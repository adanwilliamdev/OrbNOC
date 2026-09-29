"""Comandos de administração: `python -m app.cli <comando>`."""

import argparse
import asyncio
import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models import User
from app.db.session import dispose_engine, get_sessionmaker
from app.schemas.auth import validate_password_strength
from app.services.rollup import run_rollup


async def create_admin(username: str, email: str) -> None:
    password = getpass.getpass("Senha: ")
    validate_password_strength(password)
    async with get_sessionmaker()() as session:
        if await session.scalar(select(User.id).where(User.username == username.lower())):
            raise SystemExit("Esse usuário já existe.")
        session.add(
            User(
                username=username.lower(),
                email=email.lower(),
                password_hash=hash_password(password),
                role="admin",
            )
        )
        await session.commit()
    print(f"Administrador '{username}' criado.")


async def rollup() -> None:
    async with get_sessionmaker()() as session:
        print(await run_rollup(session))


def main() -> None:
    parser = argparse.ArgumentParser(prog="orbnoc")
    sub = parser.add_subparsers(dest="cmd", required=True)
    admin = sub.add_parser("create-admin", help="Cria um usuário administrador")
    admin.add_argument("username")
    admin.add_argument("email")
    sub.add_parser("rollup", help="Executa agregação por hora e retenção agora")
    args = parser.parse_args()

    async def run() -> None:
        try:
            if args.cmd == "create-admin":
                await create_admin(args.username, args.email)
            else:
                await rollup()
        finally:
            await dispose_engine()

    asyncio.run(run())


if __name__ == "__main__":
    main()
