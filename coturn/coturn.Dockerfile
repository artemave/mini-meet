FROM coturn/coturn:latest

ARG TURN_SECRET
RUN test -n "$TURN_SECRET" || (echo "TURN_SECRET build arg must be provided" && false)
ENV TURN_SECRET=$TURN_SECRET

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends iproute2 \
  && rm -rf /var/lib/apt/lists/*

COPY coturn-entrypoint.sh /usr/local/bin/coturn-entrypoint.sh
COPY turnserver.conf /etc/coturn/turnserver.conf

ENTRYPOINT ["/usr/local/bin/coturn-entrypoint.sh"]
