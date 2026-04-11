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

## Test Accounts & Data

### Test Users (9 employees)

All test accounts use password: `password123`

| Username | Email | Department | Team | Role | Level | Org |
| --- | --- | --- | --- | --- | --- | --- |
| **admin** | admin@example.com | Frontend | Commerce Web | Frontend Dev | P6 | Tech Hub |
| **alice** | alice@example.com | Frontend | Commerce Web | Frontend Dev | P5 | Tech Hub |
| **bob** | bob@example.com | Backend | Payment Infra | Backend Dev | P5 | Tech Hub |
| **carol** | carol@example.com | Backend | Order Service | Backend Dev | P4 | Tech Hub |
| **david** | david@example.com | QA | Admin Portal | QA Engineer | P4 | Tech Hub |
| **emma** | emma@example.com | SRE | Payment Infra | DevOps/SRE | P5 | Tech Hub |
| **frank** | frank@example.com | Data | Data Platform | Backend Dev | P4 | Tech Hub |
| **grace** | grace@example.com | Mobile | Growth Mobile | Frontend Dev | P4 | Tech Hub |
| **henry** | henry@example.com | Backend | Order Service | Backend Dev | P5 | Tech Hub |

### Permission Templates (5)

| Template | Description | Rules | Capabilities |
| --- | --- | --- | --- |
| **Frontend Developer** | Standard frontend permissions | ✗ backend dir, ✓ frontend dir | Cross-project: commerce(7) |
| **Backend Developer** | Standard backend permissions | ✓ backend dir, ✗ frontend dir | Cross-project: payment(14) |
| **QA Engineer** | Read-only testing access | ✓ Read all, ✗ Edit/Write/Bash | — |
| **DevOps/SRE** | Infrastructure & deployment | ✓ All reads, ✓ infra edits, ✓ limited bash | Cross-project: all(7,14,21) |
| **Data Analyst** | Data access & analysis | ✓ data & analytics dirs, ✗ sensitive | — |

### Project Assignments

```
alice    → teamcc(1), commerce(7)         [Frontend Developer]
bob      → teamcc(1), payment(14)         [Backend Developer]
carol    → payment(14)                    [Backend Developer]
david    → teamcc(1), commerce(7)         [QA Engineer]
emma     → payment(14)                    [DevOps/SRE]
frank    → analytics(21)                  [Data Analyst]
grace    → commerce(7)                    [Frontend Developer]
henry    → teamcc(1)                      [Backend Developer]
admin    → teamcc(1)                      [Frontend + Backend Developer]
```

### Projects (4)

- **teamcc** (id: 1) - TeamSkill ClaudeCode
- **commerce** (id: 7) - Commerce Platform
- **payment** (id: 14) - Payment System
- **analytics** (id: 21) - Data Analytics

## Frontend (React + Vite)

Located in `frontend/` directory.

### Features
- 🔐 Authentication login page
- 🇨🇳 Multi-language support (Chinese/English)
- 📊 Dashboard with navigation
- 👥 Employee management (scaffold)
- 🔑 Permission templates (scaffold)
- 📋 Audit logs (scaffold)

### Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Access at: `http://localhost:5173`

## Database

Uses PostgreSQL (runs in Docker). Schema created with Drizzle ORM.

### Tables
- `users` - Employee accounts & identity
- `departments`, `teams`, `roles`, `levels`, `orgs` - Dictionaries
- `projects` - Project list
- `permission_templates` - Permission rule templates
- `user_assignments` - User-Project-Template bindings
- `api_tokens` - Refresh tokens
- `audit_log` - Activity logs

### Reseed Database

```bash
npm run seed
```
