FROM coturn/coturn:latest

ARG TURN_SECRET
RUN test -n "$TURN_SECRET" || (echo "TURN_SECRET build arg must be provided" && false)
ENV TURN_SECRET=$TURN_SECRET

COPY coturn-entrypoint.sh /usr/local/bin/coturn-entrypoint.sh
COPY turnserver.conf /etc/coturn/turnserver.conf

ENTRYPOINT ["/usr/local/bin/coturn-entrypoint.sh"]
