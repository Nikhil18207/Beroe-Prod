# Beroe - AI-Powered Procurement Platform

An intelligent procurement optimization platform featuring "Max", an AI assistant that helps identify savings opportunities through multi-agent analysis.

## Architecture

```
                    ┌─────────────────────────────┐
                    │   MAIN ORCHESTRATOR AGENT   │
                    │   (Master Controller)       │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────┴───────────────┐
                    │                             │
          ┌─────────▼─────────┐       ┌──────────▼────────┐
          │   OPPORTUNITY 1   │       │   OPPORTUNITY 2   │
          │   (Volume Bundling)       │   (Target Pricing)│
          └─────────┬─────────┘       └──────────┬────────┘
                    │                            │
           ┌───────┬┴┬───────┐          ┌───────┬┴┬───────┐
          PP1    PP2   PP3            PP1    PP2   PP3

    (Each Opportunity has 2-4 Proof Points)
```

## Project Structure

```
BeroeProd/
├── frontend/              # Next.js 15 React application
│   ├── src/
│   │   ├── app/           # App Router pages (13 routes)
│   │   ├── components/    # UI components (53 Radix-based)
│   │   ├── context/       # App state management
│   │   ├── lib/api/       # API client & services
│   │   ├── types/         # TypeScript types
│   │   └── hooks/         # Custom React hooks
│   └── .env.local         # Environment config
│
├── backend/               # FastAPI Python backend
│   ├── agents/            # Multi-agent system
│   │   ├── orchestrator_agent.py   # Main controller
│   │   └── opportunity_agent.py    # Opportunity analysis
│   ├── engines/           # Business logic
│   │   ├── savings_calculator.py   # Savings calculation
│   │   └── proof_point_evaluator.py # Proof point evaluation
│   ├── models/            # Data models
│   ├── api/               # REST endpoints
│   └── config/            # Settings
│
└── backend_demo/          # Reference: Demo version backend
```

## Getting Started

### 1. Start Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API: http://localhost:8000
Docs: http://localhost:8000/docs

### 2. Start Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

App: http://localhost:3000

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/` | GET | Health check |
| `/api/v1/analyze` | POST | Full analysis with CSV upload |
| `/api/v1/analyze/quick` | POST | Quick analysis (no upload) |
| `/api/v1/session/{id}` | GET | Get session details |
| `/api/v1/session/{id}/recalculate` | POST | Recalculate savings |
| `/api/v1/opportunities/themes` | GET | List opportunity themes |

## Savings Calculation Model

Based on the two-level calculation:

### Category Level (Step 3)
- Input: Spend, Addressable %, Benchmarks, Maturity Score
- Output: Confidence-adjusted savings range

### Initiative Level (Steps 1, 2, 4)
- Step 1: Evaluate proof points → Low/Medium/High flags
- Step 2: Calculate Impact Score → Weightage
- Step 4: Calculate initiative savings = Category savings × Weightage

## Tech Stack

### Frontend
- Next.js 15.3.5 (App Router)
- React 19 + TypeScript 5
- Tailwind CSS 4
- Radix UI Components
- Framer Motion

### Backend
- Python 3.11+
- FastAPI
- Pydantic v2
- Pandas (data processing)
- Multi-agent architecture

## Data Flow

```
User Login → Setup Flow → Upload Data → Backend Analysis → Dashboard
                                ↓
                    ┌───────────────────────┐
                    │  Orchestrator Agent   │
                    │  - Initialize Category│
                    │  - Create Opportunities│
                    │  - Run Analysis       │
                    └───────────────────────┘
                                ↓
                    ┌───────────────────────┐
                    │  Opportunity Agents   │
                    │  - Create Proof Points│
                    │  - Evaluate Each PP   │
                    │  - Assign Impact Flags│
                    └───────────────────────┘
                                ↓
                    ┌───────────────────────┐
                    │  Savings Calculator   │
                    │  - Category Savings   │
                    │  - Initiative Weightage│
                    │  - Final Savings      │
                    └───────────────────────┘
                                ↓
                      Dashboard & Opportunities
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Backend (.env)
```bash
# LLM Provider (supports open source models)
# Priority: Ollama (local) > Groq > Together AI > OpenAI

# Option 1: Ollama (local, free, recommended for on-premise)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Option 2: Groq (cloud, fast, affordable)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# Option 3: Together AI (cloud)
TOGETHER_API_KEY=...
TOGETHER_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo

# Option 4: OpenAI (fallback)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Application
APP_ENV=development
```

## Open Source LLM Setup

The system supports multiple LLM providers for AI-powered procurement analysis. You can use free/low-cost open source models:

### Ollama (Recommended for Local)
```bash
# Install Ollama
# Windows: Download from https://ollama.ai
# Mac/Linux: curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.2

# Start Ollama (runs on port 11434)
ollama serve
```

### Groq (Recommended for Cloud)
1. Sign up at https://console.groq.com
2. Create an API key
3. Set `GROQ_API_KEY` in `.env`

Groq provides ultra-fast inference for open source models like Llama 3.3.
