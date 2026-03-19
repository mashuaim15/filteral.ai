"""
RecommendationAgent — closed-loop agentic recommendation framework.
Uses a ReAct-style loop where an LLM selects which platforms to query,
iterates on results, and submits when satisfied.
"""

import asyncio
import json
import os
from collections import defaultdict
from typing import Any, Optional

from services.bilibili import BilibiliService
from services.youtube import YouTubeService
from services.reddit import RedditService

from .schemas import (
    AgentRecommendationItem,
    AgentRecommendationRequest,
    AgentRecommendationResponse,
    AgentState,
)
from .tools import ANTHROPIC_TOOLS, OPENAI_TOOLS, ToolExecutor


def _format_args_preview(tool_name: str, args: dict) -> str:
    """Format tool args into a short human-readable preview (max 120 chars)."""
    if not args:
        return ""
    parts = [f"{k}: {v}" for k, v in args.items() if v is not None]
    preview = ", ".join(parts)
    return preview[:120] + "…" if len(preview) > 120 else preview


MAX_ITERATIONS = 5
AGENT_TIMEOUT_SECONDS = 360

SUPPORTED_MODELS = {
    "claude-sonnet-4-6": "anthropic",
    "claude-opus-4-6": "anthropic",
    "claude-haiku-4-5": "anthropic",
    "gpt-4o": "openai",
    "gpt-4o-mini": "openai",
}

SYSTEM_PROMPT = """You are a personalized content curation assistant. Your job is to gather content from multiple platforms and select the best recommendations based on the user's persona and interests.

Before each set of tool calls, write 1-2 sentences of thinking — what this user cares about, what platform/keyword you're using, and why. Then IMMEDIATELY call tools. You MUST call at least one tool every turn; never end a turn with only text.
Example thinking: "This user is into AI infrastructure — I'll search Reddit for 'LLM serving' and YouTube for deep-dive videos."

Strategy rules:
1. Use search_reddit, search_x, and search_youtube for content based on the user's persona and keywords.
2. Spread searches across all three platforms for diversity.
3. Iterate if you need more content — fetch from additional sources.
4. Ensure diversity: don't over-represent one platform or author.
5. Maximum 2 items per author/channel in your final submission.
6. Reasons MUST specifically reference the user's persona and why this content matches them.
7. Only submit items that were actually returned by tool calls — never invent content.
8. FOLLOWED ACCOUNTS QUOTA: If followed accounts are listed in the task, at least 30% of submitted items must come from those accounts.
9. When you have enough quality, diverse content, call submit_recommendations.
10. NEVER include specific years (e.g. 2024, 2025, 2023) in search keywords. Use "latest", "recent", "new", or just the topic name.
11. Fetch 2× more candidates than your target count per tool call (e.g. if target is 10, request count=20). You will rank and trim before submitting.
12. Before submitting, rank your collected items by engagement: use `score` (upvotes + weighted comments for posts; view_count for videos) combined with persona relevance. Set `importance_score` (1–10) on each item — 8–10 for high engagement + strong match, 5–7 for moderate, 1–4 for weak. Submit only the top target_count items, ordered by importance_score descending.

Aim to submit in 2-3 iterations."""


