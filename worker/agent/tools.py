"""
Tool definitions and executor for the agentic recommendation framework.
Each tool wraps a service method and updates AgentState.
"""

import json
from typing import Any, Optional

from services.bilibili import BilibiliService
from services.youtube import YouTubeService
from services.reddit import RedditService

from .schemas import AgentRecommendationRequest, AgentState


# ── Anthropic tool schemas ──────────────────────────────────────────────────

ANTHROPIC_TOOLS = [
    {
        "name": "fetch_bilibili_content",
        "description": (
            "Fetch personalized video recommendations from Bilibili. "
            "Only works if the user has a connected Bilibili account."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "count": {
                    "type": "integer",
                    "description": "Number of recommendations to fetch",
                    "default": 12,
                },
                "include_general": {
                    "type": "boolean",
                    "description": "Include general trending content (30% mix)",
                    "default": True,
                },
            },
            "required": [],
        },
    },
    {
        "name": "fetch_youtube_content",
        "description": (
            "Fetch personalized video recommendations from YouTube subscriptions. "
            "Only works if the user has a connected YouTube account."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "count": {
                    "type": "integer",
                    "description": "Number of recommendations to fetch",
                    "default": 12,
                },
                "include_general": {
                    "type": "boolean",
                    "description": "Include trending/general content (30% mix)",
                    "default": True,
                },
            },
            "required": [],
        },
    },
    {
        "name": "search_youtube",
        "description": "Search YouTube for videos matching keywords. No auth required.",
        "input_schema": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "string",
                    "description": "Search keywords",
                },
                "count": {
                    "type": "integer",
                    "description": "Number of results",
                    "default": 8,
                },
            },
            "required": ["keywords"],
        },
    },
    {
        "name": "search_reddit",
        "description": "Search Reddit for posts matching keywords. No auth required.",
        "input_schema": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "string",
                    "description": "Search keywords",
                },
                "count": {
                    "type": "integer",
                    "description": "Number of results",
                    "default": 8,
                },
            },
            "required": ["keywords"],
        },
    },
    {
        "name": "search_x",
        "description": "Search X (Twitter) for posts matching keywords. No auth required.",
        "input_schema": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "string",
                    "description": "Search keywords",
                },
                "count": {
                    "type": "integer",
                    "description": "Number of results",
                    "default": 8,
                },
            },
            "required": ["keywords"],
        },
    },
    {
        "name": "get_trending",
        "description": "Fetch trending/popular content from a platform without auth.",
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["youtube", "reddit", "x"],
                    "description": "Platform to get trending content from",
                },
                "count": {
                    "type": "integer",
                    "description": "Number of results",
                    "default": 8,
                },
            },
            "required": ["platform"],
        },
    },
    {
        "name": "submit_recommendations",
        "description": (
            "Submit the final curated list of recommendations. "
            "Call this when you have enough high-quality, diverse content. "
            "This ends the agent loop."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "recommendations": {
                    "type": "array",
                    "description": "List of recommendation items to submit",
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_id": {"type": "string"},
                            "title": {"type": "string"},
                            "author": {"type": "string"},
                            "author_id": {"type": "string"},
                            "cover_url": {"type": "string"},
                            "url": {"type": "string"},
                            "reason": {"type": "string"},
                            "source": {"type": "string"},
                            "platform": {"type": "string"},
                            "content_type": {"type": "string"},
                            "view_count": {"type": "integer"},
                            "duration": {"type": "integer"},
                            "score": {"type": "integer"},
                            "importance_score": {"type": "integer"},
                        },
                        "required": ["item_id", "title", "author", "url", "reason", "platform"],
                    },
                },
                "reasoning": {
                    "type": "string",
                    "description": "Brief explanation of your curation strategy",
                },
            },
            "required": ["recommendations", "reasoning"],
        },
    },
]


# ── OpenAI function calling schemas ────────────────────────────────────────

def _to_openai_tool(anthropic_tool: dict) -> dict:
    """Convert an Anthropic tool schema to OpenAI function calling format."""
    return {
        "type": "function",
        "function": {
            "name": anthropic_tool["name"],
            "description": anthropic_tool["description"],
            "parameters": anthropic_tool["input_schema"],
        },
    }


