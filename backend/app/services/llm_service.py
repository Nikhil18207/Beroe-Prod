"""
LLM Service - Hybrid AI Integration

Implements the hybrid LLM approach:
- Ollama + Qwen 2.5 for local document extraction (default)
- OpenAI (GPT-4) for complex analysis tasks (optional)

Usage:
    llm = LLMService()
    response = await llm.extract_contract_insights(content)
    response = await llm.extract_playbook_insights(content)
    response = await llm.chat(messages)
"""

from typing import Dict, List, Optional, Any, Literal
from dataclasses import dataclass
from enum import Enum
import json
import asyncio
import httpx
from datetime import datetime

from openai import AsyncOpenAI
from app.config import settings
import structlog

logger = structlog.get_logger()


class ModelType(str, Enum):
    """Available LLM model types."""
    OPENAI_GPT4 = "gpt-4-turbo-preview"
    OPENAI_GPT35 = "gpt-3.5-turbo"
    OLLAMA_QWEN = "qwen2.5:7b"
    OLLAMA_QWEN_14B = "qwen2.5:14b"


class TaskComplexity(str, Enum):
    """Task complexity levels for model selection."""
    HIGH = "high"      # Document analysis, strategic insights
    MEDIUM = "medium"  # Chat responses, summarization
    LOW = "low"        # Classification, simple extraction


@dataclass
class LLMResponse:
    """Standardized LLM response."""
    content: str
    model_used: str
    tokens_used: int
    latency_ms: float
    metadata: Dict[str, Any]


# ============================================================================
# PROCUREMENT-SPECIFIC EXTRACTION SCHEMAS
# ============================================================================

