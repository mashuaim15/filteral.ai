"""
Pydantic models for the agentic recommendation framework.
"""

from dataclasses import dataclass, field
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class AgentRecommendationRequest(BaseModel):
    persona: str = ""
    target_count: int = Field(default=10, ge=1, le=50)
    # platform -> auth_state string (None if not connected)
    available_connections: dict[str, Optional[str]] = Field(default_factory=dict)
    keywords: str = ""
    viewing_signals: str = ""
    # Bilibili-specific cached data
    cached_history: Optional[str] = None
    cached_channels: Optional[str] = None
    # User-provided model config (from profile page)
    ai_model: str = "claude-sonnet-4-6"
    ai_api_key: Optional[str] = None  # decrypted by web service before sending
    # Accounts to prioritize per platform
    followed_accounts: dict = Field(
        default_factory=lambda: {"x": [], "youtube": [], "bilibili": [], "wildSearch": []}
    )


class AgentRecommendationItem(BaseModel):
    item_id: str
    title: str
    author: str
    author_id: str = ""
    cover_url: str = ""
    url: str
    reason: str
    source: str = ""
    platform: str  # "bilibili", "youtube", "reddit", "x"
    content_type: str = "video"
    view_count: int = 0
    duration: int = 0
    score: int = 0
    importance_score: int = 5

    @model_validator(mode="before")
    @classmethod
    def coerce_nulls(cls, data: dict) -> dict:
        """Replace None with defaults for int/str fields so Pydantic-core doesn't choke."""
        if not isinstance(data, dict):
            return data
        int_defaults = {"view_count": 0, "duration": 0, "score": 0, "importance_score": 5}
        str_defaults = {"author_id": "", "cover_url": "", "source": "", "content_type": "video"}
        for k, v in int_defaults.items():
            if data.get(k) is None:
                data[k] = v
        for k, v in str_defaults.items():
            if data.get(k) is None:
                data[k] = v
        return data


class AgentRecommendationResponse(BaseModel):
    recommendations: list[dict]  # sanitized item dicts — avoid pydantic-core 2.27.0 model_dump bug
    agent_reasoning: str
    iterations_used: int
    platforms_queried: list[str]
    needs_reauth: dict[str, bool] = Field(default_factory=dict)


@dataclass
class AgentState:
    """Mutable state passed through the agent loop."""
    collected: list[dict] = field(default_factory=list)
    platforms_queried: set = field(default_factory=set)
    iterations: int = 0
    needs_reauth: dict = field(default_factory=dict)
    done: bool = False
    final_reasoning: str = ""
    submitted: list[dict] = field(default_factory=list)
