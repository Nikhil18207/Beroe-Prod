# COMPREHENSIVE FRONTEND-BACKEND INTEGRATION TABLE

## BEROE AI PROCUREMENT PLATFORM - Hardcoded to Real-Time Mapping

**Total Pages Analyzed:** 14
**LLM-required endpoints:** ~15
**Pure backend endpoints:** ~12
**Total API endpoints needed:** ~30

---

## MAIN INTEGRATION TABLE

| **PAGE ROUTE** | **HARDCODED DATA** | **REPLACEMENT STRATEGY** | **BACKEND/LLM REQUIREMENT** |
|----------------|-------------------|-------------------------|----------------------------|
| **`/` (Login)** | User data hardcoded: `"Enterprise Corp"`, `"Procurement Manager"` | **API**: `POST /api/auth/login` returns user profile | **Pure Backend** - Database lookup |
| **`/setup`** | `tasks` array with setup steps, `completedSteps` from context | **API**: `GET /api/setup/status` - Track setup progress | **Pure Backend** - State management |
| **`/setup/portfolio`** | `AVAILABLE_LOCATIONS` (126 countries/regions), fallback portfolio items | **API**: `GET /api/portfolio` already exists, `GET /api/locations` for global list | **Pure Backend** - Database |
| **`/setup/goals`** | Goal sliders (cost/risk/esg), `MAX_TOTAL = 200` budget | **API**: `POST /api/goals` to save, `GET /api/goals` to retrieve | **Pure Backend** - User preferences |
| **`/setup/review`** | `DATA_FIELDS` array (Spend by Location, Supplier, Volume, Price), `opportunities` from context, `proofPoints` | **API**: `GET /api/analysis/opportunities` + `GET /api/proofpoints` | **LLM Required** - Proof point evaluation uses Dual Orchestrator |
| **`/setup/review/coconut`** | `steps` array, `dataPoints` array with status/dates | **API**: `GET /api/categories/{id}/datapoints` | **Pure Backend** - Database |
| **`/setup/summary`** | `locations` array (US 34%, Canada 29%...), `suppliers` array (Asia Pacific Grains 34%...) | **API**: `GET /api/analysis/spend-summary` | **LLM Required** - Spend data analysis via Master Orchestrator |
| **`/setup/processing`** | `statuses` array ("Analyzing your spend data..."), 4-second timer | **WebSocket**: Real-time status from backend analysis | **LLM Required** - Shows actual analysis progress |
| **`/dashboard`** | `recentConversations` (3 items), `totalSavings` fallback "$2.4M", `qualifiedCount`/`potentialCount` defaults | **API**: `GET /api/dashboard/summary`, `GET /api/conversations/recent` | **LLM Required** for savings calculation, **Pure Backend** for conversations |
| **`/today`** | `todayInsights` (3 areas, 6 opportunities), `newOpportunities` (3 items), `attentionAreas` (3 items), `recentFlows` (3 items), `yesterdayItems` (2 items) | **API**: `GET /api/today/insights`, `GET /api/alerts`, `GET /api/flows/recent` | **LLM Required** - AI generates insights, monitors risks |
| **`/opportunities`** | `qualifiedOpportunities` (5 items), `potentialOpportunities` (2 items), savings range defaults | **API**: `GET /api/opportunities` (already partially connected), `GET /api/savings/summary` | **LLM Required** - Opportunity Orchestrator evaluates all 11 initiatives × 41 proof points |
| **`/opportunities/details`** | `questionOptions` (4 maturity questions), `tests` (5 items), `recommendations` (3 items), chart data (Pulp NBSK index) | **API**: `GET /api/opportunity/{id}/details`, `GET /api/indices/{type}` | **LLM Required** - Brief Orchestrator generates tests/recommendations |
| **`/opportunities/accepted`** | `processingSteps` (5 items), generated summary document with €2.4M savings, 4 initiatives | **API**: `POST /api/opportunity/{id}/accept`, `GET /api/summary/generate` | **LLM Required** - Summary generation, savings aggregation |
| **`/chat`** | `relevantOpportunities` (2 items), simulated conversation flow, `panelState` states, sourcing simulation data | **WebSocket**: `ws://api/chat`, **API**: `POST /api/chat/message` | **LLM Required** - Conversational AI with RAG, document analysis |

