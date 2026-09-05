FROM node:20-slim

# Install Chromium dependencies for Puppeteer/WhatsApp
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Expose the port the app actually listens on. docker-compose injects PORT=3000
# and the nginx upstream + compose health check both target :3000, so the image
# default matches that to avoid a stale/misleading value.
EXPOSE 3000

# Create necessary directories and ensure node user can write to them
RUN mkdir -p uploads && chown -R node:node /app

# Switch to non-root user
USER node

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
    CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

# Migrations are NOT run here. Every real deploy path runs them separately and
# exactly once: docker-compose has a dedicated one-shot `migrate` service that
# backend/worker wait on (depends_on: service_completed_successfully), and Render
# uses `preDeployCommand: npm run migrate` (see server/render.yaml). Running
# `npm run migrate` in this CMD too would re-run migrations on every backend
# replica's boot (a needless race under horizontal scaling). If you ever run
# this image standalone (bare `docker run`), run `npm run migrate` first.
CMD ["npm", "start"]
