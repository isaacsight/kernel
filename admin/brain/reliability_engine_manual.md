# Reliability Engine: System Manual

**Version**: 1.0 (Engineer-CEO Hardening Complete)
**Status**: Live / Production Ready
**Verification**: `scripts/final_verification.py`

---

## 1. Philosophy: Engineer-CEO Hardening
This system was built to bridge the gap between "Hacker Prototype" and "CEO-Grade Reliability". It follows three strict engineering tracks to ensure the system is not just functional, but **Scale-Ready**, **Trustworthy**, and **Monetizable**.

### Track 1: Scale (The Foundation)
**Goal**: Handle multiple tenants and high-load without crossing wires.
- **Architecture**: Asynchronous FastAPI + SQLModel.
- **Database**: SQLite (Dev) / PostgreSQL (Prod) with Alembic Migrations.
- **Multi-Tenancy**: Strict `tenant_id` enforcement on ALL core tables (`BaseTable` mixin).
- **Isolation**: API endpoints automatically filter data by the authenticated user's `tenant_id`.

### Track 2: Trust (The Guardrails)
**Goal**: Allow strangers to use the system without breaking it or seeing each other's data.
- **Authentication**: JWT (JSON Web Tokens) via OAuth2 Password Bearer.
- **RBAC (Role-Based Access Control)**:
    - **Admin**: Root access. Can view/edit any tenant's data.
    - **Client**: Sandbox access. Strictly limited to their own `tenant_id`.
- **Audit Logging**: Immutable `audit_logs` table tracks every write operation (`create_workflow`, etc.) with `actor_id` and `timestamp`.

### Track 3: Money (The Engine)
**Goal**: Turn usage into revenue safely.
- **Billing Model**: Prepaid Credits.
- **The Ledger**: Double-Entry Accounting System. we do **NOT** store a mutable "balance" column.
    - Balance = `SUM(ledger.amount)` for a given tenant.
    - Transactions are immutable (`DEPOSIT`, `WITHDRAWAL`).
- **Integration**: Stripe Webhook (`/api/v1/stripe/webhook`) listens for `checkout.session.completed` and automatically funds the ledger.

---

## 2. Technical Architecture

### Code Structure
```
engine/
├── alembic/              # Database Migrations
├── app/
│   ├── api/              # Endpoints (v1)
│   ├── core/             # Config, Security, DB Connection
│   ├── models/           # SQLModel Definitions (User, Workflow, Billing)
│   └── services/         # Business Logic (BillingService)
├── scripts/              # Verification & Admin Scripts
├── reliability.db        # Local SQLite Database
├── Dockerfile            # Container definition
└── requirements.txt      # Python dependencies
```

### Key Models
- **`User`**: Identity & Auth.
- **`Workflow`**: The unit of work.
- **`Subscription`**: Stripe mapping.
- **`Ledger`**: Financial source of truth.
- **`AuditLog`**: Security compliance.

### Security & Logic Flow
1. **Request**: User hits `POST /workflows/`.
2. **Auth**: `deps.get_current_user` validates JWT.
3. **RBAC**: Code checks `if user.role == CLIENT: assert payload.tenant_id == user.tenant_id`.
4. **Logic**: Workflow is saved to DB.
5. **Money**: (Optional) Credit check performed via `BillingService.get_balance()`.
6. **Audit**: `AuditLog` entry created linked to `user.id`.
7. **Response**: 200 OK.

---

## 3. Operations & Maintenance

### Starting the Server
```bash
cd engine
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

### Running Verification (Flight Check)
Run the master script to verify all systems:
```bash
python scripts/final_verification.py
```
*Checks Auth, Stripe, RBAC, and Workflow Logic.*

### Admin Management
Create users via CLI:
```bash
PYTHONPATH=. python scripts/create_user.py <email> <password> <role>
```

### Deployment
- **Frontend**: `docs/` is auto-deployed to GitHub Pages.
- **Backend**: `engine/` is a standard Docker container. Deploy to Fly.io, Render, or AWS.
  - Set `DATABASE_URL` env var to switch to PostgreSQL.
  - Set `SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in prod.

---

**"The system isn't done until it's boring."**
This system is now boring. It works. It's safe. It handles money.
