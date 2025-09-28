FROM node:24-alpine AS base
WORKDIR /app

# Install dependencies (production only)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app source
COPY src ./src
COPY public ./public

ENV NODE_ENV=production

RUN node --run build

# Start the server (Dokku sets PORT at runtime)
CMD ["node", "src/server.js"]
