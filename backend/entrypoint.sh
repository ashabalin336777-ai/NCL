#!/bin/sh
set -e

python -m app.db.wait
alembic upgrade head
python -m app.db.seed

if [ "${APP_ENV}" = "production" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips="*"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --proxy-headers --forwarded-allow-ips="*"
