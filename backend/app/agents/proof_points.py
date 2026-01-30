"""
Proof Point Definitions and Mappings
Defines the 18 unique proof points used by our 4 demo opportunities.
Each proof point has evaluation criteria and context for each opportunity that uses it.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


class ImpactFlag(str, Enum):
    """Impact classification for proof point evaluation."""
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
    NOT_TESTED = "Not Tested"


class ProofPointCategory(str, Enum):
    """Source category for proof points."""
    CLIENT_DATA = "Client Data Insights"  # Derived from uploaded spend data
    MARKET_DRIVERS = "Market Drivers"  # External data sources


class OpportunityType(str, Enum):
    """The 4 demo opportunities."""
    VOLUME_BUNDLING = "Volume Bundling"
    TARGET_PRICING = "Target Pricing"
    RISK_MANAGEMENT = "Risk Management"
    RESPEC_PACK = "Re-specification Pack"


@dataclass
class ProofPointContext:
    """Context for how a proof point is evaluated within a specific opportunity."""
    opportunity: OpportunityType
    hypothesis: str  # What we're looking for in this context
    high_threshold: str  # Condition for HIGH impact
    medium_threshold: str  # Condition for MEDIUM impact
    low_threshold: str  # Condition for LOW impact
    insight_template: str  # Template for generating insights


@dataclass
class ProofPointDefinition:
    """Complete definition of a proof point."""
    id: str
    name: str
    code: str
    category: ProofPointCategory
    description: str
    required_data_fields: List[str]
    contexts: Dict[OpportunityType, ProofPointContext] = field(default_factory=dict)


# =============================================================================
# PROOF POINT DEFINITIONS - 17 Unique Proof Points
# =============================================================================

PROOF_POINTS: Dict[str, ProofPointDefinition] = {

    # =========================================================================
    # VOLUME BUNDLING PROOF POINTS (8 total, 2 shared)
    # =========================================================================

    "PP_REGIONAL_SPEND": ProofPointDefinition(
        id="PP_REGIONAL_SPEND",
        name="Regional Spend Addressability",
        code="PP_REGIONAL_SPEND",
        category=ProofPointCategory.CLIENT_DATA,
        description="Analyzes geographic concentration of spend to identify bundling opportunities",
        required_data_fields=["country", "spend"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="If spend is concentrated in few regions, we can bundle volumes across sites for better leverage",
                high_threshold="Top 3 regions represent >80% of spend",
                medium_threshold="Top 3 regions represent 50-80% of spend",
                low_threshold="Spend is distributed across many regions (<50% in top 3)",
                insight_template="Regional concentration at {top_3_pct}% enables cross-site volume consolidation in {top_regions}"
            )
        }
    ),

    "PP_TAIL_SPEND": ProofPointDefinition(
        id="PP_TAIL_SPEND",
        name="Tail Spend Consolidation Opportunity",
        code="PP_TAIL_SPEND",
        category=ProofPointCategory.CLIENT_DATA,
        description="Identifies fragmented tail spend that can be consolidated",
        required_data_fields=["supplier", "spend"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="High tail spend indicates opportunity to consolidate with fewer suppliers",
                high_threshold="Tail suppliers (bottom 80%) represent >30% of spend",
                medium_threshold="Tail suppliers represent 15-30% of spend",
                low_threshold="Tail suppliers represent <15% of spend (already consolidated)",
                insight_template="Tail spend of {tail_pct}% across {tail_supplier_count} suppliers presents consolidation opportunity"
            )
        }
    ),

    "PP_VOLUME_LEVERAGE": ProofPointDefinition(
        id="PP_VOLUME_LEVERAGE",
        name="Volume Leverage from Fragmented Category Spend",
        code="PP_VOLUME_LEVERAGE",
        category=ProofPointCategory.CLIENT_DATA,
        description="Identifies fragmented spend that can be leveraged through bundling",
        required_data_fields=["supplier", "category", "spend"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="Fragmented spend across many suppliers indicates bundling opportunity",
                high_threshold="Spend fragmented across >10 suppliers with no single supplier >20%",
                medium_threshold="Spend across 5-10 suppliers with top supplier 20-40%",
                low_threshold="Spend concentrated with <5 suppliers (already leveraged)",
                insight_template="Spend fragmented across {supplier_count} suppliers - top supplier has only {top_supplier_pct}%"
            )
        }
    ),

    # SHARED: Volume Bundling + Target Pricing
    "PP_PRICE_VARIANCE": ProofPointDefinition(
        id="PP_PRICE_VARIANCE",
        name="Price Variance for Identical Items/SKUs",
        code="PP_PRICE_VARIANCE",
        category=ProofPointCategory.CLIENT_DATA,
        description="Identifies price inconsistencies for same items across suppliers/regions",
        required_data_fields=["price", "category", "supplier"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="High price variance indicates opportunity to negotiate volume-based pricing standardization",
                high_threshold="Price variance >25% for identical items",
                medium_threshold="Price variance 10-25% for identical items",
                low_threshold="Price variance <10% (prices already standardized)",
                insight_template="Price variance of {variance_pct}% across suppliers enables volume-based price harmonization"
            ),
            OpportunityType.TARGET_PRICING: ProofPointContext(
                opportunity=OpportunityType.TARGET_PRICING,
                hypothesis="High price variance indicates opportunity to use best price as negotiation target",
                high_threshold="Price variance >25% - best price can be target",
                medium_threshold="Price variance 10-25% - moderate negotiation opportunity",
                low_threshold="Price variance <10% - limited target pricing opportunity",
                insight_template="Best-in-class price is {best_price_pct}% below average - use as target for negotiations"
            ),
            OpportunityType.RESPEC_PACK: ProofPointContext(
                opportunity=OpportunityType.RESPEC_PACK,
                hypothesis="High price variance for similar packaging indicates over-specification or non-standard specs",
                high_threshold="Price variance >30% for similar packaging items - spec standardization opportunity",
                medium_threshold="Price variance 15-30% - some specification optimization possible",
                low_threshold="Price variance <15% - packaging specs already standardized",
                insight_template="Price variance of {variance_pct}% across packaging specs indicates {spec_count} non-standard specifications"
            )
        }
    ),

    "PP_AVG_SPEND_SUPPLIER": ProofPointDefinition(
        id="PP_AVG_SPEND_SUPPLIER",
        name="Average Spend per Supplier vs. Industry Benchmarks",
        code="PP_AVG_SPEND_SUPPLIER",
        category=ProofPointCategory.CLIENT_DATA,
        description="Compares average supplier spend against industry benchmarks",
        required_data_fields=["supplier", "spend"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="Low average spend per supplier indicates too many suppliers - consolidation opportunity",
                high_threshold="Average spend per supplier <$100K (too fragmented)",
                medium_threshold="Average spend per supplier $100K-$500K",
                low_threshold="Average spend per supplier >$500K (already consolidated)",
                insight_template="Average spend of ${avg_spend} per supplier is below benchmark - consolidation recommended"
            )
        }
    ),

    "PP_MARKET_CONSOLIDATION": ProofPointDefinition(
        id="PP_MARKET_CONSOLIDATION",
        name="Market Consolidation",
        code="PP_MARKET_CONSOLIDATION",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Analyzes supplier market concentration (HHI index)",
        required_data_fields=["supplier", "spend"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="Low market consolidation means buyer has leverage to bundle and negotiate",
                high_threshold="HHI <1500 (competitive market - good for bundling)",
                medium_threshold="HHI 1500-2500 (moderately concentrated)",
                low_threshold="HHI >2500 (highly concentrated - limited leverage)",
                insight_template="Market HHI of {hhi} indicates {market_type} market - {bundling_potential}"
            )
        }
    ),

    "PP_SUPPLIER_LOCATION": ProofPointDefinition(
        id="PP_SUPPLIER_LOCATION",
        name="Supplier Location",
        code="PP_SUPPLIER_LOCATION",
        category=ProofPointCategory.CLIENT_DATA,
        description="Analyzes geographic distribution of suppliers",
        required_data_fields=["supplier", "country"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="Suppliers in same region can be bundled for logistics efficiency",
                high_threshold=">70% suppliers in same region (excellent bundling potential)",
                medium_threshold="50-70% suppliers in same region",
                low_threshold="<50% suppliers in same region (geographically dispersed)",
                insight_template="{pct_same_region}% of suppliers in {top_region} enables logistics bundling"
            )
        }
    ),

    # SHARED: Volume Bundling + Risk Management
    "PP_SUPPLIER_RISK_RATING": ProofPointDefinition(
        id="PP_SUPPLIER_RISK_RATING",
        name="Supplier Risk Rating",
        code="PP_SUPPLIER_RISK_RATING",
        category=ProofPointCategory.CLIENT_DATA,
        description="Evaluates financial and operational risk of suppliers",
        required_data_fields=["supplier", "spend"],
        contexts={
            OpportunityType.VOLUME_BUNDLING: ProofPointContext(
                opportunity=OpportunityType.VOLUME_BUNDLING,
                hypothesis="Bundling should prioritize low-risk suppliers to minimize disruption",
                high_threshold="Top suppliers by spend have low risk ratings",
                medium_threshold="Mixed risk ratings among top suppliers",
                low_threshold="High risk ratings among top suppliers (bundling risky)",
                insight_template="Top {top_count} suppliers have {risk_profile} risk profile for volume consolidation"
            ),
            OpportunityType.RISK_MANAGEMENT: ProofPointContext(
                opportunity=OpportunityType.RISK_MANAGEMENT,
                hypothesis="High-risk suppliers need to be addressed through diversification or replacement",
                high_threshold=">30% of spend with high-risk suppliers",
                medium_threshold="10-30% of spend with high-risk suppliers",
                low_threshold="<10% of spend with high-risk suppliers",
                insight_template="{high_risk_pct}% of spend is with high-risk suppliers - mitigation needed"
            )
        }
    ),

    # =========================================================================
    # TARGET PRICING PROOF POINTS (4 total, 1 shared - PP_PRICE_VARIANCE above)
    # =========================================================================

    "PP_TARIFF_RATE": ProofPointDefinition(
        id="PP_TARIFF_RATE",
        name="Tariff Rate",
        code="PP_TARIFF_RATE",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Analyzes import tariff impact on pricing",
        required_data_fields=["country"],
        contexts={
            OpportunityType.TARGET_PRICING: ProofPointContext(
                opportunity=OpportunityType.TARGET_PRICING,
                hypothesis="High tariff variance across origins indicates opportunity to optimize sourcing mix",
                high_threshold="Tariff differential >15% between sources",
                medium_threshold="Tariff differential 5-15% between sources",
                low_threshold="Tariff differential <5%",
                insight_template="Tariff differential of {tariff_diff}% between {low_tariff_origin} and {high_tariff_origin}"
            )
        }
    ),

    "PP_COST_STRUCTURE": ProofPointDefinition(
        id="PP_COST_STRUCTURE",
        name="Cost Structure",
        code="PP_COST_STRUCTURE",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Analyzes cost breakdown (raw materials, labor, logistics)",
        required_data_fields=["category"],
        contexts={
            OpportunityType.TARGET_PRICING: ProofPointContext(
                opportunity=OpportunityType.TARGET_PRICING,
                hypothesis="Understanding cost drivers enables should-cost modeling for negotiations",
                high_threshold="Raw material >60% of cost (commodity-driven, index pricing possible)",
                medium_threshold="Raw material 40-60% of cost",
                low_threshold="Raw material <40% of cost (value-added, harder to benchmark)",
                insight_template="Cost structure is {cost_type} with raw materials at {raw_material_pct}% - {pricing_approach}"
            ),
            OpportunityType.RESPEC_PACK: ProofPointContext(
                opportunity=OpportunityType.RESPEC_PACK,
                hypothesis="High raw material percentage means packaging can be optimized through material specification changes",
                high_threshold="Raw material >65% - significant opportunity for material optimization/right-sizing",
                medium_threshold="Raw material 45-65% - moderate spec optimization possible",
                low_threshold="Raw material <45% - labor/process-driven costs harder to optimize via specs",
                insight_template="Packaging cost is {raw_material_pct}% material-driven - {optimization_approach} through spec changes"
            )
        }
    ),

    "PP_UNIT_PRICE": ProofPointDefinition(
        id="PP_UNIT_PRICE",
        name="Unit Price",
        code="PP_UNIT_PRICE",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Analyzes unit price trends and benchmarks",
        required_data_fields=["price", "volume"],
        contexts={
            OpportunityType.TARGET_PRICING: ProofPointContext(
                opportunity=OpportunityType.TARGET_PRICING,
                hypothesis="Prices above market benchmark indicate negotiation opportunity",
                high_threshold="Unit prices >15% above market benchmark",
                medium_threshold="Unit prices 5-15% above market benchmark",
                low_threshold="Unit prices within 5% of market benchmark",
                insight_template="Current unit price ${unit_price} is {variance_pct}% {direction} market benchmark"
            )
        }
    ),

    # =========================================================================
    # RE-SPECIFICATION PACK PROOF POINTS (3 total, 2 shared - PP_PRICE_VARIANCE, PP_COST_STRUCTURE above)
    # =========================================================================

    "PP_EXPORT_DATA": ProofPointDefinition(
        id="PP_EXPORT_DATA",
        name="Export Data",
        code="PP_EXPORT_DATA",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Analyzes global export patterns and international packaging standards",
        required_data_fields=["country", "category"],
        contexts={
            OpportunityType.RESPEC_PACK: ProofPointContext(
                opportunity=OpportunityType.RESPEC_PACK,
                hypothesis="Export markets often use standardized, cost-effective packaging - opportunity to adopt global standards",
                high_threshold="Current specs >20% more expensive than export-standard packaging",
                medium_threshold="Current specs 10-20% more expensive than export standards",
                low_threshold="Current specs within 10% of export standards (already optimized)",
                insight_template="Export-standard packaging is {savings_pct}% cheaper than current specs - {num_skus} SKUs can adopt global standards"
            )
        }
    ),

    # =========================================================================
    # RISK MANAGEMENT PROOF POINTS (7 total, 1 shared - PP_SUPPLIER_RISK_RATING above)
    # =========================================================================

    "PP_SINGLE_SOURCING": ProofPointDefinition(
        id="PP_SINGLE_SOURCING",
        name="Single Sourcing / Supplier Dependency Risk",
        code="PP_SINGLE_SOURCING",
        category=ProofPointCategory.CLIENT_DATA,
        description="Identifies over-reliance on single suppliers",
        required_data_fields=["supplier", "spend"],
        contexts={
            OpportunityType.RISK_MANAGEMENT: ProofPointContext(
                opportunity=OpportunityType.RISK_MANAGEMENT,
                hypothesis="High single-source dependency creates supply chain risk",
                high_threshold="Any single supplier >50% of category spend",
                medium_threshold="Top supplier 30-50% of category spend",
                low_threshold="No supplier >30% of category spend",
                insight_template="Supplier {top_supplier} represents {top_supplier_pct}% of spend - {risk_level} dependency risk"
            )
        }
    ),

    "PP_SUPPLIER_CONCENTRATION": ProofPointDefinition(
        id="PP_SUPPLIER_CONCENTRATION",
        name="Supplier Concentration Risk",
        code="PP_SUPPLIER_CONCENTRATION",
        category=ProofPointCategory.CLIENT_DATA,
        description="Analyzes concentration across top suppliers",
        required_data_fields=["supplier", "spend"],
        contexts={
            OpportunityType.RISK_MANAGEMENT: ProofPointContext(
                opportunity=OpportunityType.RISK_MANAGEMENT,
                hypothesis="High concentration in few suppliers increases supply disruption risk",
                high_threshold="Top 3 suppliers >80% of spend",
                medium_threshold="Top 3 suppliers 50-80% of spend",
                low_threshold="Top 3 suppliers <50% of spend",
                insight_template="Top 3 suppliers control {top_3_pct}% of spend - {concentration_risk}"
            )
        }
    ),

    "PP_CATEGORY_RISK": ProofPointDefinition(
        id="PP_CATEGORY_RISK",
        name="Category Risk",
        code="PP_CATEGORY_RISK",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Assesses overall category risk level",
        required_data_fields=["category"],
        contexts={
            OpportunityType.RISK_MANAGEMENT: ProofPointContext(
                opportunity=OpportunityType.RISK_MANAGEMENT,
                hypothesis="High category risk requires proactive mitigation strategies",
                high_threshold="Category classified as high risk (volatile, scarce, critical)",
                medium_threshold="Category classified as medium risk",
                low_threshold="Category classified as low risk (stable, abundant)",
                insight_template="Category {category} has {risk_level} risk profile due to {risk_factors}"
            )
        }
    ),

    "PP_INFLATION": ProofPointDefinition(
        id="PP_INFLATION",
        name="Inflation",
        code="PP_INFLATION",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Analyzes inflation impact on category costs",
        required_data_fields=["category"],
        contexts={
            OpportunityType.RISK_MANAGEMENT: ProofPointContext(
                opportunity=OpportunityType.RISK_MANAGEMENT,
                hypothesis="High inflation in key sourcing regions increases cost risk",
                high_threshold="Inflation >8% in primary sourcing regions",
                medium_threshold="Inflation 4-8% in primary sourcing regions",
                low_threshold="Inflation <4% in primary sourcing regions",
                insight_template="Inflation at {inflation_rate}% in {region} impacts cost predictability"
            )
        }
    ),

    "PP_EXCHANGE_RATE": ProofPointDefinition(
        id="PP_EXCHANGE_RATE",
        name="Exchange Rate",
        code="PP_EXCHANGE_RATE",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Analyzes currency exposure and volatility",
        required_data_fields=["country", "spend"],
        contexts={
            OpportunityType.RISK_MANAGEMENT: ProofPointContext(
                opportunity=OpportunityType.RISK_MANAGEMENT,
                hypothesis="High currency exposure increases cost volatility risk",
                high_threshold=">50% of spend in volatile currencies",
                medium_threshold="20-50% of spend in volatile currencies",
                low_threshold="<20% of spend in volatile currencies",
                insight_template="{foreign_currency_pct}% of spend exposed to currency risk in {currencies}"
            )
        }
    ),

    "PP_GEO_POLITICAL": ProofPointDefinition(
        id="PP_GEO_POLITICAL",
        name="Geo Political Risk",
        code="PP_GEO_POLITICAL",
        category=ProofPointCategory.MARKET_DRIVERS,
        description="Assesses geopolitical risk in sourcing regions",
        required_data_fields=["country", "spend"],
        contexts={
            OpportunityType.RISK_MANAGEMENT: ProofPointContext(
                opportunity=OpportunityType.RISK_MANAGEMENT,
                hypothesis="Concentration in high geopolitical risk regions increases supply disruption risk",
                high_threshold=">40% of spend from high geopolitical risk regions",
                medium_threshold="20-40% of spend from high geopolitical risk regions",
                low_threshold="<20% of spend from high geopolitical risk regions",
                insight_template="{high_risk_geo_pct}% of spend from geopolitically sensitive regions: {regions}"
            )
        }
    ),
}


# =============================================================================
# OPPORTUNITY → PROOF POINT MAPPINGS
# =============================================================================

OPPORTUNITY_PROOF_POINTS: Dict[OpportunityType, List[str]] = {
    OpportunityType.VOLUME_BUNDLING: [
        "PP_REGIONAL_SPEND",
        "PP_TAIL_SPEND",
        "PP_VOLUME_LEVERAGE",
        "PP_PRICE_VARIANCE",  # SHARED with Target Pricing
        "PP_AVG_SPEND_SUPPLIER",
        "PP_MARKET_CONSOLIDATION",
        "PP_SUPPLIER_LOCATION",
        "PP_SUPPLIER_RISK_RATING",  # SHARED with Risk Management
    ],
    OpportunityType.TARGET_PRICING: [
        "PP_PRICE_VARIANCE",  # SHARED with Volume Bundling
        "PP_TARIFF_RATE",
        "PP_COST_STRUCTURE",
        "PP_UNIT_PRICE",
    ],
    OpportunityType.RISK_MANAGEMENT: [
        "PP_SINGLE_SOURCING",
        "PP_SUPPLIER_CONCENTRATION",
        "PP_CATEGORY_RISK",
        "PP_INFLATION",
        "PP_EXCHANGE_RATE",
        "PP_GEO_POLITICAL",
        "PP_SUPPLIER_RISK_RATING",  # SHARED with Volume Bundling
    ],
    OpportunityType.RESPEC_PACK: [
        "PP_PRICE_VARIANCE",   # SHARED with Volume Bundling, Target Pricing
        "PP_EXPORT_DATA",      # Unique to Re-spec Pack
        "PP_COST_STRUCTURE",   # SHARED with Target Pricing
    ],
}


# =============================================================================
# PROOF POINT → OPPORTUNITIES REVERSE MAPPING (for routing)
# =============================================================================

def get_proof_point_opportunities(proof_point_code: str) -> List[OpportunityType]:
    """Get all opportunities that use a given proof point."""
    opportunities = []
    for opp_type, pp_list in OPPORTUNITY_PROOF_POINTS.items():
        if proof_point_code in pp_list:
            opportunities.append(opp_type)
    return opportunities


PROOF_POINT_TO_OPPORTUNITIES: Dict[str, List[OpportunityType]] = {
    pp_code: get_proof_point_opportunities(pp_code)
    for pp_code in PROOF_POINTS.keys()
}


# =============================================================================
# OPPORTUNITY BENCHMARKS
# =============================================================================

OPPORTUNITY_BENCHMARKS: Dict[OpportunityType, Dict[str, Any]] = {
    # Based on Beroe Excel Methodology Screenshot
    # Category level: 4% (low) to 10% (high), Addressable: 80%
    # With maturity 2.5: 6.25% to 7.75%, Confidence Medium: 5.38% to 8.62%

    OpportunityType.VOLUME_BUNDLING: {
        # From screenshot: Initiative 1 (0-1%) + Initiative 2 (2-5%)
        # Combined range considering both initiatives
        "savings_benchmark_low": 0.00,   # 0% (Initiative 1 low)
        "savings_benchmark_high": 0.05,  # 5% (Initiative 2 high)
        "initiative_1": {
            "benchmark_low": 0.00,       # 0%
            "benchmark_high": 0.01,      # 1%
            "proof_points": 5,
            "example_distribution": {"low": 1, "medium": 2, "high": 2},
            "example_impact_score": 6.5,  # Medium bucket
            "example_intermediate": 0.0025,  # 0.25%
            "example_weightage": 0.05,
        },
        "initiative_2": {
            "benchmark_low": 0.02,       # 2%
            "benchmark_high": 0.05,      # 5%
            "proof_points": 6,
            "example_distribution": {"low": 2, "medium": 1, "high": 1},
            "example_impact_score": 3.3,  # Low bucket
            "example_intermediate": 0.0313,  # 3.13%
            "example_weightage": 0.64,
        },
        "effort_months": "3-6",
        "typical_impact": "cost_reduction",
        "key_proof_points": [
            "PP_REGIONAL_SPEND",
            "PP_TAIL_SPEND",
            "PP_VOLUME_LEVERAGE",
            "PP_PRICE_VARIANCE",
            "PP_AVG_SPEND_SUPPLIER",
        ],
    },
    OpportunityType.TARGET_PRICING: {
        # From screenshot: Initiative 3 (1-2%)
        "savings_benchmark_low": 0.01,   # 1%
        "savings_benchmark_high": 0.02,  # 2%
        "initiative_3": {
            "benchmark_low": 0.01,       # 1%
            "benchmark_high": 0.02,      # 2%
            "proof_points": 4,
            "example_distribution": {"low": 3, "medium": 2, "high": 1},
            "example_impact_score": 7.2,  # Medium bucket
            "example_intermediate": 0.015,  # 1.50%
            "example_weightage": 0.31,
        },
        "effort_months": "3-6",
        "typical_impact": "cost_reduction",
        "key_proof_points": [
            "PP_PRICE_VARIANCE",
            "PP_TARIFF_RATE",
            "PP_COST_STRUCTURE",
            "PP_UNIT_PRICE",
        ],
    },
    OpportunityType.RISK_MANAGEMENT: {
        # Risk management - cost avoidance model
        "savings_benchmark_low": 0.01,   # 1% cost avoidance
        "savings_benchmark_high": 0.03,  # 3% cost avoidance
        "effort_months": "3-6",
        "typical_impact": "risk_reduction",
        "key_proof_points": [
            "PP_SINGLE_SOURCING",
            "PP_SUPPLIER_CONCENTRATION",
            "PP_CATEGORY_RISK",
            "PP_INFLATION",
            "PP_EXCHANGE_RATE",
            "PP_GEO_POLITICAL",
            "PP_SUPPLIER_RISK_RATING",
        ],
    },
    OpportunityType.RESPEC_PACK: {
        # Re-specification Pack - packaging optimization
        # Lower savings than Volume Bundling as requires technical changes
        "savings_benchmark_low": 0.02,   # 2%
        "savings_benchmark_high": 0.03,  # 3%
        "effort_months": "6-9",
        "typical_impact": "cost_reduction",
        "key_proof_points": [
            "PP_PRICE_VARIANCE",
            "PP_EXPORT_DATA",
            "PP_COST_STRUCTURE",
        ],
        "initiative_info": {
            "name": "Re-specification (Pack)",
            "description": "Optimize packaging specifications to reduce costs through standardization and right-sizing",
            "proof_points": 3,
            "example_distribution": {"low": 1, "medium": 1, "high": 1},
            "example_impact_score": 6.0,  # Medium bucket
        },
    },
}

# Category-level calculation example from screenshot
CATEGORY_CALCULATION_EXAMPLE = {
    "spend": 50_000_000,           # $50M
    "savings_benchmark_low": 0.04,  # 4%
    "savings_benchmark_high": 0.10, # 10%
    "addressable_spend_pct": 0.80,  # 80%
    "maturity_score": 2.5,
    "maturity_adj_low": 0.0625,     # 6.25%
    "maturity_adj_high": 0.0775,    # 7.75%
    "confidence_score": 0.567,      # 56.7%
    "confidence_bucket": "Medium",
    "confidence_adj_low": 0.0538,   # 5.38%
    "confidence_adj_high": 0.0862,  # 8.62%
    "savings_low": 2_153_889,       # $2,153,889
    "savings_high": 3_446_111,      # $3,446,111
}


def get_all_unique_proof_points() -> List[ProofPointDefinition]:
    """Get all 17 unique proof points."""
    return list(PROOF_POINTS.values())


def get_proof_point(code: str) -> Optional[ProofPointDefinition]:
    """Get a proof point definition by code."""
    return PROOF_POINTS.get(code)


def get_opportunity_proof_points(opportunity: OpportunityType) -> List[ProofPointDefinition]:
    """Get all proof point definitions for an opportunity."""
    pp_codes = OPPORTUNITY_PROOF_POINTS.get(opportunity, [])
    return [PROOF_POINTS[code] for code in pp_codes if code in PROOF_POINTS]
