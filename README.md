# Personal Expense Ledger

Personal Expense Ledger is a self-hosted dashboard for recording, reviewing, and understanding everyday income and expenses.

It is designed for people who want control over their financial records without sending the underlying ledger to a hosted service.

## What it helps with

- Recording income and expenses
- Tracking merchants, categories, accounts, dates, notes, and references
- Reviewing transactions in one searchable dashboard
- Understanding spending through analytics and summaries
- Exporting reports for personal use
- Using image-assisted intake through a separate helper/API boundary
- Protecting the dashboard with a login

The project is intentionally self-hosted: the database and transaction records remain on the machine where the application is deployed.

## Privacy model

Personal financial data is runtime data, not source code.

The repository contains the application, tests, migrations, and safe configuration examples. It does not contain real transactions, exports, backups, database files, credentials, or personal account data.

For a private deployment:

- keep `.env` outside Git
- use a strong dashboard password
- generate a unique `SESSION_SECRET`
- protect remote access with HTTPS and an authenticated proxy or tunnel
- review exports before sharing them
- keep Docker volumes and backups protected

The public repository is safe to inspect, but your deployed instance and its database should still be treated as private.

## Quick start with Docker

Requirements: Node.js 22+, npm, Docker Engine, and Docker Compose v2.

```bash
cp .env.example .env
# Fill in the local values; never commit .env

docker compose build
docker compose up -d
```

The dashboard is available at:

```text
http://127.0.0.1:3010
```

The default host binding is loopback-only. Use a trusted reverse proxy or tunnel when remote access is needed.

## Local development

```bash
cp .env.example .env
npm install
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
```

Use synthetic data for development and demos. Do not copy a real personal database into the repository or test fixtures.

## Configuration

The example environment file documents the available settings:

- `HOST_PORT` — local host port for the dashboard
- `DASHBOARD_PASSWORD` — password for local dashboard access
- `SESSION_SECRET` — a long, random session-signing secret
- `HERMES_API_TOKEN` — optional token for the external image-assisted intake integration

Leave optional integrations empty when they are not needed. Use different secrets for every deployment.

## Data and backups

The application stores its SQLite database in the Docker data volume. Backups should be encrypted, access-controlled, and kept separate from the source repository. Before importing or exporting data, verify that the file contains only the records you intend to handle.

## Project status

This is a working self-hosted application and portfolio project. The main ledger, analytics, export, authentication, Docker, and image-assisted intake foundations are in place. Future improvements may include richer reporting, import tools, and additional privacy controls.
