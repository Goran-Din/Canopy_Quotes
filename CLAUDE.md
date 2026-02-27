# Canopy Quotes - Project Configuration

## Technology Stack (LOCKED - Do Not Change)
- Language: TypeScript 5.x (strict mode, ES Modules only)
- Frontend: React 18 + Vite 5 (NOT Next.js)
- UI Components: Shadcn/ui + Tailwind CSS 3.x
- State: Zustand (global) + React Query (server state)
- Backend: Node.js 20 LTS + Express 4
- Database: PostgreSQL 16 via Prisma ORM
- Auth: JWT RS256 + httpOnly refresh cookie (15min access / 30day refresh)
- Validation: Zod (both frontend and backend)
- Forms: React Hook Form + Zod
- HTTP Client: Axios
- Dates: date-fns
- Icons: Lucide React
- Charts: Recharts
- Logging: Winston (structured JSON)
- Caching: Redis
- Scheduling: node-cron (background jobs)
- Containers: Docker + Docker Compose

## Architecture Rules
- UUID primary keys on all tables
- Soft delete via deleted_at column (never hard delete)
- updated_at triggers on all tables
- CommonJS (require) is PROHIBITED. Use ES Modules (import/export).
- Every API endpoint validates with Zod schemas
- Prisma for all database access (no raw SQL unless absolutely necessary)

## Project Structure
canopy-quotes/
  api/              # Backend (Express + TypeScript + Prisma)
    src/
      config/       # Environment, database, logger
      middleware/    # Auth, validation, error handling
      modules/      # Feature modules
        [module]/
          controller.ts   # Route handlers
          service.ts      # Business logic
          schema.ts       # Zod validation schemas
          routes.ts       # Express route definitions
      utils/        # Shared utilities
    prisma/
      schema.prisma # Database schema
  frontend/         # React + Vite + Tailwind
    src/
      components/   # Shared UI components
        ui/         # Shadcn/ui primitives
      pages/        # Page-level components
      stores/       # Zustand stores
      hooks/        # Custom React hooks
      api/          # Axios API client
      lib/          # Utilities
      types/        # TypeScript type definitions
  docker-compose.yml
