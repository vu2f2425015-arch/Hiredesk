#!/usr/bin/env bash
# ==============================================================================
# HiredeskHR — Database Backup Script (PostgreSQL via Direct Connection)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/hiredeskhr/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ENCRYPTED_FILE="${BACKUP_DIR}/hiredesk_db_${TIMESTAMP}.sql.gpg"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/opt/hiredeskhr/.backup_passphrase}"
TEMP_EXPORT=""

umask 077

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

if [ ! -s "${PASSPHRASE_FILE}" ]; then
    echo "ERROR: A non-empty backup passphrase file is required at ${PASSPHRASE_FILE}. Refusing to create a plaintext database dump." >&2
    exit 1
fi

TEMP_EXPORT=$(mktemp "${BACKUP_DIR}/.hiredesk_db_${TIMESTAMP}.XXXXXX.sql")
ENCRYPTION_COMPLETE=0
trap 'rm -f "${TEMP_EXPORT}"; if [ "${ENCRYPTION_COMPLETE}" != 1 ]; then rm -f "${ENCRYPTED_FILE}"; fi' EXIT

echo "[$(date)] Exporting Supabase PostgreSQL schema and data..."
pg_dump "${DIRECT_URL}" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --format=plain \
    > "${TEMP_EXPORT}"

echo "[$(date)] Encrypting SQL dump with AES-256..."
gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase-file "${PASSPHRASE_FILE}" \
    --output "${ENCRYPTED_FILE}" "${TEMP_EXPORT}"
chmod 600 "${ENCRYPTED_FILE}"
rm -f "${TEMP_EXPORT}"
ENCRYPTION_COMPLETE=1
trap - EXIT
echo "[$(date)] Backup completed and encrypted: ${ENCRYPTED_FILE}"

# Retain local dumps for 7 days
find "${BACKUP_DIR}" -name "*.sql*" -mtime +7 -delete
