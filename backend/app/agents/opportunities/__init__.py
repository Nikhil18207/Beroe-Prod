"""
Opportunities Package

Each opportunity type has its own subfolder containing:
- agent.py: The micro-agent implementation
- README.md: Documentation for the opportunity
- __init__.py: Exports

To add a new opportunity:
1. Create a new subfolder (e.g., supplier_consolidation/)
2. Create agent.py with a class extending BaseMicroAgent
3. Add proof points to proof_points.py
4. Register in this __init__.py
5. Update opportunity_orchestrator.py to include the new agent

Current Opportunities:
- volume_bundling: 8 proof points for consolidation opportunities
- target_pricing: 4 proof points for pricing optimization  
- risk_management: 7 proof points for risk mitigation
- respec_pack: 3 proof points for specification optimization
"""

from app.agents.opportunities.volume_bundling import VolumeBundlingAgent
from app.agents.opportunities.target_pricing import TargetPricingAgent
from app.agents.opportunities.risk_management import RiskManagementAgent
from app.agents.opportunities.respec_pack import RespecPackAgent

__all__ = [
    "VolumeBundlingAgent",
    "TargetPricingAgent", 
    "RiskManagementAgent",
    "RespecPackAgent",
]

AVAILABLE_OPPORTUNITIES = {
    "volume_bundling": VolumeBundlingAgent,
    "target_pricing": TargetPricingAgent,
    "risk_management": RiskManagementAgent,
}

def get_opportunity_agent(opportunity_name: str):
    """Get an opportunity agent class by name."""
    return AVAILABLE_OPPORTUNITIES.get(opportunity_name.lower().replace(" ", "_"))

def list_opportunities():
    """List all available opportunity types."""
    return list(AVAILABLE_OPPORTUNITIES.keys())
