#!/bin/sh
# Teste de restauração: restaura o dump mais recente num banco temporário, confere as tabelas
# principais e a contagem de usuários contra a origem, e remove o banco temporário no fim.
#
# Usa as variáveis padrão do libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE = banco de origem).
# O usuário precisa poder criar bancos (o POSTGRES_USER do compose pode).
#   BACKUP_DIR               pasta dos dumps (padrão: /backups)
#   RESTORE_USERS_TOLERANCE  diferença aceita na contagem de users, para origens com escrita
#                            entre o dump e o teste (padrão: 0)
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TOLERANCE="${RESTORE_USERS_TOLERANCE:-0}"
SOURCE_DB="${PGDATABASE:-orbnoc}"
TEST_DB="orbnoc_restore_test_$$"

latest=""
for f in "$BACKUP_DIR"/orbnoc-*.dump; do
  [ -f "$f" ] || continue
  if [ -z "$latest" ] || [ "$f" -nt "$latest" ]; then latest="$f"; fi
done
if [ -z "$latest" ]; then
  echo "restore-test: nenhum dump em $BACKUP_DIR" >&2
  exit 1
fi
echo "restore-test: dump mais recente: $latest"

# Banco de manutenção para criar/remover o banco descartável.
admin() { psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"; }
# $1 = banco, $2 = SQL; devolve só o valor.
scalar() { psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$1" -c "$2"; }

cleanup() {
  admin -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT

admin -c "CREATE DATABASE \"$TEST_DB\""
pg_restore --exit-on-error --no-owner --no-privileges -d "$TEST_DB" "$latest"

for t in users devices metrics; do
  found="$(scalar "$TEST_DB" "SELECT to_regclass('public.$t') IS NOT NULL")"
  if [ "$found" != "t" ]; then
    echo "restore-test: tabela $t ausente no banco restaurado" >&2
    exit 1
  fi
done

restored="$(scalar "$TEST_DB" 'SELECT count(*) FROM users')"
origin="$(scalar "$SOURCE_DB" 'SELECT count(*) FROM users')"
diff=$((restored - origin))
[ "$diff" -lt 0 ] && diff=$((-diff))
if [ "$diff" -gt "$TOLERANCE" ]; then
  echo "restore-test: users diverge (origem=$origin, restaurado=$restored, tolerância=$TOLERANCE)" >&2
  exit 1
fi

echo "restore-test: ok (users: origem=$origin, restaurado=$restored; tabelas users/devices/metrics presentes)"
