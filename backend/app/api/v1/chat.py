"""
Chat Endpoints
Handle chat conversations with the AI assistant (Coco).
Supports both HTTP and WebSocket connections.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid
from datetime import datetime
import json

from app.database import get_db, async_session_factory
from app.models.user import User
from app.models.conversation import Conversation, Message, MessageRole
from app.api.v1.auth import get_current_user, get_user_from_token
from app.services.chat_service import ChatService
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger()

router = APIRouter()

# Initialize chat service
chat_service = ChatService()


class ChatMessageCreate(BaseModel):
    """Create a chat message."""
    content: str = Field(..., min_length=1)
    conversation_id: Optional[uuid.UUID] = None
    session_id: Optional[uuid.UUID] = None


class ChatMessageResponse(BaseModel):
    """Chat message response."""
    id: uuid.UUID
    role: str
    content: str
    thinking_time: Optional[str] = None
    cards: Optional[dict] = None
    panel_state_change: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    """Conversation response."""
    id: uuid.UUID
    title: str
    summary: Optional[str] = None
    panel_state: Optional[str] = None
    message_count: int
    created_at: datetime
    last_message_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ChatFullResponse(BaseModel):
    """Full response including both user and assistant messages."""
    status: str
    conversation_id: str
    user_message: dict
    assistant_message: dict
    panel_state_change: Optional[str] = None
    cards: Optional[dict] = None


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100)
):
    """
    List user's recent conversations.
    """
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
        .options(selectinload(Conversation.messages))
    )
    conversations = result.scalars().all()

    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            summary=c.summary,
            panel_state=c.panel_state,
            message_count=len(c.messages) if c.messages else 0,
            created_at=c.created_at,
            last_message_at=c.last_message_at
        )
        for c in conversations
    ]


@router.post("/message", response_model=ChatFullResponse)
async def send_message(
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a message and get AI response.

    This endpoint:
    1. Loads context from the analysis session (if provided)
    2. Processes the message through the LLM
    3. Returns the AI response with any panel state changes
    """
    try:
        # Process message through chat service
        response = await chat_service.process_message(
            user_message=message_data.content,
            conversation_id=str(message_data.conversation_id) if message_data.conversation_id else None,
            session_id=str(message_data.session_id) if message_data.session_id else None,
            user_id=str(current_user.id),
            db=db
        )

        return ChatFullResponse(
            status="success",
            conversation_id=response.metadata.get("conversation_id", ""),
            user_message={
                "id": str(uuid.uuid4()),
                "role": "user",
                "content": message_data.content
            },
            assistant_message={
                "id": response.message_id,
                "role": "assistant",
                "content": response.content,
                "thinking_time": response.thinking_time
            },
            panel_state_change=response.panel_state_change,
            cards=response.cards
        )

    except Exception as e:
        logger.error("Chat message failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process message: {str(e)}"
        )


@router.get("/conversation/{conversation_id}/messages", response_model=List[ChatMessageResponse])
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all messages in a conversation.
    """
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return [
        ChatMessageResponse(
            id=m.id,
            role=m.role.value,
            content=m.content,
            thinking_time=m.thinking_time,
            cards=m.cards,
            panel_state_change=m.panel_state_change,
            created_at=m.created_at
        )
        for m in sorted(conversation.messages, key=lambda x: x.created_at)
    ]


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a conversation.
    """
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    await db.delete(conversation)
    await db.commit()

    return {"status": "success", "deleted": True, "id": str(conversation_id)}


