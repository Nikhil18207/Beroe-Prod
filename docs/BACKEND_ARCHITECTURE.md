# Dual Orchestrator System - Complete Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      MASTER ORCHESTRATOR                                             │
│                                   (Top-Level Request Handler)                                        │
│                                                                                                      │
│   Responsibilities:                                                                                  │
│   • Receive user requests (analyze, brief, chat)                                                     │
│   • Route to appropriate sub-orchestrator                                                            │
│   • Combine results from both orchestrators when needed                                              │
│   • Manage session state                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 │                                                             │
                 ▼                                                             ▼
┌─────────────────────────────────────────────┐     ┌─────────────────────────────────────────────────┐
│                                             │     │                                                 │
│       OPPORTUNITY ORCHESTRATOR              │     │          BRIEF ORCHESTRATOR                     │
│       (Savings Calculation Flow)            │     │       (Leadership Brief Flow)                   │
│                                             │     │                                                 │
│   • Routes proof points to micro-agents     │     │   • Coordinates 4 specialized agents            │
│   • Aggregates results                      │     │   • Generates executive briefs                  │
│   • Calculates savings                      │     │   • Produces recommendations                    │
│                                             │     │                                                 │
└─────────────────────────────────────────────┘     └─────────────────────────────────────────────────┘
                 │                                                             │
                 │                                                             │
                 ▼                                                             ▼
        [DETAIL BELOW]                                                [DETAIL BELOW]
