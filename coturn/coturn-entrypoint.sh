#!/bin/sh
set -eu

TURN_DOMAIN=${TURN_DOMAIN:-turn.artem.rocks}
TURN_SECRET=${TURN_SECRET:?TURN_SECRET not set}

while [ ! -f "/etc/letsencrypt/live/${TURN_DOMAIN}/fullchain.pem" ]; do
  echo "Waiting for certificate for ${TURN_DOMAIN}..."
  sleep 5
done

exec turnserver \
  --config=/etc/coturn/turnserver.conf \
  --use-auth-secret \
  --static-auth-secret="${TURN_SECRET}"
