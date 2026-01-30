# BeroeProd Hybrid Data Architecture

**Version:** 1.0  
**Date:** January 27, 2026  
**Author:** Development Team

---

## Executive Summary

This document outlines the hybrid data architecture for the BeroeProd procurement intelligence platform. The architecture combines real-time data upload flexibility with pre-computed metrics caching for optimal performance.

---

## 1. System Overview

### 1.1 Core Principle

```
Real-Time Upload → One-Time Compute → Cache → Fast Agent Access
```

Instead of computing metrics on every request, we:
1. Accept user uploads (4 data sources)
2. Compute all metrics ONCE during ingestion
3. Store computed metrics in database/cache
4. Agents read from cache (fast!)
5. LLM generates insights using cached metrics

---

## 2. Data Sources

### 2.1 The 4 Data Inputs (Review Page)

| ID | Data Source | File Types | Purpose | Key Fields |
|----|-------------|------------|---------|------------|
| `spend` | Overall Spend | CSV, XLSX | Transaction-level spend data | supplier, region, spend_usd, date, category |
| `supply-master` | Supply Master | CSV, XLSX | Supplier profiles & ratings | supplier_id, name, country, quality_rating, certifications |
| `contracts` | Contracts | CSV, XLSX | Contract terms & pricing | supplier_id, contract_type, expiry_date, payment_terms |
| `playbook` | Category Playbook | CSV, MD, PDF | Best practices & benchmarks | category, rule, threshold, benchmark |

### 2.2 Data Relationships

```
┌─────────────────┐     ┌─────────────────┐
│  Overall Spend  │────▶│  Supply Master  │
│  (transactions) │     │  (profiles)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    supplier_id        │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Contracts     │◀────│    Computed     │
│   (terms)       │     │    Metrics      │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Category        │
│ Playbook        │
│ (rules/bench)   │
└─────────────────┘
```

---

## 3. Architecture Diagram

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER UPLOADS                                    │
├───────────────────┬───────────────────┬─────────────────┬───────────────────┤
│   Overall Spend   │   Supply Master   │    Contracts    │ Category Playbook │
│      (.csv)       │      (.csv)       │     (.csv)      │   (.csv/.md/.pdf) │
└─────────┬─────────┴─────────┬─────────┴────────┬────────┴─────────┬─────────┘
          │                   │                  │                  │
          ▼                   ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED DATA INGESTION SERVICE                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ SpendParser │  │SupplierPars│  │ContractPars │  │PlaybookPars │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPUTE LAYER (One-Time)                             │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ Concentration    │  │ Risk Scoring     │  │ Price Analysis   │           │
│  │ Calculator       │  │ Engine           │  │ Engine           │           │
│  │ - HHI Index      │  │ - Supplier Risk  │  │ - Variance       │           │
│  │ - Top N %        │  │ - Geo Risk       │  │ - Benchmarks     │           │
│  │ - Regional %     │  │ - Category Risk  │  │ - Unit Prices    │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                                 │
│  │ Cross-Reference  │  │ Playbook Rule    │                                 │
│  │ Engine           │  │ Extractor        │                                 │
│  │ - Spend↔Supplier │  │ - Parse MD/PDF   │                                 │
│  │ - Supplier↔Contr │  │ - Extract rules  │                                 │
│  └──────────────────┘  └──────────────────┘                                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CACHE / DATABASE LAYER                                  │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ computed_metrics │  │ supplier_profiles│  │ contract_summary │           │
│  │ - category       │  │ - supplier_id    │  │ - supplier_id    │           │
│  │ - metric_name    │  │ - ratings        │  │ - terms          │           │
│  │ - value          │  │ - risk_score     │  │ - expiry         │           │
│  │ - confidence     │  │ - certifications │  │ - pricing        │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                                 │
│  │ playbook_rules   │  │ cross_references │                                 │
│  │ - category       │  │ - spend_supplier │                                 │
│  │ - rule_name      │  │ - supplier_contr │                                 │
│  │ - threshold      │  │ - linked_at      │                                 │
│  └──────────────────┘  └──────────────────┘                                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│  Volume Bundling    │ │  Target Pricing     │ │  Risk Management    │
│      Agent          │ │      Agent          │ │      Agent          │
│  ────────────────   │ │  ────────────────   │ │  ────────────────   │
│  8 Proof Points:    │ │  4 Proof Points:    │ │  7 Proof Points:    │
│  • Regional Spend   │ │  • Price Variance   │ │  • Single Sourcing  │
│  • Tail Spend       │ │  • Tariff Rate      │ │  • Supplier Conc.   │
│  • Volume Leverage  │ │  • Cost Structure   │ │  • Category Risk    │
│  • Price Variance   │ │  • Unit Price       │ │  • Inflation        │
│  • Avg Spend/Supp   │ │                     │ │  • Exchange Rate    │
│  • Market Consol.   │ │                     │ │  • Geo-Political    │
│  • Supplier Loc.    │ │                     │ │  • Supplier Rating  │
│  • Supplier Rating  │ │                     │ │                     │
└──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   ▼
                    ┌─────────────────────────┐
                    │      LLM Service        │
                    │  ─────────────────────  │
                    │  • Generate insights    │
                    │  • Recommendations      │
                    │  • Natural language     │
                    └─────────────────────────┘
