"""Testes de app/security.py — hashing de senha e emissão/validação de JWT."""
import time

import jwt
import pytest

from app import config, security


def test_hash_password_is_not_plaintext():
    hashed = security.hash_password("mypassword123")
    assert hashed != "mypassword123"
    assert hashed.startswith("$2b$")


def test_verify_password_correct():
    hashed = security.hash_password("mypassword123")
    assert security.verify_password("mypassword123", hashed) is True


def test_verify_password_incorrect():
    hashed = security.hash_password("mypassword123")
    assert security.verify_password("wrongpassword", hashed) is False


def test_verify_password_invalid_hash_does_not_raise():
    # Hash malformado não deve derrubar a aplicação com uma exceção não tratada.
    assert security.verify_password("anything", "not-a-real-hash") is False


def test_issue_and_decode_token_roundtrip():
    user = {"id": 42, "username": "alice", "role": "user"}
    token = security.issue_token(user)

    payload = security.decode_token(token)

    assert payload["id"] == 42
    assert payload["username"] == "alice"
    assert payload["role"] == "user"


def test_decode_token_rejects_tampered_signature():
    user = {"id": 1, "username": "bob", "role": "admin"}
    token = security.issue_token(user)
    tampered = token[:-2] + ("aa" if token[-2:] != "aa" else "bb")

    with pytest.raises(jwt.PyJWTError):
        security.decode_token(tampered)


def test_decode_token_rejects_expired_token():
    user = {"id": 1, "username": "carol", "role": "user"}
    payload = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "iat": int(time.time()) - 100,
        "exp": int(time.time()) - 10,  # já expirado
    }
    expired_token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)

    with pytest.raises(jwt.ExpiredSignatureError):
        security.decode_token(expired_token)


def test_to_public_user_excludes_password():
    user = {"id": 1, "username": "dave", "email": "dave@example.com", "role": "user", "password": "hash"}
    public = security.to_public_user(user)

    assert "password" not in public
    assert public == {"id": 1, "username": "dave", "email": "dave@example.com", "role": "user"}
