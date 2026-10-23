"""Every route the app serves, including those inside included routers.

FastAPI 0.159 keeps included routers as nested objects, so looping over app.routes
only sees a handful of top-level routes. Security tests must use this instead."""
from fastapi.routing import APIRoute


def api_routes(app):
    """Yield (path, methods, dependant) for every HTTP API route."""
    for r in app.routes:
        if isinstance(r, APIRoute):
            yield r.path, set(r.methods), r.dependant
        elif hasattr(r, "effective_route_contexts"):
            for c in r.effective_route_contexts():
                if c.methods and c.dependant is not None:
                    yield c.path, set(c.methods), c.dependant
