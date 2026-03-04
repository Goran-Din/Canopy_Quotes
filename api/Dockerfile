FROM node:20-alpine

# Chromium + dependencies for Puppeteer PDF rendering
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Storage directory for local dev PDF output
RUN mkdir -p storage/proposals

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed || true && node dist/server.js"]
