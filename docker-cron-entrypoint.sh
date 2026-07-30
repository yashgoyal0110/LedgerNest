#!/bin/sh
set -e

printenv | grep -E '^(DATABASE_URL|BETTER_AUTH_SECRET|UPLOAD_PATH|NODE_ENV|BASE_URL|GEMINI_API_KEY|GOOGLE_MODEL_NAME|CRON_SECRET|PATH)=' > /etc/cron.env
chmod 0644 /etc/cron.env

cp /mnt/crontab /tmp/crontab
chmod 0644 /tmp/crontab
crontab /tmp/crontab

touch /var/log/cron.log
cron
exec tail -F /var/log/cron.log
