#!/usr/bin/env sh
# Re-creates a test database: two users and the fixture thoughts.
#   admin@qoddy.test / qoddy-admin   (admin)
#   reader@qoddy.test / qoddy-reader (user)
# Usage: scripts/test-db.sh [db-file]   (default: qoddy-test.db)
# Then:  DATABASE_PATH=qoddy-test.db pnpm dev
set -eu
cd "$(dirname "$0")/.."
export DATABASE_PATH="${1:-qoddy-test.db}"
rm -f "$DATABASE_PATH" "$DATABASE_PATH-shm" "$DATABASE_PATH-wal"
echo qoddy-admin | pnpm -s qoddy create-user admin@qoddy.test "Ada Admin" --admin
echo qoddy-reader | pnpm -s qoddy create-user reader@qoddy.test "Rita Reader"
pnpm -s qoddy import fixtures/thoughts.csv
pnpm -s qoddy add-collection stoics Stoics
pnpm -s qoddy import fixtures/stoics.csv --collection stoics
echo "test database ready: $DATABASE_PATH"