OPENAI_TOOLS = [_to_openai_tool(t) for t in ANTHROPIC_TOOLS]


# ── Converters ─────────────────────────────────────────────────────────────

def _video_rec_to_dict(rec: Any, platform: str) -> dict:
    """Convert a VideoRecommendation dataclass to a flat dict."""
    return {
        "item_id": rec.video_id,
        "title": rec.title,
        "author": rec.author,
        "author_id": getattr(rec, "author_id", ""),
        "cover_url": getattr(rec, "cover_url", ""),
        "url": rec.url,
        "reason": rec.reason,
        "source": rec.source,
        "platform": platform,
        "content_type": "video",
        "view_count": getattr(rec, "view_count", 0),
        "duration": getattr(rec, "duration", 0),
        "score": 0,
        "importance_score": getattr(rec, "importance_score", 5),
    }


def _post_rec_to_dict(rec: Any, platform: str) -> dict:
    """Convert a PostRecommendation dataclass to a flat dict."""
    return {
        "item_id": rec.post_id,
        "title": rec.title,
        "author": rec.author,
        "author_id": "",
        "cover_url": rec.thumbnail_url or "",
        "url": rec.permalink if rec.permalink.startswith("http") else f"https://reddit.com{rec.permalink}",
        "reason": rec.reason,
        "source": rec.source,
        "platform": platform,
        "content_type": rec.post_type,
        "view_count": 0,
        "duration": 0,
        "score": getattr(rec, "score", 0) + getattr(rec, "comment_count", 0) * 3,
        "importance_score": 5,
    }


# ── Followed-account quota check ───────────────────────────────────────────

def _check_followed_account_ratio(
    recommendations: list[dict],
    followed_accounts: dict,
) -> tuple[bool, str]:
    """Return (passed, rejection_message). Passes immediately if no followed accounts."""
    all_followed: set[str] = set()
    for key in ("youtube", "bilibili", "x", "wildSearch"):
        for name in followed_accounts.get(key, []):
            all_followed.add(name.lower().strip())

    if not all_followed or not recommendations:
        return True, ""

    total = len(recommendations)
    followed_count = 0
    for item in recommendations:
        author = item.get("author", "").lower().strip()
        for fa_name in all_followed:
            if fa_name in author or author in fa_name:
                followed_count += 1
                break

    ratio = followed_count / total
    if ratio >= 0.30:
        return True, ""

    required = max(1, round(total * 0.30))
    shortfall = required - followed_count
    return False, (
        f"Submission rejected: followed-account quota not met. "
        f"{followed_count}/{total} items are from followed accounts ({ratio:.0%}), "
        f"but at least 30% ({required} items) is required. "
        f"Search {shortfall} more item(s) from: {', '.join(sorted(all_followed))}."
    )


# ── ToolExecutor ───────────────────────────────────────────────────────────

