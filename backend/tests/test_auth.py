from sqlalchemy import select

from app.db.models import AccessLog, User

from .conftest import create_user, login


async def test_login_sets_httponly_cookie_and_returns_no_token(client, sessionmaker):
    await create_user(sessionmaker)
    resp = await login(client)
    body = resp.json()
    assert body["user"]["username"] == "alice" and "token" not in body
    cookie = resp.headers["set-cookie"].lower()
    assert "orbnoc_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert "password" not in resp.text


async def test_login_with_email(client, sessionmaker):
    await create_user(sessionmaker)
    resp = await client.post(
        "/api/auth/login", json={"username": "ALICE@example.com", "password": "Senha1234"}
    )
    assert resp.status_code == 200


async def test_wrong_password_and_unknown_user_look_the_same(client, sessionmaker):
    await create_user(sessionmaker)
    a = await client.post("/api/auth/login", json={"username": "alice", "password": "errada123"})
    b = await client.post("/api/auth/login", json={"username": "ninguem", "password": "errada123"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


async def test_login_rate_limit(client, sessionmaker, settings):
    await create_user(sessionmaker)
    for _ in range(settings.login_max_attempts):
        r = await client.post(
            "/api/auth/login", json={"username": "alice", "password": "errada123"}
        )
        assert r.status_code == 401
    r = await client.post("/api/auth/login", json={"username": "alice", "password": "Senha1234"})
    assert r.status_code == 429  # bloqueado mesmo com a senha certa


async def test_success_clears_rate_limit_counter(client, sessionmaker):
    await create_user(sessionmaker)
    for _ in range(3):
        await client.post("/api/auth/login", json={"username": "alice", "password": "errada123"})
    await login(client)
    for _ in range(3):
        await client.post("/api/auth/login", json={"username": "alice", "password": "errada123"})
    assert (await login(client)).status_code == 200


async def test_me_requires_auth_and_logout_clears(client, sessionmaker):
    assert (await client.get("/api/auth/me")).status_code == 401
    await create_user(sessionmaker)
    await login(client)
    assert (await client.get("/api/auth/me")).json()["username"] == "alice"
    out = await client.post("/api/auth/logout")
    assert out.status_code == 200
    client.cookies.clear()
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_tampered_cookie_rejected(client):
    client.cookies.set("orbnoc_session", "abc.def.ghi")
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_inactive_user_cannot_login_or_use_session(client, sessionmaker):
    uid = await create_user(sessionmaker)
    await login(client)
    async with sessionmaker() as s:
        (await s.get(User, uid)).is_active = False
        await s.commit()
    assert (await client.get("/api/auth/me")).status_code == 401
    r = await client.post("/api/auth/login", json={"username": "alice", "password": "Senha1234"})
    assert r.status_code == 401


async def test_registration_disabled_by_default(client):
    cfg = await client.get("/api/auth/config")
    assert cfg.json() == {"registration_enabled": False}
    r = await client.post(
        "/api/auth/register",
        json={"username": "novo", "email": "n@example.com", "password": "Senha1234"},
    )
    assert r.status_code == 403


async def test_registration_when_enabled(app, client, settings):
    settings.registration_enabled = True
    try:
        r = await client.post(
            "/api/auth/register",
            json={"username": "novo", "email": "n@example.com", "password": "Senha1234"},
        )
        assert r.status_code == 201 and r.json()["user"]["role"] == "user"
        dup = await client.post(
            "/api/auth/register",
            json={"username": "novo", "email": "x@example.com", "password": "Senha1234"},
        )
        assert dup.status_code == 409
        weak = await client.post(
            "/api/auth/register",
            json={"username": "fraco", "email": "f@example.com", "password": "abcdefgh"},
        )
        assert weak.status_code == 422
    finally:
        settings.registration_enabled = False


async def test_password_is_argon2(client, sessionmaker):
    await create_user(sessionmaker)
    async with sessionmaker() as s:
        h = (await s.scalar(select(User).where(User.username == "alice"))).password_hash
    assert h.startswith("$argon2")


async def test_access_log_written(client, sessionmaker):
    await create_user(sessionmaker)
    await login(client)
    await client.post("/api/auth/logout")
    async with sessionmaker() as s:
        actions = [
            a.action for a in (await s.scalars(select(AccessLog).order_by(AccessLog.id))).all()
        ]
    assert actions == ["login", "logout"]


async def test_csrf_foreign_origin_blocked(alice):
    r = await alice.post(
        "/api/devices",
        json={"name": "x", "ip": "10.0.0.9"},
        headers={"Origin": "https://evil.example"},
    )
    assert r.status_code == 403
    ok = await alice.post(
        "/api/devices", json={"name": "x", "ip": "10.0.0.9"}, headers={"Origin": "http://test"}
    )
    assert ok.status_code == 201  # mesma origem (Host)


async def test_admin_manages_users(client, sessionmaker):
    await create_user(sessionmaker, "root", "Admin12345", role="admin")
    await login(client, "root", "Admin12345")
    r = await client.post(
        "/api/users",
        json={"username": "carol", "email": "carol@example.com", "password": "Senha1234"},
    )
    assert r.status_code == 201
    uid = r.json()["id"]
    assert len((await client.get("/api/users")).json()) == 2
    assert (await client.patch(f"/api/users/{uid}", json={"is_active": False})).json()[
        "is_active"
    ] is False


async def test_last_admin_cannot_be_demoted(client, sessionmaker):
    rid = await create_user(sessionmaker, "root", "Admin12345", role="admin")
    await login(client, "root", "Admin12345")
    r = await client.patch(f"/api/users/{rid}", json={"role": "user"})
    assert r.status_code == 409


async def test_regular_user_cannot_use_admin_routes(alice):
    assert (await alice.get("/api/users")).status_code == 403
    r = await alice.post(
        "/api/users", json={"username": "x1x", "email": "x@example.com", "password": "Senha1234"}
    )
    assert r.status_code == 403


# ---- gestão de usuários pelo admin -----------------------------------------------------------
async def _admin(client, sessionmaker):
    await create_user(sessionmaker, "root", "Admin12345", role="admin")
    await login(client, "root", "Admin12345")


async def test_admin_list_has_dates_and_never_hashes(client, sessionmaker):
    await _admin(client, sessionmaker)
    rows = (await client.get("/api/users")).json()
    assert rows[0]["username"] == "root" and rows[0]["created_at"] and "last_login" in rows[0]
    assert "password" not in (await client.get("/api/users")).text


async def test_created_user_can_log_in_and_sees_only_own_data(app, client, sessionmaker):
    import httpx

    await _admin(client, sessionmaker)
    r = await client.post(
        "/api/users", json={"username": "carol", "email": "c@example.com", "password": "Senha1234"}
    )
    assert r.status_code == 201 and r.json()["role"] == "user"
    await client.post("/api/devices", json={"name": "do-admin", "ip": "10.0.0.1"})
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as carol:
        await login(carol, "carol", "Senha1234")
        assert (await carol.get("/api/devices")).json() == []
        assert (await carol.get("/api/users")).status_code == 403


async def test_admin_resets_password(client, app, sessionmaker):
    import httpx

    await _admin(client, sessionmaker)
    uid = await create_user(sessionmaker, "dave")
    r = await client.patch(f"/api/users/{uid}", json={"password": "NovaSenha99"})
    assert r.status_code == 200
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as dave:
        old = await dave.post("/api/auth/login", json={"username": "dave", "password": "Senha1234"})
        assert old.status_code == 401
        await login(dave, "dave", "NovaSenha99")
    weak = await client.patch(f"/api/users/{uid}", json={"password": "curta"})
    assert weak.status_code == 422


async def test_admin_cannot_deactivate_or_delete_self(client, sessionmaker):
    await create_user(sessionmaker, "other", "Admin12345", role="admin")
    rid = await create_user(sessionmaker, "root", "Admin12345", role="admin")
    await login(client, "root", "Admin12345")
    assert (await client.patch(f"/api/users/{rid}", json={"is_active": False})).status_code == 409
    assert (await client.patch(f"/api/users/{rid}", json={"role": "user"})).status_code == 409
    assert (await client.delete(f"/api/users/{rid}")).status_code == 409


async def test_delete_user_cascades_and_last_admin_protected(client, sessionmaker):
    from sqlalchemy import func

    from app.db.models import Device

    await _admin(client, sessionmaker)
    uid = await create_user(sessionmaker, "erin")
    async with sessionmaker() as s:
        s.add(Device(user_id=uid, name="d", ip="10.0.0.9"))
        await s.commit()
    assert (await client.delete(f"/api/users/{uid}")).json() == {"success": True}
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(Device)) == 0
    assert (await client.delete("/api/users/999")).status_code == 404


async def test_regular_user_cannot_delete_users(alice):
    assert (await alice.delete("/api/users/1")).status_code == 403
