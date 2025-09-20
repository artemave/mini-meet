FROM certbot/certbot:latest

RUN apk add --no-cache curl

COPY certbot-entrypoint.sh /usr/local/bin/certbot-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/certbot-entrypoint.sh"]
