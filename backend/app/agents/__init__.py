"""
Beroe AI Procurement Platform - Micro-Agents Module

This module implements the Micro-Agent Routing Pattern for the Dual Orchestrator system.
Each opportunity type has its own micro-agent that evaluates proof points in its specific context.

Available Agents:
- VolumeBundlingAgent: 8 proof points for consolidation opportunities
- TargetPricingAgent: 4 proof points for pricing optimization
- RiskManagementAgent: 7 proof points for risk mitigation

Key Concept: Same proof point data can be evaluated differently by different agents.
Example: "Price Variance" proof point
  - Volume Bundling context: "High variance = consolidate and standardize"
  - Target Pricing context: "High variance = use best price as negotiation target"
"""

from app.agents.base_agent import BaseMicroAgent, ProofPointResult
from app.agents.proof_points import (
    ProofPointDefinition,
    OpportunityType,
    ImpactFlag,
    PROOF_POINTS,
    OPPORTUNITY_PROOF_POINTS,
    PROOF_POINT_TO_OPPORTUNITIES,
    get_opportunity_proof_points,
    get_proof_point_opportunities,
)

# Import agents from new opportunities subfolder structure
from app.agents.opportunities import (
    VolumeBundlingAgent,
    TargetPricingAgent,
    RiskManagementAgent,
    AVAILABLE_OPPORTUNITIES,
)

__all__ = [
    # Base classes
    "BaseMicroAgent",
    "ProofPointResult",
    # Definitions
    "ProofPointDefinition",
    "OpportunityType",
    "ImpactFlag",
    "PROOF_POINTS",
    "OPPORTUNITY_PROOF_POINTS",
    "PROOF_POINT_TO_OPPORTUNITIES",
    # Helper functions
    "get_opportunity_proof_points",
    "get_proof_point_opportunities",
    # Agents
    "VolumeBundlingAgent",
    "TargetPricingAgent",
    "RiskManagementAgent",
    # Agent Registry
    "AVAILABLE_OPPORTUNITIES",
]
