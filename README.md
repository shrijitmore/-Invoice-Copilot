# Invoice Copilot

A production-grade, full-stack B2B AI chatbot that lets small business owners upload invoices, manage their finances, and get intelligent business insights through natural conversation.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20NestJS%20%2B%20MongoDB%20%2B%20LangChain-1e3a5f)

## Features

**Auth & users** — Google OAuth sign-in, JWT in httpOnly cookies with refresh-token rotation (reuse detection revokes the session family), profile editing with avatar upload, account stats, admin/user roles, and full account deletion with data wipe.

**AI chat copilot** — token-by-token streaming replies (SSE), typing indicator with live tool status, full session memory, searchable chat history grouped by date (Today / Yesterday / Last 7 Days), rename and delete sessions, copy buttons, timestamps, auto-scroll, suggested prompts, confidence scoring on every answer, clarifying questions on ambiguous data, and polite refusal of off-topic requests.

**Invoice management** — drag-and-drop or click upload (PDF/PNG/JPEG/WebP, ≤10 MB, bulk up to 10 files), paste raw text, AI extraction of vendor, amounts, currency, dates, invoice number, tax and line items, manual review/edit before saving, sortable and filterable list (status, date range, vendor, amount range), search, mark-as-paid with payment date, notes, duplicate detection, CSV export, detail view with line items, single and bulk delete, and automatic overdue detection.

**Analytics dashboard** — month-over-month spend with % change, outstanding due this week, top-5 vendors bar chart, 6-month spending trend line, status breakdown pie, 30-day cash-flow projection, and average AI processing time. All charts in Recharts.

**Notifications** — in-app bell with unread badge, due-soon (3-day) and overdue alerts generated hourly, read/unread state, mark-all-as-read, per-user toggles.

**LangChain agent tools** — `extract_invoice`, `summarize_spending`, `find_overdue`, `calculate_cashflow`, `get_top_vendors`, `compare_periods`, `answer_question`, `export_data` (triggers a CSV download straight from chat).

**Security** — helmet, global rate limit (100 req / 15 min / IP) with stricter auth limits (10 / 15 min), class-validator on every DTO with whitelisting, XSS input sanitization, MongoDB operator-injection stripping, upload type/size validation, 15-minute access tokens + 7-day rotating refresh tokens, no sensitive data in logs, request-id tracing on every request, and length limits on all text fields.

**UI** — navy/white/slate design, ≥16px body text, loading skeletons, toasts, helpful empty states, fully responsive, keyboard accessible with visible focus rings, micro-animations, and a dark mode toggle.

## Repository layout

```
backend/    NestJS 10 + Mongoose API (TypeScript, strict)
frontend/   React 18 + Vite + Tailwind SPA (TypeScript, strict)
render.yaml Render blueprint for the API
```

## Getting started

### Prerequisites

- Node.js ≥ 18
- A MongoDB instance (local or Atlas)
- A Google OAuth 2.0 client (Web application) — authorized redirect URI: `http://localhost:4000/api/v1/auth/google/callback`
- An OpenAI API key

### Backend

```bash
cd backend
cp .env.example .env   # fill in Mongo, Google and OpenAI credentials
npm install
npm run start:dev      # http://localhost:4000/api/v1
```

### Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:4000/api/v1
npm install
npm run dev            # http://localhost:5173
```

Sign in with Google, upload an invoice (or paste its text), and start asking the copilot questions like *"What invoices are due this week?"*

### Granting admin

Add a comma-separated list of emails to `ADMIN_EMAILS` in the backend `.env`. Those accounts receive the admin role on their next sign-in and can access `GET /api/v1/admin/users` and `GET /api/v1/admin/stats`.

## Deployment

### API on Render

The included `render.yaml` provisions the API as a Render web service (build `npm ci && npm run build`, start `npm run start:prod`, health check `/api/v1/health`). Set the secret env vars in the Render dashboard, including:

- `FRONTEND_URL` — your Vercel URL (no trailing slash)
- `GOOGLE_CALLBACK_URL` — `https://<api-host>/api/v1/auth/google/callback` (also add it to the Google OAuth client)
- `COOKIE_SAME_SITE=none` — required for cross-site cookies between Vercel and Render

### Frontend on Vercel

Import the repo in Vercel with **Root Directory** = `frontend`. The included `vercel.json` handles SPA rewrites and security headers. Set:

- `VITE_API_URL` — `https://<api-host>/api/v1`

## API overview

All routes are prefixed with `/api/v1` and (except auth/health) require the access-token cookie.

| Area | Endpoints |
| --- | --- |
| Auth | `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET/PATCH /users/me`, `POST /users/me/avatar`, `PATCH /users/me/settings`, `GET /users/me/stats`, `DELETE /users/me/data`, `DELETE /users/me` |
| Invoices | `GET/POST /invoices`, `GET/PATCH/DELETE /invoices/:id`, `POST /invoices/:id/mark-paid`, `POST /invoices/extract/text`, `POST /invoices/extract/files`, `POST /invoices/check-duplicate`, `POST /invoices/bulk-delete`, `GET /invoices/vendors`, `GET /invoices/export/csv` |
| Analytics | `GET /analytics/dashboard` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| Chat | `GET/POST /chat/sessions`, `PATCH/DELETE /chat/sessions/:id`, `GET /chat/sessions/:id/messages`, `POST /chat/sessions/:id/messages` (SSE stream) |
| Admin | `GET /admin/users`, `GET /admin/stats` |

## Architecture notes

- **Refresh rotation**: refresh tokens are single-use; only a SHA-256 hash of the token id is stored. Reusing a consumed token revokes the entire token family.
- **Agent loop**: a custom tool-calling loop streams the final answer token-by-token while emitting tool events for the UI. Replies begin with a `[[confidence:X.XX]]` marker that the server strips before display and persists as the confidence score.
- **Overdue sweep**: an hourly cron flips past-due unpaid invoices to overdue and fans out deduplicated due-soon/overdue notifications, honoring per-user preferences. List queries also refresh statuses on read for instant accuracy.
- **Ownership scoping**: every query is keyed by the authenticated user id — agent tools close over the user id so the model can never touch another tenant's data.
