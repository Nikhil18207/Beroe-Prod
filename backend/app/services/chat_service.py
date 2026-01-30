"""
Chat Service - AI Chat with Context Awareness

Handles:
- Chat message processing with LLM
- Context loading (opportunities, spend data, documents)
- Panel state management for UI
- Response streaming preparation
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.services.llm_service import LLMService, LLMResponse
from app.models.conversation import Conversation, Message, MessageRole
from app.models.session import AnalysisSession
from app.models.opportunity import Opportunity
from app.models.spend_data import SpendData
from app.models.document import Document
import structlog

logger = structlog.get_logger()


class PanelState(str, Enum):
    """UI panel states that can be triggered by chat responses."""
    OPPORTUNITIES = "opportunities"
    OPPORTUNITY_DETAILS = "opportunity_details"
    PROOF_POINTS = "proof_points"
    SPEND_ANALYSIS = "spend_analysis"
    DOCUMENTS = "documents"
    SETTINGS = "settings"
    DEFAULT = "default"


@dataclass
class ChatContext:
    """Context loaded for chat conversation."""
    session_id: Optional[str] = None
    category_name: Optional[str] = None
    opportunities: List[Dict[str, Any]] = None
    spend_summary: Dict[str, Any] = None
    document_insights: Dict[str, Any] = None
    recent_messages: List[Dict[str, str]] = None

    def __post_init__(self):
        self.opportunities = self.opportunities or []
        self.spend_summary = self.spend_summary or {}
        self.document_insights = self.document_insights or {}
        self.recent_messages = self.recent_messages or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for LLM context."""
        return {
            "session_id": self.session_id,
            "category": self.category_name,
            "opportunities_count": len(self.opportunities),
            "opportunities": self.opportunities[:5],  # Top 5 only
            "spend_summary": self.spend_summary,
            "document_insights": self.document_insights
        }


@dataclass
class ChatResponse:
    """Response from chat service."""
    message_id: str
    content: str
    thinking_time: str
    panel_state_change: Optional[str]
    cards: Optional[Dict[str, Any]]
    metadata: Dict[str, Any]


