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

# Create necessary directories and ensure node user can write to them, and
# make the entrypoint script executable (COPY doesn't reliably preserve the
# exec bit across platforms/checkouts).
RUN mkdir -p uploads && chmod +x docker-entrypoint.sh && chown -R node:node /app

# Switch to non-root user
USER node

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
    CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

# Run pending migrations, then exec into the server -- see docker-entrypoint.sh
# for why this lives here (Render's actual production service runs on the
# free plan, where Pre-Deploy Command is locked, and a hand-typed Docker
# Command override in the dashboard is not a substitute: it isn't version
# controlled and doesn't behave like a real shell -- `&&` typed there doesn't
# chain commands the way it looks like it should).
#
# docker-compose overrides this CMD for `worker` (`command: ["npm", "run",
# "start:worker"]`) and already runs migrations exactly once via its own
# dedicated `migrate` service ahead of both `backend` and `worker` -- so
# `backend` running this entrypoint under compose just re-checks for pending
# migrations redundantly (a fast no-op when there are none), it does not
# re-apply anything.
CMD ["./docker-entrypoint.sh"]
