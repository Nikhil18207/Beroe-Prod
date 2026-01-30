"""
Risk Assessment Agent - Risk evaluation and compliance checking

Responsibilities:
- Evaluate procurement rules from rule book
- Calculate risk matrix (supply, geographic, diversity)
- Generate risk scores and severity levels
- Provide rule violation details with actions
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from backend.agents.base_agent import BaseAgent


class RiskAssessmentAgent(BaseAgent):
    """
    Agent for assessing procurement risks and rule compliance.

    Key capabilities:
    - Rule violation detection
    - Risk matrix calculation
    - Risk scoring and categorization
    - LLM-powered risk analysis narrative
    """

    @property
    def agent_name(self) -> str:
        return "RiskAssessmentAgent"

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute risk assessment.

        Args:
            context: Dictionary containing:
                - data_analysis: Output from DataAnalysisAgent
                - rule_engine: RuleEvaluationEngine instance
                - client_id: Client identifier
                - category: Category being analyzed

        Returns:
            Dictionary with risk assessment results
        """
        data_analysis = context.get('data_analysis', {})
        rule_engine = context.get('rule_engine')
        client_id = context.get('client_id')
        category = context.get('category')

        if not data_analysis.get('success', False):
            return {
                'success': False,
                'error': 'No valid data analysis provided',
                'risk_matrix': {},
                'violations': []
            }

        try:
            # Extract key metrics from data analysis
            supplier_analysis = data_analysis.get('supplier_analysis', {})
            regional_analysis = data_analysis.get('regional_analysis', {})

            # Calculate risk matrix
            risk_matrix = self._calculate_risk_matrix(
                supplier_concentration=supplier_analysis.get('dominant_pct', 0),
                regional_concentration=regional_analysis.get('dominant_country_pct', 0),
                num_suppliers=supplier_analysis.get('num_suppliers', 0)
            )

            # Evaluate rules if engine provided
            rule_evaluation = {}
            if rule_engine and client_id:
                rule_evaluation = self._evaluate_rules(rule_engine, client_id, category)

            # Generate risk reasoning
            risk_reasoning = self._generate_risk_reasoning(
                num_suppliers=supplier_analysis.get('num_suppliers', 0),
                supplier_concentration=supplier_analysis.get('dominant_pct', 0),
                regional_concentration=regional_analysis.get('dominant_country_pct', 0),
                countries=regional_analysis.get('all_countries', [])
            )

            # Generate key risk statement
            key_risk = self._generate_key_risk_statement(
                num_suppliers=supplier_analysis.get('num_suppliers', 0),
                dominant_pct=supplier_analysis.get('dominant_pct', 0),
                regions=supplier_analysis.get('dominant_regions', [])
            )

            # LLM-powered risk analysis if enabled
            ai_risk_analysis = None
            if self.enable_llm:
                ai_risk_analysis = self._generate_llm_risk_analysis(
                    data_analysis, risk_matrix, rule_evaluation
                )

            return {
                'success': True,
                'risk_matrix': risk_matrix,
                'rule_evaluation': rule_evaluation,
                'risk_reasoning': risk_reasoning,
                'key_risk': key_risk,
                'ai_risk_analysis': ai_risk_analysis or risk_reasoning,
                'llm_enabled': self.enable_llm and ai_risk_analysis is not None
            }

        except Exception as e:
            self.log(f"Risk assessment failed: {e}", "ERROR")
            return {
                'success': False,
                'error': str(e),
                'risk_matrix': {},
                'violations': []
            }

    def _calculate_risk_matrix(
        self,
        supplier_concentration: float,
        regional_concentration: float,
        num_suppliers: int
    ) -> Dict[str, Any]:
        """Calculate comprehensive risk matrix."""
        # Supply chain risk based on supplier concentration
        if supplier_concentration > 80:
            supply_risk = 'CRITICAL'
        elif supplier_concentration > 60:
            supply_risk = 'HIGH'
        elif supplier_concentration > 40:
            supply_risk = 'MEDIUM'
        else:
            supply_risk = 'LOW'

        # Geographic risk based on regional concentration
        if regional_concentration > 70:
            geographic_risk = 'CRITICAL'
        elif regional_concentration > 50:
            geographic_risk = 'HIGH'
        elif regional_concentration > 40:
            geographic_risk = 'MEDIUM'
        else:
            geographic_risk = 'LOW'

        # Supplier diversity risk based on count
        if num_suppliers == 1:
            supplier_diversity_risk = 'CRITICAL'
        elif num_suppliers <= 2:
            supplier_diversity_risk = 'HIGH'
        elif num_suppliers <= 4:
            supplier_diversity_risk = 'MEDIUM'
        else:
            supplier_diversity_risk = 'LOW'

        # Calculate overall risk score
        risk_scores = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
        overall_score = (
            risk_scores[supply_risk] +
            risk_scores[geographic_risk] +
            risk_scores[supplier_diversity_risk]
        ) / 3

        if overall_score >= 3.5:
            overall_risk = 'CRITICAL'
        elif overall_score >= 2.5:
            overall_risk = 'HIGH'
        elif overall_score >= 1.5:
            overall_risk = 'MEDIUM'
        else:
            overall_risk = 'LOW'

        return {
            'supply_chain_risk': supply_risk,
            'geographic_risk': geographic_risk,
            'supplier_diversity_risk': supplier_diversity_risk,
            'overall_risk': overall_risk,
            'risk_score': round(overall_score, 1),
            'risk_breakdown': {
                'supply_chain': {
                    'level': supply_risk,
                    'score': risk_scores[supply_risk],
                    'metric': f'{supplier_concentration:.0f}% supplier concentration'
                },
                'geographic': {
                    'level': geographic_risk,
                    'score': risk_scores[geographic_risk],
                    'metric': f'{regional_concentration:.0f}% regional concentration'
                },
                'diversity': {
                    'level': supplier_diversity_risk,
                    'score': risk_scores[supplier_diversity_risk],
                    'metric': f'{num_suppliers} active suppliers'
                }
            }
        }

    def _evaluate_rules(
        self,
        rule_engine,
        client_id: str,
        category: str
    ) -> Dict[str, Any]:
        """Evaluate procurement rules and return violations/warnings."""
        try:
            results = rule_engine.evaluate_all_rules(client_id, category)

            if not results.get('success', False):
                return {
                    'violations': [],
                    'warnings': [],
                    'compliant': [],
                    'total_violations': 0,
                    'total_warnings': 0,
                    'compliance_rate': 0,
                    'error': results.get('error', 'Unknown error')
                }

            violations = results.get('violations', [])
            warnings = results.get('warnings', [])
            compliant = results.get('compliant', [])

            total_rules = len(violations) + len(warnings) + len(compliant)
            compliance_rate = round(len(compliant) / max(total_rules, 1) * 100, 1)

            return {
                'violations': violations,
                'warnings': warnings,
                'compliant': compliant,
                'total_violations': len(violations),
                'total_warnings': len(warnings),
                'total_compliant': len(compliant),
                'total_rules': total_rules,
                'compliance_rate': compliance_rate,
                'overall_status': results.get('summary', {}).get('overall_status', 'UNKNOWN')
            }
        except Exception as e:
            return {
                'violations': [],
                'warnings': [],
                'compliant': [],
                'total_violations': 0,
                'total_warnings': 0,
                'compliance_rate': 0,
                'error': str(e)
            }

    def _generate_risk_reasoning(
        self,
        num_suppliers: int,
        supplier_concentration: float,
        regional_concentration: float,
        countries: List[str]
    ) -> str:
        """Generate detailed risk reasoning."""
        reasoning = "RISK ANALYSIS:\n\n"

        # Supplier Risk
        if supplier_concentration > 80:
            reasoning += f"SUPPLIER RISK (CRITICAL): At {supplier_concentration:.0f}% concentration, "
            reasoning += "a single supplier controls the vast majority of supply. "
            reasoning += "Industry best practice recommends no single supplier exceeds 30%. "
            reasoning += f"Current state exceeds this threshold by {supplier_concentration / 30:.1f}x.\n\n"
        elif supplier_concentration > 60:
            reasoning += f"SUPPLIER RISK (HIGH): At {supplier_concentration:.0f}% concentration, "
            reasoning += "the dominant supplier has excessive market power. "
            reasoning += "This limits negotiating leverage and creates dependency.\n\n"
        else:
            reasoning += f"SUPPLIER RISK (MODERATE): At {supplier_concentration:.0f}% concentration, "
            reasoning += "there is opportunity to further balance the supplier portfolio.\n\n"

        # Geographic Risk
        if regional_concentration > 50:
            countries_str = ', '.join(countries[:3]) if countries else 'a single region'
            reasoning += f"GEOGRAPHIC RISK (HIGH): {regional_concentration:.0f}% of spend is concentrated in {countries_str}. "
            reasoning += "This exposes the supply chain to regional disruptions including: "
            reasoning += "natural disasters, political instability, trade policy changes, "
            reasoning += "and logistics bottlenecks.\n\n"

        # Diversity Risk
        if num_suppliers <= 2:
            reasoning += f"DIVERSITY RISK (CRITICAL): Only {num_suppliers} supplier(s) active. "
            reasoning += "Limited supplier pool means no fallback options during disruptions "
            reasoning += "and insufficient competition to drive optimal pricing."

        return reasoning

    def _generate_key_risk_statement(
        self,
        num_suppliers: int,
        dominant_pct: float,
        regions: List[str]
    ) -> str:
        """Generate concise key risk statement."""
        region_str = regions[0] if regions else 'regional'

        if num_suppliers == 1:
            return f"Extreme single-supplier lock-in and {region_str} supply corridor dependency"
        elif dominant_pct > 80:
            return f"Critical supplier concentration ({dominant_pct:.0f}%) and {region_str} supply corridor dependency"
        elif dominant_pct > 60:
            return f"High supplier concentration ({dominant_pct:.0f}%) and {region_str} supply corridor dependency"
        else:
            return f"Moderate concentration in {region_str} with {num_suppliers} suppliers"

    def _generate_llm_risk_analysis(
        self,
        data_analysis: Dict[str, Any],
        risk_matrix: Dict[str, Any],
        rule_evaluation: Dict[str, Any]
    ) -> Optional[str]:
        """Generate LLM-powered risk analysis narrative."""
        if not self.enable_llm or not self.llm_engine:
            return None

        # Get RAG context for risk analysis
        rag_query = "supply chain risk assessment procurement concentration analysis"
        rag_result = self.get_rag_context(rag_query, k=4)

        if not rag_result.get('has_strong_context', False):
            self.log("Low RAG confidence - using template risk analysis", "INFO")
            return None

        # Build data section
        supplier_analysis = data_analysis.get('supplier_analysis', {})
        regional_analysis = data_analysis.get('regional_analysis', {})

        data_section = f"""
SUPPLIER CONCENTRATION:
- Dominant Supplier: {supplier_analysis.get('dominant_supplier', 'Unknown')}
- Concentration: {supplier_analysis.get('dominant_pct', 0):.1f}%
- Total Suppliers: {supplier_analysis.get('num_suppliers', 0)}

REGIONAL CONCENTRATION:
- Dominant Region: {regional_analysis.get('dominant_country', 'Unknown')}
- Concentration: {regional_analysis.get('dominant_country_pct', 0):.1f}%

RISK MATRIX:
- Supply Chain Risk: {risk_matrix.get('supply_chain_risk', 'UNKNOWN')}
- Geographic Risk: {risk_matrix.get('geographic_risk', 'UNKNOWN')}
- Overall Risk Level: {risk_matrix.get('overall_risk', 'UNKNOWN')}
- Risk Score: {risk_matrix.get('risk_score', 0)}/4.0

RULE COMPLIANCE:
- Violations: {rule_evaluation.get('total_violations', 0)}
- Warnings: {rule_evaluation.get('total_warnings', 0)}
- Compliance Rate: {rule_evaluation.get('compliance_rate', 0):.1f}%
"""

        task_instruction = """
Write a risk analysis narrative (2-3 paragraphs) that:
1. Identifies the most critical risks based on the data
2. Explains the business impact of these risks
3. References relevant risk management best practices from the knowledge base [SOURCE-N]
4. Prioritizes risks that need immediate attention

TONE: Professional, analytical, action-oriented.
IMPORTANT: Cite sources when referencing risk thresholds or best practices.
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

    def calculate_business_impact(
        self,
        total_spend: float,
        risk_matrix: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate potential business impact of identified risks."""
        overall_risk = risk_matrix.get('overall_risk', 'MEDIUM')

        # Impact percentages based on risk level
        impact_rates = {
            'CRITICAL': {'disruption_probability': 0.25, 'cost_impact': 0.15, 'delay_days': 45},
            'HIGH': {'disruption_probability': 0.15, 'cost_impact': 0.10, 'delay_days': 30},
            'MEDIUM': {'disruption_probability': 0.08, 'cost_impact': 0.05, 'delay_days': 14},
            'LOW': {'disruption_probability': 0.03, 'cost_impact': 0.02, 'delay_days': 7}
        }

        rates = impact_rates.get(overall_risk, impact_rates['MEDIUM'])

        potential_disruption_cost = total_spend * rates['disruption_probability'] * rates['cost_impact']
        annual_risk_exposure = total_spend * rates['disruption_probability']

        return {
            'overall_risk_level': overall_risk,
            'disruption_probability_annual': f"{rates['disruption_probability'] * 100:.0f}%",
            'potential_disruption_cost': potential_disruption_cost,
            'annual_risk_exposure': annual_risk_exposure,
            'estimated_delay_days': rates['delay_days'],
            'recommendation': self._get_risk_recommendation(overall_risk)
        }

    def _get_risk_recommendation(self, risk_level: str) -> str:
        """Get risk-level-specific recommendation."""
        recommendations = {
            'CRITICAL': 'Immediate action required. Initiate diversification within 30 days.',
            'HIGH': 'Prioritize diversification. Begin supplier qualification within 60 days.',
            'MEDIUM': 'Plan diversification. Include in next quarterly procurement review.',
            'LOW': 'Monitor quarterly. Current risk levels acceptable but optimization possible.'
        }
        return recommendations.get(risk_level, recommendations['MEDIUM'])
