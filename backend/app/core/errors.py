from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class ResearchError(Exception):
    def __init__(self, message: str, code: str = "research_error", status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


async def research_error_handler(_request: Request, exc: ResearchError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message, "clinical": False},
    )


async def http_error_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "message": exc.detail, "clinical": False},
    )
