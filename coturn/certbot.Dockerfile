FROM certbot/certbot:latest

RUN apk add --no-cache curl

COPY certbot-entrypoint.sh /usr/local/bin/certbot-entrypoint.sh
COPY notify_coturn.sh /usr/local/bin/notify_coturn

ENTRYPOINT ["/usr/local/bin/certbot-entrypoint.sh"]
