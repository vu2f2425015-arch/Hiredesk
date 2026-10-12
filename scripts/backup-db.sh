#!/usr/bin/env bash
# ==============================================================================
# HiredeskHR — Database Backup Script (PostgreSQL via Direct Connection)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/hiredeskhr/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="${BACKUP_DIR}/hiredesk_db_${TIMESTAMP}.sql"
ENCRYPTED_FILE="${EXPORT_FILE}.gpg"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/opt/hiredeskhr/.backup_passphrase}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

if [ -f "/opt/hiredeskhr/.env" ]; then
    # shellcheck disable=SC1091
    source /opt/hiredeskhr/.env
fi

if [ -z "${DIRECT_URL:-}" ]; then
    echo "ERROR: DIRECT_URL is not set. Ensure .env contains the Supabase direct connection string." >&2
    exit 1
fi

echo "[$(date)] Exporting Supabase PostgreSQL schema and data..."
pg_dump "${DIRECT_URL}" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --format=plain \
    > "${EXPORT_FILE}"

if [ -f "${PASSPHRASE_FILE}" ]; then
    echo "[$(date)] Encrypting SQL dump with AES-256..."
    gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase-file "${PASSPHRASE_FILE}" \
        --output "${ENCRYPTED_FILE}" "${EXPORT_FILE}"
    rm -f "${EXPORT_FILE}"
    chmod 600 "${ENCRYPTED_FILE}"
    echo "[$(date)] Backup completed and encrypted: ${ENCRYPTED_FILE}"
else
    chmod 600 "${EXPORT_FILE}"
    echo "[WARN] No passphrase file found at ${PASSPHRASE_FILE}. Plain SQL dump retained: ${EXPORT_FILE}"
fi

# Retain local dumps for 7 days
find "${BACKUP_DIR}" -name "*.sql*" -mtime +7 -delete
