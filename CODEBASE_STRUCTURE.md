# Beroe AI Procurement Platform - Complete Codebase Structure

## System Overview
A **procurement analytics platform** that analyzes spend data to identify savings opportunities through 4 main initiatives using a **proof point evaluation system**.

---

# BACKEND STRUCTURE

```
backend/
├── app/                          # Main application package
│   ├── __init__.py               # Package initializer
│   ├── main.py                   # FastAPI app entry point (lifespan, middleware, CORS)
│   ├── config.py                 # Pydantic Settings (env vars, JWT, OpenAI, LLM config)
│   ├── database.py               # Async SQLAlchemy setup (PostgreSQL connection)
│   │
│   ├── agents/                   # AI Agent System (Dual Orchestrator)
│   │   ├── __init__.py
│   │   ├── master_orchestrator.py    # Top-level orchestrator (coordinates all analysis)
│   │   ├── opportunity_orchestrator.py # 10-step savings calculation engine
│   │   ├── proof_points.py           # 17 proof point definitions & mappings
│   │   ├── base_agent.py             # Abstract base class for micro-agents
│   │   │
│   │   └── opportunities/            # 4 Opportunity Micro-Agents
│   │       ├── __init__.py           # Exports all agents
│   │       ├── volume_bundling/      # Volume Bundling Agent (8 proof points)
│   │       │   ├── __init__.py
│   │       │   ├── agent.py          # PP1-PP8 evaluation logic
│   │       │   └── README.md
│   │       ├── target_pricing/       # Target Pricing Agent (4 proof points)
│   │       │   ├── __init__.py
│   │       │   ├── agent.py          # PP4,PP10-PP12 evaluation
│   │       │   └── README.md
│   │       ├── risk_management/      # Risk Management Agent (7 proof points)
│   │       │   ├── __init__.py
│   │       │   ├── agent.py          # PP8,PP13-PP18 evaluation
│   │       │   └── README.md
│   │       └── respec_pack/          # Re-specification Pack Agent (3 proof points)
│   │           ├── __init__.py
│   │           ├── agent.py          # PP4,PP11,PP19 evaluation
│   │           └── README.md
│   │
│   ├── api/                      # API Layer (FastAPI Routers)
│   │   ├── __init__.py
│   │   └── v1/                   # Version 1 API
│   │       ├── __init__.py       # Router aggregation (all endpoints)
│   │       ├── health.py         # GET /health - System health check
│   │       ├── auth.py           # POST /auth/login, /register, /me
│   │       ├── portfolio.py      # CRUD /portfolio - Category management
│   │       ├── session.py        # GET /session/{id} - Analysis sessions
│   │       ├── opportunities.py  # GET /opportunities - Savings opportunities
│   │       ├── upload.py         # POST /upload - File upload handler
│   │       ├── chat.py           # POST /chat - LLM conversation
│   │       ├── analysis.py       # POST /analysis - Run analysis
│   │       ├── analyze.py        # POST /analyze, /analyze/quick (frontend-compat)
│   │       ├── documents.py      # CRUD /documents - Document management
│   │       ├── data.py           # GET /data/metrics - Cached metrics
│   │       ├── organization.py   # CRUD /org - Multi-tenant management
│   │       ├── admin.py          # GET /admin - Super admin dashboard
│   │       ├── users.py          # CRUD /users - User management
│   │       └── dependencies.py   # Shared dependencies (auth, db session)
│   │
│   ├── models/                   # SQLAlchemy ORM Models
│   │   ├── __init__.py           # Model exports
│   │   ├── user.py               # User model (auth, roles)
│   │   ├── organization.py       # Organization (multi-tenant)
│   │   ├── department.py         # Department model
│   │   ├── role.py               # Role/permissions model
│   │   ├── session.py            # Analysis session model
│   │   ├── portfolio.py          # Portfolio/category model
│   │   ├── opportunity.py        # Opportunity results model
│   │   ├── proof_point.py        # Proof point results model
│   │   ├── document.py           # Uploaded document model
│   │   ├── conversation.py       # Chat conversation model
│   │   ├── spend_data.py         # Spend data records model
│   │   ├── computed_data.py      # Pre-computed metrics model
│   │   ├── activity_log.py       # Activity audit log model
│   │   └── password_reset.py     # Password reset tokens
│   │
│   ├── schemas/                  # Pydantic Schemas (Request/Response)
│   │   ├── __init__.py
│   │   ├── common.py             # Shared schemas (pagination, errors)
│   │   ├── user.py               # User schemas
│   │   ├── session.py            # Session schemas
│   │   ├── portfolio.py          # Portfolio schemas
│   │   └── opportunity.py        # Opportunity schemas
│   │
│   └── services/                 # Business Logic Services
│       ├── __init__.py
│       ├── llm_service.py        # LLM abstraction (OpenAI, Groq, Together, Local)
│       ├── chat_service.py       # Chat/conversation handling
│       ├── document_service.py   # Document parsing & storage
│       ├── data_ingestion_service.py  # CSV/Excel parsing
│       ├── compute_service.py    # Pre-compute metrics (HHI, concentrations)
│       ├── cache_service.py      # Redis/memory caching
│       ├── activity_service.py   # Activity logging
│       ├── market_price_service.py    # Market price benchmarks
│       └── supplier_intelligence.py   # OpenAI PP8 real-time analysis
│
├── data/                         # Sample/Test Data Files
│   ├── test_spend_data.csv       # Sample spend transactions
│   ├── test_supply_master.csv    # Sample supplier profiles
│   ├── test_contracts.csv        # Sample contract data
│   ├── category_playbook.csv     # Category strategy guidance
│   ├── test_playbook.csv         # Test playbook data
│   ├── Deepdive - Savings calculation.xlsx  # Methodology reference
│   ├── Overall methodology_Dec25.xlsx       # Full methodology docs
│   ├── supplier_sample.docx      # Sample supplier document
│   ├── contract_sample.docx      # Sample contract document
│   └── category_sample.docx      # Sample category document
│
├── scripts/                      # Utility Scripts
│   ├── promote_super_admin.py    # Promote user to super admin
│   └── seed_test_users.py        # Create test users
│
├── alembic/                      # Database Migrations
│   ├── env.py                    # Alembic config
│   ├── script.py.mako            # Migration template
│   └── versions/                 # Migration files
│       ├── add_multi_tenant_support.py
│       ├── add_computed_data_tables.py
│       └── add_activity_logs_table.py
│
├── run.py                        # Uvicorn runner script
├── alembic.ini                   # Alembic configuration
├── .gitignore
├── nixpacks.toml                 # Railway deployment
├── railway.json                  # Railway config
├── .env.production.example       # Env template
└── README.md
```

