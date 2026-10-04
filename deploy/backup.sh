#!/bin/sh
# Daily database backup. Add to crontab on the VPS:
#   15 3 * * * /opt/landrush/deploy/backup.sh >> /var/log/landrush-backup.log 2>&1
set -eu
cd "$(dirname "$0")"
mkdir -p backups
FILE="backups/landrush-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U landrush landrush | gzip > "$FILE"
# Keep two weeks of backups on the server.
find backups -name 'landrush-*.sql.gz' -mtime +14 -delete
echo "backup ok: $FILE"
