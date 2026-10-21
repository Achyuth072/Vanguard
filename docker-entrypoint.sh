#!/bin/sh
set -e

DATABASE_URL="${DATABASE_URL:-file:/data/pulse.db}"
export DATABASE_URL

case "${DATABASE_URL}" in
  file:*) DB_PATH="${DATABASE_URL#file:}" ;;
  *)
    echo "[Vanguard] ERROR: DATABASE_URL must be a local file: URL (got ${DATABASE_URL})." >&2
    exit 1
    ;;
esac
DATA_DIR="$(dirname "${DB_PATH}")"
if [ ! -d "${DATA_DIR}" ]; then
  echo "[Vanguard] ERROR: database directory ${DATA_DIR} does not exist." >&2
  exit 1
fi
if [ ! -w "${DATA_DIR}" ]; then
  echo "[Vanguard] ERROR: database directory ${DATA_DIR} is not writable by UID $(id -u)." >&2
  echo "[Vanguard] Fix ownership, e.g. chown -R 1001:1001 ${DATA_DIR}." >&2
  exit 1
fi

echo "[Vanguard] Synchronizing database schema at ${DATABASE_URL}..."
npx --no-install prisma db push --schema=prisma/schema.prisma

echo "[Vanguard] Enabling SQLite WAL journaling and busy timeout..."
node -e '
  const { createClient } = require("@libsql/client");

  (async () => {
    const client = createClient({ url: process.env.DATABASE_URL });
    await client.execute("PRAGMA journal_mode = WAL;");
    await client.execute("PRAGMA busy_timeout = 5000;");
    const result = await client.execute("PRAGMA journal_mode;");
    console.log(
      `[Vanguard] SQLite journal_mode=${result.rows[0]?.journal_mode ?? "unknown"}`
    );
    client.close();
  })().catch((error) => {
    console.error("[Vanguard] Failed to initialize SQLite WAL mode:", error);
    process.exit(1);
  });
'

echo "[Vanguard] Database ready. Starting Next.js standalone server..."
exec "$@"