---

# FRONTEND STRUCTURE

```
frontend/
├── src/
│   ├── app/                      # Next.js App Router Pages
│   │   ├── layout.tsx            # Root layout (providers, fonts)
│   │   ├── page.tsx              # Landing/redirect page
│   │   ├── template.tsx          # Page template
│   │   ├── global-error.tsx      # Global error boundary
│   │   ├── favicon.ico
│   │   │
│   │   ├── login/                # Authentication
│   │   │   └── page.tsx          # Login form
│   │   ├── register/
│   │   │   └── page.tsx          # Registration form
│   │   ├── forgot-password/
│   │   │   └── page.tsx          # Password reset request
│   │   ├── reset-password/
│   │   │   └── page.tsx          # Password reset form
│   │   │
│   │   ├── setup/                # 3-Step Setup Wizard
│   │   │   ├── page.tsx          # Setup landing
│   │   │   ├── portfolio/
│   │   │   │   └── page.tsx      # Step 1: Category selection
│   │   │   ├── goals/
│   │   │   │   └── page.tsx      # Step 2: Cost/Risk/ESG goals
│   │   │   ├── review/
│   │   │   │   └── page.tsx      # Step 3: Data upload & proof points
│   │   │   └── processing/
│   │   │       └── page.tsx      # Processing animation
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Main dashboard (savings summary)
│   │   │
│   │   ├── opportunities/        # Opportunity Analysis
│   │   │   ├── page.tsx          # Opportunity list (Qualified/Potential tabs)
│   │   │   ├── details/
│   │   │   │   └── page.tsx      # Q&A interface for proof points
│   │   │   └── accepted/
│   │   │       └── page.tsx      # Accepted recommendations view
│   │   │
│   │   ├── chat/
│   │   │   └── page.tsx          # AI chat interface
│   │   │
│   │   ├── activity/
│   │   │   └── page.tsx          # Activity history
│   │   │
│   │   ├── today/
│   │   │   └── page.tsx          # Today's tasks/summary
│   │   │
│   │   └── admin/                # Admin Panel
│   │       ├── dashboard/
│   │       │   └── page.tsx      # Admin overview
│   │       ├── users/
│   │       │   └── page.tsx      # User management
│   │       └── organization/
│   │           └── [id]/
│   │               └── page.tsx  # Organization details
│   │
│   ├── components/               # React Components
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   ├── ProtectedRoute.tsx    # Auth guard component
│   │   ├── ErrorBoundary.tsx     # Error boundary wrapper
│   │   ├── ErrorReporter.tsx     # Error reporting UI
│   │   │
│   │   └── ui/                   # Shadcn/UI Component Library
│   │       ├── accordion.tsx
│   │       ├── alert.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── button-group.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── empty.tsx
│   │       ├── field.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input.tsx
│   │       ├── input-group.tsx
│   │       ├── input-otp.tsx
│   │       ├── item.tsx
│   │       ├── kbd.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── spinner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toggle.tsx
│   │       ├── toggle-group.tsx
│   │       └── tooltip.tsx
│   │
│   ├── context/                  # React Context Providers
│   │   ├── AppContext.tsx        # Global app state (portfolio, opportunities, metrics)
│   │   └── AuthContext.tsx       # Authentication state
│   │
│   ├── lib/                      # Utility Libraries
│   │   ├── utils.ts              # General utilities (cn, formatters)
│   │   ├── supabase.ts           # Supabase client (optional persistence)
│   │   ├── columnMatcher.ts      # CSV column matching logic
│   │   ├── fileParser.ts         # File parsing utilities
│   │   ├── playbookParser.ts     # Playbook CSV parser
│   │   ├── documentFieldExtractor.ts  # Document field extraction
│   │   │
│   │   ├── api/                  # API Client Layer
│   │   │   ├── index.ts          # API exports
│   │   │   ├── client.ts         # Base axios client (auth, interceptors)
│   │   │   └── procurement.ts    # Procurement API methods
│   │   │
│   │   ├── calculations/         # Frontend Calculation Engine
│   │   │   ├── index.ts          # Calculation exports
│   │   │   ├── csv-parser.ts     # CSV parsing for metrics
│   │   │   └── procurement-metrics.ts  # 7-step savings calculation
│   │   │
│   │   └── hooks/                # Custom React Hooks
│   │       ├── index.ts
│   │       ├── use-mobile.tsx    # Mobile detection hook
│   │       └── useSupabaseStorage.ts  # Supabase storage hook
│   │
│   ├── hooks/                    # Root-level Hooks
│   │   └── use-mobile.ts
│   │
│   ├── types/                    # TypeScript Type Definitions
│   │   └── api.ts                # API response types
│   │
│   └── visual-edits/             # Visual Editor Components
│       ├── component-tagger-loader.js
│       └── VisualEditsMessenger.tsx
│
├── public/                       # Static Assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── components.json               # Shadcn/UI config
├── tsconfig.json                 # TypeScript config
├── postcss.config.mjs            # PostCSS config
├── eslint.config.mjs             # ESLint config
├── vercel.json                   # Vercel deployment config
├── bun.lock                      # Bun package lock
├── .gitignore
└── .env.production.example       # Env template
```

