FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies (production only)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app source
COPY src ./src
COPY public ./public
COPY README.md AGENTS.md ./

ENV NODE_ENV=production

# Start the server (Dokku sets PORT at runtime)
CMD ["node", "src/server.js"]
