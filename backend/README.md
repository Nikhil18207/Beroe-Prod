# Beroe AI Procurement Platform - Backend

Enterprise-grade AI-powered procurement optimization platform with Dual Orchestrator architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      MASTER ORCHESTRATOR                         │
│                   (Top-Level Request Handler)                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│   OPPORTUNITY ORCHESTRATOR    │ │     BRIEF ORCHESTRATOR        │
│   (Savings Calculation)       │ │   (Leadership Brief)          │
│                               │ │                               │
│   3 Demo Micro-Agents:        │ │   4 Specialized Agents:       │
│   • Volume Bundling (8 PPs)   │ │   • Data Analysis             │
│   • Target Pricing (4 PPs)    │ │   • Risk Assessment           │
│   • Risk Management (7 PPs)   │ │   • Market Intel              │
│                               │ │   • Recommendation            │
└───────────────────────────────┘ └───────────────────────────────┘
```

## Technology Stack

- **Framework**: FastAPI 0.115
- **Database**: PostgreSQL with pgvector
- **ORM**: SQLAlchemy 2.0 (async)
- **LLM**: Hybrid (OpenAI + Local models)
- **Authentication**: JWT with passlib

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Settings management
│   ├── database.py          # Database configuration
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py      # Authentication endpoints
│   │       ├── health.py    # Health checks
│   │       ├── portfolio.py # Portfolio management
│   │       ├── session.py   # Analysis sessions
│   │       ├── opportunities.py # Opportunities
│   │       ├── upload.py    # File uploads
│   │       └── chat.py      # Chat interface
│   ├── models/              # SQLAlchemy models
│   │   ├── user.py
│   │   ├── session.py
│   │   ├── portfolio.py
│   │   ├── opportunity.py
│   │   ├── proof_point.py
│   │   ├── document.py
│   │   ├── conversation.py
│   │   └── spend_data.py
│   ├── schemas/             # Pydantic schemas
│   │   ├── user.py
│   │   ├── session.py
│   │   ├── portfolio.py
│   │   ├── opportunity.py
│   │   └── common.py
│   ├── services/            # Business logic
│   └── agents/              # Dual Orchestrator system
├── requirements.txt
├── .env.example
└── README.md
```

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Setup PostgreSQL

Create a database:
```sql
CREATE DATABASE beroe_procurement;
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Key settings:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key (for LLM features)
- `JWT_SECRET_KEY`: Secure secret for JWT tokens

### 5. Run the Server

```bash
# Development
uvicorn app.main:app --reload --port 8000

# Or using Python
python -m app.main
```

### 6. Access API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (OAuth2)
- `POST /api/v1/auth/login/json` - Login (JSON body)
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/me` - Update profile
- `PUT /api/v1/auth/me/goals` - Update optimization goals

### Portfolio
- `GET /api/v1/portfolio` - Get user's portfolio
- `POST /api/v1/portfolio/category` - Add category
- `PUT /api/v1/portfolio/category/{id}` - Update category
- `DELETE /api/v1/portfolio/category/{id}` - Delete category
- `GET /api/v1/portfolio/locations` - Get available locations

### Sessions
- `GET /api/v1/session` - List sessions
- `POST /api/v1/session` - Create session
- `GET /api/v1/session/{id}` - Get session
- `PUT /api/v1/session/{id}` - Update session
- `DELETE /api/v1/session/{id}` - Delete session

### Opportunities
- `GET /api/v1/opportunities/themes` - Get lever themes
- `GET /api/v1/opportunities` - List opportunities
- `GET /api/v1/opportunities/{id}` - Get opportunity details
- `POST /api/v1/opportunities/{id}/accept` - Accept opportunity
- `POST /api/v1/opportunities/{id}/reject` - Reject opportunity

### Upload
- `POST /api/v1/upload/spend-data` - Upload spend CSV/Excel
- `POST /api/v1/upload/validate` - Validate file
- `POST /api/v1/upload/document` - Upload document

### Chat (Placeholder)
- `GET /api/v1/chat/conversations` - List conversations
- `POST /api/v1/chat/message` - Send message
- `GET /api/v1/chat/conversation/{id}/messages` - Get messages

## Implementation Phases

### Phase 1: Foundation ✅
- [x] Database models
- [x] Authentication (JWT)
- [x] Health checks
- [x] Basic API structure

### Phase 2: Portfolio & Goals ✅
- [x] Portfolio CRUD
- [x] Locations management
- [x] Goals update

### Phase 3: File Upload (Next)
- [x] CSV/Excel upload
- [x] Column detection
- [x] Spend aggregation
- [ ] Data validation improvements

### Phase 4: Dual Orchestrator
- [ ] Master Orchestrator
- [ ] Opportunity Orchestrator
- [ ] 3 Micro-Agents
- [ ] Proof Point evaluation
- [ ] Savings calculation

### Phase 5: Document Analysis
- [ ] PDF extraction
- [ ] Contract analysis
- [ ] Proof point updates

### Phase 6: Chat System
- [ ] WebSocket support
- [ ] LLM integration
- [ ] RAG retrieval
- [ ] Panel state management

### Phase 7: Integration
- [ ] Frontend connection
- [ ] End-to-end testing
- [ ] Performance optimization

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async URL | `postgresql+asyncpg://...` |
| `JWT_SECRET_KEY` | JWT signing key | (required) |
| `OPENAI_API_KEY` | OpenAI API key | (optional) |
| `LLM_PROVIDER` | `openai`, `local`, `hybrid` | `hybrid` |
| `DEBUG` | Enable debug mode | `false` |
| `CORS_ORIGINS` | Allowed origins | `["http://localhost:3004"]` |

## Demo Opportunities

The demo implements 3 of the 11 initiatives:

1. **Volume Bundling** (8 proof points)
   - Regional Spend Addressability
   - Tail Spend Consolidation
   - Volume Leverage from Fragmented Spend
   - Price Variance for Identical SKUs
   - Average Spend per Supplier
   - Market Consolidation
   - Supplier Location
   - Supplier Risk Rating

2. **Target Pricing** (4 proof points)
   - Price Variance for Identical SKUs
   - Tariff Rate
   - Cost Structure
   - Unit Price

3. **Risk Management** (7 proof points)
   - Single Sourcing / Supplier Dependency
   - Supplier Concentration Risk
   - Category Risk
   - Inflation
   - Exchange Rate
   - Geo Political Risk
   - Supplier Risk Rating

## License

Proprietary - Beroe Inc.