@router.get("/suggestions")
async def get_suggested_questions(
    session_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get suggested questions based on session context.
    """
    questions = await chat_service.get_suggested_questions(
        session_id=str(session_id) if session_id else None,
        db=db
    )

    return {"suggestions": questions}


# WebSocket connection manager
class ConnectionManager:
    """Manage WebSocket connections."""

    def __init__(self):
        self.active_connections: dict = {}  # user_id -> WebSocket

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info("WebSocket connected", user_id=user_id)

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info("WebSocket disconnected", user_id=user_id)

    async def send_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)


manager = ConnectionManager()


@router.websocket("/ws/{token}")
async def websocket_chat(
    websocket: WebSocket,
    token: str
):
    """
    WebSocket endpoint for real-time chat.

    Message format (client -> server):
    {
        "type": "message",
        "content": "user message",
        "session_id": "optional-session-id",
        "conversation_id": "optional-conversation-id"
    }

    Response format (server -> client):
    {
        "type": "response" | "error" | "typing",
        "content": "...",
        "thinking_time": "1.2s",
        "panel_state_change": "opportunities",
        "cards": {...}
    }
    """
    # Authenticate user from token
    async with async_session_factory() as db:
        user = await get_user_from_token(token, db)

        if not user:
            await websocket.close(code=4001, reason="Authentication failed")
            return

        user_id = str(user.id)

    await manager.connect(websocket, user_id)

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if data.get("type") == "message":
                content = data.get("content", "")
                session_id = data.get("session_id")
                conversation_id = data.get("conversation_id")

                # Send typing indicator
                await websocket.send_json({"type": "typing", "status": "started"})

                # Process message
                async with async_session_factory() as db:
                    try:
                        response = await chat_service.process_message(
                            user_message=content,
                            conversation_id=conversation_id,
                            session_id=session_id,
                            user_id=user_id,
                            db=db
                        )

                        # Send response
                        await websocket.send_json({
                            "type": "response",
                            "conversation_id": response.metadata.get("conversation_id"),
                            "message_id": response.message_id,
                            "content": response.content,
                            "thinking_time": response.thinking_time,
                            "panel_state_change": response.panel_state_change,
                            "cards": response.cards
                        })

                    except Exception as e:
                        logger.error("WebSocket message processing failed", error=str(e))
                        await websocket.send_json({
                            "type": "error",
                            "message": str(e)
                        })

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        manager.disconnect(user_id)


@router.options("/demo-message")
async def demo_message_options():
    """
    Handle CORS preflight for demo-message endpoint.
    """
    from fastapi.responses import Response
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


@router.post("/demo-message")
async def demo_message(
    message_data: ChatMessageCreate
):
    """
    Demo chat endpoint without authentication.
    For testing purposes only.
    """
    from app.services.llm_service import LLMService

    llm = LLMService()

    # Max AI system prompt - context-aware procurement assistant
    system_prompt = """You are Max, an AI procurement assistant for the Beroe Procurement Platform.
You help users analyze procurement opportunities, validate proof points, and provide strategic recommendations.

IMPORTANT RULES:
1. When the user provides OPPORTUNITY CONTEXT, ALWAYS acknowledge the current confidence level and which proof points are validated vs missing
2. For MISSING/NOT VALIDATED proof points, ask SPECIFIC validation questions
3. When a user answers your validation questions, acknowledge their response and confirm you have the information needed
4. Be conversational and helpful, not just informational

PROOF POINTS BY OPPORTUNITY TYPE (EXACT NAMES):

VOLUME BUNDLING (8 proof points):
1. Regional Spend - Spend distribution across different geographic regions
   Validation Q: "What regions do you operate in, and how is your spend distributed across them?"
2. Tail Spend - Fragmented spend across multiple small suppliers
   Validation Q: "What percentage of your spend is with suppliers below $50K annually?"
3. Volume Leverage - Total volume that can be consolidated for negotiations
   Validation Q: "What is your total annual volume for this category across all sites?"
4. Price Variance - Price differences across suppliers for similar items
   Validation Q: "Have you noticed price differences of more than 10% for similar items across suppliers?"
5. Avg Spend/Supplier - Average spend per supplier indicating consolidation potential
   Validation Q: "How many suppliers do you currently have in this category?"
6. Market Consolidation - Market structure and consolidation opportunities
   Validation Q: "Are there 2-3 dominant suppliers in this market, or is it fragmented?"
7. Supplier Location - Geographic distribution of suppliers
   Validation Q: "Where are your main suppliers located geographically?"
8. Supplier Risk Rating - Risk assessment of current supplier base
   Validation Q: "Do you have financial health ratings or risk scores for your key suppliers?"

TARGET PRICING (4 proof points):
1. Price Variance - Price differences across suppliers and regions
   Validation Q: "What's the price range you're seeing across suppliers for the same items?"
2. Tariff Rate - Import/export tariff impacts on pricing
   Validation Q: "What tariff rates apply to your imports in this category?"
3. Cost Structure - Breakdown of cost components (raw materials, labor, logistics)
   Validation Q: "Do you have visibility into your suppliers' cost breakdown?"
4. Unit Price - Per-unit pricing analysis across suppliers
   Validation Q: "What's the unit price range for your key items?"

RISK MANAGEMENT (7 proof points):
1. Single Sourcing - Items or categories with only one supplier
   Validation Q: "Which items in this category have only one qualified supplier?"
2. Supplier Concentration - Over-reliance on specific suppliers
   Validation Q: "What percentage of spend goes to your top 3 suppliers?"
3. Category Risk - Inherent risk level of the category
   Validation Q: "What supply disruptions have you experienced in the past 2 years?"
4. Inflation - Inflation impact on category costs
   Validation Q: "What price increases have you seen year-over-year?"
5. Exchange Rate - Currency fluctuation risks
   Validation Q: "What percentage of your spend is in foreign currencies?"
6. Geo Political - Geopolitical risks affecting supply
   Validation Q: "Do any suppliers operate in regions with political instability?"
7. Supplier Risk Rating - Overall supplier risk assessment
   Validation Q: "Do you conduct regular financial health checks on your suppliers?"

RE-SPEC PACK (3 proof points):
1. Price Variance - Price differences indicating specification optimization opportunities
   Validation Q: "Are there items where different specs result in significantly different prices?"
2. Export Data - Export patterns and alternative sourcing options
   Validation Q: "Have you explored alternative sourcing from different regions?"
3. Cost Structure - Cost breakdown to identify specification-driven savings
   Validation Q: "What specifications drive the most cost in your items?"

RESPONSE GUIDELINES:
- When user provides data/answers validation questions, say "Thank you for that information! This helps validate [proof point name]."
- Always mention confidence level and what increasing it would mean for savings potential
- Be specific about WHICH proof point you're asking about
- If all proof points are validated, congratulate and suggest next steps for implementation
- Keep responses focused and actionable - max 3-4 paragraphs"""

    # Use the system prompt with the user message
    response = await llm.chat(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message_data.content}
        ]
    )

    return {
        "status": "success",
        "user_message": {
            "content": message_data.content
        },
        "assistant_message": {
            "content": response.content,
            "thinking_time": f"{response.latency_ms/1000:.1f}s"
        }
    }


# ============================================================================
# OPPORTUNITY RECOMMENDATIONS ENDPOINT
# ============================================================================

class OpportunityRecommendationsRequest(BaseModel):
    """Request for generating opportunity-specific recommendations."""
    opportunity_type: str = Field(..., description="Type: volume-bundling, target-pricing, risk-management, respec-pack")
    category_name: str = Field(..., description="Category name e.g. 'Edible Oils'")
    locations: Optional[List[str]] = Field(default=None, description="Geographic locations/regions e.g. ['Europe', 'India', 'Asia Pacific']")
    spend_data: dict = Field(default={}, description="Spend data including totalSpend and breakdown")
    supplier_data: List[dict] = Field(default=[], description="List of suppliers with name and spend")
    metrics: dict = Field(default={}, description="Computed metrics like priceVariance, top3Concentration")
    proof_points: List[dict] = Field(default=[], description="List of proof points with id, name, isValidated")
    playbook_data: Optional[dict] = Field(default=None, description="Optional playbook insights")


@router.options("/recommendations")
async def recommendations_options():
    """Handle CORS preflight for recommendations endpoint."""
    from fastapi.responses import Response
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


@router.post("/recommendations")
async def generate_recommendations(
    request: OpportunityRecommendationsRequest
):
    """
    Generate specific, data-driven recommendations for a procurement opportunity.

    This endpoint takes all the context (spend data, suppliers, metrics, proof points)
    and asks the LLM to generate very specific recommendations using actual names and numbers.
    """
    from app.services.llm_service import LLMService
    import json as json_module

    llm = LLMService()

    try:
        response = await llm.generate_opportunity_recommendations(
            opportunity_type=request.opportunity_type,
            category_name=request.category_name,
            locations=request.locations,
            spend_data=request.spend_data,
            supplier_data=request.supplier_data,
            metrics=request.metrics,
            proof_points=request.proof_points,
            playbook_data=request.playbook_data
        )

        # Parse the LLM response - could be JSON array or JSON object with Recommendations key
        try:
            parsed = json_module.loads(response.content)
            if isinstance(parsed, list):
                # Direct array format: ["rec1", "rec2", ...]
                recommendations = parsed
            elif isinstance(parsed, dict):
                # Object format: {"Recommendations": [...]} or {"recommendations": [...]}
                recommendations = (
                    parsed.get("Recommendations") or
                    parsed.get("recommendations") or
                    [response.content]
                )
            else:
                recommendations = [response.content]
        except json_module.JSONDecodeError:
            # If not valid JSON, split by newlines or use as single recommendation
            recommendations = [r.strip() for r in response.content.split('\n') if r.strip()]
            if not recommendations:
                recommendations = [response.content]

        return {
            "status": "success",
            "recommendations": recommendations,
            "model_used": response.model_used,
            "thinking_time": f"{response.latency_ms/1000:.1f}s"
        }

    except Exception as e:
        logger.error("Failed to generate recommendations", error=str(e))
        # Return fallback recommendations based on opportunity type
        fallback = {
            "volume-bundling": [
                f"Consolidate demands across sites for {request.category_name} to leverage economies of scale",
                "Negotiate volume-based discounts with your top suppliers",
                "Bundle similar sub-categories to increase negotiating leverage",
                "Set up quarterly demand aggregation reviews",
                "I will monitor market conditions and alert you on significant changes (±5% threshold)."
            ],
            "target-pricing": [
                f"Implement should-cost analysis for {request.category_name} key items",
                "Switch to index-based pricing with your top suppliers",
                "Re-negotiate pricing terms based on market benchmarks",
                "Set up automated price monitoring with ±5% threshold alerts",
                "I will monitor market conditions and alert you on significant changes."
            ],
            "risk-management": [
                f"Qualify backup suppliers for {request.category_name} to reduce concentration risk",
                "Standardize payment terms across all suppliers",
                "Develop contingency sourcing plan for high-risk regions",
                "Implement supplier risk monitoring dashboard",
                "I will monitor market conditions and alert you on significant changes (±5% threshold)."
            ],
            "respec-pack": [
                f"Analyze specification variations in {request.category_name} for standardization opportunities",
                "Review pack sizes to identify cost reduction potential",
                "Explore flexi tanks or bulk delivery options where applicable",
                "Conduct value engineering workshop with key suppliers",
                "I will monitor market conditions and alert you on significant changes (±5% threshold)."
            ]
        }
        return {
            "status": "fallback",
            "recommendations": fallback.get(request.opportunity_type, fallback["volume-bundling"]),
            "error": str(e)
        }


# ============================================================================
# LEADERSHIP BRIEF DOCX GENERATION ENDPOINT
# ============================================================================

class LeadershipBriefRequest(BaseModel):
    """Request for generating a Leadership Brief docx."""
    opportunity_id: str = Field(..., description="Opportunity type ID")
    opportunity_name: str = Field(..., description="Opportunity display name")
    category_name: str = Field(..., description="Category name e.g. 'Edible Oils'")
    locations: List[str] = Field(default=[], description="Geographic locations")
    total_spend: float = Field(default=0, description="Total spend amount")
    recommendations: List[str] = Field(default=[], description="Accepted recommendations")
    proof_points: List[dict] = Field(default=[], description="Proof points with validation status")
    suppliers: List[dict] = Field(default=[], description="Suppliers with spend data")
    metrics: dict = Field(default={}, description="Computed metrics")
    savings_estimate: str = Field(default="3-5%", description="Estimated savings percentage")


@router.options("/generate-brief")
async def generate_brief_options():
    """Handle CORS preflight for brief generation."""
    from fastapi.responses import Response
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


@router.post("/generate-brief")
async def generate_leadership_brief(request: LeadershipBriefRequest):
    """
    Generate a Leadership Brief Word document (.docx) for an accepted opportunity.
    Returns the docx file as a downloadable response.
    """
    from fastapi.responses import Response
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.style import WD_STYLE_TYPE
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    import io

    logger.info(f"Generating leadership brief for {request.opportunity_id}: {request.category_name}")

    # Create document
    doc = Document()

    # Helper function to format currency
    def format_currency(amount: float) -> str:
        if amount >= 1_000_000:
            return f"${amount / 1_000_000:.1f}M"
        elif amount >= 1_000:
            return f"${amount / 1_000:.0f}K"
        return f"${amount:.0f}"

    # Helper to set cell shading
    def set_cell_shading(cell, color: str):
        shading = OxmlElement('w:shd')
        shading.set(qn('w:fill'), color)
        cell._tc.get_or_add_tcPr().append(shading)

    # Opportunity type titles
    opp_titles = {
        "volume-bundling": "Volume Bundling",
        "target-pricing": "Target Pricing",
        "risk-management": "Risk Management",
        "respec-pack": "Re-specification Pack"
    }
    opp_title = opp_titles.get(request.opportunity_id, request.opportunity_name)

    # =========================================================================
    # TITLE SECTION
    # =========================================================================
    title = doc.add_heading(f"LEADERSHIP BRIEF", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        run.font.size = Pt(24)
        run.font.bold = True

    # Subtitle
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(f"{request.category_name}: {opp_title}")
    run.font.size = Pt(16)
    run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

    # Date
    date_para = doc.add_paragraph()
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    from datetime import datetime
    run = date_para.add_run(f"Strategic Summary for Leadership Review | {datetime.now().strftime('%B %Y')}")
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

    doc.add_paragraph()

    # =========================================================================
    # TOTAL SPEND SECTION
    # =========================================================================
    doc.add_heading("TOTAL SPEND", level=1)
    spend_para = doc.add_paragraph()
    run = spend_para.add_run(format_currency(request.total_spend))
    run.font.size = Pt(28)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x10, 0xB9, 0x81)  # Emerald color

    if request.locations:
        loc_para = doc.add_paragraph()
        run = loc_para.add_run(f"Focus Regions: {', '.join(request.locations)}")
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

    doc.add_paragraph()

    # =========================================================================
    # CURRENT STATE / METRICS SECTION
    # =========================================================================
    doc.add_heading("CURRENT STATE", level=1)

    # Metrics table
    metrics_table = doc.add_table(rows=2, cols=4)
    metrics_table.style = 'Table Grid'
    metrics_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Header row
    headers = ["Metric", "Value", "Status", "Insight"]
    for idx, header in enumerate(headers):
        cell = metrics_table.rows[0].cells[idx]
        cell.text = header
        set_cell_shading(cell, "F3F4F6")
        for para in cell.paragraphs:
            para.runs[0].font.bold = True
            para.runs[0].font.size = Pt(10)

    # Data row
    validated_count = len([pp for pp in request.proof_points if pp.get('isValidated', False)])
    total_pps = len(request.proof_points)
    confidence = (validated_count / total_pps * 100) if total_pps > 0 else 0

    metric_data = [
        ("Top 3 Concentration", f"{request.metrics.get('top3Concentration', 65):.0f}%", "High" if request.metrics.get('top3Concentration', 65) > 60 else "Medium", "Opportunity for diversification"),
        ("Price Variance", f"{request.metrics.get('priceVariance', 15):.0f}%", "Medium", "Room for standardization"),
        ("Supplier Count", f"{request.metrics.get('supplierCount', len(request.suppliers))}", "-", "Active suppliers analyzed"),
        ("Confidence", f"{confidence:.0f}%", "High" if confidence >= 70 else "Medium", f"{validated_count}/{total_pps} proof points validated")
    ]

    # Add more rows for metrics
    for metric_row in metric_data[1:]:
        metrics_table.add_row()

    for row_idx, (metric, value, stat, insight) in enumerate(metric_data):
        row = metrics_table.rows[row_idx + 1]
        row.cells[0].text = metric
        row.cells[1].text = value
        row.cells[2].text = stat
        row.cells[3].text = insight
        for cell in row.cells:
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)

    doc.add_paragraph()

    # =========================================================================
    # SUPPLIER ANALYSIS SECTION
    # =========================================================================
    doc.add_heading("SUPPLIER ANALYSIS", level=1)

    if request.suppliers:
        supplier_table = doc.add_table(rows=1, cols=3)
        supplier_table.style = 'Table Grid'

        # Header
        headers = ["Supplier", "Spend", "% of Total"]
        for idx, header in enumerate(headers):
            cell = supplier_table.rows[0].cells[idx]
            cell.text = header
            set_cell_shading(cell, "F3F4F6")
            for para in cell.paragraphs:
                para.runs[0].font.bold = True
                para.runs[0].font.size = Pt(10)

        # Data rows (top 5 suppliers)
        for supplier in request.suppliers[:5]:
            row = supplier_table.add_row()
            row.cells[0].text = supplier.get('name', 'Unknown')
            row.cells[1].text = format_currency(supplier.get('spend', 0))
            pct = (supplier.get('spend', 0) / request.total_spend * 100) if request.total_spend > 0 else 0
            row.cells[2].text = f"{pct:.1f}%"
            for cell in row.cells:
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(10)

    doc.add_paragraph()

    # =========================================================================
    # PROOF POINTS SECTION
    # =========================================================================
    doc.add_heading("PROOF POINTS VALIDATION", level=1)

    pp_table = doc.add_table(rows=1, cols=3)
    pp_table.style = 'Table Grid'

    # Header
    headers = ["Proof Point", "Status", "Impact"]
    for idx, header in enumerate(headers):
        cell = pp_table.rows[0].cells[idx]
        cell.text = header
        set_cell_shading(cell, "F3F4F6")
        for para in cell.paragraphs:
            para.runs[0].font.bold = True
            para.runs[0].font.size = Pt(10)

    # Data rows
    for pp in request.proof_points:
        row = pp_table.add_row()
        row.cells[0].text = pp.get('name', 'Unknown')
        is_validated = pp.get('isValidated', False)
        row.cells[1].text = "Validated" if is_validated else "Pending"
        row.cells[2].text = "High" if is_validated else "To be assessed"

        # Color the status cell
        if is_validated:
            set_cell_shading(row.cells[1], "D1FAE5")  # Light green
        else:
            set_cell_shading(row.cells[1], "FEF3C7")  # Light yellow

        for cell in row.cells:
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)

    doc.add_paragraph()

    # =========================================================================
    # RECOMMENDATIONS SECTION
    # =========================================================================
    doc.add_heading("ACCEPTED RECOMMENDATIONS", level=1)

    for idx, rec in enumerate(request.recommendations, 1):
        para = doc.add_paragraph()
        run = para.add_run(f"{idx}. ")
        run.font.bold = True
        run.font.size = Pt(11)
        run = para.add_run(rec)
        run.font.size = Pt(11)

    doc.add_paragraph()

    # =========================================================================
    # SAVINGS POTENTIAL SECTION
    # =========================================================================
    doc.add_heading("SAVINGS POTENTIAL", level=1)

    savings_para = doc.add_paragraph()
    run = savings_para.add_run(f"Estimated Savings: {request.savings_estimate}")
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x10, 0xB9, 0x81)

    if request.total_spend > 0:
        # Calculate estimated dollar savings (using midpoint of percentage range)
        try:
            savings_pct = request.savings_estimate.replace('%', '').strip()
            if '-' in savings_pct:
                low, high = savings_pct.split('-')
                avg_pct = (float(low) + float(high)) / 2 / 100
            else:
                avg_pct = float(savings_pct) / 100
            estimated_savings = request.total_spend * avg_pct
            savings_dollar_para = doc.add_paragraph()
            run = savings_dollar_para.add_run(f"Estimated Dollar Savings: {format_currency(estimated_savings)}")
            run.font.size = Pt(12)
            run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
        except:
            pass

    doc.add_paragraph()

    # =========================================================================
    # NEXT STEPS SECTION
    # =========================================================================
    doc.add_heading("NEXT STEPS", level=1)

    next_steps = [
        "Schedule kickoff meeting with procurement team",
        "Identify key stakeholders for implementation",
        "Develop detailed implementation timeline",
        "Set up monitoring dashboard for tracking progress",
        f"Review and update recommendations quarterly based on market conditions in {', '.join(request.locations) if request.locations else 'target regions'}"
    ]

    for step in next_steps:
        para = doc.add_paragraph()
        para.style = 'List Bullet'
        para.add_run(step).font.size = Pt(11)

    doc.add_paragraph()

    # =========================================================================
    # FOOTER
    # =========================================================================
    footer_para = doc.add_paragraph()
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer_para.add_run("Generated by Beroe Procurement Intelligence Platform")
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
    run.font.italic = True

    # Save to bytes
    file_stream = io.BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)

    # Return as downloadable file
    filename = f"{request.category_name.replace(' ', '_')}_{opp_title.replace(' ', '_')}_Leadership_Brief.docx"

    return Response(
        content=file_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