---

# KEY SYSTEM FLOWS

## 1. Dual Orchestrator Pattern
```
User Upload → Master Orchestrator
                    │
                    ├── Data Validation & Parsing
                    │
                    ▼
           Opportunity Orchestrator (10-Step Savings)
                    │
    ┌───────────────┼───────────────┬───────────────┐
    ▼               ▼               ▼               ▼
Volume          Target          Risk            Re-spec
Bundling        Pricing         Management      Pack
(8 PPs)         (4 PPs)         (7 PPs)         (3 PPs)
    │               │               │               │
    └───────────────┴───────────────┴───────────────┘
                    │
                    ▼
            Ranked Opportunities + Savings
```

## 2. 10-Step Savings Calculation
1. Get addressable spend (80% default)
2. Count proof points by impact (Low=1, Medium=2, High=3)
3. Calculate Impact Score (0-10)
4. Determine Impact Bucket (High/Medium/Low)
5. Get benchmark range for opportunity
6. Calculate intermediate percentage
7. Apply maturity adjustment (1-4 scale)
8. Calculate confidence score
9. Apply confidence adjustment
10. Final savings = addressable_spend × final_pct

## 3. 17 Proof Points Distribution
| Opportunity | Proof Points | Shared |
|------------|--------------|--------|
| Volume Bundling | PP1-PP8 | PP4, PP8 |
| Target Pricing | PP4, PP10-PP12 | PP4 |
| Risk Management | PP8, PP13-PP18 | PP8 |
| Re-spec Pack | PP4, PP11, PP19 | PP4, PP11 |

