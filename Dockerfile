# Multi-stage build for React frontend
# Switching to node:20-slim (Debian) for better support of native modules like canvas during build
FROM node:20-slim AS base

# Dependencies stage
FROM base AS deps
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
# Install all dependencies including devDependencies (needed for vite build)
RUN npm ci

# Build stage
FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend.nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
