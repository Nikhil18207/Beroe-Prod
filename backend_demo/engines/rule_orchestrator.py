"""
Smart Rule Orchestrator - Resolves Rule Conflicts
Ensures that fixing one rule doesn't break another

Features:
- Priority-based conflict resolution
- Dependency matrix management
- Action plan generation
"""

import sys
import logging
from pathlib import Path
from typing import Dict, Any, List
import pandas as pd

# Configure logger
logger = logging.getLogger(__name__)

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))


class RuleOrchestrator:
    """
    Orchestrates rule evaluation to prevent conflicts
    Applies priority-based resolution when rules conflict
    """
    
    def __init__(self):
        self.dependency_matrix = self._load_dependency_matrix()
        self.rule_priorities = self._define_rule_priorities()
        
    def _load_dependency_matrix(self) -> pd.DataFrame:
        """Load rule dependency matrix"""
        matrix_path = Path(__file__).parent.parent.parent / 'data' / 'structured' / 'rule_dependency_matrix.csv'
        if matrix_path.exists():
            return pd.read_csv(matrix_path)
        return pd.DataFrame()
    
    def _define_rule_priorities(self) -> Dict[str, int]:
        """
        Define rule priorities (1 = highest priority)
        Critical business rules take precedence
        """
        return {
            # TIER 1: Critical Risk & Compliance (Priority 1-5)
            'R024': 1,  # Geopolitical Risk - HIGHEST PRIORITY
            'R010': 2,  # Supplier Financial Risk
            'R001': 3,  # Regional Concentration
            'R003': 4,  # Single Supplier Dependency
            'R029': 5,  # Backup Supplier Availability
            
            # TIER 2: High Risk & ESG (Priority 6-15)
            'R005': 6,  # ESG Compliance
            'R017': 7,  # Local Content Requirement
            'R011': 8,  # Capacity Utilization Risk
            'R004': 9,  # Contract Expiry Warning
            'R007': 10, # Quality Rejection Rate
            'R008': 11, # Delivery Performance
            'R018': 12, # Supplier Qualification Gap
            'R025': 13, # Cybersecurity Rating
            'R026': 14, # Certification Compliance
            'R032': 15, # Ethical Sourcing
            
            # TIER 3: Medium Risk & Optimization (Priority 16-25)
            'R023': 16, # Supplier Concentration Index (HHI)
            'R014': 17, # Currency Exposure
            'R022': 18, # Inventory Turnover
            'R034': 19, # Long-term Contract Coverage
            'R035': 20, # Supplier Performance Score
            'R006': 21, # Price Variance Alert
            'R019': 22, # Price Benchmark Deviation
            'R012': 23, # Minimum Order Quantity
            'R013': 24, # Lead Time Variance
            'R021': 25, # Contract Compliance Rate
            
            # TIER 4: Low Risk & Strategic (Priority 26-34)
            'R009': 26, # Payment Terms Optimization
            'R027': 27, # Audit Frequency
            'R028': 28, # Price Escalation Clause
            'R031': 29, # Carbon Footprint
            'R002': 30, # Tail Spend Fragmentation
            'R015': 31, # Diverse Supplier Spend
            'R030': 32, # Innovation Score
            'R016': 33, # Innovation Supplier Ratio
            'R020': 34, # Supplier Responsiveness
        }
    
    def get_conflicting_rules(self, rule_id: str) -> List[Dict[str, Any]]:
        """
        Get all rules that conflict with the given rule
        
        Args:
            rule_id: Rule ID to check conflicts for
            
        Returns:
            List of conflicting rules with resolution strategies
        """
        if self.dependency_matrix.empty:
            return []
        
        conflicts = self.dependency_matrix[self.dependency_matrix['Rule_ID'] == rule_id]
        
        result = []
        for _, conflict in conflicts.iterrows():
            conflicting_ids = str(conflict['Conflicts_With']).split('|')
            for conf_id in conflicting_ids:
                result.append({
                    'rule_id': rule_id,
                    'conflicts_with': conf_id.strip(),
                    'conflict_type': conflict['Conflict_Type'],
                    'resolution_strategy': conflict['Resolution_Strategy'],
                    'priority_order': conflict['Priority_Order']
                })
        
        return result
    
    def resolve_conflicts(self, violations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze violations and provide conflict-aware recommendations
        
        Args:
            violations: List of rule violations
            
        Returns:
            Dictionary with prioritized actions and conflict warnings
        """
        if not violations:
            return {
                'prioritized_actions': [],
                'conflict_warnings': [],
                'resolution_plan': []
            }
        
        # Sort violations by priority
        sorted_violations = sorted(
            violations,
            key=lambda x: self.rule_priorities.get(x['rule_id'], 999)
        )
        
        conflict_warnings = []
        resolution_plan = []
        processed_rules = set()
        
        for violation in sorted_violations:
            rule_id = violation['rule_id']
            
            if rule_id in processed_rules:
                continue
            
            # Check for conflicts
            conflicts = self.get_conflicting_rules(rule_id)
            
            # Check if any conflicting rules are also violated
            conflicting_violations = [
                v for v in sorted_violations 
                if v['rule_id'] in [c['conflicts_with'] for c in conflicts]
            ]
            
            if conflicting_violations:
                # Generate conflict warning
                for conf_violation in conflicting_violations:
                    conf_rule_id = conf_violation['rule_id']
                    conflict_info = next(
                        (c for c in conflicts if c['conflicts_with'] == conf_rule_id),
                        None
                    )
                    
                    if conflict_info:
                        warning = {
                            'primary_rule': rule_id,
                            'conflicting_rule': conf_rule_id,
                            'conflict_type': conflict_info['conflict_type'],
                            'resolution_strategy': conflict_info['resolution_strategy'],
                            'priority_order': conflict_info['priority_order']
                        }
                        conflict_warnings.append(warning)
                        
                        # Add to resolution plan
                        resolution_plan.append({
                            'step': len(resolution_plan) + 1,
                            'action': f"Resolve {rule_id} and {conf_rule_id} together",
                            'strategy': conflict_info['resolution_strategy'],
                            'rules_affected': [rule_id, conf_rule_id]
                        })
                        
                        # Mark both as processed
                        processed_rules.add(rule_id)
                        processed_rules.add(conf_rule_id)
            else:
                # No conflicts - add standalone action
                resolution_plan.append({
                    'step': len(resolution_plan) + 1,
                    'action': f"Resolve {rule_id}",
                    'strategy': violation.get('action_required', 'Address violation'),
                    'rules_affected': [rule_id]
                })
                processed_rules.add(rule_id)
        
        return {
            'prioritized_actions': sorted_violations,
            'conflict_warnings': conflict_warnings,
            'resolution_plan': resolution_plan,
            'total_conflicts': len(conflict_warnings)
        }
    
    def generate_action_plan(self, violations: List[Dict[str, Any]]) -> str:
        """
        Generate a human-readable action plan that resolves conflicts
        
        Args:
            violations: List of rule violations
            
        Returns:
            Formatted action plan string
        """
        resolution = self.resolve_conflicts(violations)
        
        if not resolution['resolution_plan']:
            return "✅ No violations detected. All rules compliant."
        
        plan = []
        plan.append("=" * 80)
        plan.append("CONFLICT-AWARE ACTION PLAN")
        plan.append("=" * 80)
        plan.append("")
        
        if resolution['conflict_warnings']:
            plan.append(f"⚠️  CONFLICTS DETECTED: {resolution['total_conflicts']}")
            plan.append("")
            plan.append("CONFLICTING RULES:")
            for warning in resolution['conflict_warnings']:
                plan.append(f"  • {warning['primary_rule']} ↔ {warning['conflicting_rule']}")
                plan.append(f"    Type: {warning['conflict_type']}")
                plan.append(f"    Strategy: {warning['resolution_strategy']}")
                plan.append("")
        
        plan.append("PRIORITIZED RESOLUTION STEPS:")
        plan.append("")
        
        for step in resolution['resolution_plan']:
            plan.append(f"Step {step['step']}: {step['action']}")
            plan.append(f"  Strategy: {step['strategy']}")
            plan.append(f"  Affects: {', '.join(step['rules_affected'])}")
            plan.append("")
        
        plan.append("=" * 80)
        
        return "\n".join(plan)


# Example usage
if __name__ == "__main__":
    orchestrator = RuleOrchestrator()
    
    # Simulate violations
    test_violations = [
        {
            'rule_id': 'R001',
            'rule_name': 'Regional Concentration',
            'status': 'VIOLATION',
            'action_required': 'Diversify sourcing across 3-4 regions'
        },
        {
            'rule_id': 'R003',
            'rule_name': 'Single Supplier Dependency',
            'status': 'VIOLATION',
            'action_required': 'Qualify 2-3 alternative suppliers'
        },
        {
            'rule_id': 'R014',
            'rule_name': 'Currency Exposure',
            'status': 'VIOLATION',
            'action_required': 'Implement currency hedging'
        },
        {
            'rule_id': 'R009',
            'rule_name': 'Payment Terms Optimization',
            'status': 'VIOLATION',
            'action_required': 'Negotiate extended payment terms'
        }
    ]
    
    print(orchestrator.generate_action_plan(test_violations))
