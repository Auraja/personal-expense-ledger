#!/bin/sh
# Run once from the project root; never overwrites existing credentials.
set -eu
if [ -e .env ]; then
  printf 'Existing .env preserved.\n'
  exit 0
fi
umask 077
{
  printf 'HOST_PORT=3010\n'
  printf 'HERMES_API_TOKEN=%s\n' "$(openssl rand -hex 32)"
  printf 'DASHBOARD_PASSWORD=%s\n' "$(openssl rand -hex 18)"
  printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)"
} > .env
printf 'Created private .env; credentials are not printed.\n'
