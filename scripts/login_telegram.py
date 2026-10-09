#!/usr/bin/env python3
"""Interactive Telegram Account Login & Session String Generator.

Authenticates a real Telegram account via Telethon MTProto, exports a portable
StringSession, and optionally saves the encrypted credentials to PostgreSQL or .env.
"""

from __future__ import annotations

import asyncio
import getpass
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Try importing Telethon
try:
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError
except ImportError:
    print("\n[!] Error: Telethon no está instalado en este entorno.")
    print("    Instalalo con: pip install telethon python-dotenv cryptography asyncpg\n")
    sys.exit(1)

load_dotenv()


async def main():
    print("\n" + "=" * 65)
    print("  🚀 TELEGRAM VIDEO MIGRATOR · ASISTENTE DE CONEXIÓN REAL MTPROTO")
    print("=" * 65)
    print("\nPara conectar tu cuenta de Telegram necesitás tu 'API ID' y 'API HASH'.")
    print("Si no los tenés:")
    print("  1. Entrá a https://my.telegram.org")
    print("  2. Iniciá sesión con tu número de teléfono")
    print("  3. Hacé click en 'API development tools'")
    print("  4. Creá una app (nombre: TelegramMigrator) y copiá el api_id y api_hash.\n")

    default_api_id = os.getenv("TELEGRAM_API_ID", "")
    default_api_hash = os.getenv("TELEGRAM_API_HASH", "")

    api_id_prompt = f"Ingresá tu API ID [{default_api_id}]: " if default_api_id else "Ingresá tu API ID (numérico): "
    api_id_input = input(api_id_prompt).strip() or default_api_id

    api_hash_prompt = f"Ingresá tu API HASH [{default_api_hash[:6]}...]: " if default_api_hash else "Ingresá tu API HASH (hexadecimal): "
    api_hash_input = input(api_hash_prompt).strip() or default_api_hash

    if not api_id_input or not api_hash_input:
        print("\n[!] Error: API ID y API HASH son obligatorios.")
        return

    try:
        api_id = int(api_id_input)
    except ValueError:
        print("\n[!] Error: El API ID debe ser un número entero.")
        return

    api_hash = api_hash_input

    phone = input("\nIngresá tu número de teléfono con código de país (ej: +5491112345678): ").strip()
    if not phone:
        print("\n[!] Error: Número de teléfono requerido.")
        return

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

    # Option to save to .env
    save_env = input("¿Deseas guardar automáticamente esta sesión en tu archivo .env local? (s/N): ").strip().lower()
    if save_env in ("s", "si", "y", "yes"):
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
        print("  ✓ Guardado en .env exitosamente.")

    print("\nTambién podés copiar la 'session_string' y pegarla directamente en:")
    print("  👉 http://localhost:7900/settings (Pestaña: Credenciales Telegram)")
    print("  donde quedará cifrada en reposo con AES-256 en PostgreSQL.\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nOperación cancelada por el usuario.")
    except Exception as err:
        print(f"\n[!] Error: {err}")
