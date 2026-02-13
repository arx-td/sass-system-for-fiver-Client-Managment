# DEEPAXIS Management System

A comprehensive **internal SaaS platform** for managing Fiverr-based freelance projects. Built for agencies handling multiple Fiverr accounts with strict role-based access control (RBAC) and real-time collaboration features.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Role-Based Access Control](#role-based-access-control)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [WebSocket Events](#websocket-events)
- [n8n Automation](#n8n-automation)
- [Desktop Application](#desktop-application)
- [Contributing](#contributing)

---

## Overview

DEEPAXIS Management System is designed for **internal use only** (no public signup) to manage:

- Multiple Fiverr accounts and their projects
- Team collaboration across different roles
- Project lifecycle from requirements to delivery
- Real-time notifications and updates
- Automated workflows via n8n integration

### Why This System?

| Problem | Solution |
|---------|----------|
| Managing multiple Fiverr accounts is chaotic | Centralized dashboard with account isolation |
| Team members need different access levels | Strict 5-role RBAC system |
| Communication gaps between teams | Real-time chat & notifications |
| Manual status tracking | Automated workflow with n8n |
| No visibility into project progress | Comprehensive analytics dashboard |

---

## Key Features

### For Admins
- Create and manage all users
- Create Fiverr accounts and projects
- Assign Managers to projects
- View financial analytics (budget, revenue)
- Configure system settings (SMTP, etc.)
- View audit logs of all actions

### For Managers
- View assigned projects
- Write and manage project requirements
- Assign Team Leads to projects
- Create revisions when client requests changes
- Chat with Admins about projects
- Track project status

### For Team Leads
- View assigned projects
- Break down requirements into tasks
- Assign tasks to Developers
- Request design assets from Designers
- Review and approve submitted work
- Manage revision assignments

### For Developers
- View assigned tasks
- Submit completed work with attachments
- Access approved design assets
- Track personal task history

### For Designers
- View asset requests
- Upload design assets
- Track asset approval status

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | NestJS + Node.js | REST APIs, WebSockets, Business Logic |
| **Frontend** | Next.js 14 (App Router) | SSR, React UI |
| **UI Components** | Tailwind CSS + shadcn/ui | Styling |
| **Database** | PostgreSQL | Primary Data Store |
| **ORM** | Prisma | Type-safe Database Access |
| **Real-time** | Socket.io | WebSocket Server |
| **Authentication** | JWT | Stateless Auth |
| **Email** | Nodemailer | SMTP Integration |
| **Desktop** | Electron | Desktop App Wrapper |
| **Automation** | n8n | Workflow Automation |
| **Validation** | class-validator + Zod | Input Validation |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
├─────────────┬─────────────┬─────────────┬──────────────────────┤
│   Browser   │   Electron  │     PWA     │   React Native       │
│  (Next.js)  │  (Desktop)  │  (Mobile)   │   (Future)           │
└──────┬──────┴──────┬──────┴──────┬──────┴──────────┬───────────┘
       │             │             │                  │
       └─────────────┴──────┬──────┴──────────────────┘
                            │
                    ┌───────▼───────┐
                    │   BACKEND     │
                    │   (NestJS)    │
                    ├───────────────┤
                    │ REST APIs     │
                    │ WebSockets    │
                    │ Auth/RBAC     │
                    │ Business Logic│
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
       ┌──────▼──────┐ ┌────▼────┐ ┌─────▼─────┐
       │ PostgreSQL  │ │  SMTP   │ │   n8n     │
       │  (Prisma)   │ │ Server  │ │ (Webhooks)│
       └─────────────┘ └─────────┘ └───────────┘
```

### Data Flow

1. **User Authentication**: JWT-based with role validation
2. **API Requests**: REST endpoints with role guards
3. **Real-time Updates**: WebSocket events for instant notifications
4. **Background Tasks**: n8n polls backend for automation triggers

---

## Role-Based Access Control

### Roles Hierarchy

```
ADMIN (Full Access)
  │
  ├── MANAGER (Project Management)
  │     │
  │     └── TEAM_LEAD (Task Management)
  │           │
  │           ├── DEVELOPER (Task Execution)
  │           │
  │           └── DESIGNER (Asset Creation)
```

### Permission Matrix

| Feature | Admin | Manager | Team Lead | Developer | Designer |
|---------|:-----:|:-------:|:---------:|:---------:|:--------:|
| Create users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create projects | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign Manager | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign Team Lead | ✅ | ✅ | ❌ | ❌ | ❌ |
| Attach Designer | ✅ | ❌ | ❌ | ❌ | ❌ |
| Write requirements | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create tasks | ❌ | ❌ | ✅ | ❌ | ❌ |
| Assign developers | ❌ | ❌ | ✅ | ❌ | ❌ |
| Work on tasks | ❌ | ❌ | ❌ | ✅ | ❌ |
| Upload assets | ❌ | ❌ | ❌ | ❌ | ✅ |
| See budget | ✅ | ❌ | ❌ | ❌ | ❌ |
| See Fiverr account | ✅ | ✅ | ❌ | ❌ | ❌ |
| View analytics | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create revisions | ❌ | ✅ | ❌ | ❌ | ❌ |
| Chat (Admin-Manager) | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Project Structure

```
deepaxis-management-system/
│
├── backend/                          # NestJS Backend
│   ├── src/
│   │   ├── main.ts                   # Entry point
│   │   ├── app.module.ts             # Root module
│   │   ├── common/                   # Shared utilities
│   │   │   ├── decorators/           # Custom decorators
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── public.decorator.ts
│   │   │   └── guards/               # Auth guards
│   │   │       ├── jwt-auth.guard.ts
│   │   │       └── roles.guard.ts
│   │   ├── modules/
│   │   │   ├── auth/                 # Authentication
│   │   │   ├── users/                # User management
│   │   │   ├── fiverr-accounts/      # Fiverr account management
│   │   │   ├── projects/             # Project management
│   │   │   ├── requirements/         # Requirements management
│   │   │   ├── tasks/                # Task management
│   │   │   ├── assets/               # Design asset management
│   │   │   ├── revisions/            # Revision handling
│   │   │   ├── chat/                 # Real-time chat
│   │   │   ├── notifications/        # Notification system
│   │   │   ├── analytics/            # Analytics & reports
│   │   │   ├── settings/             # System settings
│   │   │   ├── audit/                # Audit logging
│   │   │   ├── upload/               # File uploads
│   │   │   └── webhooks/             # n8n integration
│   │   └── prisma/                   # Database service
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema
│   │   ├── migrations/               # Database migrations
│   │   └── seed.ts                   # Seed data
│   └── package.json
│
├── frontend/                         # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/               # Auth pages
│   │   │   │   ├── login/
│   │   │   │   ├── forgot-password/
│   │   │   │   └── reset-password/
│   │   │   └── (dashboard)/          # Dashboard pages
│   │   │       ├── admin/            # Admin pages
│   │   │       ├── manager/          # Manager pages
│   │   │       ├── team-lead/        # Team Lead pages
│   │   │       ├── developer/        # Developer pages
│   │   │       └── designer/         # Designer pages
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── layout/               # Layout components
│   │   │   └── chat/                 # Chat components
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── lib/                      # Utilities
│   │   ├── stores/                   # Zustand stores
│   │   └── types/                    # TypeScript types
│   └── package.json
│
├── electron/                         # Desktop App
│   ├── main.ts                       # Electron main process
│   ├── preload.ts                    # Preload script
│   └── package.json
│
├── docker-compose.yml                # PostgreSQL setup
├── docker-compose.n8n.yml            # n8n setup
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** v14 or higher (or use Docker)
- **npm** or **yarn**
- **Docker** (optional, for PostgreSQL and n8n)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/arx-td/sass-system-for-fiver-Client-Managment.git
cd sass-system-for-fiver-Client-Managment

# 2. Start PostgreSQL (using Docker)
docker-compose up -d

# 3. Setup Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# 4. Setup Frontend (in a new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev

# 5. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
# API Docs: http://localhost:4000/api/docs
```

---

## Environment Configuration

### Backend (.env)

```env
# Application
NODE_ENV=development
PORT=4000

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/deepaxis_db?schema=public"

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Email / SMTP
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-pass
SMTP_FROM=noreply@deepaxis.com

# File Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Encryption (for sensitive data like budget)
ENCRYPTION_KEY=your-32-character-encryption-key!

# n8n Automation
N8N_ENABLED=true
N8N_WEBHOOK_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=your-n8n-webhook-secret
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

---

## Database Setup

### Using Docker (Recommended)

```bash
# Start PostgreSQL
docker-compose up -d

# The database will be available at:
# Host: localhost
# Port: 5432
# User: deepaxis
# Password: deepaxis_secret
# Database: deepaxis_db
```

### Using Neon (Cloud PostgreSQL)

1. Go to https://neon.tech
2. Create a new project
3. Copy the connection string
4. Update `DATABASE_URL` in `.env`

### Database Migrations

```bash
cd backend

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

### Seed Data

The seed script creates a default Admin user:

```bash
npx prisma db seed
```

**Default Admin Credentials:**
- Email: `admin@deepaxis.com`
- Password: `Admin@123`

---

## Running the Application

### Development Mode

```bash
# Backend (Terminal 1)
cd backend
npm run start:dev

# Frontend (Terminal 2)
cd frontend
npm run dev
```

### Production Mode

```bash
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build
npm run start
```

### Running All Services

```bash
# Start PostgreSQL + n8n
docker-compose -f docker-compose.yml up -d
docker-compose -f docker-compose.n8n.yml up -d

# Start Backend
cd backend && npm run start:dev &

# Start Frontend
cd frontend && npm run dev &
```

---

## Deployment

### Frontend (Vercel)

1. Go to https://vercel.com/new
2. Import the GitHub repository
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js
4. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your backend URL
   - `NEXT_PUBLIC_WS_URL`: Your WebSocket URL
5. Deploy

### Backend (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
cd backend
railway login
railway init
railway up

# Set environment variables in Railway dashboard
```

### Backend (Render)

1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
5. Add environment variables
6. Deploy

---

## API Documentation

### Base URL

```
http://localhost:4000/api/v1
```

### Authentication

All endpoints (except `/auth/login`) require a JWT token:

```bash
Authorization: Bearer <your_jwt_token>
```

### Main Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/auth/login` | User login | Public |
| GET | `/auth/profile` | Get current user | All |
| GET | `/users` | List all users | Admin |
| POST | `/users/invite` | Invite new user | Admin |
| GET | `/fiverr-accounts` | List Fiverr accounts | Admin |
| POST | `/fiverr-accounts` | Create Fiverr account | Admin |
| GET | `/projects` | List projects | Role-based |
| POST | `/projects` | Create project | Admin |
| GET | `/projects/:id/requirements` | Get requirements | Manager+ |
| POST | `/projects/:id/requirements` | Create requirement | Manager |
| GET | `/projects/:id/tasks` | Get tasks | Team Lead+ |
| POST | `/projects/:id/tasks` | Create task | Team Lead |
| GET | `/projects/:id/assets` | Get assets | Team Lead+ |
| POST | `/projects/:id/revisions` | Create revision | Manager |
| GET | `/notifications` | Get notifications | All |
| GET | `/analytics` | Get analytics | Admin |

### Swagger Documentation

Access full API documentation at:
```
http://localhost:4000/api/docs
```

---

## WebSocket Events

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events (Server → Client)

| Event | Description | Payload |
|-------|-------------|---------|
| `notification:new` | New notification | `{ id, type, title, message }` |
| `project:created` | Project created | `{ projectId, name }` |
| `project:updated` | Project status changed | `{ projectId, status }` |
| `task:assigned` | Task assigned | `{ taskId, title, projectId }` |
| `task:status:changed` | Task status update | `{ taskId, status }` |
| `asset:submitted` | Asset submitted | `{ assetId, name }` |
| `revision:created` | New revision | `{ revisionId, projectId }` |
| `chat:message` | New chat message | `{ messageId, content, sender }` |
| `project:completed` | Project completed | `{ projectId, projectName }` |

### Events (Client → Server)

| Event | Description | Payload |
|-------|-------------|---------|
| `join:project` | Join project room | `{ projectId }` |
| `leave:project` | Leave project room | `{ projectId }` |
| `chat:send` | Send chat message | `{ projectId, content }` |

---

## n8n Automation

n8n acts as a **silent helper** - it NEVER makes business decisions, only sends reminders and reports.

### Setup n8n

```bash
# Start n8n
docker-compose -f docker-compose.n8n.yml up -d

# Access n8n
# URL: http://localhost:5678
# Username: admin
# Password: deepaxis123
```

### Available Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks/n8n/health` | GET | Health check |
| `/webhooks/n8n/idle-projects` | GET | Projects with no activity (7 days) |
| `/webhooks/n8n/overdue-tasks` | GET | Tasks past due date |
| `/webhooks/n8n/client-review-projects` | GET | Projects in CLIENT_REVIEW > 2 hours |
| `/webhooks/n8n/completed-projects-today` | GET | Projects completed today |
| `/webhooks/n8n/pending-revisions-assignment` | GET | Unassigned revisions > 1 hour |
| `/webhooks/n8n/send-reminder` | POST | Send single reminder |
| `/webhooks/n8n/send-bulk-reminders` | POST | Send multiple reminders |

### Example Workflows

1. **Client Review Reminder** (Every 10 minutes)
   - Check for projects in CLIENT_REVIEW > 2 hours
   - Send reminder to assigned Manager

2. **Daily Summary** (9 PM)
   - Get all completed projects today
   - Send summary to all Admins

3. **Overdue Task Alert** (Every 4 hours)
   - Check for overdue tasks
   - Send reminder to Developer and Team Lead

---

## Desktop Application

### Build for Windows

```bash
cd electron
npm install
npm run dist:win
```

The installer will be at: `electron/release/DEEPAXIS Setup 1.0.0.exe`

### Build for macOS

```bash
npm run dist:mac
```

### Build for Linux

```bash
npm run dist:linux
```

### Features

- System tray icon
- Native notifications
- Auto-updates
- Offline detection

---

## Project Status Workflow

```
NEW
 │
 ▼
REQUIREMENTS_PENDING ──────────────────────┐
 │                                         │
 ▼                                         │
IN_PROGRESS ◄──────────────────────────────┤
 │                                         │
 ▼                                         │
REVIEW ────────────────────────────────────┤
 │                                         │
 ▼                                         │
CLIENT_REVIEW ─────► (Revision Created) ───┘
 │
 ▼
COMPLETED
 │
 ▼
ON_HOLD / CANCELLED (manual)
```

---

## Task Status Workflow

```
ASSIGNED
 │
 ▼
IN_PROGRESS
 │
 ▼
SUBMITTED ──────► REJECTED ──► IN_PROGRESS
 │
 ▼
APPROVED
```

---

## Default Users (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@deepaxis.com | Admin@123 |

Create additional users via Admin dashboard after login.

---

## Troubleshooting

### Common Issues

**1. Database connection failed**
```bash
# Check if PostgreSQL is running
docker ps

# Restart PostgreSQL
docker-compose down
docker-compose up -d
```

**2. Prisma migration error**
```bash
# Reset database
npx prisma migrate reset

# Regenerate Prisma client
npx prisma generate
```

**3. WebSocket connection failed**
- Ensure backend is running
- Check CORS settings
- Verify JWT token is valid

**4. n8n cannot connect to backend**
- Use `host.docker.internal:4000` instead of `localhost:4000`
- Verify API key matches `N8N_WEBHOOK_SECRET`

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is **proprietary** and for internal use only.

---

## Support

For issues and feature requests, please contact:
- **Email:** arxthedesigner2021@gmail.com
- **GitHub Issues:** [Create an issue](https://github.com/arx-td/sass-system-for-fiver-Client-Managment/issues)

---

**Built by Abdullah Rahim**
