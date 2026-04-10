#!/bin/sh
set -eu

attempt=0

while true
do
  if npx prisma db push --skip-generate >/tmp/prisma-db-push.log 2>&1; then
    cat /tmp/prisma-db-push.log
    break
  fi

  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    echo "Database setup failed after 20 attempts."
    cat /tmp/prisma-db-push.log
    exit 1
  fi

  echo "Database not ready yet. Retrying in 3 seconds... ($attempt/20)"
  sleep 3
done

exec node server.js