class ToolExecutor:
    """
    Dispatches tool calls to service methods and updates AgentState.
    Never raises — returns {"success": False, "error": "..."} on failure.
    """

    def __init__(
        self,
        bilibili: BilibiliService,
        youtube: YouTubeService,
        reddit: RedditService,
        state: AgentState,
        request: AgentRecommendationRequest,
    ):
        self.bilibili = bilibili
        self.youtube = youtube
        self.reddit = reddit
        self.state = state
        self.request = request

    async def execute(self, name: str, input_data: dict) -> dict:
        """Dispatch a tool call by name."""
        dispatch = {
            "fetch_bilibili_content": self._tool_fetch_bilibili_content,
            "fetch_youtube_content": self._tool_fetch_youtube_content,
            "search_youtube": self._tool_search_youtube,
            "search_reddit": self._tool_search_reddit,
            "search_x": self._tool_search_x,
            "get_trending": self._tool_get_trending,
            "submit_recommendations": self._tool_submit_recommendations,
        }
        handler = dispatch.get(name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {name}"}
        try:
            return await handler(input_data)
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _tool_fetch_bilibili_content(self, inp: dict) -> dict:
        auth_state = self.request.available_connections.get("bilibili")
        if not auth_state:
            return {"success": False, "error": "Bilibili not connected"}

        count = inp.get("count", 12)
        include_general = inp.get("include_general", True)

        result = await self.bilibili.get_recommendations(
            auth_state=auth_state,
            count=count,
            include_general=include_general,
            persona=self.request.persona,
            cached_history=self.request.cached_history,
            cached_channels=self.request.cached_channels,
        )

        if result.get("needs_reauth"):
            self.state.needs_reauth["bilibili"] = True

        items = [_video_rec_to_dict(r, "bilibili") for r in result.get("recommendations", [])]
        self.state.collected.extend(items)
        self.state.platforms_queried.add("bilibili")
        return {"success": True, "count": len(items), "items": items}

    async def _tool_fetch_youtube_content(self, inp: dict) -> dict:
        auth_state = self.request.available_connections.get("youtube")
        if not auth_state:
            return {"success": False, "error": "YouTube not connected"}

        count = inp.get("count", 12)
        include_general = inp.get("include_general", True)

        recs = await self.youtube.get_recommendations(
            auth_state=auth_state,
            count=count,
            include_general=include_general,
            persona=self.request.persona,
        )

        items = [_video_rec_to_dict(r, "youtube") for r in recs]
        self.state.collected.extend(items)
        self.state.platforms_queried.add("youtube")
        return {"success": True, "count": len(items), "items": items}

    async def _tool_search_youtube(self, inp: dict) -> dict:
        keywords = inp.get("keywords", "")
        count = inp.get("count", 8)

        recs = await self.youtube.get_keyword_recommendations(
            keywords=keywords,
            persona=self.request.persona or None,
            count=count,
        )

        items = [_video_rec_to_dict(r, "youtube") for r in recs]
        self.state.collected.extend(items)
        self.state.platforms_queried.add("youtube")
        return {"success": True, "count": len(items), "items": items}

    async def _tool_search_reddit(self, inp: dict) -> dict:
        keywords = inp.get("keywords", "")
        count = inp.get("count", 8)

        recs = await self.reddit.get_keyword_recommendations(
            keywords=keywords,
            persona=self.request.persona or None,
            count=count,
        )

        items = [_post_rec_to_dict(r, "reddit") for r in recs]
        self.state.collected.extend(items)
        self.state.platforms_queried.add("reddit")
        return {"success": True, "count": len(items), "items": items}

    async def _tool_search_x(self, inp: dict) -> dict:
        keywords = inp.get("keywords", "")
        count = inp.get("count", 8)

        recs = await self.reddit.get_x_keyword_recommendations(
            keywords=keywords,
            persona=self.request.persona or None,
            count=count,
        )

        items = [_post_rec_to_dict(r, "x") for r in recs]
        self.state.collected.extend(items)
        self.state.platforms_queried.add("x")
        return {"success": True, "count": len(items), "items": items}

    async def _tool_get_trending(self, inp: dict) -> dict:
        platform = inp.get("platform", "youtube")
        count = inp.get("count", 8)

        trending_keywords = {
            "youtube": "trending popular technology science",
            "reddit": "hot popular news today",
            "x": "trending today",
        }
        keywords = trending_keywords.get(platform, "trending popular")

        if platform == "youtube":
            recs = await self.youtube.get_keyword_recommendations(
                keywords=keywords,
                persona=self.request.persona or None,
                count=count,
            )
            items = [_video_rec_to_dict(r, "youtube") for r in recs]
        elif platform == "reddit":
            recs = await self.reddit.get_keyword_recommendations(
                keywords=keywords,
                persona=self.request.persona or None,
                count=count,
            )
            items = [_post_rec_to_dict(r, "reddit") for r in recs]
        elif platform == "x":
            recs = await self.reddit.get_x_keyword_recommendations(
                keywords=keywords,
                persona=self.request.persona or None,
                count=count,
            )
            items = [_post_rec_to_dict(r, "x") for r in recs]
        else:
            return {"success": False, "error": f"Unsupported platform: {platform}"}

        self.state.collected.extend(items)
        self.state.platforms_queried.add(platform)
        return {"success": True, "count": len(items), "items": items}

    async def _tool_submit_recommendations(self, inp: dict) -> dict:
        recommendations = inp.get("recommendations", [])
        reasoning = inp.get("reasoning", "")

        self.state.submitted = recommendations
        self.state.final_reasoning = reasoning
        self.state.done = True
        return {"success": True, "submitted": len(recommendations)}
