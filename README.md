# Personal Expense Ledger

A self-hosted personal expense dashboard for recording, reviewing, and exporting transactions with a privacy-first local data model.

## Features

- Transaction entry and editing
- Category, account, merchant, and date metadata
- Analytics and reporting views
- Spreadsheet export
- Image-assisted transaction intake through an external helper/API boundary
- Session-protected dashboard
- Prisma-backed SQLite persistence
- Docker Compose deployment with a loopback-only host binding

## Architecture

```text
Browser
  |
Next.js dashboard (:3000)
  |
Prisma
  |
SQLite volume (/app/data/expense.db)
```

The runtime database and personal transaction records are stored in a Docker volume and are intentionally excluded from Git.

## Development

Requirements: Node.js 22+, npm, and Docker for the container workflow.

```bash
cp .env.example .env
# Fill the local values; never commit .env
npm install
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
```

## Docker

```bash
cp .env.example .env
# Set HERMES_API_TOKEN, DASHBOARD_PASSWORD, and SESSSION_SECRET
docker compose build
docker compose up -d
```

The dashboard binds to `127.0.0.1:3010` by default. Put it behind an authenticated reverse proxy or tunnel when remote access is required.

## Security and privacy

- Never commit `.env`, database files, backups, exports, or real transaction data.
- Use generated secrets for `SESSION_SECRET`.
- Use a strong dashboard password.
- Use synthetic seed data for demos and tests.
- Review exports before sharing them.

## Status

This repository is prepared as a portfolio candidate. Production credentials and personal ledger data are kept outside the source tree.