```

---

## 4. Service Components

### 4.1 Unified Data Ingestion Service

**Location:** `backend/app/services/data_ingestion_service.py`

**Responsibilities:**
- Accept file uploads (CSV, XLSX, PDF, MD)
- Validate file structure and required columns
- Parse data into standardized format
- Trigger compute layer
- Store raw data in database

**Interface:**
```python
class DataIngestionService:
    async def ingest_spend_data(file: UploadFile, session_id: str) -> SpendDataResult
    async def ingest_supplier_master(file: UploadFile, session_id: str) -> SupplierMasterResult
    async def ingest_contracts(file: UploadFile, session_id: str) -> ContractsResult
    async def ingest_playbook(file: UploadFile, session_id: str) -> PlaybookResult
    async def get_ingestion_status(session_id: str) -> IngestionStatus
```

### 4.2 Compute Layer

**Location:** `backend/app/services/compute_service.py`

**Responsibilities:**
- Calculate all metrics from raw data
- Run once per data upload (not per request)
- Store results in computed_metrics table
- Support incremental updates

**Calculators:**
```python
class ComputeService:
    # Concentration Metrics
    def calculate_hhi_index(spend_data: DataFrame) -> float
    def calculate_top_n_concentration(spend_data: DataFrame, n: int) -> float
    def calculate_regional_concentration(spend_data: DataFrame) -> Dict[str, float]
    
    # Risk Metrics
    def calculate_supplier_risk_scores(suppliers: DataFrame) -> Dict[str, float]
    def calculate_geo_risk_scores(spend_data: DataFrame) -> Dict[str, float]
    def calculate_category_risk(category: str, spend_data: DataFrame) -> float
    
    # Price Metrics
    def calculate_price_variance(spend_data: DataFrame) -> float
    def calculate_unit_prices(spend_data: DataFrame) -> Dict[str, float]
    def compare_to_benchmarks(prices: Dict, benchmarks: DataFrame) -> Dict
    
    # Cross-Reference
    def link_spend_to_suppliers(spend: DataFrame, suppliers: DataFrame) -> DataFrame
    def link_suppliers_to_contracts(suppliers: DataFrame, contracts: DataFrame) -> DataFrame
```

### 4.3 Cache Layer

**Location:** `backend/app/services/cache_service.py`

**Responsibilities:**
- Store computed metrics in database
- Provide fast read access for agents
- Handle cache invalidation on data updates
- Support Redis for hot data (optional)

**Interface:**
```python
class CacheService:
    async def store_computed_metrics(session_id: str, metrics: Dict) -> None
    async def get_computed_metrics(session_id: str, category: str) -> ComputedMetrics
    async def invalidate_cache(session_id: str) -> None
    async def get_cache_status(session_id: str) -> CacheStatus
