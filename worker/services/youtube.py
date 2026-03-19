"""
YouTube service implementation using YouTube Data API and Playwright.
Uses OAuth tokens (obtained via Next.js OAuth flow) to fetch recommendations.
Step 1: 70% from subscribed channels, 30% from trending (raw candidates)
Step 2: AI selection with 50% persona + 50% subscription-based interests
"""

import json
import os
import re
import aiohttp
from typing import Optional
from openai import OpenAI
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from .base import (
    BaseSiteService,
    QRLoginResult,
    LoginStatusResult,
    VideoRecommendation,
)


class YouTubeService(BaseSiteService):
    """YouTube implementation using YouTube Data API with OAuth tokens."""

    API_BASE = "https://www.googleapis.com/youtube/v3"

    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self.playwright = None
        self.browser: Optional[Browser] = None

    async def _ensure_browser(self):
        """Ensure browser is running, restarting it if it has crashed."""
        if self.browser is not None:
            try:
                # Quick liveness check — throws if browser process died
                if not self.browser.is_connected():
                    raise RuntimeError("browser disconnected")
            except Exception:
                # Browser crashed; clean up and recreate
                try:
                    await self.browser.close()
                except Exception:
                    pass
                try:
                    await self.playwright.stop()
                except Exception:
                    pass
                self.browser = None
                self.playwright = None

        if self.browser is None:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)

    async def _create_context(self) -> BrowserContext:
        """Create a new browser context."""
        await self._ensure_browser()
        return await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

    @property
    def site_name(self) -> str:
        return "youtube"

    async def start_qr_login(self, user_id: str) -> QRLoginResult:
        """Not used - YouTube uses OAuth flow handled by Next.js."""
        raise NotImplementedError("YouTube uses OAuth flow")

    async def check_login_status(self, session_id: str) -> LoginStatusResult:
        """Not used - YouTube uses OAuth flow handled by Next.js."""
        raise NotImplementedError("YouTube uses OAuth flow")

    async def validate_auth(self, auth_state: str) -> bool:
        """Check if OAuth tokens are still valid."""
        try:
            state = json.loads(auth_state)
            access_token = state.get("access_token")

            if not access_token:
                return False

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.API_BASE}/channels",
                    params={"part": "snippet", "mine": "true"},
                    headers={"Authorization": f"Bearer {access_token}"},
                ) as response:
                    return response.status == 200

        except Exception:
            return False

    async def get_recommendations(
        self,
        auth_state: str,
        count: int = 10,
        include_general: bool = True,
        persona: str = ""
    ) -> list[VideoRecommendation]:
        """
        Generate recommendations using YouTube Data API with AI selection.
        Step 1: 70% from subscribed channels, 30% from trending (raw candidates)
        Step 2: AI selection with 50% persona + 50% subscription-based interests
        Filter: only videos published in last 7 days, max 2 per channel.
        """
        from datetime import datetime, timedelta

        try:
            state = json.loads(auth_state)
            access_token = state.get("access_token")

            if not access_token:
                return []

            # Calculate 7 days ago in ISO format
            seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z"

            async with aiohttp.ClientSession() as http_session:
                # Step 1: Collect raw candidates (70% subscribed, 30% trending)
                # Fetch more than needed for AI to select from
                target_candidates = 50

                # Get subscriptions info for interest analysis
                subscriptions = await self._get_subscriptions(http_session, access_token)
                subscription_interests = self._analyze_subscriptions(subscriptions)
                print(f"[YouTube] Subscription interests: {subscription_interests[:200]}...")

                # Get videos from subscriptions (70% of candidates)
                subscribed_target = int(target_candidates * 0.7)
                subscription_videos = await self._get_subscription_videos(
                    http_session, access_token, subscribed_target, seven_days_ago
                )
                for v in subscription_videos:
                    v["_source"] = "subscribed"
                print(f"[YouTube] Found {len(subscription_videos)} subscribed videos")

                # Get trending videos (30% of candidates)
                trending_target = target_candidates - len(subscription_videos)
                trending_videos = []
                if include_general and trending_target > 0:
                    trending_videos = await self._get_trending_videos(
                        http_session, access_token, trending_target, seven_days_ago
                    )
                    # Filter out duplicates
                    subscribed_ids = {v["id"] for v in subscription_videos}
                    trending_videos = [v for v in trending_videos if v["id"] not in subscribed_ids]
                    for v in trending_videos:
                        v["_source"] = "trending"
                print(f"[YouTube] Found {len(trending_videos)} trending videos")

                # Combine all candidates
                all_candidates = subscription_videos + trending_videos
                print(f"[YouTube] Total candidates: {len(all_candidates)}")

                if not all_candidates:
                    return []

                # Step 2: AI selection with 50% persona + 50% subscription interests
                selected_videos = await self._ai_select_videos(
                    all_candidates,
                    subscription_interests,
                    persona,
                    count
                )

                # Build recommendations with max 2 per channel
                recommendations = []
                channel_count = {}

                for video in selected_videos:
                    channel_id = video.get("channel_id", "")

                    if channel_count.get(channel_id, 0) >= 2:
                        continue

                    source = video.get("_source", "subscribed")
                    reason = video.get("_ai_reason", f"New from {video.get('channel', 'Unknown')}")
                    rec = self._build_recommendation(video, source, reason)
                    recommendations.append(rec)
                    channel_count[channel_id] = channel_count.get(channel_id, 0) + 1

                    if len(recommendations) >= count:
                        break

                # Fill up if needed
                if len(recommendations) < count:
                    for video in all_candidates:
                        if video["id"] in {r.video_id for r in recommendations}:
                            continue
                        channel_id = video.get("channel_id", "")
                        if channel_count.get(channel_id, 0) >= 2:
                            continue

                        source = video.get("_source", "subscribed")
                        reason = f"New from {video.get('channel', 'Unknown')}" if source == "subscribed" else "Trending on YouTube"
                        rec = self._build_recommendation(video, source, reason)
                        recommendations.append(rec)
                        channel_count[channel_id] = channel_count.get(channel_id, 0) + 1

                        if len(recommendations) >= count:
                            break

                print(f"[YouTube] Final recommendations: {len(recommendations)}")
                return recommendations

        except Exception as e:
            print(f"[YouTube] Error getting recommendations: {e}")
            import traceback
            traceback.print_exc()
            return []

    async def _get_subscriptions(
        self,
        session: aiohttp.ClientSession,
        access_token: str
    ) -> list[dict]:
        """Get user's subscriptions for interest analysis."""
        subscriptions = []
        try:
            async with session.get(
                f"{self.API_BASE}/subscriptions",
                params={
                    "part": "snippet",
                    "mine": "true",
                    "maxResults": 50,
                },
                headers={"Authorization": f"Bearer {access_token}"},
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    subscriptions = data.get("items", [])
        except Exception as e:
            print(f"[YouTube] Error getting subscriptions: {e}")
        return subscriptions

    def _analyze_subscriptions(self, subscriptions: list[dict]) -> str:
        """Analyze subscriptions to understand user interests."""
        if not subscriptions:
            return "No subscription data available."

        channels = []
        for sub in subscriptions[:30]:
            snippet = sub.get("snippet", {})
            title = snippet.get("title", "")
            description = snippet.get("description", "")[:100]
            if title:
                channels.append(f"- {title}: {description}")

        return "Subscribed channels:\n" + "\n".join(channels)

    async def _ai_select_videos(
        self,
        candidates: list[dict],
        subscription_interests: str,
        persona: str,
        count: int
    ) -> list[dict]:
        """Use AI to select best videos based 100% on user persona."""
        try:
            openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            # Build candidate list for AI
            candidate_list = []
            for i, video in enumerate(candidates[:50]):
                candidate_list.append({
                    "id": i,
                    "title": video.get("title", "")[:100],
                    "channel": video.get("channel", "Unknown"),
                    "source": video.get("_source", "unknown"),
                    "views": video.get("view_count", 0),
                })

            persona_section = f"\n\nUser Persona:\n{persona}" if persona else ""

            prompt = f"""Select the top {count} YouTube videos for this user.

WEIGHTING:
- User Persona: 100% importance

CONSTRAINTS:
- Maximum 2 videos from the same channel
- Prioritize content diversity

Subscription context (for candidate pool reference only):
{subscription_interests}{persona_section}

Candidates:
{json.dumps(candidate_list, indent=2)}

Return a JSON array with exactly {count} objects:
- "id": the video id from the list
- "reason": personalized 1-sentence explanation why they'd like this

Return ONLY valid JSON array, no markdown."""

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You select YouTube videos that best match a user's interests. Return only valid JSON."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON
            if content.startswith("```"):
                content = content.replace("```json", "").replace("```", "").strip()

            selections = json.loads(content)
            print(f"[YouTube] AI selected {len(selections)} videos")

            # Build selected videos with AI reasons
            selected = []
            for selection in selections:
                idx = selection.get("id", 0)
                if 0 <= idx < len(candidates):
                    video = candidates[idx].copy()
                    video["_ai_reason"] = selection.get("reason", "Selected for you")
                    selected.append(video)

            return selected

        except Exception as e:
            print(f"[YouTube] AI selection failed: {e}")
            # Fallback to first N candidates
            return candidates[:count]

    async def _get_subscription_videos(
        self,
        session: aiohttp.ClientSession,
        access_token: str,
        max_videos: int,
        published_after: str
    ) -> list[dict]:
        """Get recent videos from subscribed channels published within last 7 days"""
        videos = []

        try:
            # Get user's subscriptions
            async with session.get(
                f"{self.API_BASE}/subscriptions",
                params={
                    "part": "snippet",
                    "mine": "true",
                    "maxResults": 20,
                },
                headers={"Authorization": f"Bearer {access_token}"},
            ) as response:
                if response.status != 200:
                    return []
                data = await response.json()

            # Get channel IDs
            channel_ids = [
                item["snippet"]["resourceId"]["channelId"]
                for item in data.get("items", [])
            ]

            if not channel_ids:
                return []

            # Get recent videos from each channel
            for channel_id in channel_ids[:10]:  # Limit to 10 channels
                async with session.get(
                    f"{self.API_BASE}/search",
                    params={
                        "part": "snippet",
                        "channelId": channel_id,
                        "type": "video",
                        "order": "date",
                        "maxResults": 3,
                        "publishedAfter": published_after,  # Only last 7 days
                    },
                    headers={"Authorization": f"Bearer {access_token}"},
                ) as response:
                    if response.status == 200:
                        search_data = await response.json()
                        for item in search_data.get("items", []):
                            videos.append({
                                "id": item["id"]["videoId"],
                                "title": item["snippet"]["title"],
                                "channel": item["snippet"]["channelTitle"],
                                "channel_id": item["snippet"]["channelId"],
                                "thumbnail": item["snippet"]["thumbnails"].get("high", {}).get("url", ""),
                            })

                if len(videos) >= max_videos:
                    break

            # Get video details (duration, view count)
            if videos:
                video_ids = [v["id"] for v in videos[:max_videos]]
                videos = await self._enrich_videos(session, access_token, videos[:max_videos], video_ids)

        except Exception as e:
            print(f"Error getting subscription videos: {e}")

        return videos

    async def _get_trending_videos(
        self,
        session: aiohttp.ClientSession,
        access_token: str,
        max_videos: int,
        published_after: str
    ) -> list[dict]:
        """Get trending videos published within last 7 days."""
        from datetime import datetime
        
        videos = []

        try:
            async with session.get(
                f"{self.API_BASE}/videos",
                params={
                    "part": "snippet,contentDetails,statistics",
                    "chart": "mostPopular",
                    "regionCode": "US",
                    "maxResults": max_videos * 2,  # Fetch more to account for filtering
                },
                headers={"Authorization": f"Bearer {access_token}"},
            ) as response:
                if response.status != 200:
                    return []
                data = await response.json()

            # Parse the published_after datetime
            cutoff_time = datetime.fromisoformat(published_after.replace('Z', '+00:00'))
            
            for item in data.get("items", []):
                # Check if video was published within last 7 days
                published_at = datetime.fromisoformat(item["snippet"]["publishedAt"].replace('Z', '+00:00'))
                
                if published_at >= cutoff_time:
                    videos.append({
                        "id": item["id"],
                        "title": item["snippet"]["title"],
                        "channel": item["snippet"]["channelTitle"],
                        "channel_id": item["snippet"]["channelId"],
                        "thumbnail": item["snippet"]["thumbnails"].get("high", {}).get("url", ""),
                        "duration": self._parse_duration(item["contentDetails"]["duration"]),
                        "view_count": int(item["statistics"].get("viewCount", 0)),
                    })
                
                if len(videos) >= max_videos:
                    break

        except Exception as e:
            print(f"Error getting trending videos: {e}")

        return videos

    async def _enrich_videos(
        self,
        session: aiohttp.ClientSession,
        access_token: str,
        videos: list[dict],
        video_ids: list[str]
    ) -> list[dict]:
        """Add duration and view count to videos."""
        try:
            async with session.get(
                f"{self.API_BASE}/videos",
                params={
                    "part": "contentDetails,statistics",
                    "id": ",".join(video_ids),
                },
                headers={"Authorization": f"Bearer {access_token}"},
            ) as response:
                if response.status != 200:
                    return videos
                data = await response.json()

            # Create lookup
            details = {
                item["id"]: {
                    "duration": self._parse_duration(item["contentDetails"]["duration"]),
                    "view_count": int(item["statistics"].get("viewCount", 0)),
                }
                for item in data.get("items", [])
            }

            # Merge details
            for video in videos:
                if video["id"] in details:
                    video.update(details[video["id"]])

        except Exception as e:
            print(f"Error enriching videos: {e}")

        return videos

    def _parse_duration(self, duration_str: str) -> int:
        """Parse ISO 8601 duration (PT1H2M3S) to seconds."""
        import re

        match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
        if not match:
            return 0

        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)

        return hours * 3600 + minutes * 60 + seconds

    def _build_recommendation(self, video: dict, source: str, reason: str = "") -> VideoRecommendation:
        """Build a VideoRecommendation from video data."""
        channel = video.get("channel", "Unknown")

        if not reason:
            if source == "subscribed":
                reason = f"New from {channel}"
            else:
                reason = "Trending on YouTube"

        # Importance scoring heuristic
        if source == "subscribed":
            importance_score = 7
        else:
            importance_score = 5

        # Boost score for high view count videos
        view_count = video.get("view_count", 0)
        if view_count > 1000000:
            importance_score = min(10, importance_score + 2)
        elif view_count > 100000:
            importance_score = min(10, importance_score + 1)

        return VideoRecommendation(
            video_id=video.get("id", ""),
            title=video.get("title", "Untitled"),
            author=channel,
            author_id=video.get("channel_id", ""),
            cover_url=video.get("thumbnail", ""),
            duration=video.get("duration", 0),
            view_count=video.get("view_count", 0),
            url=f"https://www.youtube.com/watch?v={video.get('id', '')}",
            reason=reason,
            source=source,
            importance_score=importance_score,
        )

    async def get_keyword_recommendations(
        self,
        keywords: str,
        persona: Optional[str] = None,
        count: int = 10
    ) -> list[VideoRecommendation]:
        """
        Get YouTube recommendations based on keywords and persona (no auth required).
        Uses Playwright to search YouTube directly.
        """
        from datetime import datetime, timedelta

        try:
            # Generate search queries from persona and keywords using AI
            search_queries = await self._generate_search_queries(keywords, persona, count)
            print(f"[YouTube] Generated search queries: {search_queries}")

            await self._ensure_browser()
            context = await self._create_context()
            all_videos = []

            try:
                page = await context.new_page()

                for query in search_queries[:5]:  # Limit to 5 queries
                    try:
                        import urllib.parse
                        encoded_query = urllib.parse.quote(query)
                        # Add "this week" filter with sp parameter
                        search_url = f"https://www.youtube.com/results?search_query={encoded_query}&sp=EgIIAw%253D%253D"
                        print(f"[YouTube] Searching: {search_url}")

                        await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_timeout(3000)

                        # Extract video data from the page
                        videos = await self._extract_videos_from_page(page, query)
                        all_videos.extend(videos)
                        print(f"[YouTube] Found {len(videos)} videos for '{query}'")

                        await page.wait_for_timeout(500)

                    except Exception as e:
                        print(f"[YouTube] Error searching for '{query}': {e}")
                        continue

            finally:
                await context.close()

            # Deduplicate by video ID
            seen_ids = set()
            unique_videos = []
            for video in all_videos:
                if video["id"] not in seen_ids:
                    seen_ids.add(video["id"])
                    unique_videos.append(video)

            print(f"[YouTube] Found {len(unique_videos)} unique videos from keyword search")

            if not unique_videos:
                return []

            # Use AI to select best matches
            selected_videos = await self._ai_select_keyword_videos(
                unique_videos, keywords, persona, count
            )

            # Build recommendations
            recommendations = []
            channel_count = {}

            for video in selected_videos:
                channel_id = video.get("channel_id", "")

                if channel_count.get(channel_id, 0) >= 2:
                    continue

                reason = video.get("_ai_reason", f"Based on your interests")
                rec = self._build_recommendation(video, "keyword_search", reason)
                recommendations.append(rec)
                channel_count[channel_id] = channel_count.get(channel_id, 0) + 1

                if len(recommendations) >= count:
                    break

            print(f"[YouTube] Final keyword recommendations: {len(recommendations)}")
            return recommendations

        except Exception as e:
            print(f"[YouTube] Error in keyword recommendations: {e}")
            import traceback
            traceback.print_exc()
            return []

    async def _extract_videos_from_page(self, page: Page, query: str) -> list[dict]:
        """Extract video information from YouTube search results page."""
        videos = []

        try:
            # Wait for video results to load
            await page.wait_for_selector("ytd-video-renderer", timeout=10000)

            # Get all video renderer elements
            video_elements = await page.query_selector_all("ytd-video-renderer")

            for element in video_elements[:15]:  # Limit to 15 per query
                try:
                    # Extract video ID from thumbnail link
                    link_element = await element.query_selector("a#thumbnail")
                    if not link_element:
                        continue

                    href = await link_element.get_attribute("href")
                    if not href or "/watch?v=" not in href:
                        continue

                    video_id = href.split("/watch?v=")[1].split("&")[0]

                    # Extract title
                    title_element = await element.query_selector("#video-title")
                    title = await title_element.get_attribute("title") if title_element else ""
                    if not title:
                        title = await title_element.inner_text() if title_element else "Unknown"

                    # Extract channel name
                    channel_element = await element.query_selector("ytd-channel-name a")
                    channel_name = await channel_element.inner_text() if channel_element else "Unknown"

                    # Extract channel ID from link
                    channel_id = ""
                    if channel_element:
                        channel_href = await channel_element.get_attribute("href")
                        if channel_href and "/@" in channel_href:
                            channel_id = channel_href.split("/@")[1].split("/")[0]
                        elif channel_href and "/channel/" in channel_href:
                            channel_id = channel_href.split("/channel/")[1].split("/")[0]

                    # Extract thumbnail
                    thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                    # Extract view count and time (optional)
                    metadata_element = await element.query_selector("#metadata-line")
                    view_count = 0
                    if metadata_element:
                        metadata_text = await metadata_element.inner_text()
                        # Try to parse view count
                        view_match = re.search(r'([\d,.]+[KMB]?)\s*views', metadata_text, re.IGNORECASE)
                        if view_match:
                            view_str = view_match.group(1).replace(",", "")
                            if "K" in view_str.upper():
                                view_count = int(float(view_str.upper().replace("K", "")) * 1000)
                            elif "M" in view_str.upper():
                                view_count = int(float(view_str.upper().replace("M", "")) * 1000000)
                            elif "B" in view_str.upper():
                                view_count = int(float(view_str.upper().replace("B", "")) * 1000000000)
                            else:
                                view_count = int(view_str)

                    videos.append({
                        "id": video_id,
                        "title": title.strip(),
                        "channel_name": channel_name.strip(),
                        "channel_id": channel_id,
                        "thumbnail": thumbnail,
                        "view_count": view_count,
                        "matched_query": query,
                    })

                except Exception as e:
                    print(f"[YouTube] Error extracting video: {e}")
                    continue

        except Exception as e:
            print(f"[YouTube] Error extracting videos from page: {e}")

        return videos

    async def _generate_search_queries(
        self,
        keywords: str,
        persona: Optional[str],
        count: int
    ) -> list[str]:
        """Use AI to generate relevant YouTube search queries."""
        try:
            openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            persona_section = f"\nUser Persona: {persona}" if persona else ""

            prompt = f"""Generate 5 YouTube search queries to find the LATEST, most recent videos posted this week.

Keywords/Interests: {keywords}{persona_section}

Requirements:
- Target fresh content from the past few days — do NOT include years like 2024 or 2023
- Use terms like "latest", "new", "this week", or just the topic without a year
- Queries should be specific and likely to return good YouTube results
- Each query 2-5 words

Return ONLY a JSON array of strings, no markdown:
["query1", "query2", "query3", "query4", "query5"]"""

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Generate YouTube search queries. Return only valid JSON array."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.8
            )

            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.replace("```json", "").replace("```", "").strip()

            queries = json.loads(content)
            return queries if isinstance(queries, list) else [keywords]

        except Exception as e:
            print(f"[YouTube] Failed to generate search queries: {e}")
            # Fallback to simple keyword splitting
            return [keywords] + keywords.split(",")[:4]

    async def _search_videos(
        self,
        session: aiohttp.ClientSession,
        api_key: str,
        query: str,
        max_results: int,
        published_after: str
    ) -> list[dict]:
        """Search for videos using YouTube Data API."""
        videos = []

        try:
            async with session.get(
                f"{self.API_BASE}/search",
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "order": "relevance",
                    "maxResults": max_results,
                    "publishedAfter": published_after,
                    "key": api_key,
                },
            ) as response:
                if response.status != 200:
                    error = await response.text()
                    print(f"[YouTube] Search failed: {error}")
                    return []

                data = await response.json()

                for item in data.get("items", []):
                    videos.append({
                        "id": item["id"]["videoId"],
                        "title": item["snippet"]["title"],
                        "channel": item["snippet"]["channelTitle"],
                        "channel_id": item["snippet"]["channelId"],
                        "thumbnail": item["snippet"]["thumbnails"].get("high", {}).get("url", ""),
                        "description": item["snippet"].get("description", "")[:200],
                    })

            # Enrich with duration and view count
            if videos:
                videos = await self._enrich_videos_with_key(session, api_key, videos)

        except Exception as e:
            print(f"[YouTube] Search error: {e}")

        return videos

    async def _enrich_videos_with_key(
        self,
        session: aiohttp.ClientSession,
        api_key: str,
        videos: list[dict]
    ) -> list[dict]:
        """Add duration and view count using API key."""
        try:
            video_ids = [v["id"] for v in videos]

            async with session.get(
                f"{self.API_BASE}/videos",
                params={
                    "part": "contentDetails,statistics",
                    "id": ",".join(video_ids),
                    "key": api_key,
                },
            ) as response:
                if response.status != 200:
                    return videos
                data = await response.json()

            details = {
                item["id"]: {
                    "duration": self._parse_duration(item["contentDetails"]["duration"]),
                    "view_count": int(item["statistics"].get("viewCount", 0)),
                }
                for item in data.get("items", [])
            }

            for video in videos:
                if video["id"] in details:
                    video.update(details[video["id"]])

        except Exception as e:
            print(f"[YouTube] Enrich error: {e}")

        return videos

    async def _ai_select_keyword_videos(
        self,
        candidates: list[dict],
        keywords: str,
        persona: Optional[str],
        count: int
    ) -> list[dict]:
        """Use AI to select best videos from keyword search results."""
        try:
            openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            candidate_list = []
            for i, video in enumerate(candidates[:30]):
                candidate_list.append({
                    "id": i,
                    "title": video.get("title", "")[:100],
                    "channel": video.get("channel", "Unknown"),
                    "views": video.get("view_count", 0),
                })

            persona_section = f"\n\nUser Persona:\n{persona}" if persona else ""

            prompt = f"""Select the top {count} YouTube videos for this user.

Keywords/Interests: {keywords}{persona_section}

CONSTRAINTS:
- Maximum 2 videos from the same channel
- Prioritize content diversity and quality

Candidates:
{json.dumps(candidate_list, indent=2)}

Return a JSON array with exactly {count} objects:
- "id": the video id from the list
- "reason": personalized 1-sentence explanation

Return ONLY valid JSON array, no markdown."""

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Select YouTube videos. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )

            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.replace("```json", "").replace("```", "").strip()

            selections = json.loads(content)

            selected = []
            for selection in selections:
                idx = selection.get("id", 0)
                if 0 <= idx < len(candidates):
                    video = candidates[idx].copy()
                    video["_ai_reason"] = selection.get("reason", "Based on your interests")
                    selected.append(video)

            return selected

        except Exception as e:
            print(f"[YouTube] AI selection failed: {e}")
            return candidates[:count]

    async def cleanup_session(self, session_id: str) -> None:
        """Not needed for OAuth flow."""
        pass

    async def shutdown(self):
        """Clean up browser resources."""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
