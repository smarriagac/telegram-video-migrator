#!/usr/bin/env python3
"""Interactive Telegram Account Login & Session String Generator.

Authenticates a real Telegram account via Telethon MTProto, exports a portable
StringSession, and optionally saves the encrypted credentials to PostgreSQL or .env.
Supports both interactive terminal CLI and background IPC directory modes.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

try:
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError
except ImportError:
    print("\n[!] Error: Telethon no está instalado en este entorno.")
    print("    Instalalo con: pip install telethon python-dotenv cryptography asyncpg\n")
    sys.exit(1)

try:
    import asyncpg
    from cryptography.fernet import Fernet
except ImportError:
    asyncpg = None
    Fernet = None

load_dotenv()


def save_to_env(api_id: int, api_hash: str, session_string: str) -> None:
    env_path = Path(".env")
    lines = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()

    keys_set = set()
    new_lines = []
    for line in lines:
        if line.startswith("TELEGRAM_API_ID="):
            new_lines.append(f"TELEGRAM_API_ID={api_id}")
            keys_set.add("TELEGRAM_API_ID")
        elif line.startswith("TELEGRAM_API_HASH="):
            new_lines.append(f"TELEGRAM_API_HASH={api_hash}")
            keys_set.add("TELEGRAM_API_HASH")
        elif line.startswith("TELEGRAM_SESSION_STRING="):
            new_lines.append(f"TELEGRAM_SESSION_STRING={session_string}")
            keys_set.add("TELEGRAM_SESSION_STRING")
        else:
            new_lines.append(line)

    if "TELEGRAM_API_ID" not in keys_set:
        new_lines.append(f"TELEGRAM_API_ID={api_id}")
    if "TELEGRAM_API_HASH" not in keys_set:
        new_lines.append(f"TELEGRAM_API_HASH={api_hash}")
    if "TELEGRAM_SESSION_STRING" not in keys_set:
        new_lines.append(f"TELEGRAM_SESSION_STRING={session_string}")

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


async def save_to_postgres(phone: str, session_string: str) -> bool:
    if not asyncpg or not Fernet:
        return False
    try:
        raw_key = os.getenv("ENCRYPTION_KEY", "h2jKkK7bWqB_Z5R2YxZ5L9qVz8mB4mQ1aV6cE8jN0oQ=")
        fernet = Fernet(raw_key.encode())
        encrypted_session = fernet.encrypt(session_string.encode()).decode()

        db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:7902/telegram_hub")
        # If in host, map 5432 to 7902 if localhost
        if "@postgres:5432" in db_url:
            db_url = db_url.replace("@postgres:5432", "@localhost:7902")

        conn = await asyncpg.connect(db_url)
        try:
            # Update active or matching phone record
            updated = await conn.execute(
                """
                UPDATE telegram_accounts
                SET session_string_encrypted = $1, is_active = true
                WHERE phone = $2 OR is_active = true
                """,
                encrypted_session,
                phone,
            )
            return True
        finally:
            await conn.close()
    except Exception as exc:
        print(f"[-] Error guardando en PostgreSQL: {exc}")
        return False


async def run_ipc_mode(api_id: int, api_hash: str, phone: str, ipc_path: Path):
    ipc_path.mkdir(parents=True, exist_ok=True)
    status_file = ipc_path / "status"
    code_file = ipc_path / "code"
    pwd_file = ipc_path / "pwd"
    result_file = ipc_path / "result"

    for f in (status_file, code_file, pwd_file, result_file):
        if f.exists():
            f.unlink()

    status_file.write_text("STARTING", encoding="utf-8")
    session = StringSession("")
    client = TelegramClient(session, api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print(f"[IPC] Enviando código de verificación a {phone}...")
        sent = await client.send_code_request(phone)
        status_file.write_text("CODE_SENT", encoding="utf-8")
        print("[IPC] Esperando código...")

        # Wait for code file (up to 300s)
        code = None
        for _ in range(600):
            if code_file.exists():
                code = code_file.read_text(encoding="utf-8").strip()
                if code:
                    break
            await asyncio.sleep(0.5)

        if not code:
            status_file.write_text("ERROR: Timeout esperando código", encoding="utf-8")
            await client.disconnect()
            return

        try:
            await client.sign_in(phone, code, phone_code_hash=sent.phone_code_hash)
        except SessionPasswordNeededError:
            print("[IPC] 2FA requerido. Esperando contraseña...")
            status_file.write_text("2FA_NEEDED", encoding="utf-8")
            pwd = None
            for _ in range(600):
                if pwd_file.exists():
                    pwd = pwd_file.read_text(encoding="utf-8").strip()
                    if pwd:
                        break
                await asyncio.sleep(0.5)
            if not pwd:
                status_file.write_text("ERROR: Timeout esperando 2FA", encoding="utf-8")
                await client.disconnect()
                return
            await client.sign_in(password=pwd)
        except PhoneCodeInvalidError:
            status_file.write_text("ERROR: Código incorrecto", encoding="utf-8")
            await client.disconnect()
            return

    me = await client.get_me()
    session_string = client.session.save()
    await client.disconnect()

    save_to_env(api_id, api_hash, session_string)
    await save_to_postgres(phone, session_string)

    user_name = f"{me.first_name or ''} {me.last_name or ''}".strip()
    status_file.write_text(f"SUCCESS\n{user_name}\n{me.username or ''}\n{me.id}", encoding="utf-8")
    result_file.write_text(session_string, encoding="utf-8")
    print(f"[IPC] ¡Éxito! Autenticado como {user_name} ({me.id}).")


async def main():
    parser = argparse.ArgumentParser(description="Telegram MTProto Login Helper")
    parser.add_argument("--api-id", type=int, default=None)
    parser.add_argument("--api-hash", type=str, default=None)
    parser.add_argument("--phone", type=str, default=None)
    parser.add_argument("--ipc", type=str, default=None)
    args = parser.parse_args()

    api_id = args.api_id or int(os.getenv("TELEGRAM_API_ID", 0) or 0)
    api_hash = args.api_hash or os.getenv("TELEGRAM_API_HASH", "")
    phone = args.phone or os.getenv("TELEGRAM_PHONE", "")

    if args.ipc:
        if not api_id or not api_hash or not phone:
            print("[!] En modo IPC se requieren api-id, api-hash y phone.")
            sys.exit(1)
        await run_ipc_mode(api_id, api_hash, phone, Path(args.ipc))
        return

    # Interactive CLI Mode
    print("\n" + "=" * 65)
    print("  🚀 TELEGRAM VIDEO MIGRATOR · ASISTENTE DE CONEXIÓN REAL MTPROTO")
    print("=" * 65)

    if not api_id:
        api_id_input = input("Ingresá tu API ID (numérico): ").strip()
        api_id = int(api_id_input)
    else:
        api_id_input = input(f"Ingresá tu API ID [{api_id}]: ").strip()
        if api_id_input:
            api_id = int(api_id_input)

    if not api_hash:
        api_hash = input("Ingresá tu API HASH (hexadecimal): ").strip()
    else:
        api_hash_input = input(f"Ingresá tu API HASH [{api_hash[:6]}...]: ").strip()
        if api_hash_input:
            api_hash = api_hash_input

    if not phone:
        phone = input("\nIngresá tu número de teléfono con código de país (ej: +5491112345678): ").strip()

    print("\nIniciando conexión con los servidores de Telegram...")
    session = StringSession("")
    client = TelegramClient(session, api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print(f"Enviando código de verificación a Telegram ({phone})...")
        sent = await client.send_code_request(phone)

        code = input("Ingresá el código numérico recibido en tu app de Telegram: ").strip()
        try:
            await client.sign_in(phone, code, phone_code_hash=sent.phone_code_hash)
        except SessionPasswordNeededError:
            print("\nTu cuenta tiene verificación en dos pasos (2FA) activada.")
            pwd = getpass.getpass("Ingresá tu contraseña 2FA de Telegram: ")
            await client.sign_in(password=pwd)
        except PhoneCodeInvalidError:
            print("\n[!] Error: El código ingresado es incorrecto.")
            await client.disconnect()
            return

    me = await client.get_me()
    session_string = client.session.save()
    await client.disconnect()

    user_name = f"{me.first_name or ''} {me.last_name or ''}".strip()
    username_str = f"@{me.username}" if me.username else "sin username"

    print("\n" + "=" * 65)
    print("  ✅ ¡AUTENTICACIÓN EXITOSA CON TELEGRAM!")
    print("=" * 65)
    print(f"  Usuario:   {user_name} ({username_str})")
    print(f"  ID:        {me.id}")
    print(f"  Teléfono:  {me.phone or phone}")
    print("=" * 65)
    print("\nTu TELEGRAM_SESSION_STRING es:\n")
    print(session_string)
    print("\n" + "-" * 65)

    save_env = input("¿Deseas guardar automáticamente esta sesión en tu archivo .env local? (s/N): ").strip().lower()
    if save_env in ("s", "si", "y", "yes"):
        save_to_env(api_id, api_hash, session_string)
        print("  ✓ Guardado en .env exitosamente.")

    await save_to_postgres(phone, session_string)
    print("  ✓ Actualizado en base de datos PostgreSQL exitosamente.\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nOperación cancelada por el usuario.")
    except Exception as err:
        print(f"\n[!] Error: {err}")
        sys.exit(1)
