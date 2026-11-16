#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-9071527967:AAFYfp30bl7E4wL5Ffn8dL4maCWGajexCmA}"
CHAT_ID="${TELEGRAM_CHAT_ID:--1003926247405}"

send_single_apk() {
  local apk="$1"
  local file_name
  file_name="$(basename "$apk")"
  local file_size_mb
  file_size_mb=$(du -m "$apk" | cut -f1)

  if [ "$file_size_mb" -ge 50 ]; then
    echo "⚠️ Advertencia: $file_name pesa ${file_size_mb} MB (supera el límite de 50MB de la API estándar de bots)."
    return 1
  fi

  local version
  version="$(grep '^version:' "$PROJECT_ROOT/pubspec.yaml" | awk '{print $2}')"
  local build_date
  build_date="$(date '+%Y-%m-%d %H:%M:%S')"
  local git_commit
  git_commit="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "dev")"

  local caption="📱 *Telegram Video Migrator — Mobile*
📦 Build: \`$file_name\`
🔖 Versión: \`$version\` ($git_commit)
⚖️ Peso: \`${file_size_mb} MB\`
🕒 Fecha: \`$build_date\`
⚡ Cliente nativo Flutter (BLoC, GoRouter, ScreenUtil, Cyber-Dark)"

  echo "🚀 Enviando $file_name (${file_size_mb} MB) al canal..."

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" \
    -F "chat_id=${CHAT_ID}" \
    -F "document=@${apk}" \
    -F "parse_mode=Markdown" \
    -F "caption=${caption}")

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq 200 ]; then
    echo "✅ ¡$file_name enviado con éxito a Telegram!"
  else
    echo "❌ Falló el envío de $file_name (HTTP $http_code): $body"
    return 1
  fi
}

# If an APK is provided as argument, send it
if [ -n "$1" ]; then
  send_single_apk "$1"
  exit 0
fi

# Otherwise, find the best release APKs
OUTPUT_DIR="$PROJECT_ROOT/build/app/outputs/flutter-apk"

FOUND=0
for candidate in "$OUTPUT_DIR"/app-arm64-v8a-release.apk "$OUTPUT_DIR"/app-release.apk; do
  if [ -f "$candidate" ]; then
    send_single_apk "$candidate"
    FOUND=1
    break
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "❌ No se encontró ningún APK release en $OUTPUT_DIR"
  exit 1
fi
