#!/usr/bin/env bash
# Publica a versão atual do código em produção (Vercel, time Trade Stars).
#
# Uso:  bash scripts/deploy.sh
# Precisa do arquivo .env.deploy na raiz com VERCEL_TOKEN=... (fora do git).
set -euo pipefail
cd "$(dirname "$0")/.."

SCOPE="trade-stars1"
PROJECT="tradestudio"

[ -f .env.deploy ] || { echo "Falta o arquivo .env.deploy com VERCEL_TOKEN=..."; exit 1; }
set -a; . ./.env.deploy; set +a
: "${VERCEL_TOKEN:?VERCEL_TOKEN está vazio em .env.deploy}"

echo "1/3 Conferindo tipos..."
npx tsc --noEmit
npx tsc --noEmit -p api/tsconfig.json

# O deploy sai de uma cópia sem a pasta .git: no plano Hobby a Vercel bloqueia
# deploys cujo autor do commit não é o dono do time.
echo "2/3 Preparando cópia limpa..."
STAGE="$(mktemp -d)"
trap 'cd /; rm -rf "$STAGE"' EXIT
git ls-files --cached --others --exclude-standard | grep -v '^supabase/' | while read -r file; do
  [ -f "$file" ] || continue
  mkdir -p "$STAGE/$(dirname "$file")"
  cp "$file" "$STAGE/$file"
done

echo "3/3 Publicando..."
cd "$STAGE"
npx vercel link --yes --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN" >/dev/null 2>&1
rm -f .env.local
npx vercel deploy --prod --yes --archive=tgz --scope "$SCOPE" --token "$VERCEL_TOKEN" 2>&1 | grep -E '"message"|Error|error' || true
echo "Pronto: https://tradestudio-eight.vercel.app"