CONTRACT_EXTRACTION_SCHEMA = {
    "contract_id": "Unique identifier or contract number",
    "contract_title": "Title or name of the contract",
    "contract_type": "MSA, SOW, PO, Framework Agreement, Service Agreement, etc.",

    "parties": {
        "buyer": "Buying organization name",
        "buyer_entity": "Specific legal entity if mentioned",
        "supplier": "Supplier/vendor name",
        "supplier_legal_name": "Legal entity name of supplier",
        "supplier_address": "Supplier address if available",
        "supplier_contact": "Supplier contact person",
        "supplier_email": "Contact email",
        "supplier_phone": "Contact phone",
        "relationship_type": "Preferred, approved, strategic, etc."
    },

    "dates": {
        "effective_date": "Contract start date (YYYY-MM-DD)",
        "expiry_date": "Contract end date (YYYY-MM-DD)",
        "contract_duration_months": "Total duration in months",
        "renewal_date": "Auto-renewal date if applicable",
        "auto_renewal": "true/false - Does it auto-renew?",
        "renewal_terms": "Renewal period and conditions",
        "notice_period_days": "Days notice required for termination",
        "renegotiation_date": "Date when renegotiation is possible"
    },

    "financials": {
        "total_value": "Total contract value in numbers",
        "currency": "Currency code (USD, EUR, etc.)",
        "annual_value": "Annual contract value if multi-year",
        "minimum_commitment": "Minimum purchase commitment",
        "maximum_value": "Maximum contract ceiling",
        "payment_terms": "Payment terms (Net 30, Net 60, etc.)",
        "payment_method": "Wire, ACH, check, etc.",
        "early_payment_discount": "Discount for early payment (e.g., 2/10 Net 30)",
        "late_payment_penalty": "Interest/fee for late payment",
        "billing_frequency": "Monthly, quarterly, annually, milestone-based"
    },

    "pricing": {
        "pricing_model": "Fixed, variable, cost-plus, time-and-materials, etc.",
        "base_price": "Base price or rate",
        "unit_prices": [{"item": "Item/service", "price": "Unit price", "unit": "Per unit", "currency": "Currency"}],
        "labor_rates": [{"role": "Role/title", "rate": "Hourly/daily rate", "currency": "Currency"}],
        "volume_discounts": [{"threshold": "Volume threshold", "discount_percent": "Discount %"}],
        "tiered_pricing": [{"tier": "Tier name", "volume_range": "Range", "price": "Price at tier"}],
        "rebates": {"has_rebates": "true/false", "rebate_percent": "Rebate %", "conditions": "Conditions"},
        "price_escalation": {
            "has_escalation": "true/false",
            "escalation_cap_percent": "Maximum annual increase %",
            "escalation_index": "CPI, PPI, or fixed rate",
            "escalation_frequency": "Annual, semi-annual, etc.",
            "base_year": "Base year for escalation"
        },
        "price_reduction_clause": "Any provisions for price reductions",
        "most_favored_customer": "MFC clause present? true/false"
    },

    "scope_of_work": {
        "description": "High-level description of goods/services",
        "deliverables": ["List of key deliverables"],
        "service_locations": ["Locations where services are provided"],
        "exclusions": ["What is NOT included"],
        "change_order_process": "How changes are handled"
    },

    "service_levels": {
        "has_sla": "true/false",
        "slas": [{"metric": "SLA metric", "target": "Target value", "measurement": "How measured"}],
        "uptime_guarantee": "Uptime percentage if applicable",
        "response_time": "Response time requirements",
        "resolution_time": "Issue resolution time",
        "sla_credits": "Credits for SLA breaches",
        "reporting_requirements": "SLA reporting frequency and format"
    },

    "terms_and_conditions": {
        "warranty_period": "Warranty duration",
        "warranty_coverage": "What warranty covers",
        "liability_cap": "Maximum liability amount",
        "liability_type": "Per incident, annual, contract term",
        "indemnification": "Indemnification clauses",
        "insurance_requirements": [{"type": "Insurance type", "minimum_coverage": "Coverage amount"}],
        "termination_for_convenience": "Can terminate without cause? Notice period?",
        "termination_for_cause": "Termination conditions for breach",
        "termination_fees": "Fees for early termination",
        "penalties": [{"type": "Penalty type", "amount": "Penalty amount", "trigger": "What triggers it"}],
        "force_majeure": "Force majeure provisions",
        "dispute_resolution": "Arbitration, mediation, litigation",
        "governing_law": "Governing law and jurisdiction"
    },

    "intellectual_property": {
        "ip_ownership": "Who owns IP created under contract",
        "license_granted": "Licenses provided",
        "background_ip": "Pre-existing IP handling",
        "confidentiality_period": "How long confidentiality applies"
    },

    "compliance": {
        "certifications_required": ["ISO 9001, ISO 27001, SOC2, etc."],
        "regulatory_requirements": ["GDPR, HIPAA, SOX, etc."],
        "data_protection": "Data protection requirements",
        "data_location": "Where data must be stored",
        "audit_rights": "Audit provisions and frequency",
        "compliance_reporting": "Required compliance reports",
        "subcontracting_allowed": "Can supplier subcontract?",
        "subcontractor_approval": "Approval needed for subs?"
    },

    "supplier_obligations": {
        "key_personnel": "Named key personnel requirements",
        "background_checks": "Background check requirements",
        "training_requirements": "Required training",
        "reporting_obligations": ["Required reports and frequency"],
        "inventory_requirements": "Safety stock, consignment, etc."
    },

    "buyer_obligations": {
        "forecast_requirements": "Demand forecast obligations",
        "order_lead_time": "Minimum order lead time",
        "acceptance_criteria": "How deliverables are accepted",
        "acceptance_period": "Days to accept/reject"
    },

    "risks": [
        {
            "risk": "Identified risk",
            "risk_category": "Financial, operational, compliance, strategic",
            "severity": "high/medium/low",
            "likelihood": "high/medium/low",
            "impact_description": "What could happen",
            "mitigation": "Suggested mitigation",
            "clause_reference": "Relevant clause if any"
        }
    ],

    "opportunities": [
        {
            "opportunity": "Potential savings/improvement",
            "opportunity_type": "Cost reduction, risk mitigation, efficiency, terms improvement",
            "estimated_impact": "Quantified impact if possible",
            "implementation_approach": "How to capture opportunity",
            "priority": "high/medium/low"
        }
    ],

    "negotiation_insights": {
        "strong_clauses": ["Clauses favorable to buyer"],
        "weak_clauses": ["Clauses unfavorable to buyer"],
        "missing_protections": ["Standard protections not included"],
        "negotiation_leverage_points": ["Areas where better terms possible"],
        "benchmark_comparison": "How terms compare to market"
    },

    "key_clauses": ["Important clauses to note with brief description"],
    "red_flags": ["Critical issues requiring immediate attention"],
    "summary": "Executive summary of the contract",
    "contract_score": "Overall contract quality score 1-10"
}

