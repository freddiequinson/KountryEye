from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db(request: Request):
    async with async_session_maker() as session:
        session.info.update(ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent", "")[:255])
        try:
            yield session
        finally:
            await session.close()


def _add_missing_columns(sync_conn):
    """create_all() never alters existing tables, so add any model columns the
    database doesn't have yet. Only ever ADDs nullable columns; never drops or changes."""
    import logging
    from sqlalchemy import inspect
    log = logging.getLogger("app.migrate")
    insp = inspect(sync_conn)
    existing_tables = set(insp.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in have or col.primary_key:
                continue
            col_type = col.type.compile(dialect=sync_conn.dialect)
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'
            # Existing rows get `info={"backfill": value}` when set, else the column default
            if "backfill" in col.info:
                default = col.info["backfill"]
            else:
                default = getattr(col.default, "arg", None) if col.default is not None else None
            if isinstance(default, bool):
                ddl += f" DEFAULT {1 if default else 0}"
            elif isinstance(default, (int, float)):
                ddl += f" DEFAULT {default}"
            elif isinstance(default, str):
                ddl += " DEFAULT '" + default.replace("'", "''") + "'"
            sync_conn.exec_driver_sql(ddl)
            log.warning("Added column %s.%s", table.name, col.name)
        # Indexes (incl. unique ones) on columns added after the table was created
        have_idx = {i["name"] for i in insp.get_indexes(table.name)}
        for idx in table.indexes:
            if idx.name not in have_idx:
                # A unique index fails if old data has duplicates: log it and carry on
                try:
                    with sync_conn.begin_nested():
                        idx.create(sync_conn, checkfirst=True)
                    log.warning("Added index %s", idx.name)
                except Exception as exc:  # noqa: BLE001
                    log.error("Could not add index %s (existing duplicate data?): %s", idx.name, exc)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if engine.dialect.name == "sqlite":
            await conn.run_sync(_add_missing_columns)
