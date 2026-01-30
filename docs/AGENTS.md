# Opportunity Agents Documentation

## Overview

The Beroe Procurement Engine uses a Dual Orchestrator architecture with specialized micro-agents for opportunity analysis.

## Architecture

```
Master Orchestrator
    ├── Opportunity Orchestrator
    │   ├── VolumeBundlingAgent (8 proof points)
    │   ├── TargetPricingAgent (4 proof points)
    │   ├── RiskManagementAgent (7 proof points)
    │   └── RespecPackAgent (3 proof points)
    └── Brief Orchestrator
        └── Brief Generation Agents
```

## Implemented Opportunity Agents (4)

### 1. Volume Bundling Agent
- **Savings Benchmark**: 0-5%
- **Effort**: 3-6 months
- **Proof Points**: 8
  - PP_REGIONAL_SPEND
  - PP_TAIL_SPEND
  - PP_VOLUME_LEVERAGE
  - PP_PRICE_VARIANCE (shared)
  - PP_AVG_SPEND_SUPPLIER
  - PP_MARKET_CONSOLIDATION
  - PP_SUPPLIER_LOCATION
  - PP_SUPPLIER_RISK_RATING

### 2. Target Pricing Agent
- **Savings Benchmark**: 1-2%
- **Effort**: 3-6 months
- **Proof Points**: 4
  - PP_PRICE_VARIANCE (shared)
  - PP_TARIFF_RATE
  - PP_COST_STRUCTURE (shared)
  - PP_UNIT_PRICE

### 3. Risk Management Agent
- **Savings Benchmark**: Cost avoidance 1-3%
- **Effort**: Ongoing
- **Proof Points**: 7
  - PP_SINGLE_SOURCE
  - PP_GEO_RISK
  - PP_SUPPLIER_HEALTH
  - PP_CONTRACT_EXPIRY
  - PP_COMPLIANCE
  - PP_SUSTAINABILITY
  - PP_PRICE_VOLATILITY

### 4. Re-specification Pack Agent
- **Savings Benchmark**: 2-3%
- **Effort**: 6-9 months
- **Proof Points**: 3
  - PP_PRICE_VARIANCE (shared) - Spec standardization focus
  - PP_EXPORT_DATA (unique)
  - PP_COST_STRUCTURE (shared) - Material optimization focus

## Tech Stack

### Backend
- Framework: FastAPI 0.115
- Database: PostgreSQL + pgvector
- ORM: SQLAlchemy 2.0 (async)
- LLM: OpenAI + local hybrid

### Frontend
- Framework: Next.js 15 (App Router)
- Styling: Tailwind CSS 4
- Icons: Lucide React
- Components: Shadcn/UI (Radix UI)
- Animation: Framer Motion

## Adding New Opportunity Agents

1. Create folder: `backend/app/agents/opportunities/{agent_name}/`
2. Create files: `agent.py`, `__init__.py`, `README.md`
3. Add proof points to `proof_points.py`
4. Register in `opportunities/__init__.py`
5. Add to `opportunity_orchestrator.py`
6. Update frontend `LeverTheme` type
7. Update database model `LeverTheme` enum
8. Add API mappings in `opportunities.py` and `analysis.py`

## Project Guidelines
- Keep code concise and idiomatic
- Follow existing agent patterns for new implementations
- Ensure all shared proof points have context-specific interpretations
