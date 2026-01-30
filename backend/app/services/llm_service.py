"""
LLM Service - Hybrid AI Integration

Implements the hybrid LLM approach:
- OpenAI (GPT-4) for complex analysis tasks
- Local/lightweight models for simple operations

Usage:
    llm = LLMService()
    response = await llm.analyze_document(content, analysis_type)
    response = await llm.generate_insights(data)
    response = await llm.chat(messages)
"""

from typing import Dict, List, Optional, Any, Literal
from dataclasses import dataclass
from enum import Enum
import json
import asyncio
from datetime import datetime

from openai import AsyncOpenAI
from app.config import settings
import structlog

logger = structlog.get_logger()


class ModelType(str, Enum):
    """Available LLM model types."""
    OPENAI_GPT4 = "gpt-4-turbo-preview"
    OPENAI_GPT35 = "gpt-3.5-turbo"
    LOCAL_FAST = "local_fast"  # Placeholder for local model


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


class LLMService:
    """
    Hybrid LLM service for the Beroe AI Procurement Platform.

    Automatically selects between OpenAI and local models based on task complexity.
    """

    # System prompts for different tasks
    SYSTEM_PROMPTS = {
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
        """Initialize LLM service."""
        self.openai_client = None
        if settings.openai_api_key:
            self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Model configuration
        self.model_config = {
            TaskComplexity.HIGH: ModelType.OPENAI_GPT4,
            TaskComplexity.MEDIUM: ModelType.OPENAI_GPT35,
            TaskComplexity.LOW: ModelType.OPENAI_GPT35,  # Could be local model
        }

    async def analyze_document(
        self,
        document_content: str,
        document_type: Literal["contract", "playbook", "supplier_agreement", "policy", "other"],
        category: Optional[str] = None,
        extraction_focus: Optional[List[str]] = None
    ) -> LLMResponse:
        """
        Analyze a procurement document using LLM.

        Args:
            document_content: Text content of the document
            document_type: Type of procurement document
            category: Procurement category context
            extraction_focus: Specific elements to extract

        Returns:
            LLMResponse with analysis results
        """
        # Build focused prompt
        focus_str = ""
        if extraction_focus:
            focus_str = f"\n\nFocus particularly on extracting: {', '.join(extraction_focus)}"

        category_context = f"\nCategory context: {category}" if category else ""

        user_prompt = f"""Analyze this {document_type} document:{category_context}

{document_content[:15000]}  # Limit content length

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
        """
        Generate detailed insights for a procurement opportunity.

        Args:
            opportunity_data: Opportunity analysis results
            proof_points: List of proof point results
            category: Procurement category
            spend_amount: Total spend for context

        Returns:
            LLMResponse with detailed insights
        """
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
        """
        Generate an executive brief from portfolio analysis.

        Args:
            portfolio_analysis: Complete portfolio analysis results
            focus_areas: Specific areas to emphasize

        Returns:
            LLMResponse with executive brief
        """
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
        """
        Process a chat message with conversation context.

        Args:
            messages: Conversation history [{"role": "user/assistant", "content": "..."}]
            context: Additional context (spend data, opportunities, etc.)

        Returns:
            LLMResponse with assistant reply
        """
        # Add context to system prompt if provided
        system_prompt = self.SYSTEM_PROMPTS["chat"]
        if context:
            context_str = f"\n\nContext for this conversation:\n{json.dumps(context, indent=2, default=str)[:5000]}"
            system_prompt += context_str

        # Determine complexity based on last message
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
        """
        Extract structured data from text according to a schema.

        Args:
            text: Text to extract from
            schema: JSON schema for extraction

        Returns:
            LLMResponse with extracted data
        """
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
        """
        Classify text into procurement categories.

        Args:
            description: Item or spend description
            categories: List of possible categories

        Returns:
            LLMResponse with classification
        """
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
        # Simple heuristics for demo
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

    async def _call_llm(
        self,
        system_prompt: str,
        user_prompt: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        complexity: TaskComplexity = TaskComplexity.MEDIUM,
        response_format: Literal["text", "json"] = "text"
    ) -> LLMResponse:
        """
        Make a call to the LLM.

        Args:
            system_prompt: System/instruction prompt
            user_prompt: Single user prompt (if not using messages)
            messages: Conversation messages (alternative to user_prompt)
            complexity: Task complexity for model selection
            response_format: Expected response format

        Returns:
            LLMResponse
        """
        start_time = datetime.now()

        # Select model based on complexity
        model = self.model_config.get(complexity, ModelType.OPENAI_GPT35)

        # Build messages
        llm_messages = [{"role": "system", "content": system_prompt}]

        if messages:
            llm_messages.extend(messages)
        elif user_prompt:
            llm_messages.append({"role": "user", "content": user_prompt})

        # Check if we have OpenAI client
        if not self.openai_client:
            # Return simulated response for demo
            return self._simulate_response(user_prompt or messages[-1]["content"] if messages else "", start_time)

        try:
            # Call OpenAI
            response = await self.openai_client.chat.completions.create(
                model=model.value if isinstance(model, ModelType) else model,
                messages=llm_messages,
                temperature=0.7 if complexity == TaskComplexity.HIGH else 0.5,
                max_tokens=2000 if complexity == TaskComplexity.HIGH else 1000,
                response_format={"type": "json_object"} if response_format == "json" else None
            )

            content = response.choices[0].message.content
            tokens = response.usage.total_tokens if response.usage else 0

            latency = (datetime.now() - start_time).total_seconds() * 1000

            logger.info(
                "LLM call completed",
                model=model.value if isinstance(model, ModelType) else model,
                tokens=tokens,
                latency_ms=latency
            )

            return LLMResponse(
                content=content,
                model_used=model.value if isinstance(model, ModelType) else model,
                tokens_used=tokens,
                latency_ms=latency,
                metadata={"complexity": complexity.value}
            )

        except Exception as e:
            logger.error("LLM call failed", error=str(e))
            # Return simulated response as fallback
            return self._simulate_response(user_prompt or "", start_time, error=str(e))

    def _simulate_response(
        self,
        prompt: str,
        start_time: datetime,
        error: Optional[str] = None
    ) -> LLMResponse:
        """Generate simulated response for demo/testing."""
        latency = (datetime.now() - start_time).total_seconds() * 1000

        if "json" in prompt.lower() or "{" in prompt:
            # Return simulated JSON
            content = json.dumps({
                "summary": "Simulated analysis response - OpenAI API key not configured",
                "key_findings": [
                    {"finding": "Demo mode active", "significance": "Configure OPENAI_API_KEY for real analysis"}
                ],
                "recommendations": [
                    {"recommendation": "Add OpenAI API key to .env file", "priority": "high"}
                ]
            })
        else:
            content = "I'm running in demo mode without OpenAI integration. Please configure the OPENAI_API_KEY environment variable for full functionality. I can still help with basic questions about the procurement analysis system!"

        return LLMResponse(
            content=content,
            model_used="simulated",
            tokens_used=0,
            latency_ms=latency,
            metadata={
                "simulated": True,
                "error": error
            }
        )
