"""
FastAPI Worker Server

Handles Playwright automation for Bilibili, Reddit, and future sites.
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.bilibili import BilibiliService
from services.persona import extract_persona, update_persona_from_signals
from services.reddit import RedditService
from services.youtube import YouTubeService
from agent.core import RecommendationAgent
from agent.schemas import AgentRecommendationRequest, AgentRecommendationResponse


# Service instances
bilibili_service: Optional[BilibiliService] = None
reddit_service: Optional[RedditService] = None
youtube_service: Optional[YouTubeService] = None
recommendation_agent: Optional[RecommendationAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global bilibili_service, reddit_service, youtube_service, recommendation_agent
    bilibili_service = BilibiliService()
    reddit_service = RedditService()
    youtube_service = YouTubeService()
    recommendation_agent = RecommendationAgent(bilibili_service, youtube_service, reddit_service)
    yield
    # Shutdown
    if bilibili_service:
        await bilibili_service.shutdown()
    if reddit_service:
        await reddit_service.shutdown()
    if youtube_service:
        await youtube_service.shutdown()


app = FastAPI(
    title="Daily Recommend Worker",
    description="Playwright worker for video platform integrations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class StartLoginRequest(BaseModel):
    user_id: str


class StartLoginResponse(BaseModel):
    session_id: str
    qr_url: str
    qr_image_base64: Optional[str] = None


class LoginStatusResponse(BaseModel):
    status: str
    username: Optional[str] = None
    user_id: Optional[str] = None
    auth_state: Optional[str] = None
    error: Optional[str] = None


class ValidateAuthRequest(BaseModel):
    auth_state: str


class ValidateAuthResponse(BaseModel):
    valid: bool


class RecommendationsRequest(BaseModel):
    auth_state: str
    count: int = 10
    include_general: bool = True
    persona: Optional[str] = None
    # Cached data from DB - used when auth expires
    cached_history: Optional[str] = None  # JSON array
    cached_channels: Optional[str] = None  # JSON array


class KeywordSearchRequest(BaseModel):
    keywords: str
    persona: Optional[str] = None
    count: int = 10


class VideoRecommendationResponse(BaseModel):
    video_id: str
    title: str
    author: str
    author_id: str
    cover_url: str
    duration: int
    view_count: int
    url: str
    reason: str
    source: str


class RecommendationsResponse(BaseModel):
    recommendations: list[VideoRecommendationResponse]
    viewing_analysis: Optional[str] = None
    # Cache updates - store these in DB
    updated_history: Optional[str] = None  # JSON array - only if freshly fetched
    updated_channels: Optional[str] = None  # JSON array - only if freshly fetched
    needs_reauth: bool = False  # True if auth expired, prompt user to reconnect


# Reddit-specific response models
class PostRecommendationResponse(BaseModel):
    post_id: str
    title: str
    author: str
    subreddit: str
    content_preview: str
    thumbnail_url: Optional[str] = None
    score: int
    comment_count: int
    url: str
    permalink: str
    reason: str
    source: str
    post_type: str


class RedditRecommendationsResponse(BaseModel):
    recommendations: list[PostRecommendationResponse]


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Bilibili endpoints
@app.post("/bilibili/connect", response_model=StartLoginResponse)
async def bilibili_start_login(request: StartLoginRequest):
    """Start QR code login for Bilibili."""
    try:
        result = await bilibili_service.start_qr_login(request.user_id)
        return StartLoginResponse(
            session_id=result.session_id,
            qr_url=result.qr_url,
            qr_image_base64=result.qr_image_base64,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bilibili/status/{session_id}", response_model=LoginStatusResponse)
async def bilibili_check_status(session_id: str):
    """Check login status for a session."""
    try:
        result = await bilibili_service.check_login_status(session_id)
        return LoginStatusResponse(
            status=result.status,
            username=result.username,
            user_id=result.user_id,
            auth_state=result.auth_state,
            error=result.error,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/bilibili/session/{session_id}")
async def bilibili_cleanup_session(session_id: str):
    """Clean up a login session."""
    try:
        await bilibili_service.cleanup_session(session_id)
        return {"status": "cleaned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/bilibili/validate", response_model=ValidateAuthResponse)
async def bilibili_validate_auth(request: ValidateAuthRequest):
    """Validate if auth state is still valid."""
    try:
        valid = await bilibili_service.validate_auth(request.auth_state)
        return ValidateAuthResponse(valid=valid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/bilibili/recommendations", response_model=RecommendationsResponse)
async def bilibili_get_recommendations(request: RecommendationsRequest):
    """Get video recommendations."""
    try:
        result = await bilibili_service.get_recommendations(
            auth_state=request.auth_state,
            count=request.count,
            include_general=request.include_general,
            persona=request.persona,
            cached_history=request.cached_history,
            cached_channels=request.cached_channels,
        )
        return RecommendationsResponse(
            recommendations=[
                VideoRecommendationResponse(
                    video_id=r.video_id,
                    title=r.title,
                    author=r.author,
                    author_id=r.author_id,
                    cover_url=r.cover_url,
                    duration=r.duration,
                    view_count=r.view_count,
                    url=r.url,
                    reason=r.reason,
                    source=r.source,
                )
                for r in result["recommendations"]
            ],
            viewing_analysis=result.get("viewing_analysis"),
            updated_history=result.get("updated_history"),
            updated_channels=result.get("updated_channels"),
            needs_reauth=result.get("needs_reauth", False),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Reddit endpoints
@app.post("/reddit/connect", response_model=StartLoginResponse)
async def reddit_start_login(request: StartLoginRequest):
    """Start login for Reddit."""
    try:
        result = await reddit_service.start_qr_login(request.user_id)
        return StartLoginResponse(
            session_id=result.session_id,
            qr_url=result.qr_url,
            qr_image_base64=result.qr_image_base64,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reddit/status/{session_id}", response_model=LoginStatusResponse)
async def reddit_check_status(session_id: str):
    """Check login status for a session."""
    try:
        result = await reddit_service.check_login_status(session_id)
        return LoginStatusResponse(
            status=result.status,
            username=result.username,
            user_id=result.user_id,
            auth_state=result.auth_state,
            error=result.error,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/reddit/session/{session_id}")
async def reddit_cleanup_session(session_id: str):
    """Clean up a login session."""
    try:
        await reddit_service.cleanup_session(session_id)
        return {"status": "cleaned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reddit/validate", response_model=ValidateAuthResponse)
async def reddit_validate_auth(request: ValidateAuthRequest):
    """Validate if auth state is still valid."""
    try:
        valid = await reddit_service.validate_auth(request.auth_state)
        return ValidateAuthResponse(valid=valid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reddit/recommendations", response_model=RedditRecommendationsResponse)
async def reddit_get_recommendations(request: RecommendationsRequest):
    """Get post recommendations. 70% from subscribed subreddits, 30% exploration."""
    try:
        recs = await reddit_service.get_recommendations(
            auth_state=request.auth_state,
            count=request.count,
            include_general=request.include_general,
        )
        return RedditRecommendationsResponse(
            recommendations=[
                PostRecommendationResponse(
                    post_id=r.post_id,
                    title=r.title,
                    author=r.author,
                    subreddit=r.subreddit,
                    content_preview=r.content_preview,
                    thumbnail_url=r.thumbnail_url,
                    score=r.score,
                    comment_count=r.comment_count,
                    url=r.url,
                    permalink=r.permalink,
                    reason=r.reason,
                    source=r.source,
                    post_type=r.post_type,
                )
                for r in recs
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reddit/recommendations/keywords", response_model=RedditRecommendationsResponse)
async def reddit_keyword_recommendations(request: KeywordSearchRequest):
    """Get post recommendations based on keywords and persona (no auth required)."""
    try:
        recs = await reddit_service.get_keyword_recommendations(
            keywords=request.keywords,
            persona=request.persona,
            count=request.count,
        )
        return RedditRecommendationsResponse(
            recommendations=[
                PostRecommendationResponse(
                    post_id=r.post_id,
                    title=r.title,
                    author=r.author,
                    subreddit=r.subreddit,
                    content_preview=r.content_preview,
                    thumbnail_url=r.thumbnail_url,
                    score=r.score,
                    comment_count=r.comment_count,
                    url=r.url,
                    permalink=r.permalink,
                    reason=r.reason,
                    source=r.source,
                    post_type=r.post_type,
                )
                for r in recs
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# YouTube endpoints
@app.post("/youtube/connect", response_model=StartLoginResponse)
async def youtube_start_login(request: StartLoginRequest):
    """Start login for YouTube (Google account)."""
    try:
        result = await youtube_service.start_qr_login(request.user_id)
        return StartLoginResponse(
            session_id=result.session_id,
            qr_url=result.qr_url,
            qr_image_base64=result.qr_image_base64,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/youtube/status/{session_id}", response_model=LoginStatusResponse)
async def youtube_check_status(session_id: str):
    """Check login status for a session."""
    try:
        result = await youtube_service.check_login_status(session_id)
        return LoginStatusResponse(
            status=result.status,
            username=result.username,
            user_id=result.user_id,
            auth_state=result.auth_state,
            error=result.error,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/youtube/session/{session_id}")
async def youtube_cleanup_session(session_id: str):
    """Clean up a login session."""
    try:
        await youtube_service.cleanup_session(session_id)
        return {"status": "cleaned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/youtube/validate", response_model=ValidateAuthResponse)
async def youtube_validate_auth(request: ValidateAuthRequest):
    """Validate if auth state is still valid."""
    try:
        valid = await youtube_service.validate_auth(request.auth_state)
        return ValidateAuthResponse(valid=valid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/youtube/recommendations", response_model=RecommendationsResponse)
async def youtube_get_recommendations(request: RecommendationsRequest):
    """Get video recommendations. 70% from subscriptions, 30% trending with AI selection."""
    try:
        recs = await youtube_service.get_recommendations(
            auth_state=request.auth_state,
            count=request.count,
            include_general=request.include_general,
            persona=request.persona or "",
        )
        return RecommendationsResponse(
            recommendations=[
                VideoRecommendationResponse(
                    video_id=r.video_id,
                    title=r.title,
                    author=r.author,
                    author_id=r.author_id,
                    cover_url=r.cover_url,
                    duration=r.duration,
                    view_count=r.view_count,
                    url=r.url,
                    reason=r.reason,
                    source=r.source,
                )
                for r in recs
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# YouTube keyword-based recommendations (no auth required)
@app.post("/youtube/recommendations/keywords", response_model=RecommendationsResponse)
async def youtube_keyword_recommendations(request: KeywordSearchRequest):
    """Get YouTube video recommendations based on keywords and persona (no auth required)."""
    try:
        recs = await youtube_service.get_keyword_recommendations(
            keywords=request.keywords,
            persona=request.persona,
            count=request.count,
        )
        return RecommendationsResponse(
            recommendations=[
                VideoRecommendationResponse(
                    video_id=r.video_id,
                    title=r.title,
                    author=r.author,
                    author_id=r.author_id,
                    cover_url=r.cover_url,
                    duration=r.duration,
                    view_count=r.view_count,
                    url=r.url,
                    reason=r.reason,
                    source=r.source,
                )
                for r in recs
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# X (Twitter) keyword-based recommendations
@app.post("/x/recommendations/keywords", response_model=RedditRecommendationsResponse)
async def x_keyword_recommendations(request: KeywordSearchRequest):
    """Get X/Twitter post recommendations based on keywords and persona (no auth required)."""
    try:
        # Use Reddit service's X search method (uses public Nitter or similar)
        recs = await reddit_service.get_x_keyword_recommendations(
            keywords=request.keywords,
            persona=request.persona,
            count=request.count,
        )
        return RedditRecommendationsResponse(
            recommendations=[
                PostRecommendationResponse(
                    post_id=r.post_id,
                    title=r.title,
                    author=r.author,
                    subreddit=r.subreddit,  # Will be "X" or "Twitter"
                    content_preview=r.content_preview,
                    thumbnail_url=r.thumbnail_url,
                    score=r.score,
                    comment_count=r.comment_count,
                    url=r.url,
                    permalink=r.permalink,
                    reason=r.reason,
                    source=r.source,
                    post_type=r.post_type,
                )
                for r in recs
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Persona models
class PersonaExtractRequest(BaseModel):
    new_input: str
    previous_input: Optional[str] = None
    viewing_signals: Optional[str] = None
    keywords: Optional[str] = None


class PersonaUpdateFromSignalsRequest(BaseModel):
    current_persona: Optional[str] = None
    viewing_signals: Optional[str] = None


class PersonaResponse(BaseModel):
    summary: str
    interests: str
    profession: str
    expertise: str
    contentPref: str
    compiledPersona: Optional[str] = None


@app.post("/persona/extract", response_model=PersonaResponse)
async def persona_extract(request: PersonaExtractRequest):
    """Extract persona fields from user self-description using AI."""
    try:
        result = await asyncio.to_thread(
            extract_persona,
            request.new_input,
            request.previous_input,
            request.viewing_signals,
            request.keywords,
        )
        return PersonaResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/persona/update-from-signals", response_model=PersonaResponse)
async def persona_update_from_signals(request: PersonaUpdateFromSignalsRequest):
    """Update persona based on current persona and viewing signals using AI."""
    try:
        result = await asyncio.to_thread(
            update_persona_from_signals,
            request.current_persona,
            request.viewing_signals,
        )
        return PersonaResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/recommendations", response_model=AgentRecommendationResponse)
async def agent_recommendations(request: AgentRecommendationRequest):
    """Run the agentic recommendation loop — LLM selects platforms and iterates."""
    try:
        return await recommendation_agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/recommendations/stream")
async def agent_recommendations_stream(request: AgentRecommendationRequest):
    """Stream the agentic recommendation loop as SSE events."""
    async def event_generator():
        try:
            async for event in recommendation_agent.run_streaming(request):
                yield f"data: {json.dumps(event)}\n\n"
        except BaseException as e:
            # BaseException catches asyncio.TimeoutError (Python 3.11+ BaseException subclass)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