```

---

## OPPORTUNITY ORCHESTRATOR - Micro-Agent Routing Pattern

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OPPORTUNITY ORCHESTRATOR                                           │
│                                    (Router / Controller)                                             │
│                                                                                                      │
│   Maintains:                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                    PROOF POINT → OPPORTUNITY MAPPING TABLE                                   │   │
│   │                                                                                              │   │
│   │   Proof Point                              │  Belongs To Opportunities                       │   │
│   │   ─────────────────────────────────────────┼─────────────────────────────────────────────   │   │
│   │   Regional Spend Addressability            │  [1-Volume, 5-ReSpec, 7-Global]                │   │
│   │   Tail Spend Consolidation                 │  [1-Volume]                                    │   │
│   │   Volume Leverage from Fragmented Spend    │  [1-Volume, 5-ReSpec]                          │   │
│   │   Price Variance for Identical SKUs        │  [1-Volume, 2-Target, 3-Pack, 5-ReSpec, 11]    │   │
│   │   Tariff Rate                              │  [2-Target, 7-Global, 11-PriceVol]             │   │
│   │   Cost Structure                           │  [2-Target, 3-Pack, 7-Global, 11-PriceVol]     │   │
│   │   Unit Price                               │  [2-Target, 7-Global, 11-PriceVol]             │   │
│   │   Single Sourcing / Supplier Dependency    │  [4-Technical, 6-RiskMgmt, 8-SupplierConc]     │   │
│   │   Supplier Concentration Risk              │  [4-Technical, 6-RiskMgmt, 8-SupplierConc]     │   │
│   │   Supplier Risk Rating                     │  [1-Volume, 4-Technical, 6-RiskMgmt, 9-FinRisk]│   │
│   │   Geo Political Risk                       │  [6-RiskMgmt, 7-Global, 10-GeoRisk, 11]        │   │
│   │   Export Data                              │  [3-Pack, 4-Technical, 7-Global]               │   │
│   │   ... (41 proof points total)              │                                                │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          │                                           │
                          │  WHEN PROOF POINT NEEDS VALIDATION:       │
                          │                                           │
                          │  1. Look up which opportunities have it   │
                          │  2. Route to each relevant micro-agent    │
                          │  3. Each evaluates in ITS OWN context     │
                          │  4. Collect all results                   │
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                      │
│                              MICRO-AGENT POOL (Opportunity Agents)                                   │
│                                                                                                      │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │
│   │   OPP 1     │ │   OPP 2     │ │   OPP 3     │ │   OPP 4     │ │   OPP 5     │                   │
│   │             │ │             │ │             │ │             │ │             │                   │
│   │  VOLUME     │ │  TARGET     │ │  RE-SPEC    │ │  TECHNICAL  │ │  RE-SPEC    │                   │
│   │  BUNDLING   │ │  PRICING    │ │  (PACK)     │ │  DATA MINING│ │  (SPECS)    │                   │
│   │             │ │             │ │             │ │             │ │             │                   │
│   │  8 PPs      │ │  4 PPs      │ │  3 PPs      │ │  6 PPs      │ │  3 PPs      │                   │
│   │  2-5% BM    │ │  2-5% BM    │ │  2-3% BM    │ │  2-5% BM    │ │  2-3% BM    │                   │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘                   │
│                                                                                                      │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │
│   │   OPP 6     │ │   OPP 7     │ │   OPP 8     │ │   OPP 9     │ │   OPP 10    │                   │
│   │             │ │             │ │             │ │             │ │             │                   │
│   │    RISK     │ │  GLOBAL-    │ │  SUPPLIER   │ │  SUPPLIER   │ │  SUPPLIER   │                   │
│   │  MANAGEMENT │ │  IZATION    │ │  CONC RISK  │ │  FIN RISK   │ │  GEO RISK   │                   │
│   │             │ │             │ │             │ │             │ │             │                   │
│   │  7 PPs      │ │  9 PPs      │ │  2 PPs      │ │  1 PP       │ │  5 PPs      │                   │
│   │  2-5% BM    │ │  2-3% BM    │ │  RISK       │ │  RISK       │ │  RISK       │                   │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘                   │
│                                                                                                      │
│   ┌─────────────┐                                                                                    │
│   │   OPP 11    │   Each micro-agent:                                                                │
│   │             │   • Knows its proof points                                                         │
│   │   PRICE     │   • Has hypothesis/context for each                                                │
│   │  VOLATILITY │   • Evaluates in ITS context                                                       │
│   │    RISK     │   • Returns impact flag + insight                                                  │
│   │             │                                                                                    │
│   │  9 PPs      │                                                                                    │
│   │  RISK       │                                                                                    │
│   └─────────────┘                                                                                    │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Example: Proof Point Routing Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                      │
│   EXAMPLE: Validating "Regional Spend Addressability" Proof Point                                    │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OPPORTUNITY ORCHESTRATOR                                           │
│                                                                                                      │
│   Input: proof_point = "Regional Spend Addressability"                                               │
│          data = { spend_by_region: {...}, top_3_regions_pct: 95%, ... }                              │
│                                                                                                      │
│   Step 1: LOOKUP - Which opportunities have this proof point?                                        │
│           mapping["Regional Spend Addressability"] → [1, 5, 7]                                       │
│                                                                                                      │
│   Step 2: ROUTE - Send to micro-agents 1, 5, 7                                                       │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       │                        │                        │
                       ▼                        ▼                        ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│      MICRO-AGENT 1           │ │      MICRO-AGENT 5           │ │      MICRO-AGENT 7           │
│      (Volume Bundling)       │ │      (Re-specification)      │ │      (Globalization)         │
│                              │ │                              │ │                              │
│  Context:                    │ │  Context:                    │ │  Context:                    │
│  "If regions concentrated,   │ │  "If regions concentrated,   │ │  "If regions concentrated,   │
│   great for bundling         │ │   opportunity to harmonize   │ │   limited origin switching   │
│   volumes across sites"      │ │   specs across locations"    │ │   benefit available"         │
│                              │ │                              │ │                              │
│  Evaluation:                 │ │  Evaluation:                 │ │  Evaluation:                 │
│  95% in 3 regions =          │ │  95% in 3 regions =          │ │  95% in 3 regions =          │
│  EXCELLENT bundling          │ │  MODERATE harmonization      │ │  POOR for diversification    │
│  opportunity!                │ │  opportunity                 │ │  (already concentrated)      │
│                              │ │                              │ │                              │
│  ┌────────────────────────┐  │ │  ┌────────────────────────┐  │ │  ┌────────────────────────┐  │
│  │  RESULT:               │  │ │  │  RESULT:               │  │ │  │  RESULT:               │  │
│  │                        │  │ │  │                        │  │ │  │                        │  │
│  │  Impact: HIGH          │  │ │  │  Impact: MEDIUM        │  │ │  │  Impact: LOW           │  │
│  │                        │  │ │  │                        │  │ │  │                        │  │
│  │  Insight: "95% spend   │  │ │  │  Insight: "Regional    │  │ │  │  Insight: "Already     │  │
│  │  in India/Malaysia     │  │ │  │  concentration allows  │  │ │  │  concentrated in few   │  │
│  │  enables cross-site    │  │ │  │  spec standardization  │  │ │  │  regions - switching   │  │
│  │  volume consolidation" │  │ │  │  across 3 locations"   │  │ │  │  origins limited"      │  │
│  └────────────────────────┘  │ │  └────────────────────────┘  │ │  └────────────────────────┘  │
│                              │ │                              │ │                              │
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
                       │                        │                        │
                       └────────────────────────┼────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OPPORTUNITY ORCHESTRATOR                                           │
│                                                                                                      │
│   Step 3: AGGREGATE RESULTS                                                                          │
│                                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │  Proof Point: "Regional Spend Addressability"                                                │   │
│   │                                                                                              │   │
│   │  Results:                                                                                    │   │
│   │  ├── Opp 1 (Volume Bundling):    HIGH   - "Great bundling opportunity"                      │   │
│   │  ├── Opp 5 (Re-specification):   MEDIUM - "Moderate spec harmonization"                     │   │
│   │  └── Opp 7 (Globalization):      LOW    - "Limited origin switching"                        │   │
│   │                                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                      │
│   Step 4: UPDATE each opportunity's impact score based on these flags                                │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## BRIEF ORCHESTRATOR - Agent Coordination Pattern

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      BRIEF ORCHESTRATOR                                              │
│                               (Coordinates 4 Specialized Agents)                                     │
│                                                                                                      │
│   Input: Analysis results from Opportunity Orchestrator                                              │
│   Output: Leadership Brief with recommendations                                                      │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │ Sequential / Parallel Execution
                                                │
        ┌───────────────────────────────────────┼───────────────────────────────────────┐
        │                                       │                                       │
        ▼                                       ▼                                       ▼
┌───────────────────────┐           ┌───────────────────────┐           ┌───────────────────────┐
│   DATA ANALYSIS       │           │   RISK ASSESSMENT     │           │   MARKET INTEL        │
│   AGENT               │           │   AGENT               │           │   AGENT               │
│                       │           │                       │           │                       │
│   Calculates:         │           │   Calculates:         │           │   Provides:           │
│   • HHI Index         │           │   • Risk Matrix       │           │   • Low-cost regions  │
│   • Supplier %        │           │   • 35-Rule Eval      │           │   • Cost drivers      │
│   • Regional %        │           │   • Compliance Rate   │           │   • Savings ranges    │
│   • Tail spend        │           │   • Violations        │           │   • Industry config   │
│   • Performance       │           │   • Warnings          │           │   • Regional insights │
│                       │           │                       │           │                       │
│   Output:             │           │   Output:             │           │   Output:             │
│   supplier_analysis   │           │   risk_matrix         │           │   industry_config     │
│   regional_analysis   │           │   rule_evaluation     │           │   regional_insights   │
│   hhi_metrics         │           │   risk_reasoning      │           │   market_context      │
└───────────────────────┘           └───────────────────────┘           └───────────────────────┘
        │                                       │                                       │
        └───────────────────────────────────────┼───────────────────────────────────────┘
                                                │
                                                │ All results feed into
                                                │
                                                ▼
                            ┌───────────────────────────────────────┐
                            │       RECOMMENDATION AGENT            │
                            │                                       │
                            │   Uses all above data to generate:    │
                            │   • Supplier reduction strategy       │
                            │   • Regional diversification plan     │
                            │   • Cost advantage calculations       │
                            │   • ROI projections (3-year)          │
                            │   • Implementation timeline (26 wks)  │
                            │   • Strategic outcomes                │
                            │   • Next steps                        │
                            │                                       │
                            └───────────────────────────────────────┘
                                                │
                                                │
                                                ▼
                            ┌───────────────────────────────────────┐
                            │         LEADERSHIP BRIEF              │
                            │                                       │
                            │   • Executive Summary (LLM)           │
                            │   • Current State Analysis            │
                            │   • Risk Statement (LLM)              │
                            │   • Recommendations                   │
                            │   • ROI Projections                   │
                            │   • Implementation Timeline           │
                            │   • Strategic Outcomes                │
                            │   • Next Steps                        │
                            │                                       │
                            └───────────────────────────────────────┘
```