class ChatService:
    """
    Service for handling AI chat conversations.

    Features:
    - Context-aware responses based on analysis session
    - Panel state management for UI navigation
    - Card generation for structured data display
    """

    # Keywords that trigger specific panel states
    PANEL_TRIGGERS = {
        PanelState.OPPORTUNITIES: [
            "opportunities", "savings", "show me opportunities",
            "what opportunities", "list opportunities", "potential savings"
        ],
        PanelState.OPPORTUNITY_DETAILS: [
            "tell me more about", "details on", "explain", "more info"
        ],
        PanelState.PROOF_POINTS: [
            "proof points", "evidence", "data points", "supporting data"
        ],
        PanelState.SPEND_ANALYSIS: [
            "spend", "spending", "analysis", "breakdown", "by supplier"
        ],
        PanelState.DOCUMENTS: [
            "documents", "contracts", "playbook", "agreement"
        ]
    }

    def __init__(self):
        """Initialize chat service."""
        self.llm_service = LLMService()

    async def process_message(
        self,
        user_message: str,
        conversation_id: Optional[str],
        session_id: Optional[str],
        user_id: str,
        db: AsyncSession
    ) -> ChatResponse:
        """
        Process a user message and generate AI response.

        Args:
            user_message: User's message content
            conversation_id: Existing conversation ID (optional)
            session_id: Analysis session ID for context
            user_id: User ID
            db: Database session

        Returns:
            ChatResponse with AI reply and metadata
        """
        start_time = datetime.now()

        # Get or create conversation
        conversation = await self._get_or_create_conversation(
            db=db,
            conversation_id=conversation_id,
            session_id=session_id,
            user_id=user_id,
            initial_message=user_message
        )

        # Load context
        context = await self._load_context(
            db=db,
            session_id=session_id,
            conversation=conversation
        )

        # Build message history
        messages = self._build_message_history(context.recent_messages, user_message)

        # Call LLM
        llm_response = await self.llm_service.chat(
            messages=messages,
            context=context.to_dict()
        )

        # Determine panel state change
        panel_state = self._determine_panel_state(user_message, llm_response.content)

        # Generate cards if relevant
        cards = await self._generate_cards(
            user_message=user_message,
            response=llm_response.content,
            context=context,
            panel_state=panel_state
        )

        # Calculate thinking time
        thinking_time = f"{(datetime.now() - start_time).total_seconds():.1f}s"

        # Save messages to database
        await self._save_messages(
            db=db,
            conversation=conversation,
            user_content=user_message,
            assistant_content=llm_response.content,
            thinking_time=thinking_time,
            panel_state=panel_state.value if panel_state else None,
            cards=cards
        )

        return ChatResponse(
            message_id=str(uuid.uuid4()),
            content=llm_response.content,
            thinking_time=thinking_time,
            panel_state_change=panel_state.value if panel_state else None,
            cards=cards,
            metadata={
                "conversation_id": str(conversation.id),
                "model_used": llm_response.model_used,
                "tokens_used": llm_response.tokens_used
            }
        )

    async def _get_or_create_conversation(
        self,
        db: AsyncSession,
        conversation_id: Optional[str],
        session_id: Optional[str],
        user_id: str,
        initial_message: str
    ) -> Conversation:
        """Get existing conversation or create new one."""

        if conversation_id:
            result = await db.execute(
                select(Conversation)
                .where(
                    Conversation.id == uuid.UUID(conversation_id),
                    Conversation.user_id == uuid.UUID(user_id)
                )
                .options(selectinload(Conversation.messages))
            )
            conversation = result.scalar_one_or_none()
            if conversation:
                return conversation

        # Create new conversation
        title = initial_message[:50] + "..." if len(initial_message) > 50 else initial_message

        conversation = Conversation(
            user_id=uuid.UUID(user_id),
            session_id=uuid.UUID(session_id) if session_id else None,
            title=title,
            messages=[]
        )
        db.add(conversation)
        await db.flush()

        return conversation

    async def _load_context(
        self,
        db: AsyncSession,
        session_id: Optional[str],
        conversation: Conversation
    ) -> ChatContext:
        """Load context for chat conversation."""

        context = ChatContext()

        # Get recent messages
        if conversation.messages:
            context.recent_messages = [
                {"role": m.role.value, "content": m.content}
                for m in sorted(conversation.messages, key=lambda x: x.created_at)[-10:]
            ]

        if not session_id:
            return context

        context.session_id = session_id

        # Load session data
        result = await db.execute(
            select(AnalysisSession)
            .where(AnalysisSession.id == uuid.UUID(session_id))
        )
        session = result.scalar_one_or_none()

        if not session:
            return context

        # Load opportunities
        opp_result = await db.execute(
            select(Opportunity)
            .where(Opportunity.session_id == uuid.UUID(session_id))
            .order_by(Opportunity.impact_score.desc())
            .limit(10)
        )
        opportunities = opp_result.scalars().all()

        context.opportunities = [
            {
                "name": opp.name,
                "type": opp.lever_theme.value if opp.lever_theme else "unknown",
                "impact": opp.impact_bucket.value if opp.impact_bucket else "unknown",
                "savings_estimate": (opp.savings_low + opp.savings_high) / 2 if opp.savings_low and opp.savings_high else 0,
                "category": opp.category_name
            }
            for opp in opportunities
        ]

        # Load spend summary
        spend_result = await db.execute(
            select(SpendData)
            .where(SpendData.session_id == uuid.UUID(session_id))
        )
        spend_records = spend_result.scalars().all()

        if spend_records:
            total_spend = sum(float(r.spend_amount or 0) for r in spend_records)
            unique_suppliers = len(set(r.supplier_name for r in spend_records if r.supplier_name))
            unique_categories = len(set(r.category for r in spend_records if r.category))

            context.spend_summary = {
                "total_spend": total_spend,
                "record_count": len(spend_records),
                "unique_suppliers": unique_suppliers,
                "unique_categories": unique_categories
            }

        # Load document insights
        doc_result = await db.execute(
            select(Document)
            .where(Document.session_id == uuid.UUID(session_id))
            .limit(5)
        )
        documents = doc_result.scalars().all()

        if documents:
            context.document_insights = {
                "document_count": len(documents),
                "document_types": list(set(d.document_type.value for d in documents if d.document_type)),
                "has_analysis": any(d.analysis_result for d in documents)
            }

        return context

    def _build_message_history(
        self,
        recent_messages: List[Dict[str, str]],
        new_message: str
    ) -> List[Dict[str, str]]:
        """Build message history for LLM."""
        messages = recent_messages.copy()
        messages.append({"role": "user", "content": new_message})
        return messages

    def _determine_panel_state(
        self,
        user_message: str,
        response: str
    ) -> Optional[PanelState]:
        """Determine if UI panel state should change."""
        message_lower = user_message.lower()

        for panel_state, triggers in self.PANEL_TRIGGERS.items():
            if any(trigger in message_lower for trigger in triggers):
                return panel_state

        return None

    async def _generate_cards(
        self,
        user_message: str,
        response: str,
        context: ChatContext,
        panel_state: Optional[PanelState]
    ) -> Optional[Dict[str, Any]]:
        """Generate structured cards for response if relevant."""

        if panel_state == PanelState.OPPORTUNITIES and context.opportunities:
            return {
                "type": "opportunities_list",
                "data": {
                    "opportunities": context.opportunities[:5],
                    "total_count": len(context.opportunities)
                }
            }

        if panel_state == PanelState.SPEND_ANALYSIS and context.spend_summary:
            return {
                "type": "spend_summary",
                "data": context.spend_summary
            }

        return None

    async def _save_messages(
        self,
        db: AsyncSession,
        conversation: Conversation,
        user_content: str,
        assistant_content: str,
        thinking_time: str,
        panel_state: Optional[str],
        cards: Optional[Dict[str, Any]]
    ):
        """Save user and assistant messages to database."""

        # User message
        user_message = Message(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=user_content
        )
        db.add(user_message)

        # Assistant message
        assistant_message = Message(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=assistant_content,
            thinking_time=thinking_time,
            panel_state_change=panel_state,
            cards=cards
        )
        db.add(assistant_message)

        # Update conversation
        conversation.last_message_at = datetime.utcnow()
        conversation.updated_at = datetime.utcnow()

        await db.commit()

    async def get_suggested_questions(
        self,
        session_id: Optional[str],
        db: AsyncSession
    ) -> List[str]:
        """Get suggested questions based on session context."""

        default_questions = [
            "What opportunities did you find in my spend data?",
            "Which categories have the highest savings potential?",
            "What are the main risks in my supply chain?",
            "Can you summarize the key findings?"
        ]

        if not session_id:
            return default_questions

        # Load opportunities to personalize questions
        result = await db.execute(
            select(Opportunity)
            .where(Opportunity.session_id == uuid.UUID(session_id))
            .order_by(Opportunity.impact_score.desc())
            .limit(3)
        )
        opportunities = result.scalars().all()

        if opportunities:
            personalized = [
                f"Tell me more about the {opportunities[0].name} opportunity",
                f"What's the action plan for {opportunities[0].category_name or 'the top opportunity'}?",
            ]
            return personalized + default_questions[:2]

        return default_questions
