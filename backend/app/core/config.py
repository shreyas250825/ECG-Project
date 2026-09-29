from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    app_name: str = "Cardiac Digital Twin Research Platform"
    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173"

    data_dir: str = "./data"
    model_dir: str = "./backend/models"
    sample_data_dir: str = "./data/sample"

    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_role_key: str = ""

    pynq_enable: bool = False
    pynq_board_name: str = ""
    pynq_bitstream_path: str = ""
    pynq_ip: str = ""

    default_fs: float = 250.0
    default_observation_seconds: float = 300.0
    default_horizon_seconds: float = 600.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and (self.supabase_service_role_key or self.supabase_key))


settings = Settings()
