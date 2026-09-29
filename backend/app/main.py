from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.core.errors import ResearchError, http_error_handler, research_error_handler
from app.core.logging import configure_logging
from app.services.analysis import ensure_demo_record
from app.websocket.ecg_stream import ws_router
from fastapi import HTTPException

configure_logging()

app = FastAPI(
    title=settings.app_name,
    description=(
        "Research prototype for patient-specific ECG analysis and experimental "
        "ventricular-arrhythmia risk forecasting. Not for clinical diagnosis."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ResearchError, research_error_handler)
app.add_exception_handler(HTTPException, http_error_handler)

app.include_router(router, prefix="/api")
app.include_router(ws_router)


@app.on_event("startup")
def startup() -> None:
    ensure_demo_record()