PLAYBOOK_EXTRACTION_SCHEMA = {
    "category_info": {
        "category_name": "Category being analyzed",
        "category_code": "Category code/ID if any",
        "parent_category": "Parent category if hierarchical",
        "sub_categories": ["Sub-categories if any"],
        "category_description": "Description of what's included",
        "annual_spend": "Total annual spend in this category",
        "addressable_spend": "Spend that can be influenced",
        "spend_trend": "Increasing, decreasing, stable",
        "spend_growth_rate": "YoY growth percentage",
        "business_criticality": "High, medium, low",
        "spend_by_region": [{"region": "Region name", "spend": "Spend amount", "percentage": "% of total"}],
        "spend_by_business_unit": [{"unit": "Business unit", "spend": "Spend amount"}]
    },

    "current_state": {
        "current_supplier_count": "Number of current suppliers",
        "current_suppliers": [{"name": "Supplier name", "spend": "Annual spend", "percentage": "Share %"}],
        "contract_coverage": "% of spend under contract",
        "maverick_spend": "% of off-contract spend",
        "spot_buy_percentage": "% purchased through spot buys",
        "current_payment_terms": "Average payment terms",
        "current_lead_times": "Average lead times",
        "current_quality_rating": "Quality performance score",
        "current_delivery_rating": "Delivery performance score",
        "pain_points": ["Current challenges and issues"],
        "stakeholder_feedback": "Summary of stakeholder input"
    },

    "strategy": {
        "sourcing_strategy": "Consolidate, diversify, strategic partnership, insource, etc.",
        "strategy_rationale": "Why this strategy was chosen",
        "recommended_approach": "Detailed strategic recommendation",
        "target_supplier_count": "Optimal number of suppliers",
        "supplier_strategy": "Single source, dual source, multi-source",
        "make_vs_buy": "Make vs buy recommendation",
        "contract_strategy": "Long-term, spot buy, framework agreement, etc.",
        "contract_length_recommendation": "Recommended contract duration",
        "pricing_strategy": "Fixed, indexed, market-based, etc.",
        "demand_management": "Demand optimization opportunities",
        "specification_strategy": "Standardization opportunities",
        "total_cost_focus_areas": ["Areas beyond unit price to optimize"]
    },

    "market_analysis": {
        "market_size": "Total addressable market",
        "market_size_unit": "USD billions, units, etc.",
        "market_growth_rate": "Annual growth percentage",
        "market_maturity": "Emerging, growing, mature, declining",
        "market_dynamics": "Description of market forces",
        "key_trends": [{"trend": "Trend description", "impact": "Impact on category", "timeline": "When"}],
        "technology_trends": ["Relevant technology changes"],
        "price_trends": {
            "direction": "Increasing, decreasing, stable",
            "drivers": ["What's driving prices"],
            "forecast": "Expected price movement"
        },
        "supply_demand_balance": "Oversupply, balanced, shortage",
        "capacity_utilization": "Industry capacity utilization %",
        "raw_material_impact": [{"material": "Key input", "trend": "Price trend", "impact": "Impact on category"}],
        "currency_impact": "Currency exposure and hedging needs",
        "seasonality": "Seasonal patterns if any",
        "regulatory_changes": ["Upcoming regulations affecting category"]
    },

    "supplier_landscape": {
        "total_suppliers_in_market": "Number of potential suppliers",
        "qualified_suppliers": "Number that meet requirements",
        "market_leaders": [{"name": "Supplier name", "market_share": "Estimated share", "strengths": "Key strengths"}],
        "emerging_suppliers": [{"name": "Supplier name", "potential": "Why interesting"}],
        "supplier_concentration": "Fragmented, moderate, concentrated",
        "hhi_index": "Herfindahl-Hirschman Index if known",
        "barriers_to_entry": ["Entry barriers for new suppliers"],
        "barriers_to_exit": ["Exit barriers for current suppliers"],
        "switching_costs": {
            "level": "High, medium, low",
            "factors": ["What drives switching costs"]
        },
        "supplier_power": "High, medium, low - bargaining power",
        "buyer_power": "High, medium, low - our bargaining power",
        "innovation_leaders": ["Suppliers driving innovation"],
        "regional_suppliers": [{"region": "Region", "suppliers": ["Key suppliers"]}],
        "diverse_suppliers": [{"name": "Supplier name", "certification": "MBE, WBE, etc."}]
    },

    "risk_assessment": {
        "overall_risk_level": "high/medium/low",
        "risk_score": "Numerical risk score if calculated",
        "supply_risks": [{"risk": "Risk description", "likelihood": "high/medium/low", "impact": "high/medium/low", "mitigation": "How to mitigate"}],
        "single_source_risks": [{"supplier": "Supplier name", "spend_at_risk": "Amount", "alternative": "Backup option"}],
        "price_risks": [{"risk": "Risk description", "likelihood": "high/medium/low", "impact": "high/medium/low", "mitigation": "How to mitigate"}],
        "quality_risks": [{"risk": "Risk description", "likelihood": "high/medium/low", "impact": "high/medium/low", "mitigation": "How to mitigate"}],
        "geopolitical_risks": [{"risk": "Risk description", "regions_affected": ["Regions"], "mitigation": "How to mitigate"}],
        "sustainability_risks": [{"risk": "ESG risk", "impact": "Impact description", "mitigation": "How to address"}],
        "compliance_risks": [{"risk": "Compliance concern", "regulation": "Relevant regulation", "mitigation": "How to address"}],
        "concentration_risk": {
            "top_supplier_dependency": "% with top supplier",
            "top_3_dependency": "% with top 3 suppliers",
            "regional_concentration": "% from single region",
            "mitigation_needed": "true/false"
        },
        "financial_risks": [{"supplier": "Supplier name", "concern": "Financial concern", "indicator": "Warning sign"}]
    },

    "savings_opportunities": [
        {
            "opportunity_id": "Unique ID for tracking",
            "opportunity_type": "Volume bundling, spec optimization, demand management, supplier consolidation, competitive bidding, payment terms, etc.",
            "lever_theme": "Volume Bundling, Target Pricing, Risk Management, Re-specification",
            "description": "Detailed description of opportunity",
            "current_state": "How it's done today",
            "future_state": "How it should be done",
            "estimated_savings_percent": "Potential savings %",
            "estimated_savings_value": "Dollar value of savings",
            "confidence_level": "High, medium, low",
            "implementation_effort": "high/medium/low",
            "implementation_cost": "Cost to implement",
            "timeline": "Short-term (<6mo), medium-term (6-12mo), long-term (>12mo)",
            "quick_win": "true/false",
            "dependencies": ["What needs to happen first"],
            "risks": ["Implementation risks"],
            "stakeholders": ["Who needs to be involved"]
        }
    ],

    "benchmarking": {
        "price_benchmark": {
            "our_price": "Current average price",
            "market_low": "Market low price",
            "market_average": "Market average price",
            "market_high": "Market high price",
            "position": "Where we stand vs market"
        },
        "terms_benchmark": {
            "payment_terms": "How our terms compare",
            "warranty": "How warranty compares",
            "service_levels": "How SLAs compare"
        },
        "process_benchmark": "How our processes compare to best practice",
        "gap_analysis": ["Key gaps vs best in class"]
    },

    "recommendations": [
        {
            "recommendation_id": "Unique ID",
            "recommendation": "Specific action to take",
            "category": "Strategy, process, supplier, contract, technology",
            "priority": "high/medium/low",
            "rationale": "Why this recommendation",
            "expected_outcome": "Expected result",
            "savings_impact": "Financial impact",
            "risk_impact": "Risk reduction impact",
            "effort_required": "high/medium/low",
            "timeline": "Implementation timeline",
            "owner": "Suggested responsibility",
            "success_metrics": ["How to measure success"],
            "quick_win": "true/false"
        }
    ],

    "kpis": [
        {
            "metric": "KPI name",
            "description": "What it measures",
            "current_value": "Current performance",
            "target_value": "Target",
            "benchmark": "Industry benchmark if available",
            "measurement_frequency": "How often measured",
            "data_source": "Where data comes from"
        }
    ],

    "implementation_roadmap": {
        "phase_1": {"name": "Quick wins", "timeline": "0-3 months", "activities": ["Activities"], "expected_savings": "Savings"},
        "phase_2": {"name": "Core initiatives", "timeline": "3-9 months", "activities": ["Activities"], "expected_savings": "Savings"},
        "phase_3": {"name": "Strategic transformation", "timeline": "9-18 months", "activities": ["Activities"], "expected_savings": "Savings"}
    },

    "governance": {
        "review_frequency": "How often to review category",
        "escalation_process": "How issues are escalated",
        "stakeholder_matrix": [{"stakeholder": "Who", "role": "Their role", "involvement": "Level of involvement"}],
        "decision_rights": "Who makes what decisions"
    },

    "appendix": {
        "data_sources": ["Sources used for analysis"],
        "assumptions": ["Key assumptions made"],
        "limitations": ["Limitations of analysis"],
        "glossary": [{"term": "Term", "definition": "Definition"}]
    },

    "next_steps": [{"step": "Action item", "owner": "Who", "due_date": "When", "priority": "Priority"}],
    "summary": "Executive summary of the playbook",
    "playbook_score": "Overall readiness/quality score 1-10"
}


