"""
Supplier Intelligence Service - OpenAI + Serper Powered

Real-time supplier risk rating using:
1. Serper API for real-time web search (recent news, financial updates, ESG issues)
2. OpenAI GPT-4o-mini for intelligent analysis

This service is used ONLY for PP8 (Supplier Risk Rating) proof point.
All other proof points use formula-based thresholds.

Architecture:
- Step 1: Serper search for recent news about the supplier
- Step 2: OpenAI analysis with news context for accurate assessment
- Returns structured JSON with 6-parameter risk assessment
"""

import json
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
import structlog
from openai import AsyncOpenAI

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class SupplierIntelligenceService:
    """
    Real-time supplier risk assessment using Serper + OpenAI.

    This service uses OpenAI ONLY (not Groq) because:
    - PP8 (Supplier Risk Rating) requires high-quality, nuanced analysis
    - OpenAI GPT-4o-mini provides better reasoning for complex supplier evaluation
    - This is the "super intelligence" layer for critical procurement decisions

    Flow:
    1. Search Serper for recent news about the supplier
    2. Send news context + supplier info to OpenAI
    3. Return structured risk rating with 6 parameters
    """

    def __init__(self):
        # OpenAI client ONLY - this is the "super intelligence" for supplier analysis
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = getattr(settings, 'supplier_intel_model', 'gpt-4o-mini')
        self.serper_api_key = getattr(settings, 'serper_api_key', '')
        self.serper_enabled = bool(self.serper_api_key)

        logger.info(
            "SupplierIntelligence initialized (OpenAI only)",
            model=self.model,
            serper_enabled=self.serper_enabled
        )

    async def _search_supplier_news(self, supplier_name: str, category: str = "") -> Dict[str, Any]:
        """
        Search for recent news about a supplier using Serper API.

        Returns recent news, financial updates, ESG issues, legal matters.
        """
        if not self.serper_enabled:
            return {"news": [], "source": "disabled"}

        try:
            # Build search query focused on procurement-relevant news
            search_query = f"{supplier_name} company news financial ESG sustainability"
            if category:
                search_query += f" {category}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": self.serper_api_key,
                        "Content-Type": "application/json"
                    },
                    json={
                        "q": search_query,
                        "num": 5,  # Get top 5 results
                        "tbs": "qdr:m"  # Last month's news
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    organic = data.get("organic", [])
                    news = data.get("news", [])

                    # Combine and format results
                    results = []
                    for item in (news + organic)[:5]:
                        results.append({
                            "title": item.get("title", ""),
                            "snippet": item.get("snippet", ""),
                            "date": item.get("date", ""),
                            "source": item.get("source", item.get("link", ""))
                        })

                    logger.info(f"[Serper] Found {len(results)} news items for {supplier_name}")
                    return {"news": results, "source": "serper", "query": search_query}

                else:
                    logger.warning(f"[Serper] API returned {response.status_code} for {supplier_name}")
                    return {"news": [], "source": "error", "error": f"Status {response.status_code}"}

        except Exception as e:
            logger.error(f"[Serper] Search failed for {supplier_name}: {str(e)}")
            return {"news": [], "source": "error", "error": str(e)}

    async def evaluate_supplier(
        self,
        supplier_name: str,
        category: str = "",
        country: str = ""
    ) -> Dict[str, Any]:
        """
        Evaluate a single supplier's risk profile using Serper + OpenAI.

        Args:
            supplier_name: Name of the supplier company
            category: Product category (e.g., "Edible Oil", "Steel")
            country: Country of operation

        Returns:
            Structured risk assessment with 6 parameters
        """
        logger.info(f"[SupplierIntel] Evaluating: {supplier_name} | Category: {category} | Country: {country}")

        # Step 1: Search for recent news about this supplier
        news_data = await self._search_supplier_news(supplier_name, category)
        news_context = self._format_news_context(news_data)

        # Step 2: Build the prompt with news context
        prompt = self._build_evaluation_prompt(supplier_name, category, country, news_context)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert procurement risk analyst with deep knowledge of global supply chains,
company financials, and supplier evaluation. You have access to extensive knowledge about major companies worldwide.

Your task is to evaluate suppliers for procurement decisions, specifically for volume bundling strategies.

IMPORTANT: You will receive REAL-TIME NEWS from web search. Use this news to:
- Identify recent financial issues, earnings reports, or credit rating changes
- Detect ESG concerns, sustainability issues, or regulatory problems
- Spot supply chain disruptions, factory closures, or capacity issues
- Find legal matters, lawsuits, or compliance violations
- Assess recent market position changes or M&A activity

Combine the news intelligence with your general knowledge to provide accurate, up-to-date assessments.
If news reveals concerning issues, adjust scores accordingly.
If news is positive, reflect that in your assessment.

Always respond with valid JSON only."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0,  # Deterministic for consistent ratings
                max_tokens=1500,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            result = json.loads(content)

            # Add metadata
            result["analysis_timestamp"] = datetime.now().isoformat()
            result["model_used"] = self.model
            result["tokens_used"] = response.usage.total_tokens if response.usage else 0
            result["news_source"] = news_data.get("source", "none")
            result["news_count"] = len(news_data.get("news", []))

            logger.info(f"[SupplierIntel] Result for {supplier_name}: {result.get('overall_rating', 'N/A')} ({result.get('overall_score', 0)}) [News: {result['news_count']}]")

            return result

        except Exception as e:
            logger.error(f"[SupplierIntel] Error evaluating {supplier_name}: {str(e)}")
            return self._get_fallback_analysis(supplier_name, str(e))

    def _format_news_context(self, news_data: Dict[str, Any]) -> str:
        """Format news search results into context for the prompt."""
        news_items = news_data.get("news", [])

        if not news_items:
            return "No recent news found. Use your general knowledge about this company."

        news_text = "=== RECENT NEWS & MARKET INTELLIGENCE ===\n"
        news_text += "(From real-time web search - use this to inform your assessment)\n\n"

        for i, item in enumerate(news_items, 1):
            title = item.get("title", "No title")
            snippet = item.get("snippet", "")
            date = item.get("date", "")
            source = item.get("source", "")

            news_text += f"{i}. {title}\n"
            if date:
                news_text += f"   Date: {date}\n"
            if snippet:
                news_text += f"   Summary: {snippet}\n"
            news_text += "\n"

        news_text += "Consider this recent news when evaluating financial health, compliance issues, ESG concerns, and market position.\n"
        return news_text

    def _build_evaluation_prompt(self, supplier_name: str, category: str, country: str, news_context: str = "") -> str:
        """Build the explicit evaluation prompt with news context."""

        return f"""SUPPLIER RISK ASSESSMENT REQUEST

=== SUPPLIER DETAILS ===
Company Name: {supplier_name}
Product Category: {category or "General/Not Specified"}
Operating Country: {country or "Not Specified"}

{news_context}

=== YOUR TASK ===
Analyze this supplier for procurement risk assessment. This evaluation will be used to determine:
1. Whether to use this supplier as an ANCHOR (primary, 50-60% allocation)
2. Whether to use as a CHALLENGER (secondary, 25-35% allocation)
3. Whether to limit to TAIL spend only (tactical, 10-20% allocation)

=== EVALUATE THESE 6 PARAMETERS ===

1. FINANCIAL_STRENGTH (Weight: 25%)
   - Revenue stability and growth
   - Profitability and margins
   - Debt levels and liquidity
   - Listed vs Private company status
   - Credit rating if available
   Scoring: 80-100 = Strong/Low Risk, 50-79 = Moderate, 0-49 = Weak/High Risk

2. SUPPLY_RELIABILITY (Weight: 25%)
   - Production capacity and utilization
   - Track record of on-time delivery
   - Quality consistency
   - Manufacturing capabilities
   - Inventory management
   Scoring: 80-100 = Highly Reliable, 50-79 = Moderate, 0-49 = Unreliable

3. COMPLIANCE_GOVERNANCE (Weight: 15%)
   - Regulatory compliance history
   - Corporate governance standards
   - Audit transparency
   - Certifications (ISO, etc.)
   - ESG practices
   Scoring: 80-100 = Excellent, 50-79 = Acceptable, 0-49 = Concerning

4. PRICING_COMPETITIVENESS (Weight: 20%)
   - Market pricing position
   - Pricing stability vs volatility
   - Cost efficiency
   - Value for money
   - Negotiation flexibility
   Scoring: 80-100 = Very Competitive, 50-79 = Market Average, 0-49 = Premium/Volatile

5. VOLUME_SCALABILITY (Weight: 10%)
   - Ability to scale up production
   - Capacity flexibility
   - Lead time responsiveness
   - Surge capability
   Scoring: 80-100 = Highly Scalable, 50-79 = Moderate, 0-49 = Limited

6. GEOGRAPHIC_DIVERSIFICATION (Weight: 5%)
   - Multiple manufacturing locations
   - Supply chain spread
   - Regional risk exposure
   - Logistics network
   Scoring: 80-100 = Well Diversified, 50-79 = Moderate, 0-49 = Concentrated

=== OVERALL RATING CALCULATION ===
Calculate weighted overall score:
Overall = (Financial×0.25) + (Supply×0.25) + (Compliance×0.15) + (Pricing×0.20) + (Scalability×0.10) + (Geographic×0.05)

Then classify:
- GOOD (Low Risk): Score >= 70
- MEDIUM: Score 50-69
- HIGH_RISK: Score < 50

=== PROCUREMENT ROLE ASSIGNMENT ===
Based on overall rating:
- GOOD → ANCHOR candidate (50-60% spend allocation safe)
- MEDIUM → CHALLENGER candidate (25-35% allocation recommended)
- HIGH_RISK → TAIL only (max 10-20%, tactical use)

=== RESPONSE FORMAT ===
Respond with this exact JSON structure:
{{
  "supplier": "{supplier_name}",
  "category": "{category or 'General'}",
  "country": "{country or 'Unknown'}",
  "parameters": {{
    "financial_strength": {{
      "score": <0-100>,
      "rating": "<HIGH/MEDIUM/LOW>",
      "reason": "<one sentence explanation>"
    }},
    "supply_reliability": {{
      "score": <0-100>,
      "rating": "<HIGH/MEDIUM/LOW>",
      "reason": "<one sentence explanation>"
    }},
    "compliance_governance": {{
      "score": <0-100>,
      "rating": "<HIGH/MEDIUM/LOW>",
      "reason": "<one sentence explanation>"
    }},
    "pricing_competitiveness": {{
      "score": <0-100>,
      "rating": "<HIGH/MEDIUM/LOW>",
      "reason": "<one sentence explanation>"
    }},
    "volume_scalability": {{
      "score": <0-100>,
      "rating": "<HIGH/MEDIUM/LOW>",
      "reason": "<one sentence explanation>"
    }},
    "geographic_diversification": {{
      "score": <0-100>,
      "rating": "<HIGH/MEDIUM/LOW>",
      "reason": "<one sentence explanation>"
    }}
  }},
  "overall_score": <weighted average 0-100>,
  "overall_rating": "<GOOD/MEDIUM/HIGH_RISK>",
  "procurement_role": "<ANCHOR/CHALLENGER/TAIL>",
  "max_allocation": "<recommended max % allocation>",
  "key_risks": ["<risk 1>", "<risk 2>", "<risk 3 if applicable>"],
  "key_strengths": ["<strength 1>", "<strength 2>"],
  "recommendation": "<2-3 sentence procurement recommendation>",
  "confidence": "<HIGH/MEDIUM/LOW based on your knowledge of this company>"
}}

Now analyze {supplier_name} and provide the JSON response:"""

    def _get_fallback_analysis(self, supplier_name: str, error: str = "") -> Dict[str, Any]:
        """Fallback analysis when OpenAI call fails."""
        return {
            "supplier": supplier_name,
            "category": "Unknown",
            "country": "Unknown",
            "parameters": {
                "financial_strength": {"score": 50, "rating": "MEDIUM", "reason": "Unable to assess - API error"},
                "supply_reliability": {"score": 50, "rating": "MEDIUM", "reason": "Unable to assess - API error"},
                "compliance_governance": {"score": 50, "rating": "MEDIUM", "reason": "Unable to assess - API error"},
                "pricing_competitiveness": {"score": 50, "rating": "MEDIUM", "reason": "Unable to assess - API error"},
                "volume_scalability": {"score": 50, "rating": "MEDIUM", "reason": "Unable to assess - API error"},
                "geographic_diversification": {"score": 50, "rating": "MEDIUM", "reason": "Unable to assess - API error"}
            },
            "overall_score": 50,
            "overall_rating": "MEDIUM",
            "procurement_role": "CHALLENGER",
            "max_allocation": "30%",
            "key_risks": ["Assessment failed", "Manual review required"],
            "key_strengths": ["Unknown"],
            "recommendation": f"Unable to complete automated assessment for {supplier_name}. Manual due diligence recommended.",
            "confidence": "LOW",
            "error": error,
            "analysis_timestamp": datetime.now().isoformat(),
            "model_used": "fallback"
        }

    async def evaluate_multiple_suppliers(
        self,
        suppliers: List[Dict[str, Any]],
        category: str = "",
        country: str = "",
        category_spend: float = 0
    ) -> Dict[str, Any]:
        """
        Evaluate multiple suppliers and calculate CATEGORY RISK using procurement-grade formula.

        Category Risk = f(Concentration × Weighted Supplier Risk × Market Volatility)

        NOT just the average of supplier risks!

        Args:
            suppliers: List of suppliers with name and spend
            category: Product category
            country: Default country
            category_spend: Authoritative category spend from context (overrides supplier sum)

        Returns:
            Aggregated PP8 assessment with Category Risk metrics
        """
        logger.info(f"[SupplierIntel] Evaluating {len(suppliers)} suppliers for PP8 - Category: {category}")

        evaluations = []
        good_count = 0
        medium_count = 0
        high_risk_count = 0

        # Use authoritative category_spend from context if provided
        # Otherwise fall back to summing from suppliers (for backward compatibility)
        supplier_sum = sum(s.get("spend", 0) for s in suppliers)
        total_spend = category_spend if category_spend > 0 else supplier_sum

        logger.info(f"[SupplierIntel] Using total_spend: ${total_spend:,.0f} (context: ${category_spend:,.0f}, supplier_sum: ${supplier_sum:,.0f})")

        # Evaluate top suppliers by spend (limit to top 10 for performance/cost)
        top_suppliers = sorted(suppliers, key=lambda x: x.get("spend", 0), reverse=True)[:10]

        for supplier in top_suppliers:
            supplier_name = supplier.get("name", "Unknown")
            supplier_country = supplier.get("country", country)
            supplier_spend = supplier.get("spend", 0)

            evaluation = await self.evaluate_supplier(supplier_name, category, supplier_country)

            # Add spend info to evaluation
            evaluation["spend"] = supplier_spend
            evaluation["spend_percentage"] = round((supplier_spend / total_spend * 100), 1) if total_spend > 0 else 0

            evaluations.append(evaluation)

            # Count by rating
            rating = evaluation.get("overall_rating", "MEDIUM")
            if rating == "GOOD":
                good_count += 1
            elif rating == "HIGH_RISK":
                high_risk_count += 1
            else:
                medium_count += 1

        # =============================================================================
        # PROCUREMENT-GRADE CATEGORY RISK CALCULATION
        # =============================================================================
        # Category Risk ≠ Average(Supplier Risks)
        # Category Risk = f(Concentration × Weighted Supplier Risk × Market Volatility)

        total_evaluated = len(evaluations)
        good_pct = (good_count / total_evaluated * 100) if total_evaluated > 0 else 0
        high_risk_pct = (high_risk_count / total_evaluated * 100) if total_evaluated > 0 else 0

        # Format spend for display
        def fmt_spend(amount: float) -> str:
            if amount >= 1_000_000:
                return f"${amount/1_000_000:.1f}M"
            elif amount >= 1_000:
                return f"${amount/1_000:.0f}K"
            else:
                return f"${amount:,.0f}"

        # ---------------------------------------------------------------------
        # STEP 1: Calculate HHI (Concentration Risk)
        # HHI = Σ(Supplier Share%)²
        # <1500 = Diversified (Low), 1500-2500 = Moderate, >2500 = Concentrated (High)
        # ---------------------------------------------------------------------
        hhi = 0
        supplier_shares = {}
        for eval_data in evaluations:
            spend = eval_data.get("spend", 0)
            share_pct = (spend / total_spend * 100) if total_spend > 0 else 0
            supplier_shares[eval_data["supplier"]] = share_pct
            hhi += share_pct ** 2

        if hhi < 1500:
            hhi_risk_level = "Low"
            hhi_risk_score = 1.0
            hhi_signal = "Diversified supply base"
        elif hhi < 2500:
            hhi_risk_level = "Medium"
            hhi_risk_score = 2.0
            hhi_signal = "Moderately concentrated"
        else:
            hhi_risk_level = "High"
            hhi_risk_score = 3.0
            hhi_signal = "Highly concentrated - structural risk"

        # ---------------------------------------------------------------------
        # STEP 2: Calculate Weighted Supplier Risk
        # Risk Score: GOOD=1, MEDIUM=2, HIGH_RISK=3
        # Weighted Risk = Σ(Supplier Share × Risk Score)
        # 1.0-1.5 = Low, 1.5-2.2 = Medium, >2.2 = High
        # ---------------------------------------------------------------------
        weighted_risk = 0
        for eval_data in evaluations:
            rating = eval_data.get("overall_rating", "MEDIUM")
            risk_score = 1 if rating == "GOOD" else (3 if rating == "HIGH_RISK" else 2)
            share = eval_data.get("spend", 0) / total_spend if total_spend > 0 else 0
            weighted_risk += share * risk_score

        if weighted_risk <= 1.5:
            weighted_risk_level = "Low"
            weighted_risk_signal = "Low-risk suppliers dominate spend"
        elif weighted_risk <= 2.2:
            weighted_risk_level = "Medium"
            weighted_risk_signal = "Mixed risk across spend"
        else:
            weighted_risk_level = "High"
            weighted_risk_signal = "High-risk suppliers dominate spend"

        # ---------------------------------------------------------------------
        # STEP 3: Market Volatility Buffer (Category-Specific)
        # Import-dependent categories get +0.3 buffer
        # ---------------------------------------------------------------------
        high_volatility_categories = [
            "edible oil", "palm oil", "soybean oil", "sunflower oil",
            "crude oil", "petroleum", "steel", "aluminum", "copper",
            "wheat", "corn", "rice", "coffee", "cocoa", "sugar"
        ]
        category_lower = category.lower() if category else ""
        market_buffer = 0.3 if any(cat in category_lower for cat in high_volatility_categories) else 0.0
        market_volatility = "High" if market_buffer > 0 else "Low"

        # ---------------------------------------------------------------------
        # STEP 4: Final Category Risk Score
        # Composite = (HHI Level + Weighted Risk + Market Buffer) / 3
        # Then determine final category risk
        # ---------------------------------------------------------------------
        # Convert levels to scores for final calc
        composite_score = (hhi_risk_score + weighted_risk + market_buffer)

        # Decision matrix for final category risk
        if hhi_risk_level == "High" or weighted_risk > 2.2:
            # Structural concentration OR high-risk suppliers dominate = HIGH RISK
            category_risk_level = "High"
            category_risk_score = 0.3  # Low PP8 impact for bundling
        elif hhi_risk_level == "Low" and weighted_risk <= 1.5:
            # Diversified AND low-risk suppliers = LOW RISK (good for bundling)
            category_risk_level = "Low"
            category_risk_score = 0.85  # High PP8 impact for bundling
        else:
            category_risk_level = "Medium"
            category_risk_score = 0.55

        # ---------------------------------------------------------------------
        # STEP 5: PP8 Impact (for Volume Bundling opportunity)
        # Higher Category Risk = Lower Bundling Opportunity
        # ---------------------------------------------------------------------
        if category_risk_level == "Low":
            pp8_impact = "High"  # Low risk = High opportunity to bundle
        elif category_risk_level == "High":
            pp8_impact = "Low"   # High risk = Low opportunity to bundle
        else:
            pp8_impact = "Medium"

        # Build detailed reasoning
        spend_text = f" ({fmt_spend(total_spend)} {category} spend)" if total_spend > 0 and category else ""

        pp8_reasoning = (
            f"Category Risk: {category_risk_level}{spend_text}. "
            f"HHI={hhi:.0f} ({hhi_risk_level} concentration), "
            f"Weighted Risk={weighted_risk:.2f} ({weighted_risk_level}), "
            f"Market Volatility={market_volatility}."
        )

        # Add executive insight
        top_supplier = max(supplier_shares.items(), key=lambda x: x[1]) if supplier_shares else ("Unknown", 0)
        if top_supplier[1] >= 50:
            pp8_reasoning += f" WARNING: {top_supplier[0]} has {top_supplier[1]:.0f}% share - structural concentration risk even if supplier is low-risk."

        # Build recommendations with concentration awareness
        anchor_candidates = [e["supplier"] for e in evaluations if e.get("overall_rating") == "GOOD"]
        challenger_candidates = [e["supplier"] for e in evaluations if e.get("overall_rating") == "MEDIUM"]
        tail_only = [e["supplier"] for e in evaluations if e.get("overall_rating") == "HIGH_RISK"]

        # Adjust max allocation based on concentration risk
        max_anchor_pct = 40 if hhi_risk_level == "High" else (50 if hhi_risk_level == "Medium" else 60)

        return {
            "proof_point": "PP8_SUPPLIER_RISK_RATING",
            "proof_point_name": "Supplier Risk Rating (Category-Level)",
            "impact": pp8_impact,
            "reasoning": pp8_reasoning,
            "category_risk": {
                "level": category_risk_level,
                "score": round(category_risk_score, 2),
                "components": {
                    "hhi": {
                        "value": round(hhi, 0),
                        "level": hhi_risk_level,
                        "signal": hhi_signal
                    },
                    "weighted_supplier_risk": {
                        "value": round(weighted_risk, 2),
                        "level": weighted_risk_level,
                        "signal": weighted_risk_signal
                    },
                    "market_volatility": {
                        "buffer": market_buffer,
                        "level": market_volatility,
                        "category_type": "commodity" if market_buffer > 0 else "stable"
                    }
                },
                "top_concentration": {
                    "supplier": top_supplier[0],
                    "share_pct": round(top_supplier[1], 1),
                    "warning": top_supplier[1] >= 50
                }
            },
            "summary": {
                "total_evaluated": total_evaluated,
                "good_count": good_count,
                "medium_count": medium_count,
                "high_risk_count": high_risk_count,
                "good_percentage": round(good_pct, 1),
                "high_risk_percentage": round(high_risk_pct, 1)
            },
            "recommendations": {
                "anchor_candidates": anchor_candidates,
                "challenger_candidates": challenger_candidates,
                "tail_only": tail_only,
                "max_anchor_allocation_pct": max_anchor_pct,
                "strategy": self._generate_bundling_strategy_v2(
                    evaluations, anchor_candidates, challenger_candidates, tail_only,
                    category, total_spend, hhi_risk_level, max_anchor_pct
                ),
                "category_spend": total_spend
            },
            "supplier_shares": supplier_shares,
            "supplier_evaluations": evaluations,
            "evaluated_at": datetime.now().isoformat(),
            "model_used": self.model
        }

    def _generate_bundling_strategy_v2(
        self,
        evaluations: List[Dict[str, Any]],
        anchors: List[str],
        challengers: List[str],
        tail: List[str],
        category: str = "",
        category_spend: float = 0,
        hhi_risk_level: str = "Medium",
        max_anchor_pct: int = 50
    ) -> str:
        """
        Generate volume bundling strategy that BALANCES leverage vs resilience.

        Higher concentration = Better negotiation leverage BUT higher disruption risk.
        Strategy must balance both.
        """
        category_text = f" for {category}" if category else ""

        # Format spend amounts
        def fmt_spend(amount: float) -> str:
            if amount >= 1_000_000:
                return f"${amount/1_000_000:.1f}M"
            elif amount >= 1_000:
                return f"${amount/1_000:.0f}K"
            else:
                return f"${amount:,.0f}"

        # Calculate allocation amounts based on concentration-adjusted max
        anchor_max = category_spend * (max_anchor_pct / 100)
        anchor_min = category_spend * ((max_anchor_pct - 10) / 100)
        challenger_alloc = category_spend * 0.30

        # Check if any single supplier already has >50% (structural risk)
        current_concentration_warning = ""
        for eval_data in evaluations:
            share = eval_data.get("spend_percentage", 0)
            if share >= 50:
                current_concentration_warning = f" RISK: {eval_data['supplier']} currently has {share:.0f}% - consider rebalancing."
                break

        spend_context = fmt_spend(category_spend) if category_spend > 0 else ""

        # Strategy based on HHI risk level
        if hhi_risk_level == "High":
            # Already concentrated - DO NOT increase concentration
            if len(anchors) >= 1:
                return (
                    f"Rebalancing strategy{category_text} ({spend_context}): "
                    f"Category is HIGHLY CONCENTRATED (HHI>2500). "
                    f"Cap {anchors[0]} at {max_anchor_pct}% max ({fmt_spend(anchor_max)}). "
                    f"Develop {challengers[0] if challengers else 'alternative supplier'} to 25-30% for resilience.{current_concentration_warning}"
                )
            else:
                return (
                    f"Diversification priority{category_text} ({spend_context}): "
                    f"High concentration risk with no clear anchor. "
                    f"Distribute across {challengers[0] if challengers else 'multiple suppliers'} and {challengers[1] if len(challengers) > 1 else 'others'} (30% each max).{current_concentration_warning}"
                )

        elif hhi_risk_level == "Low":
            # Diversified - CAN consolidate for leverage
            if len(anchors) >= 2:
                return (
                    f"Dual-anchor strategy{category_text} ({spend_context}): "
                    f"Low concentration allows consolidation. "
                    f"Allocate {fmt_spend(anchor_min)}-{fmt_spend(anchor_max)} ({max_anchor_pct-10}-{max_anchor_pct}%) "
                    f"combined to {anchors[0]} and {anchors[1]}, "
                    f"with {challengers[0] if challengers else 'other suppliers'} as challenger for competitive tension."
                )
            elif len(anchors) == 1:
                return (
                    f"Single-anchor strategy{category_text} ({spend_context}): "
                    f"Consolidate {fmt_spend(anchor_min)}-{fmt_spend(anchor_max)} ({max_anchor_pct-10}-{max_anchor_pct}%) "
                    f"with {anchors[0]} as primary, backed by {challengers[0] if challengers else 'challenger'} ({fmt_spend(challenger_alloc)}) for negotiation leverage."
                )
            else:
                return (
                    f"Challenger-based strategy{category_text} ({spend_context}): "
                    f"No anchor-grade supplier. Distribute 30-35% each across {challengers[0] if challengers else 'top supplier'} "
                    f"and {challengers[1] if len(challengers) > 1 else 'second supplier'}. Monitor for anchor development."
                )

        else:
            # Medium concentration - balance leverage and risk
            if len(anchors) >= 1:
                return (
                    f"Balanced strategy{category_text} ({spend_context}): "
                    f"Moderate concentration allows selective bundling. "
                    f"Allocate {fmt_spend(anchor_min)}-{fmt_spend(anchor_max)} ({max_anchor_pct-10}-{max_anchor_pct}%) to {anchors[0]}, "
                    f"maintain {challengers[0] if challengers else 'backup supplier'} at 25-30% for supply security.{current_concentration_warning}"
                )
            else:
                return (
                    f"Cautious bundling{category_text} ({spend_context}): "
                    f"No anchor supplier available. Keep top 3 suppliers at 25-35% each "
                    f"until supplier development improves ratings."
                )

    def _generate_bundling_strategy(
        self,
        anchors: List[str],
        challengers: List[str],
        tail: List[str],
        category: str = "",
        category_spend: float = 0
    ) -> str:
        """Legacy method - kept for backwards compatibility."""
        return self._generate_bundling_strategy_v2(
            [], anchors, challengers, tail, category, category_spend, "Medium", 50
        )


# Singleton instance
_supplier_intel_service: Optional[SupplierIntelligenceService] = None


def get_supplier_intelligence_service() -> SupplierIntelligenceService:
    """Get or create singleton instance."""
    global _supplier_intel_service
    if _supplier_intel_service is None:
        _supplier_intel_service = SupplierIntelligenceService()
    return _supplier_intel_service
