#!/bin/sh
set -eu
export DATABASE_URL=file:/tmp/expense-backend-test.db
npx prisma migrate deploy
npx tsx prisma/seed.ts
npx tsx prisma/seed.ts
npx tsx --test tests/backend.test.ts