---

## Complete Data Flow - Both Orchestrators

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         USER REQUEST                                                 │
│                                                                                                      │
│   {                                                                                                  │
│     category: "Vegetable Oils",                                                                      │
│     spend: 50000000,                                                                                 │
│     csv_file: spend_data.csv,                                                                        │
│     goals: { cost: 40, risk: 35, esg: 25 },                                                          │
│     request_type: "full_analysis"   // or "brief" or "opportunities_only"                            │
│   }                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      MASTER ORCHESTRATOR                                             │
│                                                                                                      │
│   1. Parse request                                                                                   │
│   2. Create session                                                                                  │
│   3. Determine flow:                                                                                 │
│      • "opportunities_only" → Opportunity Orchestrator only                                          │
│      • "brief" → Brief Orchestrator only (needs prior analysis)                                      │
│      • "full_analysis" → Both orchestrators                                                          │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │ For "full_analysis"
                                                │
                ┌───────────────────────────────┴───────────────────────────────┐
                │                                                               │
                ▼                                                               │
┌───────────────────────────────────────────────┐                               │
│         OPPORTUNITY ORCHESTRATOR              │                               │
│                                               │                               │
│  1. Initialize Category                       │                               │
│  2. Parse CSV → spend_df                      │                               │
│  3. Create 3 Opportunity Micro-Agents         │                               │
│                                               │                               │
│  4. FOR EACH of 41 Proof Points:              │                               │
│     ┌─────────────────────────────────────┐   │                               │
│     │ a. Which opportunities have this PP?│   │                               │
│     │ b. Route to those micro-agents      │   │                               │
│     │ c. Each evaluates in its context    │   │                               │
│     │ d. Collect impact flags             │   │                               │
│     └─────────────────────────────────────┘   │                               │
│                                               │                               │
│  5. Calculate impact scores per opportunity   │                               │
│  6. Calculate category-level savings          │                               │
│  7. Calculate weightages                      │                               │
│  8. Distribute savings to opportunities       │                               │
│                                               │                               │
│  Output: SavingsResult                        │                               │
│  ├── category_calculation                     │                               │
│  ├── opportunity_calculations[]               │                               │
│  ├── total_savings_low/high                   │                               │
│  └── confidence_score/bucket                  │                               │
│                                               │                               │
└───────────────────────────────────────────────┘                               │
                │                                                               │
                │ Analysis results                                              │
                │                                                               │
                └───────────────────────────────┬───────────────────────────────┘
                                                │
                                                ▼
                ┌───────────────────────────────────────────────────────────────┐
                │                     BRIEF ORCHESTRATOR                        │
                │                                                               │
                │  Input: SavingsResult from Opportunity Orchestrator           │
                │                                                               │
                │  1. DataAnalysisAgent → HHI, concentration metrics            │
                │  2. RiskAssessmentAgent → Risk matrix, 35 rules               │
                │  3. MarketIntelAgent → Regions, cost drivers                  │
                │  4. RecommendationAgent → ROI, timeline, strategy             │
                │  5. Assemble LeadershipBrief                                  │
                │                                                               │
                │  Output: LeadershipBrief                                      │
                │  ├── executive_summary (LLM)                                  │
                │  ├── risk_matrix                                              │
                │  ├── roi_projections                                          │
                │  ├── implementation_timeline                                  │
                │  └── strategic_recommendations (LLM)                          │
                │                                                               │
                └───────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         API RESPONSE                                                 │