class LLMService:
    """
    Hybrid LLM service for the Beroe AI Procurement Platform.

    Uses Ollama + Qwen 2.5 for local processing by default.
    Falls back to OpenAI if configured and local is unavailable.
    """

    # System prompts for different tasks
    SYSTEM_PROMPTS = {
        "contract_extraction": """You are an expert procurement contract analyst at Beroe, a leading procurement intelligence company.
Your task is to extract structured information from procurement contracts.

IMPORTANT INSTRUCTIONS:
1. Extract ALL relevant information from the contract
2. Use exact values from the document when available
3. For missing information, use null or "Not specified"
4. Dates should be in YYYY-MM-DD format
5. Currency values should be numbers without symbols
6. Identify risks and opportunities for the buyer
7. Be thorough but precise - only extract what's actually in the document

You must respond with valid JSON only, no explanations.""",

        "playbook_extraction": """You are an expert procurement strategist at Beroe, a leading procurement intelligence company.
Your task is to extract structured insights from category playbooks and strategy documents.

IMPORTANT INSTRUCTIONS:
1. Extract strategic insights, market analysis, and recommendations
2. Identify all savings opportunities mentioned
3. Capture risk assessments and mitigation strategies
4. Note supplier landscape and market dynamics
5. Extract KPIs and performance metrics
6. For missing information, use null or "Not specified"
7. Quantify savings and impacts where possible

You must respond with valid JSON only, no explanations.""",

        "document_analysis": """You are an expert procurement analyst at Beroe, a leading procurement intelligence company.
You analyze procurement documents (contracts, playbooks, supplier agreements) to extract actionable insights.

Focus on:
1. Key terms and conditions
2. Pricing structures and payment terms
3. Risk factors and compliance requirements
4. Opportunities for cost optimization
5. Supplier performance metrics

Provide structured, actionable analysis.""",

        "opportunity_insight": """You are a strategic procurement advisor helping to identify cost savings opportunities.
Based on the data provided, generate specific, actionable insights that procurement teams can act on.

Be specific about:
- The opportunity and its potential impact
- Supporting data points (proof points)
- Recommended actions
- Implementation considerations
- Risk factors to consider""",

        "chat": """You are Coco, an AI procurement assistant powered by Beroe intelligence.
You help procurement professionals with:
- Analyzing spend data and identifying opportunities
- Understanding market trends and supplier dynamics
- Answering questions about procurement best practices
- Providing recommendations based on data analysis

Be helpful, specific, and data-driven in your responses.
When discussing opportunities, reference specific proof points and metrics.""",

        "brief_generation": """You are a procurement strategist creating executive briefs for leadership.
Summarize complex analysis into clear, actionable briefs that:

1. Lead with the bottom line (key finding/recommendation)
2. Support with 3-5 key data points
3. Outline specific next steps
4. Identify risks and mitigation strategies

Keep language professional but accessible. Avoid jargon.""",
    }

    def __init__(self):
        """Initialize LLM service with Ollama and optional OpenAI."""
        # OpenAI client (optional)
        self.openai_client = None
        if settings.openai_api_key:
            self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Ollama configuration
        self.ollama_base_url = settings.local_llm_base_url
        self.ollama_model = settings.local_llm_model or "qwen2.5:7b"
        self.use_local = settings.local_llm_enabled or True  # Default to local

        # HTTP client for Ollama - increased timeout for large document extraction
        self.http_client = httpx.AsyncClient(timeout=300.0)

        # Model configuration based on provider preference
        self.llm_provider = settings.llm_provider  # "openai", "local", or "hybrid"

        logger.info(
            "LLM Service initialized",
            provider=self.llm_provider,
            ollama_url=self.ollama_base_url,
            ollama_model=self.ollama_model,
            openai_configured=bool(self.openai_client)
        )

    async def check_ollama_health(self) -> bool:
        """Check if Ollama is running and accessible."""
        try:
            response = await self.http_client.get(f"{self.ollama_base_url}/api/tags")
            return response.status_code == 200
        except Exception as e:
            logger.warning("Ollama health check failed", error=str(e))
            return False

    async def ensure_model_available(self, model: str = None) -> bool:
        """Check if the specified model is available in Ollama."""
        model = model or self.ollama_model
        try:
            response = await self.http_client.get(f"{self.ollama_base_url}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                # Check if model exists (with or without tag)
                model_base = model.split(":")[0]
                return any(model_base in m for m in models)
            return False
        except Exception as e:
            logger.warning("Model check failed", error=str(e))
            return False

    # =========================================================================
    # CONTRACT EXTRACTION
    # =========================================================================

    async def extract_contract_insights(
        self,
        document_content: str,
        category: Optional[str] = None
    ) -> LLMResponse:
        """
        Extract structured insights from a contract document.

        Args:
            document_content: Text content of the contract
            category: Procurement category context

        Returns:
            LLMResponse with extracted contract data as JSON
        """
        category_context = f"\nCategory context: {category}" if category else ""

        user_prompt = f"""Extract all relevant information from this procurement contract:{category_context}

--- CONTRACT DOCUMENT ---
{document_content[:12000]}
--- END DOCUMENT ---

Extract information according to this schema and return as JSON:
{json.dumps(CONTRACT_EXTRACTION_SCHEMA, indent=2)}

Return ONLY valid JSON, no explanations or markdown."""

        return await self._call_llm(
            system_prompt=self.SYSTEM_PROMPTS["contract_extraction"],
            user_prompt=user_prompt,
            complexity=TaskComplexity.HIGH,
            response_format="json",
            prefer_local=True  # Always use local for document extraction
        )

    # =========================================================================
    # PLAYBOOK EXTRACTION
    # =========================================================================

    async def extract_playbook_insights(
        self,
        document_content: str,
        category: Optional[str] = None
    ) -> LLMResponse:
        """
        Extract structured insights from a category playbook document.

        Args:
            document_content: Text content of the playbook
            category: Procurement category context

        Returns:
            LLMResponse with extracted playbook data as JSON
        """
        category_context = f"\nCategory: {category}" if category else ""

        user_prompt = f"""Extract strategic insights from this category playbook document:{category_context}

--- PLAYBOOK DOCUMENT ---
{document_content[:12000]}
--- END DOCUMENT ---

Extract information according to this schema and return as JSON:
{json.dumps(PLAYBOOK_EXTRACTION_SCHEMA, indent=2)}

Return ONLY valid JSON, no explanations or markdown."""

        return await self._call_llm(
            system_prompt=self.SYSTEM_PROMPTS["playbook_extraction"],
            user_prompt=user_prompt,
            complexity=TaskComplexity.HIGH,
            response_format="json",
            prefer_local=True  # Always use local for document extraction
        )

    # =========================================================================
    # GENERIC DOCUMENT ANALYSIS (Original method - kept for compatibility)
    # =========================================================================

    async def analyze_document(
        self,
        document_content: str,
        document_type: Literal["contract", "playbook", "supplier_agreement", "policy", "other"],
        category: Optional[str] = None,
        extraction_focus: Optional[List[str]] = None
    ) -> LLMResponse:
        """
        Analyze a procurement document using LLM.
        Routes to specific extractors for contract/playbook.
        """
        # Route to specific extractors
        if document_type == "contract":
            return await self.extract_contract_insights(document_content, category)
        elif document_type == "playbook":
            return await self.extract_playbook_insights(document_content, category)

        # Generic analysis for other types
        focus_str = ""
        if extraction_focus:
            focus_str = f"\n\nFocus particularly on extracting: {', '.join(extraction_focus)}"

        category_context = f"\nCategory context: {category}" if category else ""

        user_prompt = f"""Analyze this {document_type} document:{category_context}

{document_content[:15000]}

{focus_str}

Provide analysis in the following JSON structure:
{{
    "summary": "Brief executive summary",
    "key_terms": [
        {{"term": "...", "details": "...", "risk_level": "high/medium/low"}}
    ],
    "pricing": {{
        "structure": "...",
        "key_rates": [...],
        "payment_terms": "..."
    }},
    "risks": [
        {{"risk": "...", "severity": "high/medium/low", "mitigation": "..."}}
    ],
    "opportunities": [
        {{"opportunity": "...", "potential_impact": "...", "action": "..."}}
    ],
    "compliance": {{
        "requirements": [...],
        "gaps": [...]
    }},
    "recommendations": [
        {{"recommendation": "...", "priority": "high/medium/low", "rationale": "..."}}
    ]
}}"""

        return await self._call_llm(
            system_prompt=self.SYSTEM_PROMPTS["document_analysis"],
            user_prompt=user_prompt,
            complexity=TaskComplexity.HIGH,
            response_format="json"
        )

    async def generate_opportunity_insights(
        self,
        opportunity_data: Dict[str, Any],
        proof_points: List[Dict[str, Any]],
        category: str,
        spend_amount: float
    ) -> LLMResponse:
        """Generate detailed insights for a procurement opportunity."""
        user_prompt = f"""Generate strategic insights for this procurement opportunity:

Category: {category}
Total Spend: ${spend_amount:,.2f}

Opportunity Type: {opportunity_data.get('name', 'Unknown')}
Overall Score: {opportunity_data.get('overall_score', 0):.0%}
Impact Level: {opportunity_data.get('impact_level', 'MEDIUM')}

Proof Points:
{json.dumps(proof_points, indent=2)}

Estimated Savings: ${opportunity_data.get('savings', {}).get('estimated_savings', 0):,.2f}

Generate insights in JSON format:
{{
    "executive_summary": "...",
    "key_findings": [
        {{"finding": "...", "supporting_data": "...", "significance": "..."}}
    ],
    "action_plan": [
        {{"action": "...", "timeline": "...", "expected_outcome": "...", "owner": "..."}}
    ],
    "implementation_risks": [
        {{"risk": "...", "probability": "...", "mitigation": "..."}}
    ],
    "success_metrics": [
        {{"metric": "...", "baseline": "...", "target": "..."}}
    ]
}}"""

        return await self._call_llm(
            system_prompt=self.SYSTEM_PROMPTS["opportunity_insight"],
            user_prompt=user_prompt,
            complexity=TaskComplexity.HIGH,
            response_format="json"
        )

    async def generate_executive_brief(
        self,
        portfolio_analysis: Dict[str, Any],
        focus_areas: Optional[List[str]] = None
    ) -> LLMResponse:
        """Generate an executive brief from portfolio analysis."""
        focus_str = ""
        if focus_areas:
            focus_str = f"\n\nFocus areas for this brief: {', '.join(focus_areas)}"

        user_prompt = f"""Create an executive brief from this portfolio analysis:

{json.dumps(portfolio_analysis, indent=2, default=str)[:10000]}

{focus_str}

Generate a brief in JSON format:
{{
    "title": "...",
    "date": "...",
    "executive_summary": "...",
    "key_metrics": {{
        "total_spend": ...,
        "potential_savings": ...,
        "savings_percentage": ...,
        "risk_score": ...
    }},
    "top_opportunities": [
        {{"opportunity": "...", "category": "...", "savings": ..., "priority": "..."}}
    ],
    "risk_alerts": [
        {{"alert": "...", "severity": "...", "action": "..."}}
    ],
    "recommended_actions": [
        {{"action": "...", "timeline": "...", "impact": "..."}}
    ],
    "next_steps": [...]
}}"""

        return await self._call_llm(
            system_prompt=self.SYSTEM_PROMPTS["brief_generation"],
            user_prompt=user_prompt,
            complexity=TaskComplexity.HIGH,
            response_format="json"
        )

    async def chat(
        self,
        messages: List[Dict[str, str]],
        context: Optional[Dict[str, Any]] = None
    ) -> LLMResponse:
        """Process a chat message with conversation context."""
        system_prompt = self.SYSTEM_PROMPTS["chat"]
        if context:
            context_str = f"\n\nContext for this conversation:\n{json.dumps(context, indent=2, default=str)[:5000]}"
            system_prompt += context_str

        last_message = messages[-1]["content"] if messages else ""
        complexity = self._estimate_complexity(last_message)

        return await self._call_llm(
            system_prompt=system_prompt,
            messages=messages,
            complexity=complexity,
            response_format="text"
        )

    async def extract_structured_data(
        self,
        text: str,
        schema: Dict[str, Any]
    ) -> LLMResponse:
        """Extract structured data from text according to a schema."""
        user_prompt = f"""Extract data from the following text according to this schema:

Schema:
{json.dumps(schema, indent=2)}

Text:
{text[:10000]}

Return only valid JSON matching the schema."""

        return await self._call_llm(
            system_prompt="You are a data extraction assistant. Extract information precisely according to the given schema.",
            user_prompt=user_prompt,
            complexity=TaskComplexity.MEDIUM,
            response_format="json"
        )

    async def classify_category(
        self,
        description: str,
        categories: List[str]
    ) -> LLMResponse:
        """Classify text into procurement categories."""
        user_prompt = f"""Classify this item into one of the given categories:

Item description: {description}

Categories: {', '.join(categories)}

Return JSON: {{"category": "selected_category", "confidence": 0.0-1.0, "reasoning": "..."}}"""

        return await self._call_llm(
            system_prompt="You are a procurement categorization expert. Classify items accurately.",
            user_prompt=user_prompt,
            complexity=TaskComplexity.LOW,
            response_format="json"
        )

    def _estimate_complexity(self, text: str) -> TaskComplexity:
        """Estimate task complexity from text."""
        complex_indicators = [
            "analyze", "strategy", "recommend", "evaluate", "compare",
            "opportunities", "risks", "savings", "contract", "negotiate"
        ]
        simple_indicators = [
            "what is", "define", "list", "show", "display", "how many"
        ]

        text_lower = text.lower()
        complex_count = sum(1 for ind in complex_indicators if ind in text_lower)
        simple_count = sum(1 for ind in simple_indicators if ind in text_lower)

        if complex_count > 2:
            return TaskComplexity.HIGH
        elif simple_count > complex_count:
            return TaskComplexity.LOW
        else:
            return TaskComplexity.MEDIUM

    # =========================================================================
    # CORE LLM CALL - Supports both Ollama and OpenAI
    # =========================================================================

    async def _call_llm(
        self,
        system_prompt: str,
        user_prompt: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        complexity: TaskComplexity = TaskComplexity.MEDIUM,
        response_format: Literal["text", "json"] = "text",
        prefer_local: bool = False
    ) -> LLMResponse:
        """
        Make a call to the LLM (Ollama or OpenAI).

        Args:
            system_prompt: System/instruction prompt
            user_prompt: Single user prompt (if not using messages)
            messages: Conversation messages (alternative to user_prompt)
            complexity: Task complexity for model selection
            response_format: Expected response format
            prefer_local: Force use of local Ollama model

        Returns:
            LLMResponse
        """
        start_time = datetime.now()

        # Build messages
        llm_messages = [{"role": "system", "content": system_prompt}]
        if messages:
            llm_messages.extend(messages)
        elif user_prompt:
            llm_messages.append({"role": "user", "content": user_prompt})

        # Determine which provider to use
        use_ollama = prefer_local or self.llm_provider == "local" or (
            self.llm_provider == "hybrid" and complexity in [TaskComplexity.HIGH, TaskComplexity.MEDIUM]
        )

        # Try Ollama first if preferred
        if use_ollama:
            ollama_available = await self.check_ollama_health()
            if ollama_available:
                try:
                    return await self._call_ollama(llm_messages, response_format, start_time)
                except Exception as e:
                    logger.warning("Ollama call failed, falling back", error=str(e))

        # Fall back to OpenAI if available
        if self.openai_client:
            try:
                return await self._call_openai(llm_messages, complexity, response_format, start_time)
            except Exception as e:
                logger.error("OpenAI call failed", error=str(e))

        # Return simulated response if no LLM available
        return self._simulate_response(user_prompt or "", start_time, error="No LLM available")

    async def _call_ollama(
        self,
        messages: List[Dict[str, str]],
        response_format: str,
        start_time: datetime
    ) -> LLMResponse:
        """Call Ollama API with Qwen model."""

        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,  # Lower for more consistent extraction
                "num_predict": 4096,  # Allow longer responses for JSON
            }
        }

        # Request JSON format if needed
        if response_format == "json":
            payload["format"] = "json"

        response = await self.http_client.post(
            f"{self.ollama_base_url}/api/chat",
            json=payload
        )

        if response.status_code != 200:
            raise Exception(f"Ollama API error: {response.status_code} - {response.text}")

        data = response.json()
        content = data.get("message", {}).get("content", "")

        # Parse token usage
        eval_count = data.get("eval_count", 0)
        prompt_eval_count = data.get("prompt_eval_count", 0)
        total_tokens = eval_count + prompt_eval_count

        latency = (datetime.now() - start_time).total_seconds() * 1000

        logger.info(
            "Ollama call completed",
            model=self.ollama_model,
            tokens=total_tokens,
            latency_ms=latency
        )

        return LLMResponse(
            content=content,
            model_used=self.ollama_model,
            tokens_used=total_tokens,
            latency_ms=latency,
            metadata={"provider": "ollama", "eval_count": eval_count}
        )

    async def _call_openai(
        self,
        messages: List[Dict[str, str]],
        complexity: TaskComplexity,
        response_format: str,
        start_time: datetime
    ) -> LLMResponse:
        """Call OpenAI API."""

        model = ModelType.OPENAI_GPT4 if complexity == TaskComplexity.HIGH else ModelType.OPENAI_GPT35

        response = await self.openai_client.chat.completions.create(
            model=model.value,
            messages=messages,
            temperature=0.7 if complexity == TaskComplexity.HIGH else 0.5,
            max_tokens=2000 if complexity == TaskComplexity.HIGH else 1000,
            response_format={"type": "json_object"} if response_format == "json" else None
        )

        content = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        latency = (datetime.now() - start_time).total_seconds() * 1000

        logger.info(
            "OpenAI call completed",
            model=model.value,
            tokens=tokens,
            latency_ms=latency
        )

        return LLMResponse(
            content=content,
            model_used=model.value,
            tokens_used=tokens,
            latency_ms=latency,
            metadata={"provider": "openai", "complexity": complexity.value}
        )

    def _simulate_response(
        self,
        prompt: str,
        start_time: datetime,
        error: Optional[str] = None
    ) -> LLMResponse:
        """Generate simulated response for demo/testing."""
        latency = (datetime.now() - start_time).total_seconds() * 1000

        if "contract" in prompt.lower():
            content = json.dumps({
                "summary": "Demo mode - Install Ollama and run: ollama pull qwen2.5:7b",
                "contract_id": "DEMO-001",
                "parties": {"buyer": "Demo Corp", "supplier": "Sample Vendor"},
                "dates": {"effective_date": "2024-01-01", "expiry_date": "2025-12-31"},
                "financials": {"total_value": 100000, "currency": "USD", "payment_terms": "Net 30"},
                "risks": [{"risk": "Demo mode active", "severity": "low", "mitigation": "Install Ollama"}],
                "opportunities": [{"opportunity": "Enable AI extraction", "estimated_impact": "Full contract analysis"}]
            })
        elif "playbook" in prompt.lower():
            content = json.dumps({
                "summary": "Demo mode - Install Ollama and run: ollama pull qwen2.5:7b",
                "category_info": {"category_name": "Demo Category", "annual_spend": 1000000},
                "strategy": {"sourcing_strategy": "Consolidate", "recommended_approach": "Install Ollama for full analysis"},
                "savings_opportunities": [{"opportunity_type": "AI-powered analysis", "estimated_savings_percent": 10}],
                "recommendations": [{"recommendation": "Enable local LLM", "priority": "high"}]
            })
        elif "json" in prompt.lower() or "{" in prompt:
            content = json.dumps({
                "summary": "Simulated response - No LLM configured",
                "key_findings": [{"finding": "Demo mode", "significance": "Install Ollama for real analysis"}],
                "recommendations": [{"recommendation": "Run: ollama pull qwen2.5:7b", "priority": "high"}]
            })
        else:
            content = "I'm running in demo mode. Please install Ollama and run 'ollama pull qwen2.5:7b' for full AI capabilities!"

        return LLMResponse(
            content=content,
            model_used="simulated",
            tokens_used=0,
            latency_ms=latency,
            metadata={"simulated": True, "error": error}
        )

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()