---

## DETAILED BREAKDOWN BY COMPONENT

### 1. `/setup/review` - Data Upload & Validation

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| CSV Column Detection | Client-side parsing only | **API**: `POST /api/upload/validate` → Returns detected columns + field mapping |
| Data Fields Available | Hardcoded `DATA_FIELDS` array | **API**: Response includes which fields were found in uploaded data |
| Opportunities List | Static from context | **API**: `GET /api/opportunities` → Dual Orchestrator evaluates proof points |
| Proof Points | Manual validation checkboxes | **API**: `POST /api/proofpoint/{id}/validate` → Updates opportunity qualification |
| Contract File Analysis | No actual analysis | **API**: `POST /api/contracts/analyze` → **LLM extracts** pricing terms, expiry dates, clauses |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/setup/review/page.tsx
const DATA_FIELDS: DataField[] = [
  { name: "Spend by Location", requiredColumns: ["country", "region", "location", "supplier_country", "supplier_region", "geography"], description: "Geographic spend distribution" },
  { name: "Spend by Supplier", requiredColumns: ["supplier", "supplier_name", "supplier_id", "vendor", "vendor_name"], description: "Supplier spend breakdown" },
  { name: "Volume by Supplier", requiredColumns: ["volume", "quantity", "qty", "units", "volume_kg", "volume_mt"], description: "Volume data per supplier" },
  { name: "Volume by Geography", requiredColumns: ["volume", "quantity", "qty"], description: "Volume data by region" },
  { name: "Price", requiredColumns: ["price", "unit_price", "price_per_unit", "rate", "cost_per_unit"], description: "Pricing information" }
];
```

---

### 2. `/opportunities` - Main Opportunity View

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| Qualified Opportunities | 5 hardcoded items with fixed category/impact/effort | **API**: `GET /api/opportunities?status=qualified` → Opportunity Orchestrator generates |
| Potential Opportunities | 2 hardcoded items | **API**: `GET /api/opportunities?status=potential` |
| Total Savings Range | Fallback `$1.9M - $3M` | **API**: `GET /api/savings/summary` → Calculated from all initiative benchmarks |
| Confidence Score | Fallback `80%` | Backend calculates based on validated proof points |
| Impact Bucket (High/Medium/Low) | Hardcoded per card | **LLM determines** based on proof point evaluation scores |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/opportunities/page.tsx
const qualifiedOpportunities = [
  { category: "CORRUGATE", title: "Use cost model driven pricing mechanisms", type: "Savings", impact: "High", effort: "3-6 months", risk: "-2", esg: "0", confidence: 65, status: "Qualified", isNew: true, questionsToAnswer: 2 },
  { category: "CORRUGATE", title: "Consider Volume consolidation for better discounts", type: "Savings", impact: "Medium", effort: "3-6 months", risk: "-2", esg: "0", confidence: 65, status: "Qualified", isNew: true, questionsToAnswer: 2 },
  { category: "CORRUGATE", title: "Adjust sourcing mix to minimise tariff impact", type: "Resilience", impactLabel: "Risk Reduction", impact: "High", effort: "3-6 months", esg: "-2", savings: "Low", confidence: 65, status: "Qualified", questionsToAnswer: 2 },
  { category: "STEEL", title: "Explore adding new suppliers to reduce supplier risk", type: "Resilience", impactLabel: "Risk Reduction", impact: "High", effort: "3-6 months", esg: "-2", savings: "Low", confidence: 65, status: "Qualified", badge: "Impacted", questionsToAnswer: 2 },
  { category: "CORRUGATE", title: "Standardise payment terms across suppliers to 60 days", type: "Resilience", impactLabel: "Risk Reduction", impact: "High", effort: "3-6 months", esg: "-2", savings: "Low", confidence: 65, status: "Qualified", questionsToAnswer: 2 }
];

const potentialOpportunities = [
  { category: "STEEL", title: "Rationalise corrugate SKUs to reduce low value/ volume items", type: "Savings", impact: "High", effort: "3-6 months", confidence: 65, status: "Potential", isNew: true, questionsToAnswer: 2 },
  { category: "STEEL", title: "Consolidate demands across sites to leverage economies of scale", type: "Savings", impact: "High", effort: "3-6 months", confidence: 65, status: "Potential", isNew: true, questionsToAnswer: 2 }
];
```

