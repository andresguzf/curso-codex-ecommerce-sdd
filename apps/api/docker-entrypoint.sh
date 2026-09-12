#!/bin/sh
set -eu

node dist/database/migrate.js
exec "$@"