```

---

## 5. Database Models

### 5.1 New Tables

```sql
-- Computed metrics cache
CREATE TABLE computed_metrics (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    category VARCHAR(255),
    subcategory VARCHAR(255),
    metric_name VARCHAR(100),
    metric_value FLOAT,
    calculation_method VARCHAR(255),
    confidence_level VARCHAR(20),
    computed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, category, subcategory, metric_name)
);

-- Supplier profiles (enriched)
CREATE TABLE supplier_profiles (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    supplier_id VARCHAR(50),
    supplier_name VARCHAR(255),
    country VARCHAR(100),
    region VARCHAR(100),
    quality_rating FLOAT,
    delivery_rating FLOAT,
    risk_score FLOAT,
    certifications TEXT[],
    is_diverse BOOLEAN,
    linked_contract_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Contract summaries
CREATE TABLE contract_summaries (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    supplier_id VARCHAR(50),
    contract_type VARCHAR(100),
    payment_terms VARCHAR(50),
    expiry_date DATE,
    annual_value FLOAT,
    has_price_escalation BOOLEAN,
    days_to_expiry INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Playbook rules (extracted)
CREATE TABLE playbook_rules (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    category VARCHAR(255),
    rule_name VARCHAR(255),
    rule_description TEXT,
    threshold_value VARCHAR(50),
    threshold_operator VARCHAR(20),
    priority VARCHAR(20),
    source_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cross-references
CREATE TABLE data_cross_references (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    source_type VARCHAR(50),  -- 'spend', 'supplier', 'contract'
    source_id VARCHAR(50),
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    confidence FLOAT,
    linked_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. Proof Point to Metric Mapping

### 6.1 Volume Bundling Agent (8 Proof Points)

| Proof Point | Required Metrics | Data Sources |
|-------------|------------------|--------------|
| PP_REGIONAL_SPEND | regional_concentration, top_region_pct | Spend |
| PP_TAIL_SPEND | tail_spend_pct, tail_supplier_count | Spend |
| PP_VOLUME_LEVERAGE | volume_by_supplier, bundling_potential | Spend |
| PP_PRICE_VARIANCE | price_variance_pct, std_dev | Spend |
| PP_AVG_SPEND_SUPPLIER | avg_spend_per_supplier, supplier_count | Spend |
| PP_MARKET_CONSOLIDATION | hhi_index, top3_concentration | Spend, Supply Master |
| PP_SUPPLIER_LOCATION | geo_distribution, single_region_pct | Spend, Supply Master |
| PP_SUPPLIER_RISK_RATING | avg_risk_score, high_risk_count | Supply Master |

### 6.2 Target Pricing Agent (4 Proof Points)

| Proof Point | Required Metrics | Data Sources |
|-------------|------------------|--------------|
| PP_PRICE_VARIANCE | price_variance_pct, min_max_spread | Spend |
| PP_TARIFF_RATE | tariff_exposure, duty_by_country | Spend, Supply Master |
| PP_COST_STRUCTURE | cost_breakdown, component_analysis | Spend, Playbook |
| PP_UNIT_PRICE | unit_price_variance, benchmark_deviation | Spend, Playbook |

### 6.3 Risk Management Agent (7 Proof Points)

| Proof Point | Required Metrics | Data Sources |
|-------------|------------------|--------------|
| PP_SINGLE_SOURCING | single_source_items_pct, dependency_score | Spend |
| PP_SUPPLIER_CONCENTRATION | hhi_index, top_supplier_pct | Spend |
| PP_CATEGORY_RISK | category_risk_score, risk_factors | Playbook |
| PP_INFLATION | inflation_exposure, weighted_inflation | Spend, Supply Master |
| PP_EXCHANGE_RATE | fx_exposure, currency_count | Spend, Supply Master |
| PP_GEO_POLITICAL | geo_risk_score, high_risk_countries | Spend, Supply Master |
| PP_SUPPLIER_RISK_RATING | risk_rating_dist, avg_risk_score | Supply Master |

---

## 7. Performance Benefits

### 7.1 Before (Real-Time Computing)

| Operation | Time | Notes |
|-----------|------|-------|
| Parse CSV | 500ms | Every request |
| Compute metrics | 2-5s | Every request |
| Agent evaluation | 1-2s | Every request |
| LLM insight | 3-5s | Every request |
| **Total** | **7-13s** | Per opportunity |

### 7.2 After (Hybrid with Cache)

| Operation | Time | Notes |
|-----------|------|-------|
| Parse CSV | 500ms | Once on upload |
| Compute metrics | 2-5s | Once on upload |
| Store in cache | 100ms | Once on upload |
| Agent evaluation | 50ms | Cache read |
| LLM insight | 3-5s | Once per insight |
| **Total** | **3-6s** | Per opportunity (first time) |
| **Subsequent** | **<1s** | Cache hit |

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database models (computed_metrics, supplier_profiles, etc.)
- [ ] Build DataIngestionService with parsers
- [ ] Build basic ComputeService with core metrics

### Phase 2: Integration (Week 2)
- [ ] Connect agents to cache layer
- [ ] Update proof point evaluators to read from cache
- [ ] Build cross-reference engine

### Phase 3: Optimization (Week 3)
- [ ] Add Redis for hot data caching
- [ ] Implement incremental updates
- [ ] Add playbook parser (PDF/MD)

### Phase 4: Testing & Polish (Week 4)
- [ ] End-to-end testing
- [ ] Performance benchmarking
- [ ] Documentation updates

---

## 9. API Endpoints

### 9.1 Data Ingestion Endpoints

```
POST /api/v1/data/ingest/spend
POST /api/v1/data/ingest/supplier-master
POST /api/v1/data/ingest/contracts
POST /api/v1/data/ingest/playbook

GET  /api/v1/data/status/{session_id}
GET  /api/v1/data/metrics/{session_id}
GET  /api/v1/data/metrics/{session_id}/{category}

DELETE /api/v1/data/cache/{session_id}
```

### 9.2 Response Format

```json
{
  "status": "success",
  "session_id": "uuid",
  "data_type": "spend",
  "records_processed": 1500,
  "metrics_computed": 45,
  "cache_status": "warm",
  "computed_at": "2026-01-27T10:30:00Z"
}
```

---

## 10. Error Handling

### 10.1 Ingestion Errors

| Error Code | Description | Recovery |
|------------|-------------|----------|
| INVALID_FILE_FORMAT | Unsupported file type | Return supported formats |
| MISSING_REQUIRED_COLUMNS | Required columns not found | Return column requirements |
| PARSE_ERROR | File parsing failed | Return line number and error |
| COMPUTE_ERROR | Metric calculation failed | Partial cache, retry option |

### 10.2 Cache Errors

| Error Code | Description | Recovery |
|------------|-------------|----------|
| CACHE_MISS | Metrics not computed | Trigger compute |
| CACHE_STALE | Data updated, cache old | Invalidate and recompute |
| CACHE_CORRUPT | Data integrity issue | Clear and recompute |

---

## 11. Dual Orchestrator Integration

### 11.1 How Agents Use the Cache

All micro-agents in the Dual Orchestrator system are integrated with CacheService:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        DUAL ORCHESTRATOR SYSTEM                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     MASTER ORCHESTRATOR                               │  │
│  │  • Receives CacheService in constructor                              │  │
│  │  • Calls set_cache(cache_service, session_id)                        │  │
│  │  • Passes session_id to analyze_category() and analyze_portfolio()   │  │
│  └───────────────────────────────┬──────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                   OPPORTUNITY ORCHESTRATOR                            │  │
│  │  • Receives cache_service in constructor                             │  │
│  │  • set_cache() propagates to ALL micro-agents                        │  │
│  │  • analyze() accepts session_id for cache lookups                    │  │
│  └───────────────────────────────┬──────────────────────────────────────┘  │
│                                  │                                          │
│          ┌───────────────────────┼───────────────────────┐                 │
│          ▼                       ▼                       ▼                 │
│  ┌───────────────┐       ┌───────────────┐       ┌───────────────┐        │
│  │Volume Bundling│       │Target Pricing │       │Risk Management│        │
│  │    Agent      │       │    Agent      │       │    Agent      │        │
│  └───────┬───────┘       └───────┬───────┘       └───────┬───────┘        │
│          │                       │                       │                 │
│          └───────────────────────┼───────────────────────┘                 │
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      BASE MICRO-AGENT                                 │  │
│  │  • _cache_service: Optional[CacheService] instance                   │  │
│  │  • _session_id: UUID for cache lookups                               │  │
│  │  • set_cache(cache_service, session_id) - called by orchestrator     │  │
│  │  • _get_cached_metric(metric_name) - async lookup                    │  │
│  │  • PROOF_POINT_METRIC_MAP - maps proof points to cached metrics      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Agent Cache Methods

Each micro-agent implements these cache-aware methods:

```python
# Volume Bundling, Target Pricing, Risk Management Agents

async def evaluate_proof_point_cached(
    self,
    proof_point: ProofPointDefinition,
    context_data: Optional[Dict] = None
) -> Optional[ProofPointResult]:
    """
    Fast path: evaluate using cached metrics.
    Returns None if cache miss → caller uses slow path.
    """

def _evaluate_from_cache(
    self,
    proof_point: ProofPointDefinition,
    metrics: Dict[str, float]
) -> ProofPointResult:
    """
    Dispatcher to cache evaluators based on proof point code.
    """

# Per-proof-point cache evaluators:
def _cache_regional_spend(pp, metrics) -> ProofPointResult
def _cache_tail_spend(pp, metrics) -> ProofPointResult
def _cache_volume_leverage(pp, metrics) -> ProofPointResult
# ... etc
```

### 11.3 Proof Point to Metric Mapping

The `PROOF_POINT_METRIC_MAP` in `base_agent.py` defines which cached metrics each proof point needs:

| Proof Point Code | Required Cached Metrics |
|------------------|------------------------|
| `PP_REGIONAL_SPEND` | `regional_concentration`, `geo_concentration_risk` |
| `PP_TAIL_SPEND` | `tail_spend_percentage`, `supplier_count` |
| `PP_VOLUME_LEVERAGE` | `hhi_index`, `top_3_concentration`, `top_5_concentration` |
| `PP_PRICE_VARIANCE` | `price_variance` |
| `PP_SINGLE_SOURCING` | `single_source_spend`, `top_3_concentration` |
| `PP_GEO_POLITICAL` | `geo_concentration_risk`, `regional_concentration` |
| `PP_SUPPLIER_RISK_RATING` | `avg_supplier_quality`, `high_risk_supplier_spend` |

### 11.4 API Integration

The analyze endpoints inject CacheService:

```python
# backend/app/api/v1/analyze.py

def get_master_orchestrator(db: AsyncSession) -> MasterOrchestrator:
    """Factory function with dependency injection."""
    cache_service = CacheService(db)
    return MasterOrchestrator(cache_service=cache_service)

@router.post("", response_model=AnalysisResponse)
async def analyze_with_upload(...):
    # Create orchestrator with cache
    master_orchestrator = get_master_orchestrator(db)
    
    # Run analysis with session_id for cache lookups
    result = await master_orchestrator.analyze_category(
        ...,
        session_id=session.id  # Enables cache lookups
    )
```

---

## Appendix A: Demo Data Mapping

The demo data in `/data/` folder maps to this architecture:

| Demo File | Maps To | Purpose |
|-----------|---------|---------|
| `structured/spend_data.csv` | Overall Spend | Sample transaction data |
| `structured/supplier_master.csv` | Supply Master | Sample supplier profiles |
| `structured/supplier_contracts.csv` | Contracts | Sample contract terms |
| `structured/rule_book.csv` | Playbook (partial) | 35 procurement rules |
| `calculated/calculated_metrics.csv` | computed_metrics | Pre-computed metrics example |
| `unstructured/*.md` | Playbook | Best practices, policies |

---

**Document End**
