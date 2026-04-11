# teamcc-admin

Identity & Permission Management Platform for TeamSkill ClaudeCode.

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
# Start dev server
npm run dev

# Type checking
npm run typecheck

# Generate database migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

### Build & Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
  api/           # REST API route handlers
  db/            # Database schema & initialization
  services/      # Business logic (auth, policy, etc.)
  types/         # Shared TypeScript types
  main.ts        # Server entry point
```

## Architecture

This project implements the backend for the identity & permission platform as described in `../TeamSkill-ClaudeCode/docs/architecture/身份与权限平台化方案.md`.

- **V1**: SQLite + Fastify + JWT auth
- **V2**: Postgres + SSO/OIDC + Audit Dashboard

## API Overview

### Authentication
- `POST /auth/login` - Login with username/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout & revoke refresh token

### Client Endpoints
- `GET /identity/me` - Get current user identity
- `GET /policy/bundle?projectId=<n>` - Get permission bundle for project

### Admin Endpoints (require `admin` role)
- `GET/POST/PUT/DELETE /admin/users`
- `GET/POST/PUT/DELETE /admin/templates`
- `POST/DELETE /admin/users/:id/assignments`
- `GET /admin/audit`
- `GET /admin/dictionaries`

## Environment Variables

Create a `.env` file (see `.env.example`):

```
PORT=3000
HOST=127.0.0.1
DATABASE_PATH=./teamcc-admin.db
JWT_SECRET=your-secret-key-here
```

## Wire Schema

This project uses a shared wire schema with the teamcc client. See `src/types/wire.ts`.

- `IdentityEnvelope` - User identity information
- `PermissionBundle` - Permission rules & capabilities for a project
- `AuthResponse` - Authentication token response
