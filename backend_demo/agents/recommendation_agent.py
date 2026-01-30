"""
Recommendation Agent - Strategic recommendations and action plans

Responsibilities:
- Generate diversification strategies
- Calculate ROI projections
- Create implementation timelines
- Provide business justification
- Generate strategic outcomes
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from backend.agents.base_agent import BaseAgent


class RecommendationAgent(BaseAgent):
    """
    Agent for generating strategic recommendations and action plans.

    Key capabilities:
    - Supplier diversification strategies
    - Target allocation planning
    - ROI projections
    - Implementation timelines
    - Business justification narratives
    """

    @property
    def agent_name(self) -> str:
        return "RecommendationAgent"

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute recommendation generation.

        Args:
            context: Dictionary containing:
                - data_analysis: Output from DataAnalysisAgent
                - risk_assessment: Output from RiskAssessmentAgent
                - alternate_suppliers: Alternate supplier info
                - industry_config: Industry-specific configuration
                - category: Category being analyzed

        Returns:
            Dictionary with recommendations and action plans
        """
        data_analysis = context.get('data_analysis', {})
        risk_assessment = context.get('risk_assessment', {})
        alternate_suppliers = context.get('alternate_suppliers', {})
        industry_config = context.get('industry_config', {})
        category = context.get('category', 'Procurement')

        if not data_analysis.get('success', False):
            return {
                'success': False,
                'error': 'No valid data analysis provided'
            }

        try:
            total_spend = data_analysis.get('total_spend', 0)
            supplier_analysis = data_analysis.get('supplier_analysis', {})
            regional_analysis = data_analysis.get('regional_analysis', {})
            risk_matrix = risk_assessment.get('risk_matrix', {})

            # Generate supplier reduction strategy
            supplier_reduction = self._generate_supplier_reduction_strategy(
                supplier_analysis, alternate_suppliers
            )

            # Generate regional diversification strategy
            regional_strategy = self._generate_regional_strategy(
                regional_analysis, industry_config
            )

            # Calculate cost advantages
            cost_advantages = self._calculate_cost_advantages(
                total_spend,
                regional_strategy.get('new_regions', []),
                industry_config
            )

            # Calculate ROI projections
            roi_projections = self._calculate_roi_projections(
                total_spend,
                cost_advantages,
                supplier_analysis.get('dominant_pct', 0),
                supplier_reduction.get('target_dominant_pct', 55)
            )

            # Generate implementation timeline
            timeline = self._generate_implementation_timeline(category)

            # Generate strategic outcomes
            strategic_outcomes = self._generate_strategic_outcomes(
                supplier_analysis, supplier_reduction, regional_strategy,
                roi_projections, alternate_suppliers
            )

            # Generate next steps
            next_steps = self._generate_next_steps(
                category, alternate_suppliers, regional_strategy
            )

            # Business justification
            business_justification = self._generate_business_justification(
                supplier_analysis.get('dominant_pct', 0),
                supplier_reduction.get('target_dominant_pct', 55),
                roi_projections, risk_matrix
            )

            # LLM-powered strategic recommendations if enabled
            ai_recommendations = None
            if self.enable_llm:
                ai_recommendations = self._generate_llm_recommendations(
                    data_analysis, risk_assessment, supplier_reduction,
                    regional_strategy, industry_config
                )

            return {
                'success': True,
                'supplier_reduction': supplier_reduction,
                'regional_strategy': regional_strategy,
                'cost_advantages': cost_advantages,
                'roi_projections': roi_projections,
                'implementation_timeline': timeline,
                'strategic_outcomes': strategic_outcomes,
                'next_steps': next_steps,
                'business_justification': business_justification,
                'ai_strategic_recommendations': ai_recommendations or business_justification,
                'llm_enabled': self.enable_llm and ai_recommendations is not None
            }

        except Exception as e:
            self.log(f"Recommendation generation failed: {e}", "ERROR")
            return {
                'success': False,
                'error': str(e)
            }

    def _generate_supplier_reduction_strategy(
        self,
        supplier_analysis: Dict[str, Any],
        alternate_suppliers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate supplier reduction/diversification strategy."""
        dominant_supplier = supplier_analysis.get('dominant_supplier', 'Unknown')
        dominant_pct = supplier_analysis.get('dominant_pct', 0)
        suppliers_list = supplier_analysis.get('suppliers_list', [])

        # Calculate target concentration
        if dominant_pct > 80:
            target_dominant_pct = 60
        elif dominant_pct > 60:
            target_dominant_pct = 55
        else:
            target_dominant_pct = max(40, dominant_pct - 15)

        # Calculate target for alternate supplier
        other_suppliers_pct = sum(s['pct'] for s in suppliers_list[1:] if len(suppliers_list) > 1)
        target_alternate_pct = 100 - target_dominant_pct - other_suppliers_pct
        target_alternate_pct = max(10, min(40, target_alternate_pct))

        # Calculate reduction metrics
        reduction_pct = dominant_pct - target_dominant_pct
        reduction_pct_of_original = round((reduction_pct / dominant_pct) * 100, 1) if dominant_pct > 0 else 0

        alternate_supplier = alternate_suppliers.get('alternate_supplier')
        alternate_regions = alternate_suppliers.get('alternate_regions', [])

        return {
            'dominant_supplier': {
                'name': dominant_supplier,
                'original_share_pct': dominant_pct,
                'new_target_cap_pct': target_dominant_pct,
                'reduction_pct': reduction_pct,
                'reduction_pct_of_original': reduction_pct_of_original,
                'formatted_reduction': f'{dominant_pct:.0f}% -> {target_dominant_pct:.0f}% = {reduction_pct_of_original:.1f}% reduction'
            },
            'alternate_supplier': {
                'name': alternate_supplier or 'New Alternate Supplier',
                'original_share_pct': 0,
                'new_target_pct': target_alternate_pct,
                'regions': alternate_regions,
                'benefit': 'Enables supplier competition + fallback'
            },
            'target_dominant_pct': target_dominant_pct,
            'target_alternate_pct': target_alternate_pct,
            'has_identified_alternate': alternate_supplier is not None
        }

    def _generate_regional_strategy(
        self,
        regional_analysis: Dict[str, Any],
        industry_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate regional diversification strategy."""
        corridor_name = regional_analysis.get('corridor_name', 'Primary Supply Corridor')
        dominant_country_pct = regional_analysis.get('dominant_country_pct', 0)
        total_high_concentration = regional_analysis.get('total_high_concentration_pct', 0)
        existing_countries = regional_analysis.get('all_countries', [])

        # Calculate target regional percentages
        if total_high_concentration > 60:
            target_min = max(40, total_high_concentration - 30)
            target_max = max(50, total_high_concentration - 25)
        else:
            target_min = total_high_concentration
            target_max = total_high_concentration

        # Identify new regions from industry config
        low_cost_regions = industry_config.get('low_cost_regions', ['India', 'China', 'Mexico'])
        new_regions = [r for r in low_cost_regions if r not in existing_countries][:3]

        return {
            'corridor_name': corridor_name,
            'original_pct': dominant_country_pct,
            'new_target_pct': f'{target_min:.0f}-{target_max:.0f}%',
            'net_reduction_pct': f'{max(0, dominant_country_pct - target_max):.0f}-{max(0, dominant_country_pct - target_min):.0f}%',
            'new_regions': new_regions,
            'target_min': target_min,
            'target_max': target_max
        }

    def _calculate_cost_advantages(
        self,
        total_spend: float,
        new_regions: List[str],
        industry_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Calculate cost advantages from diversification."""
        advantages = []
        drivers = industry_config.get('drivers', {})
        min_savings_pct, max_savings_pct = industry_config.get('savings_range', (0.08, 0.18))

        for region in new_regions:
            driver = drivers.get(
                region,
                f'Diversification benefits + competitive pricing in {region}'
            )

            allocation_pct = 0.15
            region_spend = total_spend * allocation_pct
            min_savings = region_spend * min_savings_pct
            max_savings = region_spend * max_savings_pct

            advantages.append({
                'region': region,
                'driver': driver,
                'min_usd': round(min_savings, 0),
                'max_usd': round(max_savings, 0)
            })

        # Add blended total
        if advantages:
            total_min = sum(a['min_usd'] for a in advantages)
            total_max = sum(a['max_usd'] for a in advantages)
            advantages.append({
                'region': 'Blended Annual Advantage',
                'driver': 'Supplier competition + diversification benefits + logistics resilience',
                'min_usd': total_min,
                'max_usd': total_max
            })

        return advantages

    def _calculate_roi_projections(
        self,
        total_spend: float,
        cost_advantages: List[Dict[str, Any]],
        current_concentration: float,
        target_concentration: float
    ) -> Dict[str, Any]:
        """Calculate ROI projections for diversification."""
        # Sum savings excluding blended total
        total_min_savings = sum(
            a.get('min_usd', 0) for a in cost_advantages
            if 'Blended' not in a.get('region', '')
        )
        total_max_savings = sum(
            a.get('max_usd', 0) for a in cost_advantages
            if 'Blended' not in a.get('region', '')
        )

        # Implementation cost estimate (2% of total spend)
        implementation_cost = total_spend * 0.02

        # Risk reduction value
        risk_reduction_value = total_spend * (current_concentration - target_concentration) / 100 * 0.05

        # Total benefits
        total_benefit_min = total_min_savings + risk_reduction_value
        total_benefit_max = total_max_savings + risk_reduction_value

        # ROI calculations
        roi_min = ((total_benefit_min - implementation_cost) / implementation_cost) * 100 if implementation_cost > 0 else 0
        roi_max = ((total_benefit_max - implementation_cost) / implementation_cost) * 100 if implementation_cost > 0 else 0

        # Payback period
        payback_months_min = (implementation_cost / (total_benefit_max / 12)) if total_benefit_max > 0 else 0
        payback_months_max = (implementation_cost / (total_benefit_min / 12)) if total_benefit_min > 0 else 0

        return {
            'annual_cost_savings_min': total_min_savings,
            'annual_cost_savings_max': total_max_savings,
            'risk_reduction_value': risk_reduction_value,
            'implementation_cost': implementation_cost,
            'total_annual_benefit_min': total_benefit_min,
            'total_annual_benefit_max': total_benefit_max,
            'roi_percentage_min': round(roi_min, 1),
            'roi_percentage_max': round(roi_max, 1),
            'payback_period_months_min': round(payback_months_min, 1),
            'payback_period_months_max': round(payback_months_max, 1),
            'three_year_net_benefit_min': (total_benefit_min * 3) - implementation_cost,
            'three_year_net_benefit_max': (total_benefit_max * 3) - implementation_cost
        }

    def _generate_implementation_timeline(self, category: str) -> List[Dict[str, Any]]:
        """Generate implementation timeline."""
        today = datetime.now()

        return [
            {
                'phase': 'Phase 1: Supplier Qualification',
                'duration': 'Weeks 1-4',
                'start_date': today.strftime('%Y-%m-%d'),
                'end_date': (today + timedelta(weeks=4)).strftime('%Y-%m-%d'),
                'activities': [
                    'Identify and shortlist alternate suppliers',
                    'Request for Information (RFI) distribution',
                    'Initial capability assessment',
                    'Site qualification planning'
                ]
            },
            {
                'phase': 'Phase 2: Pilot Contracts',
                'duration': 'Weeks 5-12',
                'start_date': (today + timedelta(weeks=4)).strftime('%Y-%m-%d'),
                'end_date': (today + timedelta(weeks=12)).strftime('%Y-%m-%d'),
                'activities': [
                    'Negotiate pilot contract terms',
                    'Execute 8-12 week pilot allocations',
                    'Monitor quality and delivery performance',
                    'Establish baseline metrics'
                ]
            },
            {
                'phase': 'Phase 3: Performance Review',
                'duration': 'Week 13',
                'start_date': (today + timedelta(weeks=12)).strftime('%Y-%m-%d'),
                'end_date': (today + timedelta(weeks=13)).strftime('%Y-%m-%d'),
                'activities': [
                    'Quarterly performance review',
                    'Cost-benefit analysis',
                    'Risk assessment update',
                    'Go/No-Go decision for scale-up'
                ]
            },
            {
                'phase': 'Phase 4: Scale-Up',
                'duration': 'Weeks 14-26',
                'start_date': (today + timedelta(weeks=13)).strftime('%Y-%m-%d'),
                'end_date': (today + timedelta(weeks=26)).strftime('%Y-%m-%d'),
                'activities': [
                    'Gradual volume transition',
                    'Long-term contract negotiation',
                    'Continuous monitoring and optimization',
                    'Further concentration reduction if pilots succeed'
                ]
            }
        ]

    def _generate_strategic_outcomes(
        self,
        supplier_analysis: Dict[str, Any],
        supplier_reduction: Dict[str, Any],
        regional_strategy: Dict[str, Any],
        roi_projections: Dict[str, Any],
        alternate_suppliers: Dict[str, Any]
    ) -> List[str]:
        """Generate strategic outcome statements."""
        dominant_pct = supplier_analysis.get('dominant_pct', 0)
        target_pct = supplier_reduction.get('target_dominant_pct', 55)
        alternate_supplier = alternate_suppliers.get('alternate_supplier')
        corridor_name = regional_strategy.get('corridor_name', 'primary region')

        outcomes = [
            f'Reduce single-supplier concentration from {dominant_pct:.0f}% to {target_pct:.0f}% in Phase 1',
        ]

        if alternate_supplier:
            target_alternate = supplier_reduction.get('target_alternate_pct', 15)
            outcomes.append(
                f'Activate {target_alternate:.0f}% of spend via incumbent supplier ({alternate_supplier}) with multi-region presence'
            )
        else:
            outcomes.append('Activate diversified spend via new qualified suppliers')

        outcomes.extend([
            'Improve pricing leverage through supplier competition',
            f'Reduce {corridor_name.lower()} risk by ~{max(0, regional_strategy.get("original_pct", 0) - regional_strategy.get("target_max", 0)):.0f}%',
            f'Achieve estimated annual cost advantage of USD {roi_projections["annual_cost_savings_min"]:,.0f}-{roi_projections["annual_cost_savings_max"]:,.0f} while improving supply continuity'
        ])

        return outcomes

    def _generate_next_steps(
        self,
        category: str,
        alternate_suppliers: Dict[str, Any],
        regional_strategy: Dict[str, Any]
    ) -> List[str]:
        """Generate next steps."""
        alternate_supplier = alternate_suppliers.get('alternate_supplier')
        new_regions = regional_strategy.get('new_regions', [])
        cat_lower = (category or 'procurement').lower()

        if alternate_supplier:
            steps = [
                f'Activate {cat_lower} with {alternate_supplier}',
                'Initiate 8-12 week pilot allocations',
                'Benchmark pricing and delivery quarterly',
                'Continue phased reduction based on pilot performance'
            ]
        else:
            steps = [
                f'Shortlist suppliers in {", ".join(new_regions[:3]) if new_regions else "target regions"}',
                'Initiate 8-12 week pilot contracts',
                'Review pricing and delivery performance quarterly',
                'Reduce concentration further if pilots outperform'
            ]

        return steps

    def _generate_business_justification(
        self,
        current_pct: float,
        target_pct: float,
        roi_projections: Dict[str, Any],
        risk_matrix: Dict[str, Any]
    ) -> str:
        """Generate business justification with ROI reasoning."""
        reduction = current_pct - target_pct

        justification = "BUSINESS CASE JUSTIFICATION:\n\n"

        # ROI Argument
        min_savings = roi_projections.get('annual_cost_savings_min', 0)
        max_savings = roi_projections.get('annual_cost_savings_max', 0)
        impl_cost = roi_projections.get('implementation_cost', 0)
        roi_min = roi_projections.get('roi_percentage_min', 0)
        roi_max = roi_projections.get('roi_percentage_max', 0)

        justification += f"1. FINANCIAL RETURN: The proposed diversification is projected to deliver "
        justification += f"${min_savings:,.0f} to ${max_savings:,.0f} in annual cost savings, "
        justification += f"representing a {roi_min:.0f}%-{roi_max:.0f}% ROI on the estimated "
        justification += f"${impl_cost:,.0f} implementation investment.\n\n"

        # Risk Reduction Argument
        risk_level = risk_matrix.get('overall_risk', 'HIGH')
        justification += f"2. RISK MITIGATION: Current risk level is rated {risk_level}. "
        justification += f"Reducing concentration by {reduction:.0f} percentage points will "
        justification += "significantly lower supply chain vulnerability, improve business continuity, "
        justification += "and reduce exposure to single-source disruptions.\n\n"

        # Strategic Argument
        justification += "3. STRATEGIC VALUE: Beyond direct savings, diversification enables: "
        justification += "(a) Improved negotiating leverage with existing suppliers, "
        justification += "(b) Access to innovation from multiple sources, "
        justification += "(c) Flexibility to respond to demand changes, and "
        justification += "(d) Alignment with enterprise risk management policies."

        return justification

    def _generate_llm_recommendations(
        self,
        data_analysis: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        supplier_reduction: Dict[str, Any],
        regional_strategy: Dict[str, Any],
        industry_config: Dict[str, Any]
    ) -> Optional[str]:
        """Generate LLM-powered strategic recommendations."""
        if not self.enable_llm or not self.llm_engine:
            return None

        # Get RAG context
        rag_query = "strategic procurement diversification recommendations supplier management"
        rag_result = self.get_rag_context(rag_query, k=4)

        if not rag_result.get('has_strong_context', False):
            self.log("Low RAG confidence - using template recommendations", "INFO")
            return None

        supplier_analysis = data_analysis.get('supplier_analysis', {})
        risk_matrix = risk_assessment.get('risk_matrix', {})

        data_section = f"""
CURRENT STATE:
- Dominant Supplier: {supplier_analysis.get('dominant_supplier', 'Unknown')} ({supplier_analysis.get('dominant_pct', 0):.1f}%)
- Total Suppliers: {supplier_analysis.get('num_suppliers', 0)}
- Risk Level: {risk_matrix.get('overall_risk', 'HIGH')}

PROPOSED STRATEGY:
- Target Dominant Share: {supplier_reduction.get('target_dominant_pct', 55):.0f}%
- Alternate Supplier: {supplier_reduction.get('alternate_supplier', {}).get('name', 'To be identified')}
- New Regions: {', '.join(regional_strategy.get('new_regions', []))}

INDUSTRY CONTEXT:
- Low Cost Regions: {', '.join(industry_config.get('low_cost_regions', []))}
- Expected Savings Range: {industry_config.get('savings_range', (0.08, 0.18))}
"""

        task_instruction = """
Write strategic recommendations (2-3 paragraphs) that:
1. Justify the proposed diversification strategy with specific reasoning
2. Explain WHY these specific regions and suppliers are recommended
3. Reference industry best practices from the knowledge base [SOURCE-N]
4. Address potential challenges and mitigation strategies

TONE: Executive-level, strategic, actionable.
IMPORTANT: Cite sources when referencing best practices or industry benchmarks.
"""

        result = self.generate_with_llm(
            data_section=data_section,
            task_instruction=task_instruction,
            rag_query=rag_query,
            fallback_generator=None
        )

        if result.get('method') == 'llm':
            return result.get('content', '')

        return None

    def generate_target_allocation(
        self,
        total_spend: float,
        current_distribution: Dict[str, float]
    ) -> Dict[str, Dict[str, Any]]:
        """Generate diversified target allocation ensuring R001 compliance."""
        # Get top countries from current distribution
        sorted_countries = sorted(
            current_distribution.items(),
            key=lambda x: x[1],
            reverse=True
        )
        top_countries = [c[0] for c in sorted_countries[:3]]

        allocations = {}

        # Calculate reduced allocations for concentrated countries
        for country, current_pct in sorted_countries[:3]:
            if current_pct > 40:
                target_pct = min(35, current_pct * 0.65)
            else:
                target_pct = current_pct * 0.9
            allocations[country] = round(target_pct, 0)

        # Calculate remaining allocation for new regions
        allocated = sum(allocations.values())
        remaining = 100 - allocated

        # Add diversification targets
        diversification_targets = ['India', 'China', 'Mexico', 'Germany', 'USA']
        existing_countries = set(allocations.keys())

        new_country_allocation = remaining / 3
        added = 0
        for country in diversification_targets:
            if country not in existing_countries and added < 3:
                alloc = min(new_country_allocation, 35)
                if alloc > 5:
                    allocations[country] = round(alloc, 0)
                    added += 1

        # Normalize to 100%
        total_allocated = sum(allocations.values())
        if total_allocated != 100:
            adjustment = 100 - total_allocated
            first_country = list(allocations.keys())[0]
            allocations[first_country] += adjustment

        # Build result with spend calculations
        result = {}
        for country, pct in allocations.items():
            spend_usd = total_spend * (pct / 100)

            if country in current_distribution:
                original_pct = current_distribution[country]
                if pct < original_pct:
                    change = f'{abs(original_pct - pct):.0f}% lower'
                else:
                    change = f'{abs(pct - original_pct):.0f}% higher'
            else:
                change = 'New addition'

            result[country] = {
                'pct': pct,
                'spend_usd': spend_usd,
                'change': change
            }

        return result
