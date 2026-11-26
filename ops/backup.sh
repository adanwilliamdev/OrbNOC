#!/bin/sh
# Backup do PostgreSQL do OrbNOC: pg_dump em formato custom (-Fc), com escrita atômica e rotação.
#
# Usa as variáveis padrão do libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) e:
#   BACKUP_DIR        pasta de destino (padrão: /backups)
#   BACKUP_KEEP_DAYS  dias de retenção dos dumps (padrão: 14)
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

case "$KEEP_DAYS" in
  ''|*[!0-9]*) echo "backup: BACKUP_KEEP_DAYS inválido: $KEEP_DAYS" >&2; exit 2 ;;
esac

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="$BACKUP_DIR/orbnoc-$stamp.dump"
tmp="$final.tmp"

# Nunca deixa um .tmp parcial para trás se algo falhar no meio.
trap 'rm -f "$tmp"' EXIT

echo "backup: gerando $final"
pg_dump -Fc -f "$tmp"

# Valida que o arquivo é legível antes de publicá-lo (um dump truncado não passa daqui).
pg_restore -l "$tmp" >/dev/null

# Escrita atômica: o arquivo definitivo só aparece completo.
mv "$tmp" "$final"
echo "backup: ok ($(wc -c < "$final") bytes)"

# Rotação: remove dumps antigos e restos de execuções interrompidas.
find "$BACKUP_DIR" -maxdepth 1 -name 'orbnoc-*.dump' -type f -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'orbnoc-*.dump.tmp' -type f -mmin +120 -delete
