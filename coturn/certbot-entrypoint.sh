#!/bin/sh
set -eu

: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required}"
: "${TURN_DOMAIN:=turn.artem.rocks}"
: "${COTURN_CONTAINER:=coturn}"
RENEW_INTERVAL=${RENEW_INTERVAL:-12h}

issue_if_missing() {
  if [ ! -f "/etc/letsencrypt/live/${TURN_DOMAIN}/fullchain.pem" ]; then
    certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "${LETSENCRYPT_EMAIL}" \
      -d "${TURN_DOMAIN}" || return 1
  fi
  return 0
}

notify_coturn() {
  curl --fail --silent --show-error \
    --unix-socket /var/run/docker.sock \
    -X POST "http://localhost/containers/${COTURN_CONTAINER}/kill?signal=HUP"
}

while true; do
  if issue_if_missing; then
    break
  fi
  echo "[certbot] Initial certificate request failed, retrying in 30s" >&2
  sleep 30
done

while true; do
  certbot renew --standalone --quiet --deploy-hook notify_coturn || true
  sleep "${RENEW_INTERVAL}"
done
