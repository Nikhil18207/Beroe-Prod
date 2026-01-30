# Re-specification Pack Opportunity Agent

## Overview

The Re-specification Pack agent evaluates opportunities to optimize packaging specifications 
through standardization across markets and alignment with global standards.

## Proof Points

This agent evaluates 3 proof points:

| Code | Name | Shared | Description |
|------|------|--------|-------------|
| PP_PRICE_VARIANCE | Price Variance for Identical Items/SKUs | Yes | Identifies specification inconsistencies causing price differences |
| PP_EXPORT_DATA | Export Data | No | Analyzes global packaging standards compliance and optimization |
| PP_COST_STRUCTURE | Cost Structure | Yes | Evaluates material costs and optimization opportunities |

## Business Context

Re-specification Pack opportunities typically arise when:

1. **Multiple specification variants** exist for similar products across regions
2. **Global market expansion** requires meeting different packaging standards  
3. **Material costs** can be reduced through specification optimization
4. **Supplier complexity** increases due to non-standard specifications

## Typical Savings

- **Savings Range**: 2-3% of category spend
- **Implementation Effort**: 6-9 months
- **Complexity**: High (requires cross-functional alignment)

## Evaluation Logic

### PP_PRICE_VARIANCE (Re-spec Context)
- **HIGH**: Variance >= 15% suggests significant spec differences driving costs
- **MEDIUM**: Variance 8-15% indicates moderate standardization opportunity
- **LOW**: Variance < 8% suggests specs are already optimized

### PP_EXPORT_DATA
- **HIGH**: < 60% export market coverage with global standards
- **MEDIUM**: 60-80% coverage with some gaps
- **LOW**: > 80% coverage, specifications well-aligned

### PP_COST_STRUCTURE (Re-spec Context)
- **HIGH**: Raw material > 50% with spec variation opportunities
- **MEDIUM**: 30-50% raw material with some optimization potential
- **LOW**: < 30% raw material, limited re-spec opportunity

## Architecture

```
RespecPackAgent (BaseMicroAgent)
├── evaluate_proof_point() - Main entry for spend data analysis
├── evaluate_proof_point_cached() - Fast path using cached metrics
├── _evaluate_price_variance() - Spec standardization analysis
├── _evaluate_export_data() - Global standards compliance
└── _evaluate_cost_structure() - Material optimization
```

## Usage

```python
from app.agents.opportunities.respec_pack import RespecPackAgent

agent = RespecPackAgent()
result = await agent.evaluate_opportunity(
    spend_data=df,
    category_spend=1000000,
    context_data={"category_name": "Corrugated Packaging"}
)
```
