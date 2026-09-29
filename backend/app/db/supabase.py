"""Optional Supabase REST client. Never required for local research demo."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


class SupabaseClient:
    def __init__(self) -> None:
        self.enabled = settings.supabase_configured
        self.url = settings.supabase_url.rstrip("/") if settings.supabase_url else ""
        self.key = settings.supabase_service_role_key or settings.supabase_key

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def health(self) -> dict[str, Any]:
        if not self.enabled:
            return {"configured": False, "reachable": False, "reason": "SUPABASE_URL/KEY not set"}
        try:
            r = httpx.get(f"{self.url}/rest/v1/", headers=self._headers(), timeout=5.0)
            return {"configured": True, "reachable": r.status_code < 500, "status_code": r.status_code}
        except Exception as exc:
            log.warning("supabase_unreachable", extra={"event": "supabase_health"})
            return {"configured": True, "reachable": False, "reason": str(exc)}


supabase_client = SupabaseClient()