---

### 3. `/opportunities/details` - Opportunity Deep Dive

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| Question Options | 4 maturity options for cost models | **API**: `GET /api/opportunity/{id}/questions` → **LLM generates** context-specific questions from methodology |
| Tests (How I tested) | 5 hardcoded test descriptions | **API**: `GET /api/opportunity/{id}/tests` → **Brief Orchestrator generates** based on actual data analyzed |
| Recommendations | 3 hardcoded recommendations | **API**: `GET /api/opportunity/{id}/recommendations` → **LLM generates** actionable next steps |
| Chart Data (Pulp NBSK) | Static SVG path | **API**: `GET /api/indices/pulp-nbsk?range=1y` → Real market data |
| Price Analysis Insights | 2 hardcoded info boxes | **LLM generates** insights by comparing user's prices vs market indices |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/opportunities/details/page.tsx
const questionOptions = [
  "No cost models available. Fixed price with suppliers",
  "Cost models available, pricing mechanism defined by suppliers",
  "Cost models defined, occasionally used for pricing adjustments",
  "Cost models defined, variable pricing formulae automatically calculated based on latest market indicies"
];

const tests = [
  { text: "Analyzed spend data to find out the high spend suppliers and checked for price variations in them.", completed: true },
  { text: "Determined the key levers and test questions for the corrugates from Kearney framework", completed: true },
  { text: "I looked into the contracts of Westrock and International Paper", completed: true },
  { text: "I looked at the relevant external price indicies (pulp NBSK index)", completed: true },
  { text: "Determined that Pulp is the key cost driver for corrugates from the kearney industry playbook", completed: true }
];

const recommendations = [
  { text: "Switch to index based pricing - kraft liner index O211 or RISI", checked: true },
  { text: "Re-negotiate with your two major suppliers, Westrock and International paper", checked: true },
  { text: "Set up bilateral negotiation with Westrock in Negotip tool", checked: true }
];
```

---

### 4. `/chat` - AI Assistant Interface

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| Conversation Flow | Simulated with `setTimeout` | **WebSocket**: Real-time streaming responses from LLM |
| Document Analysis | Fake file upload | **API**: `POST /api/documents/analyze` → **LLM extracts** data from PDFs/Excel |
| Category Summary Card | Hardcoded vegetable oils summary | **LLM generates** summary from analyzed data |
| Opportunity Cards | Static cards | **API**: `GET /api/opportunities/relevant?query={userQuery}` |
| Sourcing Simulation | Hardcoded Malaysia/Indonesia sliders | **API**: `POST /api/simulation/sourcing` → **LLM calculates** cost/risk/ESG impact |
| Panel States | 10 hardcoded states | Backend sends `panelState` based on analysis progress |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/chat/page.tsx
const relevantOpportunities = [
  { id: "1", title: "Vegetable Oils ESG Compliance Enhance...", description: "Current supplier ESG assessment reveals significant compliance gaps...", savingsImpact: "Mid", effort: "1 week", time: "Just Now" },
  { id: "2", title: "Consolidate Spend with Top Performers", description: "You have 5 suppliers for Office Supplies in North America with similar performance ratings...", savingsImpact: "High", effort: "0-3 months", time: "Just Now" }
];

type PanelState = "empty" | "updating_profile" | "risk_profile" | "spend_overview" | "analysing_documents" | "category_summary" | "top_opportunity" | "opportunity_rationale" | "analysing_levers" | "simulation_mode";
```

---

