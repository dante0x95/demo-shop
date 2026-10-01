#!/usr/bin/env bash
# Recreates the dedicated E2E database, runs migrations and creates the admin user.
# Invoked by the Playwright webServer before `medusa develop`.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MAINTENANCE_DATABASE_URL:?MAINTENANCE_DATABASE_URL is required}"
: "${E2E_DB_NAME:?E2E_DB_NAME is required}"
: "${E2E_ADMIN_EMAIL:?E2E_ADMIN_EMAIL is required}"
: "${E2E_ADMIN_PASSWORD:?E2E_ADMIN_PASSWORD is required}"

# Never drop anything but the E2E database.
case "$E2E_DB_NAME" in
  *_e2e) ;;
  *) echo "Refusing to reset database \"$E2E_DB_NAME\": name must end in _e2e" >&2; exit 1 ;;
esac

psql "$MAINTENANCE_DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS \"$E2E_DB_NAME\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$E2E_DB_NAME\""

npx medusa db:migrate
npx medusa user -e "$E2E_ADMIN_EMAIL" -p "$E2E_ADMIN_PASSWORD"
