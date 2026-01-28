"""Add clinical record history table for tracking changes

Revision ID: add_clinical_record_history
Revises: 
Create Date: 2026-01-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_clinical_record_history'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'clinical_record_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinical_record_id', sa.Integer(), nullable=False),
        sa.Column('modified_by_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('field_name', sa.String(100), nullable=True),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('change_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['clinical_record_id'], ['clinical_records.id'], ),
        sa.ForeignKeyConstraint(['modified_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_clinical_record_history_id'), 'clinical_record_history', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_clinical_record_history_id'), table_name='clinical_record_history')
    op.drop_table('clinical_record_history')
