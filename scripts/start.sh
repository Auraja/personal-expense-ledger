#!/bin/sh
set -eu
: "${HERMES_API_TOKEN:?Missing HERMES_API_TOKEN}"
: "${DASHBOARD_PASSWORD:?Missing DASHBOARD_PASSWORD}"
: "${SESSION_SECRET:?Missing SESSION_SECRET}"
mkdir -p /app/data
printf 'Ledger: applying database migrations\n'
./node_modules/.bin/prisma migrate deploy
printf 'Ledger: initializing defaults\n'
./node_modules/.bin/tsx prisma/seed.ts
printf 'Ledger: starting production server\n'
exec ./node_modules/.bin/next start -H 0.0.0.0 -p 3000
