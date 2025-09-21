#!/bin/sh
set -eu

: "${COTURN_CONTAINER:=coturn}"

curl --fail --silent --show-error \
  --unix-socket /var/run/docker.sock \
  -X POST "http://localhost/containers/${COTURN_CONTAINER}/kill?signal=HUP"
