"""
Market Intelligence Agent - Market context and regional insights

Responsibilities:
- Generate market intelligence for categories
- Provide regional cost drivers
- Supply chain disruption context
- Industry-specific insights via RAG + LLM
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from backend.agents.base_agent import BaseAgent


class MarketIntelligenceAgent(BaseAgent):
    """
    Agent for generating market intelligence and regional insights.

    Key capabilities:
    - Category market context
    - Regional cost driver analysis
    - Supply chain trend insights
    - Industry-specific intelligence via RAG
    """

    # Industry-specific cost drivers configuration (includes Africa & Middle East regions)
    INDUSTRY_CONFIG = {
        'Edible Oils': {
            'low_cost_regions': ['India', 'Thailand', 'Indonesia', 'Vietnam', 'Egypt', 'Morocco', 'Turkey'],
            'drivers': {
                'India': 'Lower raw material input costs + scaling extraction infrastructure',
                'Thailand': 'Port efficiency + strong processing ecosystem',
                'Indonesia': 'High production capacity + efficient supply chains',
                'Vietnam': 'Competitive labor costs + growing export infrastructure',
                'China': 'Industrial scale processing + pricing leverage',
                'Malaysia': 'Established supply chains + quality standards',
                'Egypt': 'Strategic location + growing agri-processing capacity',
                'Morocco': 'EU proximity + competitive labor costs',
                'Turkey': 'Bridge between Europe and Asia + established food industry',
                'Kenya': 'East Africa hub + emerging processing capabilities',
                'South Africa': 'Regional leader + quality infrastructure'
            },
            'savings_range': (0.08, 0.20)
        },
        'IT Hardware': {
            'low_cost_regions': ['China', 'Taiwan', 'Vietnam', 'India', 'Mexico', 'Morocco', 'Egypt'],
            'drivers': {
                'China': 'Manufacturing scale + component ecosystem integration',
                'Taiwan': 'Advanced semiconductor manufacturing capabilities',
                'Vietnam': 'Competitive labor costs + growing tech manufacturing',
                'India': 'IT services integration + growing hardware assembly',
                'Mexico': 'Nearshoring benefits + trade agreements',
                'USA': 'Premium quality + reduced logistics risk',
                'Morocco': 'EU proximity + growing tech manufacturing hub',
                'Egypt': 'Strategic location + skilled workforce',
                'UAE': 'Regional tech hub + logistics excellence',
                'South Africa': 'African tech hub + established infrastructure'
            },
            'savings_range': (0.05, 0.15)
        },
        'Cloud Services': {
            'low_cost_regions': ['USA', 'Ireland', 'Singapore', 'India', 'UAE', 'South Africa'],
            'drivers': {
                'USA': 'Primary data center infrastructure + innovation hub',
                'Ireland': 'EU data sovereignty + tax efficiency',
                'Singapore': 'APAC hub + strong data protection',
                'India': 'Cost-effective managed services + skilled workforce',
                'Germany': 'GDPR compliance + data sovereignty',
                'UAE': 'Middle East hub + emerging data center market',
                'South Africa': 'African data sovereignty + growing cloud market',
                'Saudi Arabia': 'MENA cloud hub + infrastructure investment'
            },
            'savings_range': (0.10, 0.25)
        },
        'Software Licenses': {
            'low_cost_regions': ['India', 'Eastern Europe', 'Ireland', 'Egypt', 'Morocco'],
            'drivers': {
                'USA': 'Primary vendor relationships + support coverage',
                'India': 'Implementation services + support cost optimization',
                'Ireland': 'EU licensing optimization + tax benefits',
                'Germany': 'Enterprise software expertise + local support',
                'Egypt': 'Growing IT sector + cost-effective support',
                'Morocco': 'Francophone expertise + nearshore capabilities',
                'South Africa': 'Regional support hub + skilled workforce'
            },
            'savings_range': (0.05, 0.12)
        },
        'Steel': {
            'low_cost_regions': ['China', 'India', 'Russia', 'Brazil', 'Turkey', 'Egypt', 'South Africa'],
            'drivers': {
                'China': 'Massive production capacity + competitive pricing',
                'India': 'Growing capacity + lower labor costs',
                'Luxembourg': 'Premium quality + established logistics',
                'USA': 'Domestic supply security + reduced tariffs',
                'Brazil': 'Iron ore integration + competitive costs',
                'Turkey': 'Strategic location + growing steel industry',
                'Egypt': 'MENA steel hub + infrastructure development',
                'South Africa': 'African industrial leader + mining integration',
                'Saudi Arabia': 'Industrial diversification + infrastructure investment'
            },
            'savings_range': (0.08, 0.18)
        },
        'Pharmaceuticals': {
            'low_cost_regions': ['India', 'China', 'Ireland', 'Egypt', 'Morocco', 'South Africa'],
            'drivers': {
                'USA': 'Innovation hub + regulatory approval speed',
                'India': 'Generic manufacturing + cost efficiency',
                'Switzerland': 'Premium quality + R&D capabilities',
                'Ireland': 'Tax-efficient manufacturing hub',
                'China': 'API manufacturing + scale benefits',
                'Egypt': 'MENA pharma hub + growing generics market',
                'Morocco': 'African pharma leader + EU proximity',
                'South Africa': 'Regional manufacturing + regulatory expertise',
                'Jordan': 'Middle East pharma hub + quality standards'
            },
            'savings_range': (0.10, 0.30)
        },
        'Medical Devices': {
            'low_cost_regions': ['Mexico', 'Ireland', 'Costa Rica', 'China', 'Morocco', 'Tunisia'],
            'drivers': {
                'USA': 'Innovation + regulatory expertise',
                'Germany': 'Precision engineering + quality',
                'Mexico': 'Nearshoring + skilled labor pool',
                'Ireland': 'EU market access + manufacturing expertise',
                'China': 'Scale manufacturing + cost efficiency',
                'Morocco': 'EU proximity + growing medical device sector',
                'Tunisia': 'Skilled workforce + cost efficiency',
                'UAE': 'Regional healthcare hub + quality infrastructure',
                'South Africa': 'African medical device hub + regulatory alignment'
            },
            'savings_range': (0.08, 0.20)
        },
        'Construction Materials': {
            'low_cost_regions': ['China', 'India', 'Mexico', 'Turkey', 'Egypt', 'Morocco', 'UAE'],
            'drivers': {
                'Local': 'Reduced transport costs + faster delivery',
                'China': 'Scale production + competitive pricing',
                'Mexico': 'Nearshoring + trade agreements',
                'India': 'Growing capacity + cost efficiency',
                'Turkey': 'Cement & materials hub + competitive pricing',
                'Egypt': 'MENA construction hub + local production',
                'Morocco': 'African gateway + growing industry',
                'UAE': 'Regional construction leader + quality standards',
                'South Africa': 'African infrastructure hub + established supply chains'
            },
            'savings_range': (0.10, 0.25)
        },
        'Marketing Services': {
            'low_cost_regions': ['India', 'Philippines', 'Eastern Europe', 'Egypt', 'South Africa', 'Kenya'],
            'drivers': {
                'USA': 'Strategic expertise + market knowledge',
                'UK': 'Creative excellence + global reach',
                'India': 'Digital services + cost optimization',
                'Philippines': 'English proficiency + cost efficiency',
                'Egypt': 'Arabic content + MENA market expertise',
                'South Africa': 'African market expertise + creative talent',
                'Kenya': 'East Africa hub + digital innovation',
                'UAE': 'MENA creative hub + regional reach'
            },
            'savings_range': (0.15, 0.35)
        },
        'Logistics': {
            'low_cost_regions': ['Netherlands', 'Singapore', 'UAE', 'Panama', 'Morocco', 'Egypt', 'South Africa'],
            'drivers': {
                'Germany': 'European hub + infrastructure quality',
                'Netherlands': 'Port efficiency + logistics expertise',
                'Singapore': 'APAC hub + connectivity',
                'USA': 'Domestic coverage + technology integration',
                'UAE': 'Middle East logistics hub + world-class infrastructure',
                'Morocco': 'Tanger Med port + African gateway',
                'Egypt': 'Suez Canal proximity + MENA logistics hub',
                'South Africa': 'African logistics leader + port infrastructure',
                'Kenya': 'East Africa gateway + growing logistics sector'
            },
            'savings_range': (0.05, 0.15)
        },
        'DEFAULT': {
            'low_cost_regions': ['India', 'China', 'Mexico', 'Eastern Europe', 'Morocco', 'Egypt', 'South Africa'],
            'drivers': {
                'India': 'Cost-effective operations + skilled workforce',
                'China': 'Manufacturing scale + supply chain efficiency',
                'Mexico': 'Nearshoring benefits + trade agreements',
                'USA': 'Quality assurance + reduced risk',
                'Germany': 'Premium quality + reliability',
                'Morocco': 'EU proximity + competitive labor costs',
                'Egypt': 'Strategic location + growing industrial base',
                'South Africa': 'African hub + established infrastructure',
                'UAE': 'Middle East hub + business-friendly environment',
                'Turkey': 'Europe-Asia bridge + diversified economy'
            },
            'savings_range': (0.08, 0.18)
        }
    }

    # Higher confidence threshold for market intelligence (needs good RAG context)
    DEFAULT_CONFIDENCE_THRESHOLD = 0.5

    @property
    def agent_name(self) -> str:
        return "MarketIntelligenceAgent"

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute market intelligence generation.

        Args:
            context: Dictionary containing:
                - category: Product category
                - product_category: More specific product category
                - regions: List of relevant regions
                - current_suppliers: Current supplier information

        Returns:
            Dictionary with market intelligence
        """
        category = context.get('category', 'Procurement')
        product_category = context.get('product_category')
        regions = context.get('regions', [])

        try:
            # Get industry configuration
            industry_config = self.get_industry_config(category, product_category)

            # Generate regional cost drivers
            regional_insights = self._generate_regional_insights(
                category, regions, industry_config
            )

            # Generate market context
            market_context = self._generate_market_context(category, product_category)

            # LLM-powered market intelligence if enabled
            ai_market_intelligence = None
            if self.enable_llm:
                ai_market_intelligence = self._generate_llm_market_intelligence(
                    category, regions, product_category
                )

            return {
                'success': True,
                'category': category,
                'product_category': product_category,
                'industry_config': industry_config,
                'regional_insights': regional_insights,
                'market_context': market_context,
                'ai_market_intelligence': ai_market_intelligence or market_context,
                'llm_enabled': self.enable_llm and ai_market_intelligence is not None
            }

        except Exception as e:
            self.log(f"Market intelligence generation failed: {e}", "ERROR")
            return {
                'success': False,
                'error': str(e),
                'industry_config': self.INDUSTRY_CONFIG['DEFAULT']
            }

    def get_industry_config(
        self,
        category: str,
        product_category: str = None
    ) -> Dict[str, Any]:
        """Get industry-specific configuration based on category."""
        category_lower = (category or '').lower()
        product_lower = (product_category or '').lower()

        # Match category to industry config
        if 'oil' in category_lower or 'edible' in product_lower:
            return self.INDUSTRY_CONFIG['Edible Oils']
        elif 'it' in category_lower or 'hardware' in category_lower or 'laptop' in category_lower:
            return self.INDUSTRY_CONFIG['IT Hardware']
        elif 'cloud' in category_lower or 'saas' in category_lower:
            return self.INDUSTRY_CONFIG['Cloud Services']
        elif 'software' in category_lower or 'license' in category_lower:
            return self.INDUSTRY_CONFIG['Software Licenses']
        elif 'steel' in category_lower or 'aluminum' in category_lower or 'metal' in category_lower:
            return self.INDUSTRY_CONFIG['Steel']
        elif 'pharma' in category_lower or 'drug' in category_lower:
            return self.INDUSTRY_CONFIG['Pharmaceuticals']
        elif 'medical' in category_lower or 'device' in category_lower:
            return self.INDUSTRY_CONFIG['Medical Devices']
        elif 'construction' in category_lower or 'cement' in category_lower:
            return self.INDUSTRY_CONFIG['Construction Materials']
        elif 'marketing' in category_lower or 'consulting' in category_lower:
            return self.INDUSTRY_CONFIG['Marketing Services']
        elif 'logistics' in category_lower or 'freight' in category_lower:
            return self.INDUSTRY_CONFIG['Logistics']
        else:
            return self.INDUSTRY_CONFIG['DEFAULT']

    def _generate_regional_insights(
        self,
        category: str,
        regions: List[str],
        industry_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate insights for each relevant region."""
        insights = []
        drivers = industry_config.get('drivers', {})
        low_cost_regions = industry_config.get('low_cost_regions', [])

        for region in regions[:6]:
            driver = drivers.get(
                region,
                f'Regional supply capabilities for {category}'
            )

            is_low_cost = region in low_cost_regions

            insights.append({
                'region': region,
                'cost_driver': driver,
                'is_low_cost_region': is_low_cost,
                'recommendation': 'Consider for diversification' if is_low_cost else 'Current supplier region'
            })

        return insights

    def _generate_market_context(
        self,
        category: str,
        product_category: str = None
    ) -> str:
        """Generate market context summary."""
        cat = product_category or category or 'this category'

        context = f"MARKET CONTEXT FOR {cat.upper()}:\n\n"

        context += f"The {cat} market presents opportunities for procurement optimization through "
        context += "strategic supplier diversification and regional rebalancing. "

        context += "\n\nKey market factors to consider:\n"
        context += "- Global supply chain resilience has become a critical priority\n"
        context += "- Regional concentration creates vulnerability to localized disruptions\n"
        context += "- Supplier competition typically yields 5-15% cost improvements\n"
        context += "- Multi-region sourcing provides logistics flexibility and risk mitigation\n"

        context += f"\nFor {cat}, diversification strategies should balance cost optimization "
        context += "with quality requirements, delivery reliability, and risk management objectives."

        return context

    def _generate_llm_market_intelligence(
        self,
        category: str,
        regions: List[str],
        product_category: str = None
    ) -> Optional[str]:
        """Generate LLM-powered market intelligence using RAG."""
        if not self.enable_llm or not self.llm_engine:
            return None

        cat = product_category or category or 'procurement'

        # Get RAG context for market intelligence
        rag_query = f"market intelligence {cat} regional sourcing supply chain trends"
        rag_result = self.get_rag_context(rag_query, k=5)

        # Market intelligence needs strong RAG context to avoid hallucination
        if not rag_result.get('has_strong_context', False):
            self.log(f"Low RAG confidence ({rag_result.get('confidence', 0)}) - using template market context", "INFO")
            return None

        # Build data section
        data_section = f"""
CATEGORY: {cat}
REGIONS UNDER ANALYSIS: {', '.join(regions) if regions else 'Global'}

CURRENT MARKET FACTORS:
- Supply chain resilience is a board-level priority
- Geopolitical tensions affect regional sourcing decisions
- Sustainability requirements increasingly impact supplier selection
- Digital transformation enables better supplier visibility
"""

        task_instruction = """
Write a market intelligence brief (2-3 paragraphs) that:
1. Summarizes key market trends relevant to this category
2. Identifies regional supply chain considerations
3. References insights from the knowledge base [SOURCE-N]
4. Provides actionable market context for procurement decisions

IMPORTANT RULES:
- Only use information from the KNOWLEDGE BASE CONTEXT
- Cite sources using [SOURCE-N] format
- Do NOT invent market statistics or trends
- If knowledge base lacks specific market data, focus on general procurement best practices
- Be specific but only where data supports it

TONE: Informative, strategic, evidence-based.
"""

        result = self.generate_with_llm(
            data_section=data_section,
            task_instruction=task_instruction,
            rag_query=rag_query,
            fallback_generator=lambda: self._generate_market_context(category, product_category)
        )

        if result.get('method') == 'llm':
            return result.get('content', '')

        return None

    def get_cost_savings_estimate(
        self,
        category: str,
        product_category: str = None
    ) -> Dict[str, float]:
        """Get estimated cost savings range for diversification."""
        config = self.get_industry_config(category, product_category)
        min_pct, max_pct = config.get('savings_range', (0.08, 0.18))

        return {
            'min_percentage': min_pct * 100,
            'max_percentage': max_pct * 100,
            'typical_percentage': ((min_pct + max_pct) / 2) * 100
        }

    def get_recommended_diversification_regions(
        self,
        category: str,
        product_category: str = None,
        exclude_regions: List[str] = None
    ) -> List[Dict[str, str]]:
        """Get recommended regions for diversification."""
        config = self.get_industry_config(category, product_category)
        low_cost_regions = config.get('low_cost_regions', [])
        drivers = config.get('drivers', {})
        exclude = set(exclude_regions or [])

        recommendations = []
        for region in low_cost_regions:
            if region not in exclude:
                recommendations.append({
                    'region': region,
                    'driver': drivers.get(region, 'Competitive market conditions'),
                    'priority': 'High' if low_cost_regions.index(region) < 2 else 'Medium'
                })

        return recommendations[:5]

    def generate_why_this_matters(
        self,
        dominant_pct: float,
        num_suppliers: int,
        total_spend: float,
        category: str
    ) -> str:
        """Generate 'Why This Matters' reasoning section."""
        cat = category or "procurement"

        if dominant_pct > 80:
            severity = "critical"
            impact = "immediate action required"
        elif dominant_pct > 60:
            severity = "high"
            impact = "proactive action recommended"
        else:
            severity = "moderate"
            impact = "opportunity for optimization"

        reasoning = f"This analysis reveals a {severity} supplier concentration issue in {cat}. "

        if num_suppliers == 1:
            reasoning += f"With 100% of the ${total_spend:,.0f} annual spend flowing through a single supplier, "
            reasoning += "any disruption - whether from production issues, logistics failures, geopolitical events, "
            reasoning += "or commercial disputes - would result in complete supply chain failure. "
        else:
            reasoning += f"With {dominant_pct:.0f}% of spend concentrated with one supplier, "
            reasoning += "the organization faces significant vulnerability to supply disruptions, "
            reasoning += "limited negotiating leverage, and reduced ability to respond to market changes. "

        reasoning += f"\n\nThis matters because: (1) Supply chain resilience is now a board-level priority, "
        reasoning += "(2) Procurement concentration directly impacts business continuity risk profiles, "
        reasoning += f"(3) Diversification typically yields 5-15% cost improvements through competitive pressure, "
        reasoning += f"and (4) {impact} to maintain competitive procurement operations."

        return reasoning
