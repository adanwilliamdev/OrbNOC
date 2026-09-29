from app.core.security import create_access_token, decrypt_secret, encrypt_secret

from .conftest import PASSWORD, login, make_user, new_client


async def test_login_define_cookie_httponly_e_nao_devolve_token(db, client):
    await make_user(db)
    r = await login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["username"] == "alice" and "token" not in body and "password_hash" not in str(body)
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "orbnoc_session=" in cookie
    assert (await client.get("/api/auth/me")).json()["user"]["username"] == "alice"


async def test_login_por_email_e_case_insensitive(db, client):
    await make_user(db)
    assert (await login(client, "ALICE@example.com")).status_code == 200


async def test_erro_generico_nao_revela_se_usuario_existe(db, client):
    await make_user(db)
    a = await login(client, "alice", "errada123")
    b = await login(client, "fantasma", "errada123")
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


async def test_usuario_inativo_nao_entra(db, client):
    await make_user(db, "carol", active=False)
    assert (await login(client, "carol")).status_code == 401


async def test_bloqueio_apos_tentativas_e_reset_no_sucesso(db, client, settings):
    await make_user(db)
    for _ in range(settings.login_max_attempts):
        assert (await login(client, "alice", "errada123")).status_code == 401
    r = await login(client, "alice", PASSWORD)  # mesmo com a senha certa
    assert r.status_code == 429 and "retry-after" in r.headers


async def test_sucesso_zera_contador(db, client, settings):
    await make_user(db)
    for _ in range(settings.login_max_attempts - 1):
        await login(client, "alice", "errada123")
    assert (await login(client, "alice")).status_code == 200
    for _ in range(settings.login_max_attempts - 1):
        assert (await login(client, "alice", "errada123")).status_code == 401


async def test_rotas_exigem_autenticacao(client):
    for method, url in [
        ("get", "/api/devices"),
        ("get", "/api/alerts"),
        ("get", "/api/reports/summary"),
        ("post", "/api/diagnostic/ping"),
    ]:
        assert (await getattr(client, method)(url)).status_code == 401


async def test_token_invalido_ou_forjado(client, settings):
    client.headers["Authorization"] = "Bearer lixo"
    assert (await client.get("/api/devices")).status_code == 401
    import jwt

    forged = jwt.encode(
        {"sub": "1", "exp": 9999999999}, "outro-segredo-qualquer-com-32-caracteres!", algorithm="HS256"
    )
    client.headers["Authorization"] = f"Bearer {forged}"
    assert (await client.get("/api/devices")).status_code == 401


async def test_bearer_funciona_para_clientes_nao_browser(db, client):
    user = await make_user(db)
    client.headers["Authorization"] = f"Bearer {create_access_token(user.id)}"
    assert (await client.get("/api/devices")).status_code == 200


async def test_logout_limpa_cookie(db, client):
    await make_user(db)
    await login(client)
    r = await client.post("/api/auth/logout")
    assert r.status_code == 200 and 'orbnoc_session=""' in r.headers["set-cookie"].lower().replace(
        "=;", '="";'
    )
    client.cookies.clear()
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_registro_desativado_por_padrao(client):
    r = await client.post(
        "/api/auth/register", json={"username": "novo", "email": "n@x.com", "password": PASSWORD}
    )
    assert r.status_code == 403


async def test_registro_quando_ativado(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "allow_registration", True)
    body = {"username": "Novo.User", "email": "N@X.com", "password": PASSWORD}
    r = await client.post("/api/auth/register", json=body)
    assert (
        r.status_code == 201
        and r.json()["user"]["username"] == "novo.user"
        and r.json()["user"]["role"] == "user"
    )
    assert (await client.post("/api/auth/register", json=body)).status_code == 409
    weak = await client.post(
        "/api/auth/register", json={**body, "username": "outro", "email": "o@x.com", "password": "12345678"}
    )
    assert weak.status_code == 422 and "letras e números" in weak.json()["error"]


async def test_registro_nao_permite_escolher_role(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "allow_registration", True)
    r = await client.post(
        "/api/auth/register",
        json={"username": "hack", "email": "h@x.com", "password": PASSWORD, "role": "admin"},
    )
    assert r.json()["user"]["role"] == "user"


async def test_somente_admin_cria_usuarios(db, client):
    await make_user(db, "alice")
    await login(client)
    body = {"username": "dave", "email": "d@x.com", "password": PASSWORD}
    assert (await client.post("/api/users", json=body)).status_code == 403
    await make_user(db, "root", role="admin")
    async with new_client() as admin:
        await login(admin, "root")
        assert (await admin.post("/api/users", json=body)).status_code == 201
        assert len((await admin.get("/api/users")).json()) == 3


async def test_csrf_origem_externa_bloqueada(db, client):
    await make_user(db)
    await login(client)
    r = await client.post("/api/alerts/ack-all", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    assert (await client.post("/api/alerts/ack-all", headers={"Origin": "http://test"})).status_code == 200
    assert (
        await client.post("/api/alerts/ack-all", headers={"Origin": "http://localhost:3000"})
    ).status_code == 200
    assert (
        await client.get("/api/devices", headers={"Origin": "https://evil.example"})
    ).status_code == 200  # leitura não muda dados


async def test_erros_seguem_formato_error(client):
    r = await client.post("/api/auth/login", json={})
    assert r.status_code == 422 and "error" in r.json()


def test_segredo_criptografado_ida_e_volta():
    enc = encrypt_secret("123456:ABC-token")
    assert "ABC" not in enc and decrypt_secret(enc) == "123456:ABC-token"
    assert decrypt_secret("lixo") is None
