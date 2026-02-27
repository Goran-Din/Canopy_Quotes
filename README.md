# Canopy Quotes

Quoting and proposal management system for Canopy.

## Tech Stack

### Frontend
- React 18, Vite 5, TypeScript 5
- Tailwind CSS 3, Shadcn/ui
- Zustand (state), React Query (server state)
- React Hook Form + Zod (validation)
- Axios (HTTP client)

### Backend
- Node.js 20, Express 4, TypeScript 5
- Prisma ORM, PostgreSQL 16
- Zod (validation)
- Winston (logging), JWT (auth)

### Infrastructure
- Docker Compose (PostgreSQL 16, Redis 7)

## Getting Started

### Prerequisites
- Node.js 20 LTS
- Docker Desktop

### 1. Start databases

```bash
docker compose up -d
```

### 2. Set up the API

```bash
cd api
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

### 3. Set up the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:3000`.

## Project Structure

```
canopy-quotes/
  api/                  # Backend (Express + TypeScript + Prisma)
    src/
      config/           # Environment, database, logger
      middleware/        # Auth, validation, error handling
      modules/          # Feature modules
      utils/            # Shared utilities
    prisma/             # Schema and migrations
  frontend/             # React + Vite + Tailwind
    src/
      api/              # Axios API client
      components/       # Shared UI components
        ui/             # Shadcn/ui primitives
      hooks/            # Custom React hooks
      lib/              # Utilities (cn, etc.)
      pages/            # Page-level components
      stores/           # Zustand stores
      types/            # TypeScript type definitions
  docker-compose.yml    # PostgreSQL + Redis
```