### 5. `/today` - Daily Insights

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| Areas Needing Attention | 3 hardcoded alerts | **API**: `GET /api/alerts/today` → **LLM monitors** supplier performance, contract expirations |
| New Opportunities Count | Hardcoded `6` | Backend counts opportunities created in last 24h |
| Attention Areas | Contract drift, price index, ESG certification | **LLM generates** from real-time data monitoring |
| Recent Flows | 3 hardcoded conversations | **API**: `GET /api/flows/recent` → Actual conversation history |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/today/page.tsx
const todayInsights = { areasNeedingAttention: 3, newOpportunities: 6 };

const newOpportunities = [
  { id: "1", title: "Consolidate Spend with Top Performers", category: "CORRUGATE", impact: "High", savings: "$450K - $680K", confidence: 78, description: "Consolidate 60% of corrugate spend with top 3 suppliers to achieve volume discounts of 8-12%.", isNew: true },
  { id: "2", title: "Renegotiate Expiring Contracts", category: "STEEL", impact: "Medium", savings: "$320K - $480K", confidence: 65, description: "3 contracts expiring in Q2 present opportunity for better terms based on market conditions.", isNew: true },
  { id: "3", title: "Supplier ESG Compliance Gap", category: "PACKAGING", impact: "High", savings: "Risk Reduction", confidence: 82, description: "2 tier-1 suppliers have expiring ESG certifications that need immediate attention.", isNew: true }
];

const attentionAreas = [
  { id: "1", type: "alert", title: "Contract Performance Drift", description: "Packaging Materials Corp showing 15% delivery delays", severity: "high" },
  { id: "2", type: "warning", title: "Price Index Change", description: "Steel commodity prices up 8% this month", severity: "medium" },
  { id: "3", type: "info", title: "Supplier Risk Update", description: "AgroPure Ltd. ESG certification expires in 30 days", severity: "low" }
];

const recentFlows = [
  { id: "1", title: "Freight Consolidation Savings in Asia Ro...", description: "Max identified fragmented shipments between...", time: "2 hours ago", icon: "layers" },
  { id: "2", title: "Expiring Supplier ESG Certification", description: "One of your tier-1 suppliers, AgroPure Ltd., has a...", time: "2 days ago", icon: "file" },
  { id: "3", title: "Contract Performance Drift – Packaging...", description: "Max flagged declining performance trends in a k...", time: "Last week", icon: "chart" }
];

const yesterdayItems = [
  { id: "1", title: "Market Intelligence Update", description: "New data on corrugate pricing trends in APAC region", time: "Yesterday" },
  { id: "2", title: "Supplier Scorecard Review", description: "Q4 performance scores ready for review", time: "Yesterday" }
];
```

---

### 6. `/dashboard` - Main Dashboard

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| Recent Conversations | 3 hardcoded items | **API**: `GET /api/conversations/recent` |
| Total Savings | Fallback "$2.4M" | **API**: `GET /api/savings/summary` |
| Qualified/Potential Counts | Defaults 5/2 | **API**: `GET /api/opportunities/counts` |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/dashboard/page.tsx
const recentConversations = [
  { id: "1", title: "Freight Consolidation Savings in Asia Ro...", description: "Max identified fragmented shipments between...", time: "2 HOURS AGO" },
  { id: "2", title: "Expiring Supplier ESG Certification", description: "One of your tier-1 suppliers, AgroPure Ltd., has a...", time: "2 DAYS AGO" },
  { id: "3", title: "Contract Performance Drift – Packaging...", description: "Max flagged declining performance trends in a k...", time: "LAST WEEK" }
];

// Fallback values
const totalSavings = state.savingsSummary?.total_savings_low ? `$${(state.savingsSummary.total_savings_low / 1000000).toFixed(1)}M` : "$2.4M";
const qualifiedCount = state.opportunities?.filter(o => o.impact_bucket === "High" || o.impact_bucket === "Medium").length || 5;
const potentialCount = state.opportunities?.filter(o => o.impact_bucket === "Low").length || 2;
```

---

