#!/bin/sh
# SQLite online backup API: consistent backup including committed WAL data.
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
chmod 700 backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
remote="/app/data/backup-$stamp.db"
out="backups/expense-$stamp.db"
docker compose exec -T expense-dashboard sqlite3 /app/data/expense.db ".backup '$remote'"
docker compose cp "expense-dashboard:$remote" "$out"
chmod 600 "$out"
docker compose exec -T expense-dashboard sqlite3 "$remote" 'PRAGMA integrity_check;'
docker compose exec -T expense-dashboard unlink "$remote"
printf 'Backup: %s/%s\n' "$PWD" "$out"
