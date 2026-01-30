"""
Brief Orchestrator - Coordinates all microagents for brief generation

Responsibilities:
- Initialize and manage all specialized agents
- Coordinate data flow between agents
- Generate complete briefs by aggregating agent outputs
- Handle fallbacks and error recovery
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import pandas as pd

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from backend.agents.data_analysis_agent import DataAnalysisAgent
from backend.agents.risk_assessment_agent import RiskAssessmentAgent
from backend.agents.recommendation_agent import RecommendationAgent
from backend.agents.market_intelligence_agent import MarketIntelligenceAgent


class BriefOrchestrator:
    """
    Orchestrates microagents to generate comprehensive procurement briefs.

    Architecture:
    1. DataAnalysisAgent analyzes spend data
    2. RiskAssessmentAgent evaluates risks
    3. MarketIntelligenceAgent provides market context
    4. RecommendationAgent generates strategic recommendations
    5. Orchestrator combines outputs into complete brief

    All agents share RAG and LLM capabilities for consistent grounding.
    """

    def __init__(
        self,
        data_loader=None,
        rule_engine=None,
        llm_engine=None,
        vector_store=None,
        enable_llm: bool = True,
        enable_rag: bool = True,
        enable_web_search: bool = True
    ):
        """
        Initialize orchestrator with all required components.

        Args:
            data_loader: DataLoader instance for data access
            rule_engine: RuleEvaluationEngine for compliance checking
            llm_engine: LLMEngine for AI-powered generation
            vector_store: FAISSVectorStore for RAG
            enable_llm: Enable LLM across all agents
            enable_rag: Enable RAG across all agents
            enable_web_search: Enable web search fallback when RAG has low confidence
        """
        self.data_loader = data_loader
        self.rule_engine = rule_engine
        self.llm_engine = llm_engine
        self.vector_store = vector_store
        self.enable_llm = enable_llm
        self.enable_rag = enable_rag
        self.enable_web_search = enable_web_search

        # Initialize agents with shared LLM, RAG, and web search
        self.data_agent = DataAnalysisAgent(
            llm_engine=llm_engine,
            vector_store=vector_store,
            enable_llm=enable_llm,
            enable_rag=enable_rag,
            enable_web_search=enable_web_search
        )

        self.risk_agent = RiskAssessmentAgent(
            llm_engine=llm_engine,
            vector_store=vector_store,
            enable_llm=enable_llm,
            enable_rag=enable_rag,
            enable_web_search=enable_web_search
        )

        self.recommendation_agent = RecommendationAgent(
            llm_engine=llm_engine,
            vector_store=vector_store,
            enable_llm=enable_llm,
            enable_rag=enable_rag,
            enable_web_search=enable_web_search
        )

        self.market_agent = MarketIntelligenceAgent(
            llm_engine=llm_engine,
            vector_store=vector_store,
            enable_llm=enable_llm,
            enable_rag=enable_rag,
            enable_web_search=enable_web_search,
            confidence_threshold=0.5  # Higher threshold for market intelligence
        )

        web_status = "enabled" if enable_web_search else "disabled"
        print(f"[OK] BriefOrchestrator initialized with all agents (web search: {web_status})")

    def generate_incumbent_concentration_brief(
        self,
        client_id: str,
        category: str = None
    ) -> Dict[str, Any]:
        """
        Generate Incumbent Concentration Brief using microagent pipeline.

        Pipeline:
        1. Load and validate data
        2. DataAnalysisAgent: Analyze spend concentration
        3. RiskAssessmentAgent: Evaluate risks
        4. MarketIntelligenceAgent: Get market context
        5. RecommendationAgent: Generate strategy
        6. Combine into final brief

        Args:
            client_id: Client identifier
            category: Category filter (sector/category/subcategory)

        Returns:
            Complete brief dictionary
        """
        # Step 1: Load and validate data
        spend_df, supplier_df, resolved_info = self._load_data(client_id, category)

        if spend_df is None or spend_df.empty:
            return self._empty_brief_response(
                resolved_info.get('error', 'No spend data found')
            )

        # Update category from resolved hierarchy
        hierarchy = resolved_info.get('hierarchy', {})
        resolved_sector = hierarchy.get('sector')
        resolved_category = hierarchy.get('category')
        if hierarchy.get('subcategory'):
            category = hierarchy['subcategory']
        elif hierarchy.get('category'):
            category = hierarchy['category']

        # Step 2: Data Analysis
        data_context = {
            'spend_df': spend_df,
            'supplier_df': supplier_df,
            'category': category,
            'client_id': client_id
        }
        data_analysis = self.data_agent.execute(data_context)

        if not data_analysis.get('success', False):
            return self._empty_brief_response(
                data_analysis.get('error', 'Data analysis failed')
            )

        # Find alternate suppliers
        alternate_suppliers = self.data_agent.find_alternate_suppliers(
            spend_df, supplier_df, category
        )

        # Step 3: Risk Assessment
        risk_context = {
            'data_analysis': data_analysis,
            'rule_engine': self.rule_engine,
            'client_id': client_id,
            'category': category
        }
        risk_assessment = self.risk_agent.execute(risk_context)

        # Step 4: Market Intelligence
        supplier_analysis = data_analysis.get('supplier_analysis', {})
        regional_analysis = data_analysis.get('regional_analysis', {})

        all_regions = (
            supplier_analysis.get('dominant_countries', []) +
            regional_analysis.get('all_countries', []) +
            alternate_suppliers.get('alternate_regions', [])
        )

        market_context = {
            'category': category,
            'product_category': alternate_suppliers.get('product_category'),
            'regions': list(set(all_regions))
        }
        market_intel = self.market_agent.execute(market_context)

        # Step 5: Generate Recommendations
        recommendation_context = {
            'data_analysis': data_analysis,
            'risk_assessment': risk_assessment,
            'alternate_suppliers': alternate_suppliers,
            'industry_config': market_intel.get('industry_config', {}),
            'category': category
        }
        recommendations = self.recommendation_agent.execute(recommendation_context)

        # Step 6: Assemble Final Brief
        brief = self._assemble_incumbent_brief(
            data_analysis=data_analysis,
            risk_assessment=risk_assessment,
            market_intel=market_intel,
            recommendations=recommendations,
            alternate_suppliers=alternate_suppliers,
            category=category,
            resolved_sector=resolved_sector,
            resolved_category=resolved_category,
            client_id=client_id
        )

        return brief

    def generate_regional_concentration_brief(
        self,
        client_id: str,
        category: str = None
    ) -> Dict[str, Any]:
        """
        Generate Regional Concentration Brief using microagent pipeline.

        Similar pipeline to incumbent brief but focused on geographic analysis.

        Args:
            client_id: Client identifier
            category: Category filter (sector/category/subcategory)

        Returns:
            Complete brief dictionary
        """
        # Step 1: Load and validate data
        spend_df, supplier_df, resolved_info = self._load_data(client_id, category)

        if spend_df is None or spend_df.empty:
            return self._empty_brief_response(
                resolved_info.get('error', 'No spend data found')
            )

        # Update category from resolved hierarchy
        hierarchy = resolved_info.get('hierarchy', {})
        resolved_sector = hierarchy.get('sector')
        resolved_category = hierarchy.get('category')
        if hierarchy.get('subcategory'):
            category = hierarchy['subcategory']
        elif hierarchy.get('category'):
            category = hierarchy['category']

        # Step 2: Data Analysis
        data_context = {
            'spend_df': spend_df,
            'supplier_df': supplier_df,
            'category': category,
            'client_id': client_id
        }
        data_analysis = self.data_agent.execute(data_context)

        if not data_analysis.get('success', False):
            return self._empty_brief_response(
                data_analysis.get('error', 'Data analysis failed')
            )

        # Step 3: Risk Assessment
        risk_context = {
            'data_analysis': data_analysis,
            'rule_engine': self.rule_engine,
            'client_id': client_id,
            'category': category
        }
        risk_assessment = self.risk_agent.execute(risk_context)

        # Step 4: Market Intelligence
        regional_analysis = data_analysis.get('regional_analysis', {})
        market_context = {
            'category': category,
            'product_category': None,
            'regions': regional_analysis.get('all_countries', [])
        }
        market_intel = self.market_agent.execute(market_context)

        # Step 5: Generate Target Allocation
        total_spend = data_analysis.get('total_spend', 0)
        country_pct = regional_analysis.get('country_pct', {})

        # Convert to dict if Series
        if hasattr(country_pct, 'to_dict'):
            country_dist = country_pct.to_dict()
        else:
            country_dist = dict(country_pct) if country_pct else {}

        target_allocation = self.recommendation_agent.generate_target_allocation(
            total_spend, country_dist
        )

        # Step 6: Generate Recommendations
        alternate_suppliers = {}  # Regional brief doesn't focus on specific alternates
        recommendation_context = {
            'data_analysis': data_analysis,
            'risk_assessment': risk_assessment,
            'alternate_suppliers': alternate_suppliers,
            'industry_config': market_intel.get('industry_config', {}),
            'category': category
        }
        recommendations = self.recommendation_agent.execute(recommendation_context)

        # Step 7: Assemble Final Brief
        brief = self._assemble_regional_brief(
            data_analysis=data_analysis,
            risk_assessment=risk_assessment,
            market_intel=market_intel,
            recommendations=recommendations,
            target_allocation=target_allocation,
            category=category,
            resolved_sector=resolved_sector,
            resolved_category=resolved_category,
            client_id=client_id
        )

        return brief

    def generate_both_briefs(
        self,
        client_id: str,
        category: str = None
    ) -> Dict[str, Any]:
        """
        Generate both incumbent and regional concentration briefs.

        Args:
            client_id: Client identifier
            category: Category filter

        Returns:
            Dictionary with both briefs
        """
        incumbent_brief = self.generate_incumbent_concentration_brief(client_id, category)
        regional_brief = self.generate_regional_concentration_brief(client_id, category)

        return {
            'incumbent_concentration_brief': incumbent_brief,
            'regional_concentration_brief': regional_brief,
            'generated_at': datetime.now().isoformat(),
            'client_id': client_id,
            'category': category
        }

    def _load_data(
        self,
        client_id: str,
        category: str = None
    ) -> tuple:
        """Load and resolve spend data for analysis."""
        supplier_df = self.data_loader.load_supplier_master() if self.data_loader else pd.DataFrame()

        resolved_info = {'hierarchy': {}}

        if category and self.data_loader:
            # Use robust category resolver
            resolved = self.data_loader.resolve_category_input(category, client_id)
            if not resolved.get('success', False):
                # Try without client filter
                resolved = self.data_loader.resolve_category_input(category)

            if not resolved.get('success', False):
                return None, supplier_df, resolved

            spend_df = resolved.get('spend_data', pd.DataFrame())
            resolved_info = resolved
        elif self.data_loader:
            spend_df = self.data_loader.load_spend_data()
            spend_df = spend_df[spend_df['Client_ID'] == client_id]
            if not spend_df.empty and 'Sector' in spend_df.columns:
                resolved_info['hierarchy'] = {'sector': spend_df['Sector'].iloc[0]}
        else:
            spend_df = pd.DataFrame()

        return spend_df, supplier_df, resolved_info

    def _assemble_incumbent_brief(
        self,
        data_analysis: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        market_intel: Dict[str, Any],
        recommendations: Dict[str, Any],
        alternate_suppliers: Dict[str, Any],
        category: str,
        resolved_sector: str,
        resolved_category: str,
        client_id: str
    ) -> Dict[str, Any]:
        """Assemble incumbent concentration brief from agent outputs."""
        supplier_analysis = data_analysis.get('supplier_analysis', {})
        regional_analysis = data_analysis.get('regional_analysis', {})
        risk_matrix = risk_assessment.get('risk_matrix', {})
        rule_evaluation = risk_assessment.get('rule_evaluation', {})

        supplier_reduction = recommendations.get('supplier_reduction', {})
        regional_strategy = recommendations.get('regional_strategy', {})
        roi_projections = recommendations.get('roi_projections', {})

        # Generate risk statement
        risk_statement = self._generate_risk_statement(
            category=category,
            total_spend=data_analysis.get('total_spend', 0),
            num_suppliers=supplier_analysis.get('num_suppliers', 0),
            all_suppliers=supplier_analysis.get('suppliers_list', []),
            dominant_supplier=supplier_analysis.get('dominant_supplier', 'Unknown'),
            dominant_pct=supplier_analysis.get('dominant_pct', 0),
            dominant_spend=supplier_analysis.get('dominant_spend', 0),
            supplier_countries=supplier_analysis.get('dominant_countries', []),
            alternate_supplier=alternate_suppliers.get('alternate_supplier'),
            alternate_regions=alternate_suppliers.get('alternate_regions', []),
            product_category=alternate_suppliers.get('product_category'),
            subcategory=alternate_suppliers.get('subcategory')
        )

        brief = {
            'title': f'LEADERSHIP BRIEF - {(category or "PROCUREMENT").upper()} DIVERSIFICATION',
            'subtitle': 'Supplier Concentration Analysis & Diversification Strategy',
            'total_spend': data_analysis.get('total_spend', 0),
            'sector': resolved_sector,
            'category': category,
            'product_category': alternate_suppliers.get('product_category'),
            'generated_date': datetime.now().strftime('%Y-%m-%d'),
            'fiscal_year': datetime.now().year,

            'current_state': {
                'dominant_supplier': supplier_analysis.get('dominant_supplier', 'Unknown'),
                'supplier_location': ', '.join(supplier_analysis.get('dominant_countries', [])),
                'supplier_region': ', '.join(supplier_analysis.get('dominant_regions', [])),
                'spend_share_pct': supplier_analysis.get('dominant_pct', 0),
                'spend_share_usd': supplier_analysis.get('dominant_spend', 0),
                'num_suppliers': supplier_analysis.get('num_suppliers', 0),
                'all_suppliers': supplier_analysis.get('suppliers_list', []),
                'currently_buying_category': 'Yes',
                'alternate_supplier_active': (
                    'None active today' if not alternate_suppliers.get('alternate_supplier')
                    else alternate_suppliers.get('alternate_supplier')
                ),
                'key_risk': risk_assessment.get('key_risk', '')
            },

            'risk_statement': risk_statement,

            'supplier_reduction': supplier_reduction,

            'regional_dependency': {
                'corridor_name': regional_analysis.get('corridor_name', 'Primary Supply Corridor'),
                'original_pct': regional_analysis.get('dominant_country_pct', 0),
                'new_target_pct': regional_strategy.get('new_target_pct', ''),
                'net_reduction_pct': regional_strategy.get('net_reduction_pct', '')
            },

            'cost_advantages': recommendations.get('cost_advantages', []),
            'total_cost_advantage': {
                'min_usd': sum(
                    a['min_usd'] for a in recommendations.get('cost_advantages', [])
                    if 'Blended' not in a.get('region', '')
                ),
                'max_usd': sum(
                    a['max_usd'] for a in recommendations.get('cost_advantages', [])
                    if 'Blended' not in a.get('region', '')
                )
            },

            'supplier_performance': data_analysis.get('performance_metrics', []),
            'risk_matrix': risk_matrix,
            'roi_projections': roi_projections,
            'implementation_timeline': recommendations.get('implementation_timeline', []),
            'rule_violations': rule_evaluation,

            'strategic_outcome': recommendations.get('strategic_outcomes', []),
            'next_steps': recommendations.get('next_steps', []),

            # Reasoning sections
            'why_this_matters': market_intel.get('ai_market_intelligence', ''),
            'business_justification': recommendations.get('business_justification', ''),
            'risk_reasoning': risk_assessment.get('risk_reasoning', ''),
            'recommendation_rationale': recommendations.get('ai_strategic_recommendations', ''),

            # AI-powered sections
            'ai_executive_summary': self._generate_executive_summary(
                data_analysis, risk_matrix, roi_projections, 'incumbent'
            ),
            'ai_risk_analysis': risk_assessment.get('ai_risk_analysis', ''),
            'ai_strategic_recommendations': recommendations.get('ai_strategic_recommendations', ''),
            'ai_market_intelligence': market_intel.get('ai_market_intelligence', ''),

            'llm_enabled': (
                recommendations.get('llm_enabled', False) or
                risk_assessment.get('llm_enabled', False) or
                market_intel.get('llm_enabled', False)
            ),

            # Metadata
            'agents_used': ['DataAnalysisAgent', 'RiskAssessmentAgent', 'RecommendationAgent', 'MarketIntelligenceAgent'],
            'orchestrator_version': '1.0'
        }

        return brief

    def _assemble_regional_brief(
        self,
        data_analysis: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        market_intel: Dict[str, Any],
        recommendations: Dict[str, Any],
        target_allocation: Dict[str, Dict],
        category: str,
        resolved_sector: str,
        resolved_category: str,
        client_id: str
    ) -> Dict[str, Any]:
        """Assemble regional concentration brief from agent outputs."""
        supplier_analysis = data_analysis.get('supplier_analysis', {})
        regional_analysis = data_analysis.get('regional_analysis', {})
        risk_matrix = risk_assessment.get('risk_matrix', {})
        rule_evaluation = risk_assessment.get('rule_evaluation', {})

        regional_strategy = recommendations.get('regional_strategy', {})
        roi_projections = recommendations.get('roi_projections', {})

        # Calculate reductions
        reductions = self._calculate_regional_reductions(
            regional_analysis.get('concentration_list', []),
            target_allocation
        )

        # Concentration note
        high_concentration_countries = regional_analysis.get('high_concentration_countries', [])
        total_high_concentration = regional_analysis.get('total_high_concentration_pct', 0)

        if len(high_concentration_countries) >= 2:
            concentration_note = f"{high_concentration_countries[0]} and {high_concentration_countries[1]} each exceeded 40% of spend, creating high regional dependency."
        elif len(high_concentration_countries) == 1:
            concentration_note = f"{high_concentration_countries[0]} exceeds 40% of spend, creating regional concentration risk."
        else:
            concentration_note = "Regional distribution is within acceptable limits, but diversification opportunities exist."

        brief = {
            'title': f'LEADERSHIP BRIEF - {(category or "PROCUREMENT").upper()} DIVERSIFICATION',
            'subtitle': 'Regional Concentration Analysis & Diversification Strategy',
            'total_spend': data_analysis.get('total_spend', 0),
            'sector': resolved_sector,
            'category': category,
            'product_category': None,
            'generated_date': datetime.now().strftime('%Y-%m-%d'),
            'fiscal_year': datetime.now().year,

            'original_concentration': regional_analysis.get('concentration_list', []),
            'total_high_concentration_pct': total_high_concentration,
            'total_high_concentration_spend': sum(
                c['spend_usd'] for c in regional_analysis.get('concentration_list', [])
                if c.get('pct', 0) > 40
            ),
            'concentration_note': concentration_note,

            'target_allocation': target_allocation,
            'reductions': reductions,

            'regional_dependency': {
                'corridor_name': regional_analysis.get('corridor_name', 'Primary Supply Corridor'),
                'original_pct': total_high_concentration or regional_analysis.get('dominant_country_pct', 0),
                'new_target_pct': regional_strategy.get('new_target_pct', ''),
                'reduction_pct': regional_strategy.get('net_reduction_pct', '')
            },

            'cost_advantages': recommendations.get('cost_advantages', []),
            'total_cost_advantage': {
                'min_usd': sum(
                    a['min_usd'] for a in recommendations.get('cost_advantages', [])
                    if 'Blended' not in a.get('region', '')
                ),
                'max_usd': sum(
                    a['max_usd'] for a in recommendations.get('cost_advantages', [])
                    if 'Blended' not in a.get('region', '')
                )
            },

            'supplier_performance': data_analysis.get('performance_metrics', []),
            'risk_matrix': risk_matrix,
            'roi_projections': roi_projections,
            'implementation_timeline': recommendations.get('implementation_timeline', []),
            'rule_violations': rule_evaluation,

            'strategic_outcome': recommendations.get('strategic_outcomes', []),
            'next_steps': recommendations.get('next_steps', []),

            # Reasoning sections
            'why_this_matters': market_intel.get('ai_market_intelligence', ''),
            'business_justification': recommendations.get('business_justification', ''),
            'risk_reasoning': risk_assessment.get('risk_reasoning', ''),
            'recommendation_rationale': recommendations.get('ai_strategic_recommendations', ''),

            # AI-powered sections
            'ai_executive_summary': self._generate_executive_summary(
                data_analysis, risk_matrix, roi_projections, 'regional'
            ),
            'ai_risk_analysis': risk_assessment.get('ai_risk_analysis', ''),
            'ai_strategic_recommendations': recommendations.get('ai_strategic_recommendations', ''),
            'ai_market_intelligence': market_intel.get('ai_market_intelligence', ''),

            'llm_enabled': (
                recommendations.get('llm_enabled', False) or
                risk_assessment.get('llm_enabled', False) or
                market_intel.get('llm_enabled', False)
            ),

            # Metadata
            'agents_used': ['DataAnalysisAgent', 'RiskAssessmentAgent', 'RecommendationAgent', 'MarketIntelligenceAgent'],
            'orchestrator_version': '1.0'
        }

        return brief

    def _generate_risk_statement(
        self,
        category: str,
        total_spend: float,
        num_suppliers: int,
        all_suppliers: List[Dict],
        dominant_supplier: str,
        dominant_pct: float,
        dominant_spend: float,
        supplier_countries: List[str],
        alternate_supplier: Optional[str],
        alternate_regions: List[str],
        product_category: Optional[str],
        subcategory: Optional[str] = None
    ) -> str:
        """Generate comprehensive risk statement."""
        cat_lower = (category or 'procurement').lower()
        year = datetime.now().year
        category_label = subcategory or product_category or category or 'this category'

        statement = f"Our current {cat_lower} procurement "

        if num_suppliers == 1:
            statement += f"is sourced entirely from {dominant_supplier}, representing 100% of the total "
            statement += f"category spend (USD {total_spend:,.0f} in {year}). "
        else:
            statement += f"involves {num_suppliers} suppliers, with {dominant_supplier} as the dominant supplier "
            statement += f"at {dominant_pct:.0f}% of total category spend (USD {dominant_spend:,.0f} of USD {total_spend:,.0f} in {year}). "

            other_suppliers = [s for s in all_suppliers if s['name'] != dominant_supplier]
            if other_suppliers:
                statement += "Other suppliers include: "
                supplier_list = [f"{s['name']} ({s['pct']:.0f}%)" for s in other_suppliers[:3]]
                statement += ", ".join(supplier_list) + ". "

        if len(supplier_countries) > 1:
            statement += f"While suppliers operate across {', '.join(supplier_countries[:3])}, "
        else:
            country_name = supplier_countries[0] if supplier_countries else 'a single region'
            statement += f"All suppliers operate from {country_name}. "

        if alternate_supplier:
            statement += f"We currently do not source {cat_lower} from "
            statement += f"{alternate_supplier}, an already approved {category_label} supplier in our system with "
            statement += f"operational presence across {', '.join(alternate_regions[:4])}. "
        elif subcategory:
            statement += f"There are no other qualified {subcategory} suppliers in our approved supplier database. "
            statement += "New supplier qualification will be required for diversification. "
        else:
            statement += "We do not have alternate suppliers activated for this category. "

        statement += "\n\nThis creates "
        if num_suppliers == 1:
            statement += "both a critical single-supplier dependency risk and a correlated "
        elif dominant_pct > 60:
            statement += "both a high supplier concentration risk and a correlated "
        else:
            statement += "a "
        statement += "geographic concentration risk. "

        statement += "It is recommended to "
        if alternate_supplier:
            statement += f"activate {cat_lower} with {alternate_supplier} "
        else:
            statement += "identify and activate alternate suppliers "
        statement += "to offset this dependency, introduce price competition, diversify geographic exposure, "
        statement += "and enable alternate logistics routing, while continuing optimization and quarterly rebalancing."

        return statement

    def _calculate_regional_reductions(
        self,
        original_concentration: List[Dict],
        target_allocation: Dict[str, Dict]
    ) -> List[Dict]:
        """Calculate regional reductions from target allocation."""
        reductions = []

        for orig in original_concentration[:3]:
            country = orig['country']
            if country in target_allocation:
                target = target_allocation[country]
                original_pct = orig['pct']
                target_pct = target['pct']
                reduction_pct_of_original = round(
                    ((original_pct - target_pct) / original_pct) * 100, 1
                ) if original_pct > 0 else 0

                reductions.append({
                    'country': country,
                    'original_pct': original_pct,
                    'target_pct': target_pct,
                    'reduction_pct': reduction_pct_of_original,
                    'formatted_reduction': f'{original_pct:.0f}% -> {target_pct:.0f}% = {reduction_pct_of_original:.1f}% reduction in share'
                })

        return reductions

    def _generate_executive_summary(
        self,
        data_analysis: Dict[str, Any],
        risk_matrix: Dict[str, Any],
        roi_projections: Dict[str, Any],
        brief_type: str
    ) -> str:
        """Generate executive summary template."""
        total_spend = data_analysis.get('total_spend', 0)
        supplier_analysis = data_analysis.get('supplier_analysis', {})
        regional_analysis = data_analysis.get('regional_analysis', {})

        if brief_type == "incumbent":
            dominant_supplier = supplier_analysis.get('dominant_supplier', 'Unknown')
            dominant_pct = supplier_analysis.get('dominant_pct', 0)

            summary = f"This analysis identifies a critical supplier concentration issue in our procurement portfolio, "
            summary += f"with {dominant_supplier} representing {dominant_pct:.0f}% of the ${total_spend:,.0f} annual spend. "
            summary += f"The current risk level is rated {risk_matrix.get('overall_risk', 'HIGH')}, "
            summary += "requiring immediate attention to ensure supply chain continuity.\n\n"

            summary += f"The recommended diversification strategy targets a reduction in concentration to {55}% through "
            summary += "phased activation of alternate suppliers and regional diversification. "
            summary += f"This initiative is projected to deliver ${roi_projections.get('annual_cost_savings_min', 0):,.0f} to "
            summary += f"${roi_projections.get('annual_cost_savings_max', 0):,.0f} in annual cost savings "
            summary += f"with a {roi_projections.get('roi_percentage_min', 0):.0f}%-{roi_projections.get('roi_percentage_max', 0):.0f}% ROI.\n\n"

            summary += "Implementation follows a 26-week phased approach beginning with supplier qualification, "
            summary += "followed by pilot contracts and performance validation before full scale-up."

        else:  # regional
            dominant_country = regional_analysis.get('dominant_country', 'Unknown')
            dominant_country_pct = regional_analysis.get('dominant_country_pct', 0)

            summary = f"This analysis identifies significant regional concentration risk, "
            summary += f"with {dominant_country_pct:.0f}% of the ${total_spend:,.0f} annual spend concentrated in {dominant_country}. "
            summary += f"The current risk level is rated {risk_matrix.get('overall_risk', 'HIGH')}, "
            summary += "indicating vulnerability to regional disruptions.\n\n"

            summary += "The recommended diversification strategy targets geographic rebalancing through "
            summary += "strategic expansion into alternative supply regions. "
            summary += f"This initiative is projected to deliver ${roi_projections.get('annual_cost_savings_min', 0):,.0f} to "
            summary += f"${roi_projections.get('annual_cost_savings_max', 0):,.0f} in annual cost advantages "
            summary += "while significantly improving supply chain resilience.\n\n"

            summary += "Implementation follows a 26-week phased approach, starting with regional supplier identification "
            summary += "and qualification, followed by pilot allocations to validate performance."

        return summary

    def _empty_brief_response(self, error: str) -> Dict[str, Any]:
        """Return empty brief structure with error message."""
        return {
            'success': False,
            'error': error,
            'title': 'BRIEF GENERATION FAILED',
            'total_spend': 0,
            'current_state': {},
            'risk_matrix': {},
            'strategic_outcome': [],
            'next_steps': []
        }