### 7. `/setup/summary` - Spend Summary View

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| Locations List | 6 hardcoded items (US 34%, Canada 29%...) | **API**: `GET /api/analysis/spend-by-location` |
| Suppliers List | 6 hardcoded items (Asia Pacific Grains 34%...) | **API**: `GET /api/analysis/spend-by-supplier` |
| Total Spend | Hardcoded "$3.3M" | **API**: From uploaded spend data |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/setup/summary/page.tsx
const locations = [
  { name: "United States", value: "34%" },
  { name: "Canada", value: "29%" },
  { name: "Mexico", value: "21%" },
  { name: "Germany", value: "7%" },
  { name: "Japan", value: "3%" },
  { name: "France", value: "1%", ghost: true },
];

const suppliers = [
  { name: "Asia Pacific Grains", value: "34%" },
  { name: "Pacific Rim Cereals", value: "29%" },
  { name: "EuroGrain Trading", value: "21%" },
  { name: "Orient Food Supply", value: "7%" },
  { name: "Brazilian Grain Consortium", value: "3%" },
  { name: "Nordic Cereals Ltd", value: "1%", ghost: true },
];
```

---

### 8. `/opportunities/accepted` - Accepted Opportunity Summary

| **FEATURE** | **CURRENT (Hardcoded)** | **REAL-TIME REPLACEMENT** |
|-------------|------------------------|---------------------------|
| Processing Steps | 5 hardcoded steps | **WebSocket**: Real-time progress updates |
| Summary Document | Hardcoded €2.4M savings, 4 initiatives | **API**: `GET /api/summary/generate` → **LLM generates** |

**Hardcoded Data in Code:**
```typescript
// frontend/src/app/opportunities/accepted/page.tsx
const processingSteps = [
  { icon: "document", title: "Detected 5 contracts", result: "2 Insights", expandable: true },
  { icon: "bullet", title: "updating insights from contracts", result: "5 Results", expandable: true, indent: true },
  { icon: "document", title: "Consolidating price variance from send data", expandable: false },
  { icon: "bullet", title: "5 similar SKUs and 10 same SKUs with different pricing identified", expandable: false, indent: true },
  { icon: "document", title: "Comparing Price Trends", result: "3 Results", expandable: true }
];

