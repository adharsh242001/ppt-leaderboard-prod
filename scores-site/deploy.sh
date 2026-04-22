#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo ".env file not found."
  echo "Create it first, for example:"
  echo "  cp .env.production.example .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env
set +a

required_vars=(
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  ADMIN_USERNAME
  ADMIN_PASSWORD
  SESSION_SECRET
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}"
    exit 1
  fi
done

mkdir -p public/photos

compose_args=(-f docker-compose.yml)
mode="app-only"

if [[ -n "${PUBLIC_DOMAIN:-}" && -n "${LETSENCRYPT_EMAIL:-}" ]]; then
  compose_args+=(-f docker-compose.proxy.yml)
  mode="https-reverse-proxy"
fi

echo "Deploy mode: ${mode}"
docker compose "${compose_args[@]}" up --build -d
docker compose "${compose_args[@]}" ps

if [[ "$mode" == "https-reverse-proxy" ]]; then
  echo ""
  echo "Expected public URL: https://${PUBLIC_DOMAIN}"
  echo "Make sure your DNS A record already points to this server."
else
  echo ""
  echo "App URL: http://localhost:${PORT:-3000}"
fi

echo ""
echo "Useful follow-up commands:"
echo "  docker compose ${compose_args[*]} logs app --tail 100"
echo "  docker compose ${compose_args[*]} logs postgres --tail 100"