│                                                                                                      │
│   {                                                                                                  │
│     "session_id": "abc-123",                                                                         │
│     "status": "success",                                                                             │
│                                                                                                      │
│     "analysis": {                           // From Opportunity Orchestrator                         │
│       "category": { ... },                                                                           │
│       "opportunities": [                                                                             │
│         {                                                                                            │
│           "id": "opp-1",                                                                             │
│           "lever_theme": "Volume Bundling",                                                          │
│           "impact_score": 7.18,                                                                      │
│           "impact_bucket": "Medium",                                                                 │
│           "savings_low": 358139,                                                                     │
│           "savings_high": 434883,                                                                    │
│           "proof_points": [                                                                          │
│             { "name": "Regional Spend", "impact": "HIGH", "insight": "..." },                        │
│             { "name": "Tail Spend", "impact": "HIGH", "insight": "..." },                            │
│             ...                                                                                      │
│           ]                                                                                          │
│         },                                                                                           │
│         ...                                                                                          │
│       ],                                                                                             │
│       "savings_summary": {                                                                           │
│         "total_savings_low": 2390916,                                                                │
│         "total_savings_high": 3809083,                                                               │
│         "confidence_score": 0.49,                                                                    │
│         "confidence_bucket": "Low"                                                                   │
│       }                                                                                              │
│     },                                                                                               │
│                                                                                                      │
│     "brief": {                              // From Brief Orchestrator                               │
│       "executive_summary": "...",                                                                    │
│       "risk_matrix": { ... },                                                                        │
│       "roi_projections": { ... },                                                                    │
│       "implementation_timeline": [ ... ],                                                            │
│       "strategic_recommendations": "..."                                                             │
│     }                                                                                                │
│   }                                                                                                  │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Insight: Same Proof Point, Different Contexts

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                      │
│   WHY MICRO-AGENTS MATTER: Context-Dependent Evaluation                                              │
│                                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                              │   │
│   │   Proof Point: "Regional Spend Addressability"                                               │   │
│   │   Data: 95% spend concentrated in India/Malaysia (3 regions)                                 │   │
│   │                                                                                              │   │
│   │   ┌─────────────────────┬─────────────────────┬─────────────────────┐                       │   │
│   │   │   Opp 1: Volume     │   Opp 5: Re-spec    │   Opp 7: Global     │                       │   │
│   │   │   Bundling          │   (Specs)           │   ization           │                       │   │
│   │   ├─────────────────────┼─────────────────────┼─────────────────────┤                       │   │
│   │   │                     │                     │                     │                       │   │
│   │   │   Context:          │   Context:          │   Context:          │                       │   │
│   │   │   "Concentration    │   "Concentration    │   "Concentration    │                       │   │
│   │   │   = bundling        │   = harmonize       │   = can't switch    │                       │   │
│   │   │   opportunity"      │   specs"            │   origins"          │                       │   │
│   │   │                     │                     │                     │                       │   │
│   │   ├─────────────────────┼─────────────────────┼─────────────────────┤                       │   │
│   │   │                     │                     │                     │                       │   │
│   │   │   Impact: HIGH ✓    │   Impact: MEDIUM    │   Impact: LOW       │                       │   │
│   │   │                     │                     │                     │                       │   │
│   │   │   "95% in 3 regions │   "Can standardize  │   "Already in few   │                       │   │
│   │   │   = GREAT for       │   specs across      │   regions, limited  │                       │   │
│   │   │   consolidating     │   these locations"  │   diversification   │                       │   │
│   │   │   volumes!"         │                     │   possible"         │                       │   │
│   │   │                     │                     │                     │                       │   │
│   │   └─────────────────────┴─────────────────────┴─────────────────────┘                       │   │
│   │                                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                      │
│   SAME DATA → DIFFERENT IMPACT → DIFFERENT INSIGHTS                                                  │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Component | Role |
|-----------|------|
| **Master Orchestrator** | Routes requests, manages sessions, combines results |
| **Opportunity Orchestrator** | Routes proof points to micro-agents, calculates savings |
| **Opportunity Micro-Agents** | Each evaluates proof points in ITS OWN context |
| **Brief Orchestrator** | Coordinates 4 agents for leadership brief |
| **Brief Agents** | Data, Risk, Market, Recommendation specialists |

**The key innovation: Same proof point → Different micro-agents → Different impact flags based on context!**