// Summary metrics (hardcoded in JSX)
// Projected Savings: €2.4M ($1.3M)
// Risk Reduction: 5%
// Active Initiatives: 4
```

---

## BACKEND API ENDPOINTS NEEDED

### Authentication
```
POST /api/auth/login
GET  /api/auth/user
```

### Portfolio & Setup
```
GET  /api/portfolio
POST /api/portfolio/categories
PUT  /api/portfolio/categories/{id}
DELETE /api/portfolio/categories/{id}
POST /api/goals
GET  /api/setup/status
GET  /api/locations                    # Global locations list
```

### Data Upload & Analysis
```
POST /api/upload/spend-data
POST /api/upload/validate
POST /api/contracts/analyze            ← LLM Required
POST /api/documents/analyze            ← LLM Required
```

### Opportunities (Dual Orchestrator)
```
GET  /api/opportunities                ← LLM (Opportunity Orchestrator)
GET  /api/opportunities/{id}
GET  /api/opportunities/{id}/details   ← LLM (Brief Orchestrator)
GET  /api/opportunities/{id}/questions ← LLM
GET  /api/opportunities/{id}/tests     ← LLM
GET  /api/opportunities/{id}/recommendations ← LLM
POST /api/opportunities/{id}/validate
POST /api/opportunities/{id}/accept
GET  /api/opportunities/relevant       ← LLM (Query-based retrieval)
GET  /api/opportunities/counts
```

### Proof Points
```
GET  /api/proofpoints
POST /api/proofpoints/{id}/validate
```

### Savings & Analysis
```
GET  /api/savings/summary              ← LLM (Calculates from 11 initiatives)
GET  /api/analysis/spend-summary       ← LLM
GET  /api/analysis/spend-by-location
GET  /api/analysis/spend-by-supplier
GET  /api/analysis/opportunities
```

### Market Data
```
GET  /api/indices/{type}               # (pulp-nbsk, kraft-liner, etc.)
```

### Dashboard & Today
```
GET  /api/dashboard/summary
GET  /api/today/insights               ← LLM
GET  /api/alerts                       ← LLM (monitoring)
GET  /api/alerts/today
GET  /api/flows/recent
GET  /api/conversations/recent
```

### Chat & Simulation
```
POST /api/chat/message                 ← LLM (RAG + Conversation)
WS   /api/chat/stream                  ← LLM (Streaming)
POST /api/simulation/sourcing          ← LLM
POST /api/summary/generate             ← LLM
```

---

## LLM vs PURE CALCULATION SUMMARY

### PURE CALCULATION/DATABASE (No LLM)
- User authentication
- Portfolio CRUD operations
- Goal preferences storage
- Setup progress tracking
- Location/supplier lookups
- Conversation history retrieval
- Market index data retrieval
- File upload storage
- Opportunity counts

### LLM REQUIRED
- Proof point evaluation (41 proof points × context)
- Opportunity impact scoring
- Brief generation (tests, recommendations)
- Document/contract analysis
- Chat conversations
- Insights generation (Today page)
- Sourcing simulation
- Savings calculations (initiative benchmarks)
- Summary document generation
- Alert/risk monitoring

---

## KEY INTEGRATION POINTS

### 1. Dual Orchestrator Flow
```
Master Orchestrator
    ├── Opportunity Orchestrator
    │   ├── Volume Bundling Micro-Agent
    │   ├── Target Pricing Micro-Agent
    │   ├── Re-spec Pack Micro-Agent
    │   ├── Technical Data Mining Micro-Agent
    │   ├── Re-spec Specs Micro-Agent
    │   ├── Risk Management Micro-Agent
    │   ├── Globalization Micro-Agent
    │   ├── Supplier Concentration Micro-Agent
    │   ├── Financial Risk Micro-Agent
    │   ├── Geopolitical Risk Micro-Agent
    │   └── Price Volatility Micro-Agent
    │
    └── Brief Orchestrator
        ├── Test Generator
        ├── Recommendation Engine
        └── Summary Generator
```

### 2. Contract File Analysis (`/setup/review`)
- User uploads 2 contract files
- **LLM extracts**: pricing terms, payment terms, expiry dates, clauses
- Updates proof points automatically
- Triggers opportunity re-evaluation

### 3. Real-Time Chat (`/chat`)
- WebSocket for streaming responses
- RAG retrieval from uploaded documents + market data
- Panel state updates based on analysis progress
- Document analysis with real-time feedback

### 4. Proof Point Flow
```
User validates proof point
    → POST /api/proofpoints/{id}/validate
    → Backend recalculates opportunity scores
    → Updates Qualified/Potential status
    → Frontend refreshes opportunity cards
```

### 5. Savings Calculation
```
For each of 11 initiatives:
    → Evaluate 3-5 proof points
    → Calculate impact score
    → Apply category benchmark (e.g., 1.5% for Volume Bundling)
    → Sum across initiatives
    → Return range (low - high)
```

---

## FILE LOCATIONS REFERENCE

| Page | File Path |
|------|-----------|
| Login | `frontend/src/app/page.tsx` |
| Setup | `frontend/src/app/setup/page.tsx` |
| Portfolio | `frontend/src/app/setup/portfolio/page.tsx` |
| Goals | `frontend/src/app/setup/goals/page.tsx` |
| Review | `frontend/src/app/setup/review/page.tsx` |
| Review Coconut | `frontend/src/app/setup/review/coconut/page.tsx` |
| Summary | `frontend/src/app/setup/summary/page.tsx` |
| Processing | `frontend/src/app/setup/processing/page.tsx` |
| Dashboard | `frontend/src/app/dashboard/page.tsx` |
| Today | `frontend/src/app/today/page.tsx` |
| Opportunities | `frontend/src/app/opportunities/page.tsx` |
| Opportunity Details | `frontend/src/app/opportunities/details/page.tsx` |
| Accepted Opportunity | `frontend/src/app/opportunities/accepted/page.tsx` |
| Chat | `frontend/src/app/chat/page.tsx` |
