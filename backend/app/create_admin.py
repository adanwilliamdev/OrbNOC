"""Cria ou redefine um usuário admin pela linha de comando.

    python -m app.create_admin                      # usa as variáveis ADMIN_*
    python -m app.create_admin -u ana -e ana@x.com  # pergunta a senha
    python -m app.create_admin --reset -u admin     # redefine a senha de quem já existe

Com Docker:  docker compose exec backend python -m app.create_admin --reset
"""

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import or_, select

from app.api.schemas import validate_password
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import User
from app.db.session import create_engine, create_sessionmaker


async def run(username: str, email: str, password: str, reset: bool) -> str:
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = create_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            user = await session.scalar(
                select(User).where(or_(User.username == username, User.email == email.lower()))
            )
            if user is None:
                session.add(
                    User(
                        username=username,
                        email=email.lower(),
                        password_hash=hash_password(password),
                        role="admin",
                    )
                )
                message = f"Admin '{username}' criado."
            elif reset:
                user.password_hash = hash_password(password)
                user.role = "admin"
                user.is_active = True
                message = (
                    f"Senha de '{user.username}' redefinida (e a conta foi reativada como admin)."
                )
            else:
                raise SystemExit(
                    f"O usuário '{user.username}' já existe. Use --reset para redefinir a senha."
                )
            await session.commit()
            return message
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Cria ou redefine um usuário admin.")
    parser.add_argument("-u", "--username", default=settings.admin_username)
    parser.add_argument("-e", "--email", default=settings.admin_email)
    parser.add_argument("-p", "--password", help="Se omitido, usa ADMIN_PASSWORD ou pergunta.")
    parser.add_argument(
        "--reset", action="store_true", help="Redefine a senha se o usuário existir."
    )
    args = parser.parse_args(argv)

    password = args.password or settings.admin_password
    if not password:
        password = getpass.getpass("Senha: ")
        if password != getpass.getpass("Confirme a senha: "):
            sys.exit("As senhas não coincidem.")
    try:
        validate_password(password)
    except ValueError as exc:
        sys.exit(str(exc))
    print(asyncio.run(run(args.username, args.email, password, args.reset)))


if __name__ == "__main__":
    main()