def _build_task_message(request: AgentRecommendationRequest) -> str:
    connected = [p for p, state in request.available_connections.items() if state]
    not_connected = [p for p, state in request.available_connections.items() if not state]

    lines = [
        f"Please curate {request.target_count} personalized recommendations for this user.",
        "",
        f"User Persona: {request.persona or '(not set)'}",
    ]
    if request.keywords:
        lines.append(f"Keywords: {request.keywords}")
    if request.viewing_signals:
        lines.append(f"Viewing Signals: {request.viewing_signals}")
    lines.append("")
    lines.append(f"Connected platforms (auth available): {', '.join(connected) if connected else 'none'}")
    lines.append(f"Not connected (keyword/persona search only): {', '.join(not_connected) if not_connected else 'none'}")
    lines.append("Reddit and X are always available via keyword/persona search.")

    # Inject followed accounts if any are set
    fa = request.followed_accounts
    fa_lines = []
    if fa.get("youtube"):
        fa_lines.append(f"  - YouTube channels: {', '.join(fa['youtube'])}")
    if fa.get("bilibili"):
        fa_lines.append(f"  - Bilibili channels: {', '.join(fa['bilibili'])}")
    if fa.get("x"):
        fa_lines.append(f"  - X/Twitter accounts: {', '.join(fa['x'])}")
    if fa.get("wildSearch"):
        fa_lines.append(f"  - Search topics: {', '.join(fa['wildSearch'])}")
    if fa_lines:
        required_followed = max(1, round(request.target_count * 0.30))
        lines.append("")
        lines.append("Accounts/topics to prioritize (QUOTA REQUIRED):")
        lines.extend(fa_lines)
        lines.append("Account names may be approximate — use your best judgment to find the right channel or user.")
        lines.append(
            f"IMPORTANT: Your final submission MUST include at least {required_followed} out of "
            f"{request.target_count} items ({required_followed}/{request.target_count} = 30%) "
            f"from the accounts listed above. If submit_recommendations rejects your submission, "
            f"fetch more content from those specific accounts and retry."
        )

    lines.append("")
    lines.append("Start fetching content and submit when you have a good curated set.")
    return "\n".join(lines)


def _sanitize_item_dict(item: dict) -> dict:
    """Sanitize a raw item dict — ensures all fields have valid types without pydantic."""
    return {
        "item_id": item.get("item_id") or "",
        "title": item.get("title") or "",
        "author": item.get("author") or "",
        "author_id": item.get("author_id") or "",
        "cover_url": item.get("cover_url") or "",
        "url": item.get("url") or "",
        "reason": item.get("reason") or "",
        "source": item.get("source") or "",
        "platform": item.get("platform") or "",
        "content_type": item.get("content_type") or "video",
        "view_count": int(item.get("view_count") or 0),
        "duration": int(item.get("duration") or 0),
        "score": int(item.get("score") or 0),
        "importance_score": int(item.get("importance_score") or 5),
    }


def _dedup_by_author(items: list[dict], max_per_author: int = 2) -> list[dict]:
    """Enforce max items per author."""
    counts: dict[str, int] = defaultdict(int)
    result = []
    for item in items:
        author = item.get("author", "").lower()
        if counts[author] < max_per_author:
            result.append(item)
            counts[author] += 1
    return result


