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
    OLLAMA_MISTRAL = "mistral:7b"
    OLLAMA_LLAMA = "llama3.2:3b"


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
        """Initialize LLM service with multiple provider support."""
        # Model configuration based on provider preference
        self.llm_provider = settings.llm_provider  # "openai", "together", "groq", "local", or "hybrid"

        # OpenAI client (for openai/hybrid modes)
        self.openai_client = None
        if settings.openai_api_key:
            self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Together.ai client (OpenAI-compatible API)
        self.together_client = None
        if settings.together_api_key:
            self.together_client = AsyncOpenAI(
                api_key=settings.together_api_key,
                base_url="https://api.together.xyz/v1"
            )
        self.together_model = settings.together_model

        # Groq client (OpenAI-compatible API)
        self.groq_client = None
        if settings.groq_api_key:
            self.groq_client = AsyncOpenAI(
                api_key=settings.groq_api_key,
                base_url="https://api.groq.com/openai/v1"
            )
        self.groq_model = settings.groq_model

        # Ollama configuration (for local development)
        self.ollama_base_url = settings.local_llm_base_url
        self.ollama_model = settings.local_llm_model or "qwen2.5:7b"
        self.use_local = settings.local_llm_enabled

        # HTTP client for Ollama - increased timeout for large document extraction
        self.http_client = httpx.AsyncClient(timeout=300.0)

        logger.info(
            "LLM Service initialized",
            provider=self.llm_provider,
            openai_configured=bool(self.openai_client),
            together_configured=bool(self.together_client),
            groq_configured=bool(self.groq_client),
            ollama_url=self.ollama_base_url if self.use_local else "disabled"
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
            response_format="json"
            # Uses configured provider (Groq/OpenAI) - removed prefer_local
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
            response_format="json"
            # Uses configured provider (Groq/OpenAI) - removed prefer_local
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

    async def generate_opportunity_recommendations(
        self,
        opportunity_type: str,
        category_name: str,
        spend_data: Dict[str, Any],
        supplier_data: List[Dict[str, Any]],
        metrics: Dict[str, Any],
        proof_points: List[Dict[str, Any]],
        playbook_data: Optional[Dict[str, Any]] = None,
        contract_data: Optional[Dict[str, Any]] = None,
        supplier_master_data: Optional[Dict[str, Any]] = None,
        locations: Optional[List[str]] = None
    ) -> LLMResponse:
        """
        Generate intelligent, context-aware recommendations for a procurement opportunity.

        This method:
        1. Analyzes uploaded documents (category playbook, contracts, supplier data)
        2. Extracts category-specific insights
        3. Avoids duplicating existing playbook recommendations
        4. Generates 10 unique, data-driven recommendations with reasoning
        5. Works for all 4 opportunity types (Volume Bundling, Target Pricing, Risk Management, Re-spec Pack)
        
        Args:
            opportunity_type: Type of opportunity (volume-bundling, target-pricing, risk-management, respec-pack)
            category_name: Category name (e.g., "Edible Oils")
            spend_data: Spend breakdown data
            supplier_data: List of suppliers with spend amounts
            metrics: Computed metrics (price variance, concentration, etc.)
            proof_points: List of proof points with validation status
            playbook_data: Extracted playbook data for this category
            contract_data: Extracted contract data for this category
            supplier_master_data: Supplier master data
            locations: Geographic locations/regions
            
        Returns:
            LLMResponse with 10 recommendations in JSON format
        """
        # Build a rich context for the LLM
        validated_pps = [pp for pp in proof_points if pp.get('isValidated', False)]
        unvalidated_pps = [pp for pp in proof_points if not pp.get('isValidated', False)]

        # Extract playbook data for deduplication and traceability
        existing_playbook_recs = []
        playbook_strategy = ""
        playbook_market_trend = ""
        playbook_risk_factor = ""

        if playbook_data:
            existing_playbook_recs = playbook_data.get("recommendations", [])
            playbook_strategy = playbook_data.get("strategy", "")
            playbook_market_trend = playbook_data.get("marketTrend", "")
            playbook_risk_factor = playbook_data.get("riskFactor", "")

            logger.info(f"Playbook data received: strategy={playbook_strategy}, recommendations={len(existing_playbook_recs)}")

        # Extract contract insights
        contract_insights = {}
        if contract_data:
            contract_insights = {
                "active_contracts": contract_data.get("contracts", []),
                "total_contract_value": contract_data.get("total_value", 0),
                "payment_terms": contract_data.get("payment_terms", []),
                "renewal_dates": contract_data.get("renewal_dates", []),
                "auto_renewal_contracts": contract_data.get("auto_renewal", [])
            }

        # Build rich context with all uploaded data sources
        context = {
            "opportunity_type": opportunity_type,
            "category": category_name,
            "locations": locations or [],
            "total_spend": spend_data.get("totalSpend", 0),
            "spend_breakdown": spend_data.get("breakdown", [])[:10],
            "top_suppliers": supplier_data[:10] if supplier_data else [],
            "metrics": metrics,
            "validated_proof_points": len(validated_pps),
            "total_proof_points": len(proof_points),
            "unvalidated_items": [pp.get("name") for pp in unvalidated_pps],
            # Playbook details for traceability
            "playbook": {
                "strategy": playbook_strategy,
                "market_trend": playbook_market_trend,
                "risk_factor": playbook_risk_factor,
                "existing_recommendations": existing_playbook_recs
            },
            "contract_insights": contract_insights,
            "supplier_master": supplier_master_data or {}
        }

        # Opportunity-specific context and proof points
        opportunity_definitions = {
            "volume-bundling": {
                "description": "consolidating purchase volumes across sites/categories/regions for better pricing leverage",
                "proof_points": [
                    "Regional Spend - Spend distribution across geographic regions",
                    "Tail Spend - Fragmented spend across multiple small suppliers",
                    "Volume Leverage - Total volume that can be consolidated",
                    "Price Variance - Price differences across suppliers for similar items",
                    "Avg Spend/Supplier - Average spend per supplier",
                    "Market Consolidation (HHI) - Market structure and supplier concentration",
                    "Supplier Location - Geographic distribution of suppliers",
                    "Supplier Risk Rating - Risk assessment of supplier base"
                ],
                "focus_areas": [
                    "Consolidate fragmented spend across regions and suppliers",
                    "Leverage volume to negotiate tiered pricing and rebates",
                    "Standardize specifications to enable cross-regional bundling",
                    "Create demand pooling mechanisms",
                    "Rationalize supplier base strategically"
                ]
            },
            "target-pricing": {
                "description": "using should-cost models, market indices, and benchmarking to negotiate optimal prices",
                "proof_points": [
                    "Price Variance - Price differences across suppliers and regions",
                    "Tariff Rate - Import/export tariff impacts on pricing",
                    "Cost Structure - Breakdown of cost components",
                    "Unit Price - Per-unit pricing analysis across suppliers"
                ],
                "focus_areas": [
                    "Implement should-cost analysis to validate pricing",
                    "Negotiate index-linked pricing with caps and floors",
                    "Benchmark against market rates and best-in-class prices",
                    "Optimize tariff exposure through sourcing mix",
                    "Implement automated price monitoring"
                ]
            },
            "risk-management": {
                "description": "reducing supply chain risks through diversification, monitoring, and mitigation strategies",
                "proof_points": [
                    "Single Sourcing - Items with only one supplier",
                    "Supplier Concentration - Over-reliance on specific suppliers",
                    "Category Risk - Inherent risk level of the category",
                    "Inflation - Inflation impact on category costs",
                    "Exchange Rate - Currency fluctuation risks",
                    "Geo Political - Geopolitical risks affecting supply",
                    "Supplier Risk Rating - Overall supplier risk assessment"
                ],
                "focus_areas": [
                    "Qualify backup suppliers for single-sourced items",
                    "Diversify supplier base to reduce concentration",
                    "Develop contingency sourcing plans for high-risk regions",
                    "Implement currency hedging strategies",
                    "Monitor supplier financial health proactively"
                ]
            },
            "respec-pack": {
                "description": "optimizing specifications and pack sizes to reduce costs without compromising quality",
                "proof_points": [
                    "Price Variance - Price differences indicating spec optimization opportunities",
                    "Export Data - Export patterns and alternative sourcing options",
                    "Cost Structure - Cost breakdown to identify spec-driven savings"
                ],
                "focus_areas": [
                    "Rationalize SKUs and standardize specifications",
                    "Analyze pack size optimization opportunities",
                    "Conduct value engineering workshops",
                    "Explore alternative materials and specifications",
                    "Implement cross-functional spec review processes"
                ]
            }
        }

        opp_def = opportunity_definitions.get(opportunity_type, opportunity_definitions["volume-bundling"])

        # Build location context
        location_context = ""
        if locations and len(locations) > 0:
            location_context = f"""
GEOGRAPHIC CONTEXT:
- Locations/Regions: {', '.join(locations)}
- Consider regional factors (local suppliers, tariffs, logistics, currency, regulations)
"""

        # Build playbook context string for explicit deduplication
        # Extract key phrases from playbook recommendations to BAN
        banned_phrases = []
        if existing_playbook_recs:
            for rec in existing_playbook_recs:
                rec_lower = rec.lower()
                if 'quarterly' in rec_lower:
                    banned_phrases.append('quarterly')
                if 'weekly' in rec_lower:
                    banned_phrases.append('weekly')
                if 'index-linked' in rec_lower or 'index linked' in rec_lower:
                    banned_phrases.append('index-linked pricing')
                if 'qualified suppliers' in rec_lower or '2 qualified' in rec_lower:
                    banned_phrases.append('maintain 2 qualified suppliers')
                if 'business review' in rec_lower:
                    banned_phrases.append('business reviews')
                if 'commodity index' in rec_lower:
                    banned_phrases.append('commodity index monitoring')

        playbook_context = ""
        if existing_playbook_recs and len(existing_playbook_recs) > 0:
            playbook_context = f"""
=== CATEGORY PLAYBOOK DATA - CRITICAL DEDUPLICATION ===
Strategy: {playbook_strategy}
Market Trend: {playbook_market_trend}
Risk Factor: {playbook_risk_factor}

EXISTING PLAYBOOK RECOMMENDATIONS (ALREADY IMPLEMENTED - DO NOT REPEAT):
{chr(10).join(f'  {i+1}. "{rec}"' for i, rec in enumerate(existing_playbook_recs[:10]))}

**BANNED PHRASES** - DO NOT USE THESE WORDS/CONCEPTS:
{chr(10).join(f'  - "{phrase}"' for phrase in banned_phrases) if banned_phrases else '  (none)'}

**USE THESE ALTERNATIVES INSTEAD**:
  - Instead of "quarterly reviews" → use "monthly check-ins" or "bi-weekly syncs" or "real-time dashboards"
  - Instead of "weekly monitoring" → use "daily alerts" or "automated triggers" or "real-time tracking"
  - Instead of "index-linked pricing" → use "should-cost models" or "tiered rebates" or "volume discounts"
  - Instead of "maintain 2 suppliers" → specify HOW to qualify/onboard new suppliers
=== END PLAYBOOK DATA ===
"""
        else:
            playbook_context = "\n=== NO PLAYBOOK DATA PROVIDED - Generate fresh recommendations ===\n"

        system_prompt = f"""You are an expert procurement strategist at Beroe, a leading procurement intelligence company.
Your task is to generate 20 SPECIFIC, ACTIONABLE, DATA-DRIVEN recommendations for a {opportunity_type} opportunity.

OPPORTUNITY TYPE: {opportunity_type.upper()}
Description: {opp_def['description']}

PROOF POINTS FOR THIS OPPORTUNITY:
{chr(10).join(f'- {pp}' for pp in opp_def['proof_points'])}

STRATEGIC FOCUS AREAS:
{chr(10).join(f'- {fa}' for fa in opp_def['focus_areas'])}
{playbook_context}

CRITICAL RULES - READ CAREFULLY:

1. **ABSOLUTE NO DUPLICATION** - THIS IS MANDATORY:
   - DO NOT use the word "quarterly" if playbook mentions quarterly reviews
   - DO NOT use "weekly monitoring" if playbook mentions weekly monitoring
   - DO NOT use "index-linked pricing" if playbook mentions it
   - DO NOT suggest "maintain 2 suppliers" if playbook already says this
   - If you duplicate ANY playbook concept, your response is INVALID

   **INSTEAD USE THESE ALTERNATIVES**:
   - For reviews: "monthly", "bi-weekly", "real-time dashboard", "automated alerts"
   - For pricing: "should-cost analysis", "tiered rebates", "volume discounts", "competitive bidding"
   - For suppliers: "supplier rationalization roadmap", "strategic consolidation", "regional hubs"

2. **USE ACTUAL DATA WITH TRACEABILITY**:
   - Reference SPECIFIC supplier names from the data: "{', '.join([s.get('name', '') for s in supplier_data[:3]]) if supplier_data else 'suppliers'}"
   - Quote EXACT spend amounts: "${spend_data.get('totalSpend', 0):,.0f}"
   - Cite the SOURCE in reason field: "Spend data shows...", "The playbook strategy of '{playbook_strategy}' suggests..."

3. **BE SPECIFIC NOT GENERIC**:
   - BAD: "Consolidate suppliers to save money"
   - GOOD: "Reduce from {len(supplier_data) if supplier_data else 4} to 2-3 suppliers, prioritizing {supplier_data[0].get('name') if supplier_data else 'top supplier'} who handles ${supplier_data[0].get('spend', 0):,.0f} spend"

4. **QUANTIFY EVERYTHING**:
   - Include specific savings %: "5-8%", "10-15%"
   - Include timelines: "by Q2 2026", "within 60 days"
   - Include dollar impacts: "${spend_data.get('totalSpend', 0) * 0.05:,.0f} potential savings"

5. **GENERATE EXACTLY 20 RECOMMENDATIONS** - count them: 1, 2, 3... up to 20

OUTPUT FORMAT:
Return ONLY a JSON array with exactly 20 objects. Each has "text" and "reason" fields.
[{{"text": "recommendation", "reason": "data-backed reason with source citation"}}, ...]
NO markdown, NO explanations - ONLY the JSON array starting with [ and ending with ]"""

        # Get supplier names and counts for easy reference
        supplier_count = len(supplier_data) if supplier_data else 4
        supplier_names = [s.get('name', f'Supplier{i+1}') for i, s in enumerate(supplier_data[:5])] if supplier_data else ['Supplier1', 'Supplier2', 'Supplier3']
        supplier1 = supplier_names[0] if len(supplier_names) > 0 else 'TopSupplier'
        supplier2 = supplier_names[1] if len(supplier_names) > 1 else 'SecondSupplier'
        supplier3 = supplier_names[2] if len(supplier_names) > 2 else 'ThirdSupplier'
        locations_str = ', '.join(locations) if locations else 'your regions'
        total_spend_val = context['total_spend']

        user_prompt = f"""Generate 20 UNIQUE recommendations for {opportunity_type} in {category_name}.
{location_context}

=== YOUR DATA SOURCES (cite these in your reasons) ===

SPEND DATA:
- Total Spend: ${total_spend_val:,.0f}
- Suppliers: {', '.join(supplier_names)}
- Locations: {locations_str}

METRICS:
- Price Variance: {metrics.get('priceVariance', 15)}%
- Top 3 Concentration: {metrics.get('top3Concentration', 65)}%
- Supplier Count: {metrics.get('supplierCount', len(supplier_data) if supplier_data else 4)}
- Tail Spend: {metrics.get('tailSpendPercentage', 12)}%

PLAYBOOK DATA:
- Strategy: {playbook_strategy or 'Not specified'}
- Market Trend: {playbook_market_trend or 'Not specified'}
- Risk Factor: {playbook_risk_factor or 'Not specified'}

=== GENERATE 20 RECOMMENDATIONS ===

Each recommendation must:
1. Use ACTUAL supplier names: {supplier1}, {supplier2}, {supplier3}
2. Include SPECIFIC amounts: ${total_spend_val:,.0f} total, ${total_spend_val * 0.05:,.0f} savings
3. Have a "reason" that cites the SOURCE: "Spend data shows...", "The playbook strategy of '{playbook_strategy}' indicates...", "Metrics reveal..."

EXAMPLE of good recommendation with traceability:
{{
  "text": "Consolidate {supplier_count} suppliers to 2-3 strategic partners, prioritizing {supplier1} and {supplier2} for their regional coverage across {locations_str}. Target completion by Q4 2026 with 8-12% price improvement.",
  "reason": "Spend data shows {supplier_count} active suppliers with ${total_spend_val:,.0f} total spend. The playbook strategy '{playbook_strategy}' supports consolidation. Current {metrics.get('top3Concentration', 65)}% concentration with top 3 indicates room for strategic rationalization."
}}

Output EXACTLY 20 recommendations as a JSON array. Start with '[' and end with ']':"""

        return await self._call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            complexity=TaskComplexity.HIGH,
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

    async def generate_brief_content(
        self,
        opportunity_type: str,
        category_name: str,
        total_spend: float,
        suppliers: List[Dict[str, Any]],
        metrics: Dict[str, Any],
        recommendations: List[Dict[str, str]],
        proof_points: List[Dict[str, Any]],
        locations: Optional[List[str]] = None,
        savings_low: float = 0,
        savings_high: float = 0,
        confidence_score: float = 0
    ) -> LLMResponse:
        """
        Generate enhanced content for Leadership Brief using LLM.

        This creates a more detailed, contextual executive summary, strategic analysis,
        and implementation insights based on the actual data.

        Uses OpenAI (primary) with Qwen fallback for high-quality content.
        """
        # Build context for the LLM
        validated_pps = [pp for pp in proof_points if pp.get('isValidated', False)]
        top_suppliers = suppliers[:5] if suppliers else []

        context = {
            "opportunity_type": opportunity_type,
            "category": category_name,
            "locations": locations or [],
            "total_spend": total_spend,
            "top_suppliers": [{"name": s.get("name"), "spend": s.get("spend", 0)} for s in top_suppliers],
            "metrics": metrics,
            "validated_proof_points": len(validated_pps),
            "total_proof_points": len(proof_points),
            "savings_range": {"low": savings_low, "high": savings_high},
            "confidence_score": confidence_score,
            "recommendations_count": len(recommendations)
        }

        system_prompt = """You are an expert procurement strategist at Beroe, creating content for a Leadership Brief.
Your task is to generate compelling, data-driven content that executives can act upon.

IMPORTANT:
1. Use ACTUAL numbers from the data provided - specific spend amounts, percentages, supplier names
2. Be concise but impactful - executives have limited time
3. Focus on strategic implications, not just data recitation
4. Highlight risks AND opportunities
5. Make recommendations actionable and specific

Return a JSON object with these fields:
- executive_summary: 2-3 sentences summarizing the opportunity (use actual $ figures)
- strategic_analysis: 2-3 key strategic insights based on the data
- risk_assessment: Top 2-3 risks with mitigation approaches
- implementation_priorities: Top 3 actions to take immediately
- success_factors: What will make this initiative successful"""

        user_prompt = f"""Generate enhanced Leadership Brief content for this procurement opportunity:

OPPORTUNITY DATA:
{json.dumps(context, indent=2, default=str)}

ACCEPTED RECOMMENDATIONS:
{json.dumps([r.get('text', '') for r in recommendations[:5]], indent=2)}

Generate strategic, executive-level content that:
1. References specific suppliers by name (e.g., "{top_suppliers[0].get('name') if top_suppliers else 'top supplier'}")
2. Cites actual spend figures (e.g., "${total_spend:,.0f}")
3. Mentions specific regions/locations: {', '.join(locations) if locations else 'target regions'}
4. Provides actionable insights for leadership

Return ONLY valid JSON."""

        return await self._call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            complexity=TaskComplexity.HIGH,
            response_format="json"
        )

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
        Make a call to the LLM (OpenAI or Ollama).

        PRIORITY ORDER (hybrid mode - default):
        1. OpenAI (primary) - better quality, faster for most tasks
        2. Ollama/Qwen (fallback) - used if OpenAI fails or is unavailable

        Args:
            system_prompt: System/instruction prompt
            user_prompt: Single user prompt (if not using messages)
            messages: Conversation messages (alternative to user_prompt)
            complexity: Task complexity for model selection
            response_format: Expected response format
            prefer_local: Force use of local Ollama model (overrides hybrid behavior)

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

        # PROVIDER SELECTION LOGIC:
        # - "local": Only use Ollama/Qwen (development)
        # - "openai": Only use OpenAI
        # - "together": Use Together.ai (open source models)
        # - "groq": Use Groq (ultra-fast)
        # - "hybrid": Try OpenAI first, fallback to Ollama/Qwen

        # If prefer_local is set, use Ollama regardless of provider setting
        if prefer_local and self.use_local:
            ollama_available = await self.check_ollama_health()
            if ollama_available:
                try:
                    logger.info("Using Ollama (prefer_local=True)")
                    return await self._call_ollama(llm_messages, response_format, start_time)
                except Exception as e:
                    logger.warning("Ollama call failed", error=str(e))

        # Local-only mode (development)
        if self.llm_provider == "local":
            ollama_available = await self.check_ollama_health()
            if ollama_available:
                try:
                    logger.info("Using Ollama (provider=local)")
                    return await self._call_ollama(llm_messages, response_format, start_time)
                except Exception as e:
                    logger.error("Ollama call failed", error=str(e))
            return self._simulate_response(user_prompt or "", start_time, error="Ollama not available")

        # Together.ai mode (open source models like Llama, Mistral)
        if self.llm_provider == "together":
            if self.together_client:
                try:
                    logger.info("Using Together.ai (provider=together)")
                    return await self._call_together(llm_messages, complexity, response_format, start_time)
                except Exception as e:
                    logger.error("Together.ai call failed", error=str(e))
            return self._simulate_response(user_prompt or "", start_time, error="Together.ai not configured")

        # Groq mode (ultra-fast inference) with OpenAI fallback
        if self.llm_provider == "groq":
            if self.groq_client:
                try:
                    logger.info("Using Groq (provider=groq)")
                    return await self._call_groq(llm_messages, complexity, response_format, start_time)
                except Exception as e:
                    logger.warning("Groq call failed, falling back to OpenAI", error=str(e))
            # Fallback to OpenAI
            if self.openai_client:
                try:
                    logger.info("Using OpenAI (groq fallback)")
                    return await self._call_openai(llm_messages, complexity, response_format, start_time)
                except Exception as e:
                    logger.error("OpenAI fallback also failed", error=str(e))
            return self._simulate_response(user_prompt or "", start_time, error="Groq and OpenAI both failed")

        # OpenAI-only mode
        if self.llm_provider == "openai":
            if self.openai_client:
                try:
                    logger.info("Using OpenAI (provider=openai)")
                    return await self._call_openai(llm_messages, complexity, response_format, start_time)
                except Exception as e:
                    logger.error("OpenAI call failed", error=str(e))
            return self._simulate_response(user_prompt or "", start_time, error="OpenAI not available")

        # HYBRID MODE (default): OpenAI first, fallback to Together/Groq/Ollama
        # Try OpenAI first (primary)
        if self.openai_client:
            try:
                logger.info("Using OpenAI (hybrid mode - primary)")
                return await self._call_openai(llm_messages, complexity, response_format, start_time)
            except Exception as e:
                logger.warning("OpenAI call failed, trying fallbacks", error=str(e))

        # Try Together.ai as first fallback
        if self.together_client:
            try:
                logger.info("Using Together.ai (hybrid mode - fallback)")
                return await self._call_together(llm_messages, complexity, response_format, start_time)
            except Exception as e:
                logger.warning("Together.ai fallback failed", error=str(e))

        # Try Groq as second fallback
        if self.groq_client:
            try:
                logger.info("Using Groq (hybrid mode - fallback)")
                return await self._call_groq(llm_messages, complexity, response_format, start_time)
            except Exception as e:
                logger.warning("Groq fallback failed", error=str(e))

        # Fallback to Ollama/Qwen (local development)
        if self.use_local:
            ollama_available = await self.check_ollama_health()
            if ollama_available:
                try:
                    logger.info("Using Ollama (hybrid mode - final fallback)")
                    return await self._call_ollama(llm_messages, response_format, start_time)
                except Exception as e:
                    logger.error("Ollama fallback also failed", error=str(e))

        # Return simulated response if no LLM available
        return self._simulate_response(user_prompt or "", start_time, error="No LLM available")

    async def _call_ollama(
        self,
        messages: List[Dict[str, str]],
        response_format: str,
        start_time: datetime,
        max_tokens: int = 512  # Default to short responses for fast chat
    ) -> LLMResponse:
        """Call Ollama API with Qwen model."""

        # Detect if this is a recommendation request (needs longer output)
        # Check ALL messages (system + user) for recommendation keywords
        all_content = " ".join([m.get("content", "") for m in messages]).lower()
        is_recommendation_request = "recommendation" in all_content and ("generate" in all_content or "20" in all_content)
        is_evaluation_request = "evaluate" in all_content and "proof point" in all_content

        # Use higher token limit for recommendation generation or proof point evaluation
        if is_recommendation_request:
            num_predict = 8192  # Increased for 20 recommendations
        elif is_evaluation_request:
            num_predict = 4096
        else:
            num_predict = max_tokens

        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,  # Lower temperature for more focused responses
                "num_predict": num_predict,  # Short responses for chat, longer for recommendations
                "num_ctx": 4096,  # Reduced context window for faster processing
            }
        }

        # Request JSON format if needed
        if response_format == "json":
            payload["format"] = "json"

        # Use shorter timeout for chat (30s), longer for recommendations (120s)
        timeout = 120.0 if is_recommendation_request else 30.0

        response = await self.http_client.post(
            f"{self.ollama_base_url}/api/chat",
            json=payload,
            timeout=timeout
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
        """Call OpenAI API using the configured model (default: gpt-4o)."""

        # Use configured model from settings (default: gpt-4o)
        model = settings.openai_model

        response = await self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7 if complexity == TaskComplexity.HIGH else 0.5,
            max_tokens=4000 if complexity == TaskComplexity.HIGH else 2000,
            response_format={"type": "json_object"} if response_format == "json" else None
        )

        content = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        latency = (datetime.now() - start_time).total_seconds() * 1000

        logger.info(
            "OpenAI call completed",
            model=model,
            tokens=tokens,
            latency_ms=latency
        )

        return LLMResponse(
            content=content,
            model_used=model,
            tokens_used=tokens,
            latency_ms=latency,
            metadata={"provider": "openai", "complexity": complexity.value}
        )

    async def _call_together(
        self,
        messages: List[Dict[str, str]],
        complexity: TaskComplexity,
        response_format: str,
        start_time: datetime
    ) -> LLMResponse:
        """Call Together.ai API (OpenAI-compatible, hosts open source models)."""

        model = self.together_model

        # Together.ai uses OpenAI-compatible API
        response = await self.together_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7 if complexity == TaskComplexity.HIGH else 0.5,
            max_tokens=4000 if complexity == TaskComplexity.HIGH else 2000,
        )

        content = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        latency = (datetime.now() - start_time).total_seconds() * 1000

        logger.info(
            "Together.ai call completed",
            model=model,
            tokens=tokens,
            latency_ms=latency
        )

        return LLMResponse(
            content=content,
            model_used=model,
            tokens_used=tokens,
            latency_ms=latency,
            metadata={"provider": "together", "complexity": complexity.value}
        )

    async def _call_groq(
        self,
        messages: List[Dict[str, str]],
        complexity: TaskComplexity,
        response_format: str,
        start_time: datetime
    ) -> LLMResponse:
        """Call Groq API (OpenAI-compatible, ultra-fast inference)."""

        model = self.groq_model

        # Groq uses OpenAI-compatible API
        response = await self.groq_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7 if complexity == TaskComplexity.HIGH else 0.5,
            max_tokens=4000 if complexity == TaskComplexity.HIGH else 2000,
            response_format={"type": "json_object"} if response_format == "json" else None
        )

        content = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        latency = (datetime.now() - start_time).total_seconds() * 1000

        logger.info(
            "Groq call completed",
            model=model,
            tokens=tokens,
            latency_ms=latency
        )

        return LLMResponse(
            content=content,
            model_used=model,
            tokens_used=tokens,
            latency_ms=latency,
            metadata={"provider": "groq", "complexity": complexity.value}
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
                "summary": "Demo mode - Check LLM provider configuration",
                "contract_id": "DEMO-001",
                "parties": {"buyer": "Demo Corp", "supplier": "Sample Vendor"},
                "dates": {"effective_date": "2024-01-01", "expiry_date": "2025-12-31"},
                "financials": {"total_value": 100000, "currency": "USD", "payment_terms": "Net 30"},
                "risks": [{"risk": "Demo mode active", "severity": "low", "mitigation": "Configure Groq API key"}],
                "opportunities": [{"opportunity": "Enable AI extraction", "estimated_impact": "Full contract analysis"}]
            })
        elif "playbook" in prompt.lower():
            content = json.dumps({
                "summary": "Demo mode - Check LLM provider configuration",
                "category_info": {"category_name": "Demo Category", "annual_spend": 1000000},
                "strategy": {"sourcing_strategy": "Consolidate", "recommended_approach": "Configure Groq for full analysis"},
                "savings_opportunities": [{"opportunity_type": "AI-powered analysis", "estimated_savings_percent": 10}],
                "recommendations": [{"recommendation": "Check Groq API key", "priority": "high"}]
            })
        elif "json" in prompt.lower() or "{" in prompt:
            content = json.dumps({
                "summary": "Simulated response - No LLM configured",
                "key_findings": [{"finding": "Demo mode", "significance": "Configure Groq/OpenAI for real analysis"}],
                "recommendations": [{"recommendation": "Check LLM_PROVIDER and API keys in .env", "priority": "high"}]
            })
        else:
            content = "I'm running in demo mode. Please configure Groq or OpenAI API key for full AI capabilities!"

        return LLMResponse(
            content=content,
            model_used="simulated",
            tokens_used=0,
            latency_ms=latency,
            metadata={"simulated": True, "error": error}
        )

    async def evaluate_proof_points(
        self,
        opportunity_type: str,
        category_name: str,
        proof_points_data: List[Dict[str, Any]],
        spend_data: Dict[str, Any],
        supplier_data: List[Dict[str, Any]],
        metrics: Dict[str, Any]
    ) -> LLMResponse:
        """
        Evaluate proof points using LLM to determine impact level (Low/Medium/High).

        Uses Mistral or Llama for fast, accurate evaluation instead of hardcoded thresholds.
        Returns L/M/H for each proof point which is then used for weighted confidence calculation.

        Confidence Formula: (0.25 × L_count) + (0.625 × M_count) + (0.875 × H_count)

        Args:
            opportunity_type: Type of opportunity (volume-bundling, target-pricing, etc.)
            category_name: Category name (e.g., "Edible Oils")
            proof_points_data: List of proof points with their raw data values
            spend_data: Spend breakdown data
            supplier_data: List of suppliers with spend amounts
            metrics: Computed metrics (price variance, concentration, etc.)

        Returns:
            LLMResponse with JSON containing impact ratings for each proof point
        """
        # Define proof points by opportunity type with FULL H/M/L threshold ranges
        # These thresholds are from the methodology document
        proof_point_definitions = {
            "volume-bundling": [
                {
                    "id": "PP_REGIONAL_SPEND",
                    "name": "Regional Spend Addressability",
                    "calculation": "top_3_pct = (top 3 regions spend / total) × 100",
                    "thresholds": {"HIGH": "≥80%", "MEDIUM": "50-80%", "LOW": "<50%"}
                },
                {
                    "id": "PP_TAIL_SPEND",
                    "name": "Tail Spend Consolidation",
                    "calculation": "Cumsum until 80%, then tail_pct = remaining spend %",
                    "thresholds": {"HIGH": "≥30%", "MEDIUM": "15-30%", "LOW": "<15%"}
                },
                {
                    "id": "PP_VOLUME_LEVERAGE",
                    "name": "Volume Leverage",
                    "calculation": "supplier_count + top_supplier_pct = (top supplier / total) × 100",
                    "thresholds": {"HIGH": ">10 suppliers & top <20%", "MEDIUM": "5-10 suppliers & top 20-40%", "LOW": "<5 suppliers"}
                },
                {
                    "id": "PP_PRICE_VARIANCE",
                    "name": "Price Variance",
                    "calculation": "variance_pct = (std_price / mean_price) × 100 (CV)",
                    "thresholds": {"HIGH": "≥25%", "MEDIUM": "10-25%", "LOW": "<10%"}
                },
                {
                    "id": "PP_AVG_SPEND_SUPPLIER",
                    "name": "Avg Spend per Supplier",
                    "calculation": "avg_spend = total_spend / supplier_count",
                    "thresholds": {"HIGH": "<$100K", "MEDIUM": "$100K-$500K", "LOW": ">$500K"}
                },
                {
                    "id": "PP_MARKET_CONSOLIDATION",
                    "name": "Market Consolidation (HHI)",
                    "calculation": "HHI = Σ(market_share_i²) where share is %",
                    "thresholds": {"HIGH": "<1500 (fragmented)", "MEDIUM": "1500-2500", "LOW": ">2500 (concentrated)"}
                },
                {
                    "id": "PP_SUPPLIER_LOCATION",
                    "name": "Supplier Location",
                    "calculation": "top_region_pct = (suppliers in top region / total suppliers) × 100",
                    "thresholds": {"HIGH": "≥70%", "MEDIUM": "50-70%", "LOW": "<50%"}
                },
                {
                    "id": "PP_SUPPLIER_RISK_RATING",
                    "name": "Supplier Risk Rating",
                    "calculation": "top_5_pct + supplier_count (proxy for risk)",
                    "thresholds": {"HIGH": ">10 suppliers & top5 <70%", "MEDIUM": ">5 suppliers", "LOW": "≤5 suppliers"}
                }
            ],
            "target-pricing": [
                {
                    "id": "PP_PRICE_VARIANCE",
                    "name": "Price Variance",
                    "calculation": "variance_pct = (std_price / mean_price) × 100 (CV)",
                    "thresholds": {"HIGH": "≥25%", "MEDIUM": "10-25%", "LOW": "<10%"}
                },
                {
                    "id": "PP_TARIFF_RATE",
                    "name": "Tariff Rate Differential",
                    "calculation": "max_tariff - min_tariff across suppliers",
                    "thresholds": {"HIGH": ">15% differential", "MEDIUM": "5-15%", "LOW": "<5%"}
                },
                {
                    "id": "PP_COST_STRUCTURE",
                    "name": "Cost Structure",
                    "calculation": "raw_material_pct = raw_material_cost / total_cost × 100",
                    "thresholds": {"HIGH": ">60% raw material", "MEDIUM": "40-60%", "LOW": "<40%"}
                },
                {
                    "id": "PP_UNIT_PRICE",
                    "name": "Unit Price vs Benchmark",
                    "calculation": "(avg_price - benchmark_price) / benchmark_price × 100",
                    "thresholds": {"HIGH": ">15% above benchmark", "MEDIUM": "5-15% above", "LOW": "<5% above or below"}
                }
            ],
            "risk-management": [
                {
                    "id": "PP_SINGLE_SOURCING",
                    "name": "Single Sourcing Risk",
                    "calculation": "top_supplier_pct = top supplier spend / total × 100",
                    "thresholds": {"HIGH": ">50% from one supplier", "MEDIUM": "30-50%", "LOW": "<30%"}
                },
                {
                    "id": "PP_SUPPLIER_CONCENTRATION",
                    "name": "Supplier Concentration",
                    "calculation": "top3_pct = (top 3 suppliers spend / total) × 100",
                    "thresholds": {"HIGH": ">80%", "MEDIUM": "60-80%", "LOW": "<60%"}
                },
                {
                    "id": "PP_CATEGORY_RISK",
                    "name": "Category Risk Level",
                    "calculation": "Based on category classification (commodities, volatility)",
                    "thresholds": {"HIGH": "High-risk category (commodities)", "MEDIUM": "Moderate risk", "LOW": "Low-risk category"}
                },
                {
                    "id": "PP_INFLATION",
                    "name": "Inflation Impact",
                    "calculation": "Category-specific inflation rate",
                    "thresholds": {"HIGH": ">8% inflation", "MEDIUM": "4-8%", "LOW": "<4%"}
                },
                {
                    "id": "PP_EXCHANGE_RATE",
                    "name": "Exchange Rate Risk",
                    "calculation": "volatile_currency_pct = spend from volatile regions / total × 100",
                    "thresholds": {"HIGH": ">50% volatile currency", "MEDIUM": "25-50%", "LOW": "<25%"}
                },
                {
                    "id": "PP_GEO_POLITICAL",
                    "name": "Geopolitical Risk",
                    "calculation": "high_risk_region_pct = spend from high-risk regions / total × 100",
                    "thresholds": {"HIGH": ">40% high-risk regions", "MEDIUM": "20-40%", "LOW": "<20%"}
                },
                {
                    "id": "PP_SUPPLIER_RISK_RATING",
                    "name": "Supplier Risk Rating",
                    "calculation": "Based on supplier financial health scores",
                    "thresholds": {"HIGH": "Key suppliers are high risk", "MEDIUM": "Mixed risk profile", "LOW": "Key suppliers are low risk"}
                }
            ],
            "respec-pack": [
                {
                    "id": "PP_PRICE_VARIANCE",
                    "name": "Spec-Driven Price Variance",
                    "calculation": "variance_pct = (std_price / mean_price) × 100 (CV)",
                    "thresholds": {"HIGH": "≥25%", "MEDIUM": "10-25%", "LOW": "<10%"}
                },
                {
                    "id": "PP_EXPORT_DATA",
                    "name": "Export Standard Gap",
                    "calculation": "(domestic_spec_price - export_spec_price) / export_spec_price × 100",
                    "thresholds": {"HIGH": ">20% premium vs export", "MEDIUM": "10-20%", "LOW": "<10%"}
                },
                {
                    "id": "PP_COST_STRUCTURE",
                    "name": "Material Cost Ratio",
                    "calculation": "raw_material_pct = raw_material_cost / total_cost × 100",
                    "thresholds": {"HIGH": ">60% raw material", "MEDIUM": "40-60%", "LOW": "<40%"}
                }
            ]
        }

        pp_definitions = proof_point_definitions.get(opportunity_type, proof_point_definitions["volume-bundling"])

        # Build context for LLM
        context = {
            "category": category_name,
            "total_spend": spend_data.get("totalSpend", 0),
            "supplier_count": len(supplier_data) if supplier_data else 0,
            "top_suppliers": [{"name": s.get("name"), "spend": s.get("spend", 0), "share": s.get("share", 0)} for s in (supplier_data[:5] if supplier_data else [])],
            "metrics": {
                "price_variance": metrics.get("priceVariance", 0),
                "top3_concentration": metrics.get("top3Concentration", 0),
                "hhi_index": metrics.get("hhiIndex", 0),
                "tail_spend_pct": metrics.get("tailSpendPercentage", 0),
                "supplier_count": metrics.get("supplierCount", 0)
            }
        }

        system_prompt = """You are an expert procurement analyst evaluating proof points for savings opportunities.

Your task is to analyze the provided data and rate each proof point's IMPACT LEVEL using the EXACT THRESHOLD RANGES provided.

CRITICAL: Use the threshold ranges provided for each proof point. DO NOT use your own thresholds.
Each proof point includes:
- "calculation": How to compute the metric from the data
- "thresholds": Exact ranges for HIGH, MEDIUM, LOW ratings

RATING SCALE:
- "H" (High): Value falls in the HIGH threshold range
- "M" (Medium): Value falls in the MEDIUM threshold range
- "L" (Low): Value falls in the LOW threshold range

For each proof point:
1. Calculate or extract the metric value from the provided data
2. Compare against the threshold ranges provided
3. Assign H/M/L based on which range the value falls into

Return ONLY valid JSON in this exact format:
{
  "evaluations": [
    {"id": "PP_XXX", "impact": "H/M/L", "reasoning": "Value is X which falls in [HIGH/MEDIUM/LOW] range", "data_point": "X%"},
    ...
  ],
  "summary": {
    "high_count": 0,
    "medium_count": 0,
    "low_count": 0,
    "confidence_score": 0.0,
    "overall_assessment": "Brief overall assessment"
  }
}"""

        user_prompt = f"""Evaluate these proof points for a {opportunity_type.replace('-', ' ').title()} opportunity in {category_name}:

CONTEXT DATA (use these values for calculations):
{json.dumps(context, indent=2, default=str)}

PROOF POINTS WITH THRESHOLD RANGES (use these exact thresholds):
{json.dumps(pp_definitions, indent=2)}

ADDITIONAL METRICS FROM UPLOADED DATA:
{json.dumps(proof_points_data, indent=2, default=str) if proof_points_data else "No additional data provided"}

INSTRUCTIONS:
1. For each proof point, calculate the metric using the provided data
2. Compare the calculated value against the "thresholds" provided
3. Rate as H if value is in HIGH range, M if in MEDIUM range, L if in LOW range
4. Show the actual value in your reasoning

Confidence Score Formula: ((0.25 × L_count) + (0.625 × M_count) + (0.875 × H_count)) / (total × 0.875) × 100

Return your evaluation as JSON."""

        # Use configured LLM provider (Groq/OpenAI/Ollama) for evaluation
        return await self._call_llm_with_model(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=self.ollama_model,  # Local fallback model if Groq/OpenAI unavailable
            response_format="json"
        )

    async def _call_llm_with_model(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str = "mistral:7b",
        response_format: str = "json"
    ) -> LLMResponse:
        """
        Call LLM for proof point evaluation.
        Uses configured provider (Groq/OpenAI) first, falls back to Ollama.
        """
        start_time = datetime.now()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # Try Groq first if configured (ultra-fast, free tier)
        if self.llm_provider == "groq" and self.groq_client:
            try:
                logger.info("Using Groq for proof point evaluation")
                response = await self.groq_client.chat.completions.create(
                    model=self.groq_model,
                    messages=messages,
                    temperature=0,  # Zero temperature for deterministic results
                    max_tokens=2000,
                    response_format={"type": "json_object"} if response_format == "json" else None
                )

                content = response.choices[0].message.content
                latency = (datetime.now() - start_time).total_seconds() * 1000

                return LLMResponse(
                    content=content,
                    model_used=self.groq_model,
                    tokens_used=response.usage.total_tokens if response.usage else 0,
                    latency_ms=latency,
                    metadata={"provider": "groq"}
                )
            except Exception as e:
                logger.warning(f"Groq call failed for proof point evaluation", error=str(e))

        # Try Ollama with specified model if local is enabled
        ollama_available = self.use_local and await self.check_ollama_health()
        if ollama_available:
            try:
                # Check if specified model is available, fallback to default
                model_available = await self.ensure_model_available(model)
                if not model_available:
                    # Try llama as fallback
                    model_available = await self.ensure_model_available("llama3.2:3b")
                    if model_available:
                        model = "llama3.2:3b"
                    else:
                        # Use default qwen
                        model = self.ollama_model

                logger.info(f"Using Ollama model {model} for proof point evaluation")

                payload = {
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0,  # Zero temperature for deterministic, consistent results
                        "num_predict": 2048,
                        "num_ctx": 4096,
                    }
                }

                if response_format == "json":
                    payload["format"] = "json"

                response = await self.http_client.post(
                    f"{self.ollama_base_url}/api/chat",
                    json=payload,
                    timeout=60.0
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data.get("message", {}).get("content", "")

                    latency = (datetime.now() - start_time).total_seconds() * 1000

                    return LLMResponse(
                        content=content,
                        model_used=model,
                        tokens_used=data.get("eval_count", 0) + data.get("prompt_eval_count", 0),
                        latency_ms=latency,
                        metadata={"provider": "ollama", "model": model}
                    )
            except Exception as e:
                logger.warning(f"Ollama call failed for {model}", error=str(e))

        # Fallback to OpenAI
        if self.openai_client:
            try:
                logger.info("Falling back to OpenAI for proof point evaluation")
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",  # Use mini for faster, cheaper evaluation
                    messages=messages,
                    temperature=0,  # Zero temperature for deterministic, consistent results
                    max_tokens=2000,
                    response_format={"type": "json_object"} if response_format == "json" else None
                )

                content = response.choices[0].message.content
                latency = (datetime.now() - start_time).total_seconds() * 1000

                return LLMResponse(
                    content=content,
                    model_used="gpt-4o-mini",
                    tokens_used=response.usage.total_tokens if response.usage else 0,
                    latency_ms=latency,
                    metadata={"provider": "openai", "fallback": True}
                )
            except Exception as e:
                logger.error("OpenAI fallback also failed", error=str(e))

        # Return simulated response if no LLM available
        return self._simulate_proof_point_response(start_time)

    def _simulate_proof_point_response(self, start_time: datetime) -> LLMResponse:
        """Generate simulated proof point evaluation for demo mode."""
        latency = (datetime.now() - start_time).total_seconds() * 1000

        simulated = {
            "evaluations": [
                {"id": "PP_SIMULATED_1", "impact": "M", "reasoning": "Demo mode - check Groq API key configuration", "data_point": "N/A"},
                {"id": "PP_SIMULATED_2", "impact": "M", "reasoning": "Demo mode - LLM provider unavailable", "data_point": "N/A"}
            ],
            "summary": {
                "high_count": 0,
                "medium_count": 2,
                "low_count": 0,
                "confidence_score": 71.4,
                "overall_assessment": "Demo mode - Check LLM provider configuration (Groq/OpenAI)"
            }
        }

        return LLMResponse(
            content=json.dumps(simulated),
            model_used="simulated",
            tokens_used=0,
            latency_ms=latency,
            metadata={"simulated": True}
        )

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()
