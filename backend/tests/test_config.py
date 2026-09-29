import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.db.session import normalize_database_url

GOOD = "x" * 40


def test_producao_exige_jwt_forte():
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="curto")
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="change_this_in_production")
    with pytest.raises(ValidationError):
        Settings(environment="production")  # segredo de desenvolvimento
    assert Settings(environment="production", jwt_secret=GOOD).secure_cookies is True


def test_producao_exige_senha_admin_forte():
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret=GOOD, admin_password="123")


def test_samesite_none_exige_cookie_seguro():
    with pytest.raises(ValidationError):
        Settings(environment="development", cookie_samesite="none")
    assert Settings(environment="development", cookie_samesite="none", cookie_secure=True)


def test_docs_desligadas_em_producao():
    assert Settings(environment="production", jwt_secret=GOOD).docs_enabled is False
    assert Settings(environment="development").docs_enabled is True


def test_origens_normalizadas():
    s = Settings(frontend_url="https://app.exemplo.com/", extra_cors_origins=" https://b.com/ , ")
    assert s.allowed_origins == ["https://app.exemplo.com", "https://b.com"]


def test_normaliza_url_do_banco():
    url, args = normalize_database_url("postgres://u:p@h:5432/db?sslmode=require&channel_binding=require")
    assert url == "postgresql+asyncpg://u:p@h:5432/db" and args["ssl"] == "require"
    assert args["server_settings"]["timezone"] == "UTC"
    assert "ssl" not in normalize_database_url("postgresql://u:p@h/db")[1]


def test_variavel_vazia_equivale_a_nao_definida(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "")
    monkeypatch.setenv("COOKIE_SECURE", "")
    s = Settings(environment="production", jwt_secret=GOOD)
    assert s.admin_password is None and s.secure_cookies is True