class RecommendationAgent:
    def __init__(
        self,
        bilibili: BilibiliService,
        youtube: YouTubeService,
        reddit: RedditService,
    ):
        self.bilibili = bilibili
        self.youtube = youtube
        self.reddit = reddit

    async def run(self, request: AgentRecommendationRequest) -> AgentRecommendationResponse:
        """Run the agent with a timeout."""
        # Resolve API key and provider
        model = request.ai_model if request.ai_model in SUPPORTED_MODELS else "claude-sonnet-4-6"
        provider = SUPPORTED_MODELS[model]

        if provider == "anthropic":
            import anthropic
            api_key = request.ai_api_key or os.getenv("ANTHROPIC_API_KEY", "")
            client = anthropic.AsyncAnthropic(api_key=api_key)
        else:
            import openai
            api_key = request.ai_api_key or os.getenv("OPENAI_API_KEY", "")
            client = openai.AsyncOpenAI(api_key=api_key)

        # Use a mutable holder so the timeout handler can access whatever
        # the loop had collected before the timeout fired.
        state_holder: list[AgentState] = []

        async def _run_and_capture():
            state = AgentState()
            state_holder.append(state)
            executor = ToolExecutor(self.bilibili, self.youtube, self.reddit, state, request)
            task_message = _build_task_message(request)
            if provider == "anthropic":
                return await self._run_anthropic_loop(request, client, model, executor, state, task_message)
            else:
                return await self._run_openai_loop(request, client, model, executor, state, task_message)

        try:
            return await asyncio.wait_for(
                _run_and_capture(),
                timeout=AGENT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            # Return whatever was collected before the timeout
            state = state_holder[0] if state_holder else AgentState()
            return self._build_fallback_response(state, request.target_count)

    async def run_streaming(self, request: AgentRecommendationRequest):
        """
        Async generator that yields SSE event dicts as the agent loop runs.
        Emits: thinking, tool_call, tool_result, done, error.
        """
        queue: asyncio.Queue = asyncio.Queue()

        def emit(event: dict) -> None:
            queue.put_nowait(event)

        # Resolve client (same logic as run())
        model = request.ai_model if request.ai_model in SUPPORTED_MODELS else "claude-sonnet-4-6"
        provider = SUPPORTED_MODELS[model]

        if provider == "anthropic":
            import anthropic
            api_key = request.ai_api_key or os.getenv("ANTHROPIC_API_KEY", "")
            client = anthropic.AsyncAnthropic(api_key=api_key)
        else:
            import openai
            api_key = request.ai_api_key or os.getenv("OPENAI_API_KEY", "")
            client = openai.AsyncOpenAI(api_key=api_key)

        _SENTINEL = object()

        async def run_and_signal():
            try:
                result = await self._run_loop(request, client, provider, model, emit=emit)
                items = result.recommendations  # already sanitized dicts
                emit({
                    "type": "done",
                    "count": len(items),
                    "items": items,
                    "needs_reauth": result.needs_reauth,
                })
            except BaseException as e:
                # BaseException catches asyncio.TimeoutError (Python 3.11+ BaseException subclass)
                emit({"type": "error", "message": str(e)})
            finally:
                queue.put_nowait(_SENTINEL)

        task = asyncio.create_task(run_and_signal())

        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            yield item

    async def _run_loop(
        self,
        request: AgentRecommendationRequest,
        client: Any,
        provider: str,
        model: str,
        emit=None,
    ) -> AgentRecommendationResponse:
        state = AgentState()
        executor = ToolExecutor(self.bilibili, self.youtube, self.reddit, state, request)

        task_message = _build_task_message(request)

        if provider == "anthropic":
            return await self._run_anthropic_loop(request, client, model, executor, state, task_message, emit=emit)
        else:
            return await self._run_openai_loop(request, client, model, executor, state, task_message, emit=emit)

    async def _run_anthropic_loop(
        self,
        request: AgentRecommendationRequest,
        client: Any,
        model: str,
        executor: ToolExecutor,
        state: AgentState,
        task_message: str,
        emit=None,
    ) -> AgentRecommendationResponse:
        if emit is None:
            emit = lambda _: None
        messages = [{"role": "user", "content": task_message}]

        while state.iterations < MAX_ITERATIONS and not state.done:
            state.iterations += 1

            response = await client.messages.create(
                model=model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=ANTHROPIC_TOOLS,
                messages=messages,
            )

            # Emit thinking from text blocks
            for block in response.content:
                if block.type == "text" and block.text.strip():
                    emit({"type": "thinking", "content": block.text.strip()})

            # Append assistant turn
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason != "tool_use":
                break

            # Execute tools
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    emit({
                        "type": "tool_call",
                        "tool": block.name,
                        "args_preview": _format_args_preview(block.name, block.input),
                    })
                    result = await self._run_with_progress(
                        executor.execute(block.name, block.input), block.name, emit
                    )
                    if block.name == "submit_recommendations":
                        if result.get("success", True):
                            emit({"type": "tool_result", "tool": block.name, "submitted": result.get("submitted", 0)})
                        else:
                            emit({"type": "thinking", "content": f"Submit rejected: {result.get('error', 'unknown reason')} — retrying"})
                    else:
                        emit({"type": "tool_result", "tool": block.name, "count": result.get("count", 0)})
                        candidates = [c.get("title", "")[:80] for c in result.get("items", [])[:3]]
                        if candidates:
                            emit({"type": "candidates", "tool": block.name, "titles": candidates})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })
                    if state.done:
                        break

            messages.append({"role": "user", "content": tool_results})

        if state.done and state.submitted:
            return self._build_response_from_submission(state, request.target_count)
        return self._build_fallback_response(state, request.target_count)

    async def _run_openai_loop(
        self,
        request: AgentRecommendationRequest,
        client: Any,
        model: str,
        executor: ToolExecutor,
        state: AgentState,
        task_message: str,
        emit=None,
    ) -> AgentRecommendationResponse:
        if emit is None:
            emit = lambda _: None
        messages: list[dict] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": task_message},
        ]

        while state.iterations < MAX_ITERATIONS and not state.done:
            state.iterations += 1

            response = await client.chat.completions.create(
                model=model,
                tools=OPENAI_TOOLS,
                messages=messages,
            )

            choice = response.choices[0]
            assistant_msg = choice.message

            if assistant_msg.content and assistant_msg.content.strip():
                emit({"type": "thinking", "content": assistant_msg.content.strip()})
            elif assistant_msg.tool_calls:
                # GPT-4o-mini returns null content when making tool calls — synthesize per-tool
                for tc in assistant_msg.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments)
                    except Exception:
                        args = {}
                    preview = _format_args_preview(tc.function.name, args)
                    msg = f"→ {tc.function.name}  {preview}" if preview else f"→ {tc.function.name}"
                    emit({"type": "thinking", "content": msg})

            # Serialize and append assistant message
            msg_dict: dict = {"role": "assistant", "content": assistant_msg.content}
            if assistant_msg.tool_calls:
                msg_dict["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in assistant_msg.tool_calls
                ]
            messages.append(msg_dict)

            if choice.finish_reason != "tool_calls":
                break

            # Execute tools
            for tool_call in (assistant_msg.tool_calls or []):
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                emit({
                    "type": "tool_call",
                    "tool": tool_call.function.name,
                    "args_preview": _format_args_preview(tool_call.function.name, args),
                })
                result = await self._run_with_progress(
                    executor.execute(tool_call.function.name, args), tool_call.function.name, emit
                )
                if tool_call.function.name == "submit_recommendations":
                    if result.get("success", True):
                        emit({"type": "tool_result", "tool": tool_call.function.name, "submitted": result.get("submitted", 0)})
                    else:
                        emit({"type": "thinking", "content": f"Submit rejected: {result.get('error', 'unknown reason')} — retrying"})
                else:
                    emit({"type": "tool_result", "tool": tool_call.function.name, "count": result.get("count", 0)})
                    candidates = [c.get("title", "")[:80] for c in result.get("items", [])[:3]]
                    if candidates:
                        emit({"type": "candidates", "tool": tool_call.function.name, "titles": candidates})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                })
                if state.done:
                    break

        if state.done and state.submitted:
            return self._build_response_from_submission(state, request.target_count)
        return self._build_fallback_response(state, request.target_count)

    async def _run_with_progress(self, coro, tool_name: str, emit):
        """Run a tool coroutine and emit a spinner every 1.5 s while it executes."""
        done = asyncio.Event()
        symbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

        async def ticker():
            count = 0
            while not done.is_set():
                await asyncio.sleep(1.0)
                if not done.is_set():
                    emit({"type": "thinking", "content": f"{symbols[count % len(symbols)]} {tool_name}…"})
                    count += 1

        ticker_task = asyncio.create_task(ticker())
        try:
            return await coro
        finally:
            done.set()
            ticker_task.cancel()
            try:
                await ticker_task
            except asyncio.CancelledError:
                pass

    def _build_response_from_submission(
        self, state: AgentState, target_count: int
    ) -> AgentRecommendationResponse:
        """Build response from agent's submit_recommendations call."""
        deduped = _dedup_by_author(state.submitted, max_per_author=2)
        ranked = sorted(deduped, key=lambda x: x.get("importance_score", 5), reverse=True)
        submitted = ranked[:target_count]
        return AgentRecommendationResponse(
            recommendations=[_sanitize_item_dict(item) for item in submitted],
            agent_reasoning=state.final_reasoning,
            iterations_used=state.iterations,
            platforms_queried=list(state.platforms_queried),
            needs_reauth=state.needs_reauth,
        )

    def _build_fallback_response(
        self, state: AgentState, target_count: int
    ) -> AgentRecommendationResponse:
        """Build response from collected items when agent didn't submit."""
        raw = _dedup_by_author(state.collected, max_per_author=2)[:target_count]
        return AgentRecommendationResponse(
            recommendations=[_sanitize_item_dict(item) for item in raw],
            agent_reasoning="Fallback: used collected items without explicit submission.",
            iterations_used=state.iterations,
            platforms_queried=list(state.platforms_queried),
            needs_reauth=state.needs_reauth,
        )
