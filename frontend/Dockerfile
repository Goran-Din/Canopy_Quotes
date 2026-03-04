# ── Build stage ──
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Cache bust: 2026-03-04
ENV VITE_API_URL=https://staging-api-quotes.sunsetapp.us

RUN npm run build

# ── Production stage ──
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