---

# DATA FLOW

```
Frontend (Next.js)
    │
    │  REST API calls
    ▼
Backend (FastAPI)
    │
    ├── /api/v1/analyze    → MasterOrchestrator
    ├── /api/v1/chat       → LLMService
    ├── /api/v1/auth       → JWT Authentication
    └── /api/v1/session    → Session State
    │
    ▼
PostgreSQL (Models)     Redis (Cache)
    │                       │
    └───────────────────────┘
            │
            ▼
    CacheService (Hybrid Architecture)
        - Fast path: Pre-computed metrics
        - Slow path: Real-time from spend_data
```

---

# TECHNOLOGY STACK

## Backend
- **Framework**: FastAPI (Python 3.10+)
- **ORM**: SQLAlchemy 2.0 (async)
- **Database**: PostgreSQL + Alembic migrations
- **Cache**: Redis (optional)
- **LLM**: OpenAI GPT-4o, Groq, Together.ai, Local Ollama
- **Auth**: JWT (PyJWT)
- **Logging**: structlog

## Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **State**: React Context + useReducer
- **UI**: Shadcn/UI + Tailwind CSS
- **API Client**: Axios
- **Storage**: localStorage + Supabase (optional)

## Deployment
- **Backend**: Railway/Render (nixpacks)
- **Frontend**: Vercel
- **Database**: Supabase/Railway PostgreSQL

---

# KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| `backend/app/agents/proof_points.py` | 17 proof point definitions |
| `backend/app/agents/opportunity_orchestrator.py` | 10-step savings calculation |
| `backend/app/agents/master_orchestrator.py` | Top-level coordination |
| `frontend/src/context/AppContext.tsx` | Global state management |
| `frontend/src/lib/calculations/procurement-metrics.ts` | Frontend calculation engine |
| `frontend/src/lib/api/procurement.ts` | API client methods |
| `backend/app/config.py` | Environment configuration |
| `backend/app/main.py` | FastAPI application entry |

---

# CONSTANTS & THRESHOLDS

```python
# Addressable Spend
ADDRESSABLE_SPEND_PCT = 0.80  # 80% default

# Savings Benchmarks
VOLUME_BUNDLING = {"low": 0%, "high": 5%}
TARGET_PRICING = {"low": 1%, "high": 2%}
RISK_MANAGEMENT = {"low": 1%, "high": 3%}
RESPEC_PACK = {"low": 2%, "high": 3%}

# Impact Scoring
HIGH = 3, MEDIUM = 2, LOW = 1
IMPACT_BUCKETS = {High: 7-10, Medium: 4-7, Low: 0-4}

# Maturity Adjustment
MATURITY = {1: 1.75x, 2: 1.50x, 2.5: 1.375x, 3: 1.25x, 4: 1.0x}

# Confidence
CONFIDENCE_BUCKETS = {High: ≥70%, Medium: 40-70%, Low: <40%}
```
