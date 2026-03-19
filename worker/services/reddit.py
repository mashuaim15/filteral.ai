"""
Reddit service implementation.
Handles login and recommendation generation for Reddit.
70% from joined subreddits, 30% from exploration (r/popular).
"""

import asyncio
import aiohttp
import base64
import json
import os
import time
import re
from datetime import datetime, timedelta
from typing import Optional
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from .base import (
    BaseSiteService,
    QRLoginResult,
    LoginStatusResult,
    PostRecommendation,
)


class RedditService(BaseSiteService):
    """Reddit implementation of site service."""

    BASE_URL = "https://www.reddit.com"
    OLD_URL = "https://old.reddit.com"  # Easier to parse

    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self._sessions: dict[str, dict] = {}  # session_id -> session data

    @property
    def site_name(self) -> str:
        return "reddit"

    async def _ensure_browser(self):
        """Ensure browser is running."""
        if self.browser is None:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)

    async def _create_context(self, auth_state: Optional[str] = None) -> BrowserContext:
        """Create a new browser context, optionally with saved state."""
        await self._ensure_browser()

        if auth_state:
            state = json.loads(auth_state)
            return await self.browser.new_context(
                storage_state=state,
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        return await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

    async def start_qr_login(self, user_id: str) -> QRLoginResult:
        """
        Start login for Reddit.
        Reddit doesn't have QR login, so we capture the login page for user to enter credentials.
        """
        await self._ensure_browser()

        context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        try:
            # Navigate to Reddit login page
            await page.goto("https://www.reddit.com/login/", wait_until="networkidle")
            await page.wait_for_timeout(2000)

            # Take screenshot of login area for user reference
            screenshot = await page.screenshot(type="png")
            login_base64 = base64.b64encode(screenshot).decode()

            # Generate session ID
            session_id = f"reddit_{user_id}_{int(time.time())}"

            # Store session
            self._sessions[session_id] = {
                "context": context,
                "page": page,
                "user_id": user_id,
                "started_at": time.time(),
            }

            return QRLoginResult(
                session_id=session_id,
                qr_url="",  # Reddit uses username/password, not QR
                qr_image_base64=login_base64,
            )

        except Exception as e:
            await context.close()
            raise RuntimeError(f"Failed to start Reddit login: {e}")

    async def check_login_status(self, session_id: str) -> LoginStatusResult:
        """Check if user has logged in successfully."""
        session = self._sessions.get(session_id)
        if not session:
            return LoginStatusResult(status="error", error="Session not found")

        page: Page = session["page"]
        context: BrowserContext = session["context"]

        try:
            # Check if we're still on login page
            current_url = page.url

            # If redirected away from login, user might be logged in
            if "/login" not in current_url:
                # Verify by checking for user element or API
                return await self._verify_login(context, session_id)

            # Try to detect login by checking for user menu
            try:
                # Check if user is logged in by looking for username or account button
                user_element = page.locator('[data-testid="reddit-user-icon"]').or_(
                    page.locator('button:has-text("u/")')
                ).or_(
                    page.locator('#USER_DROPDOWN_ID')
                )

                if await user_element.count() > 0:
                    return await self._verify_login(context, session_id)
            except Exception:
                pass

            # Check for timeout (10 minutes for manual login)
            if time.time() - session["started_at"] > 600:
                return LoginStatusResult(status="expired", error="Login session expired")

            return LoginStatusResult(status="pending")

        except Exception as e:
            return LoginStatusResult(status="error", error=str(e))

    async def _verify_login(self, context: BrowserContext, session_id: str) -> LoginStatusResult:
        """Verify login and get user info."""
        try:
            page = await context.new_page()

            # Use Reddit's API to verify login
            await page.goto("https://www.reddit.com/api/me.json", wait_until="networkidle")

            try:
                body = await page.locator("body").inner_text()
                data = json.loads(body)

                if data and data.get("data") and data["data"].get("name"):
                    username = data["data"]["name"]
                    user_id = data["data"].get("id", username)

                    # Save auth state
                    state = await context.storage_state()
                    auth_state = json.dumps(state)

                    await page.close()

                    return LoginStatusResult(
                        status="confirmed",
                        username=username,
                        user_id=user_id,
                        auth_state=auth_state,
                    )
            except json.JSONDecodeError:
                pass
            finally:
                await page.close()

            return LoginStatusResult(status="pending")

        except Exception as e:
            return LoginStatusResult(status="error", error=str(e))

    async def validate_auth(self, auth_state: str) -> bool:
        """Check if auth state is still valid."""
        try:
            context = await self._create_context(auth_state)
            page = await context.new_page()

            try:
                await page.goto("https://www.reddit.com/api/me.json", wait_until="networkidle")
                body = await page.locator("body").inner_text()
                data = json.loads(body)

                return data and data.get("data") and data["data"].get("name") is not None
            finally:
                await context.close()

        except Exception:
            return False

    async def get_recommendations(
        self,
        auth_state: str,
        count: int = 10,
        include_general: bool = True
    ) -> list[PostRecommendation]:
        """
        Generate recommendations for user.
        70% from subscribed subreddits, 30% from exploration.
        """
        context = await self._create_context(auth_state)

        try:
            page = await context.new_page()
            recommendations = []

            # Get user's subscribed subreddits
            subreddits = await self._get_subscribed_subreddits(page)

            # Calculate split: 70% subscribed, 30% exploration
            subscribed_count = int(count * 0.7)
            exploration_count = count - subscribed_count

            # Get posts from subscribed subreddits
            if subreddits:
                subscribed_posts = await self._get_subreddit_posts(
                    page,
                    subreddits,
                    max_posts=subscribed_count * 3  # Get extra for filtering
                )

                # Filter for quality posts
                quality_posts = self._filter_quality_posts(subscribed_posts)

                for post in quality_posts[:subscribed_count]:
                    rec = self._build_recommendation(post, "subscribed")
                    recommendations.append(rec)

            # Get exploration posts from r/popular
            if include_general and exploration_count > 0:
                popular_posts = await self._get_popular_posts(page, exploration_count * 3)

                # Filter out posts from subscribed subreddits
                subscribed_names = {s.lower() for s in subreddits}
                exploration_posts = [
                    p for p in popular_posts
                    if p.get("subreddit", "").lower() not in subscribed_names
                ]

                quality_exploration = self._filter_quality_posts(exploration_posts)

                for post in quality_exploration[:exploration_count]:
                    rec = self._build_recommendation(post, "exploration")
                    recommendations.append(rec)

            return recommendations

        finally:
            await context.close()

    async def _get_subscribed_subreddits(self, page: Page) -> list[str]:
        """Get user's subscribed subreddits."""
        subreddits = []
        after = None

        # Fetch up to 100 subreddits
        for _ in range(4):  # 25 per page
            url = "https://www.reddit.com/subreddits/mine/subscriber.json?limit=25"
            if after:
                url += f"&after={after}"

            try:
                await page.goto(url, wait_until="networkidle")
                body = await page.locator("body").inner_text()
                data = json.loads(body)

                if not data or not data.get("data"):
                    break

                children = data["data"].get("children", [])
                for child in children:
                    subreddit_data = child.get("data", {})
                    name = subreddit_data.get("display_name")
                    if name:
                        subreddits.append(name)

                after = data["data"].get("after")
                if not after:
                    break

                await page.wait_for_timeout(300)

            except Exception:
                break

        return subreddits

    async def _get_subreddit_posts(
        self,
        page: Page,
        subreddits: list[str],
        max_posts: int = 50
    ) -> list[dict]:
        """Get posts from multiple subreddits."""
        all_posts = []
        posts_per_sub = max(5, max_posts // len(subreddits)) if subreddits else 0

        for subreddit in subreddits[:20]:  # Limit to 20 subreddits
            try:
                url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={posts_per_sub}"
                await page.goto(url, wait_until="networkidle")

                body = await page.locator("body").inner_text()
                data = json.loads(body)

                if data and data.get("data") and data["data"].get("children"):
                    for child in data["data"]["children"]:
                        post_data = child.get("data", {})
                        if post_data and not post_data.get("stickied"):
                            post_data["subreddit"] = subreddit
                            all_posts.append(post_data)

                await page.wait_for_timeout(200)

            except Exception:
                continue

        return all_posts

    async def _get_popular_posts(self, page: Page, max_posts: int = 50) -> list[dict]:
        """Get posts from r/popular."""
        posts = []

        try:
            url = f"https://www.reddit.com/r/popular.json?limit={min(max_posts, 100)}"
            await page.goto(url, wait_until="networkidle")

            body = await page.locator("body").inner_text()
            data = json.loads(body)

            if data and data.get("data") and data["data"].get("children"):
                for child in data["data"]["children"]:
                    post_data = child.get("data", {})
                    if post_data and not post_data.get("stickied"):
                        posts.append(post_data)

        except Exception:
            pass

        return posts

    def _filter_quality_posts(self, posts: list[dict], relaxed: bool = False) -> list[dict]:
        """Filter for quality posts based on engagement and content.

        Args:
            posts: List of post data dicts
            relaxed: If True, use less strict filters (for keyword searches)
        """
        quality_posts = []

        for post in posts:
            # Skip NSFW posts
            if post.get("over_18"):
                continue

            score = post.get("score", 0)
            num_comments = post.get("num_comments", 0)

            if relaxed:
                # Relaxed filter for keyword searches - just needs some engagement
                if score < 1 and num_comments < 1:
                    continue
            else:
                # Strict filter for subscribed content
                if score < 10:
                    continue
                if num_comments < 3 and not post.get("selftext"):
                    continue
                selftext = post.get("selftext", "")
                if post.get("is_self") and len(selftext) < 50 and num_comments < 5:
                    continue

            quality_posts.append(post)

        # Sort by score (engagement)
        quality_posts.sort(key=lambda p: p.get("score", 0), reverse=True)

        return quality_posts

    def _build_recommendation(self, post: dict, source: str) -> PostRecommendation:
        """Build a PostRecommendation from post data."""
        # Determine post type
        if post.get("is_self"):
            post_type = "text"
        elif post.get("is_video"):
            post_type = "video"
        elif post.get("url", "").endswith((".jpg", ".jpeg", ".png", ".gif")):
            post_type = "image"
        else:
            post_type = "link"

        # Get content preview
        selftext = post.get("selftext", "")
        if len(selftext) > 200:
            content_preview = selftext[:197] + "..."
        else:
            content_preview = selftext

        # Get thumbnail
        thumbnail = post.get("thumbnail")
        if thumbnail in ["self", "default", "nsfw", "spoiler", ""]:
            thumbnail = None

        # Build reason
        subreddit = post.get("subreddit", "unknown")
        if source == "subscribed":
            reason = f"From r/{subreddit}, a subreddit you follow"
        else:
            reason = f"Trending on r/{subreddit}"

        return PostRecommendation(
            post_id=post.get("id", ""),
            title=post.get("title", "Untitled"),
            author=post.get("author", "[deleted]"),
            subreddit=subreddit,
            content_preview=content_preview,
            thumbnail_url=thumbnail,
            score=post.get("score", 0),
            comment_count=post.get("num_comments", 0),
            url=post.get("url", ""),
            permalink=f"https://www.reddit.com{post.get('permalink', '')}",
            reason=reason,
            source=source,
            post_type=post_type,
        )

    async def cleanup_session(self, session_id: str) -> None:
        """Clean up resources for a login session."""
        session = self._sessions.pop(session_id, None)
        if session:
            try:
                context = session.get("context")
                if context:
                    await context.close()
            except Exception:
                pass

    async def get_keyword_recommendations(
        self,
        keywords: str,
        persona: Optional[str] = None,
        count: int = 10
    ) -> list[PostRecommendation]:
        """
        Get Reddit posts based on keywords and persona (no auth required).
        1. Generate search queries from persona using AI
        2. Search Reddit and collect ~20 candidates
        3. Use AI to select the best ones based on persona
        Maximum 2 posts from the same subreddit.
        """
        from datetime import datetime, timedelta
        import os
        import aiohttp
        from openai import OpenAI

        print(f"[Reddit] get_keyword_recommendations called - keywords: '{keywords}', persona length: {len(persona) if persona else 0}, count: {count}")

        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        recommendations = []

        # Use AI to generate search queries from persona
        search_queries = []
        if persona:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": "Generate 5 diverse Reddit search queries to find the LATEST posts from this week. Do NOT include years like 2024 or 2023 — use fresh, timeless terms. Cover different aspects of the user's interests. Return only a comma-separated list of search terms."
                        },
                        {
                            "role": "user",
                            "content": f"User Persona: {persona}\n\nGenerate relevant search queries:"
                        }
                    ],
                    max_tokens=150,
                    temperature=0.8
                )
                query_text = response.choices[0].message.content.strip()
                search_queries = [q.strip() for q in query_text.split(",") if q.strip()]
                print(f"[Reddit] AI generated queries: {search_queries}")
            except Exception as e:
                print(f"[Reddit] Error generating queries from persona: {e}")

        # Add keywords as additional queries
        if keywords:
            keyword_list = [k.strip() for k in keywords.split(",") if k.strip()]
            search_queries.extend(keyword_list)

        if not search_queries:
            # Fallback to general popular posts if no queries
            print("[Reddit] No search queries available, using fallback general terms")
            search_queries = ["interesting", "trending", "popular today"]

        # Calculate 3 days ago timestamp (wider window for Reddit)
        three_days_ago = datetime.utcnow() - timedelta(days=3)
        three_days_ago_ts = int(three_days_ago.timestamp())

        all_posts = []

        # Use Playwright for Reddit since they block API requests from cloud IPs
        await self._ensure_browser()
        context = await self._create_context()

        try:
            page = await context.new_page()

            for query in search_queries[:5]:  # Limit to 5 queries
                try:
                    import urllib.parse
                    encoded_query = urllib.parse.quote(query)

                    # Navigate to .json endpoint with browser context (has cookies/JS)
                    json_url = f"https://www.reddit.com/search.json?q={encoded_query}&sort=relevance&t=week&limit=25"
                    print(f"[Reddit] Fetching via Playwright: {json_url}")

                    await page.goto(json_url, wait_until="networkidle", timeout=20000)

                    # Extract JSON from page body
                    body_text = await page.locator("body").inner_text()
                    try:
                        data = json.loads(body_text)
                        children = data.get("data", {}).get("children", [])

                        for child in children:
                            post = child.get("data", {})
                            created = post.get("created_utc", 0)
                            if created >= three_days_ago_ts:
                                post["matched_keyword"] = query
                                all_posts.append(post)

                        print(f"[Reddit] Got {len(children)} posts for '{query}'")
                    except json.JSONDecodeError as e:
                        print(f"[Reddit] Failed to parse JSON for '{query}': {body_text[:200]}")
                        continue

                    await asyncio.sleep(0.5)  # Rate limiting

                except Exception as e:
                    print(f"[Reddit] Error searching for '{query}': {e}")
                    continue

            print(f"[Reddit] Found {len(all_posts)} total posts")
        finally:
            await context.close()

        # Filter quality posts (relaxed for keyword search)
        quality_posts = self._filter_quality_posts(all_posts, relaxed=True)

        # Deduplicate by post ID and limit to 2 per subreddit
        seen_ids = set()
        subreddit_count = {}
        unique_posts = []
        for post in quality_posts:
            post_id = post.get("id")
            subreddit = post.get("subreddit", "").lower()

            if post_id and post_id not in seen_ids:
                if subreddit_count.get(subreddit, 0) < 2:
                    seen_ids.add(post_id)
                    subreddit_count[subreddit] = subreddit_count.get(subreddit, 0) + 1
                    unique_posts.append(post)

        print(f"[Reddit] {len(unique_posts)} unique quality posts after filtering")

        # Use AI to select the best posts if we have persona and enough candidates
        if persona and len(unique_posts) > count:
            unique_posts = await self._ai_select_posts(openai_client, unique_posts, persona, count)
        else:
            unique_posts = unique_posts[:count]

        # Build recommendations with AI-generated reasons
        for post in unique_posts:
            subreddit = post.get("subreddit", "unknown")
            title = post.get("title", "Untitled")

            # Generate personalized reason
            reason = post.get("ai_reason", f"Found in r/{subreddit}")

            rec = PostRecommendation(
                post_id=post.get("id", ""),
                title=title,
                author=post.get("author", "[deleted]"),
                subreddit=subreddit,
                content_preview=post.get("selftext", "")[:200],
                thumbnail_url=self._get_thumbnail(post),
                score=post.get("score", 0),
                comment_count=post.get("num_comments", 0),
                url=post.get("url", ""),
                permalink=f"https://www.reddit.com{post.get('permalink', '')}",
                reason=reason,
                source="ai_search",
                post_type=self._get_post_type(post),
            )
            recommendations.append(rec)

        return recommendations

    async def _ai_select_posts(
        self,
        openai_client,
        posts: list[dict],
        persona: str,
        count: int
    ) -> list[dict]:
        """Use AI to select the best posts based on user persona."""
        try:
            # Build candidates list for AI
            candidates = []
            for i, post in enumerate(posts[:25]):  # Limit to 25 candidates
                candidates.append({
                    "id": i,
                    "title": post.get("title", "")[:100],
                    "subreddit": post.get("subreddit", ""),
                    "score": post.get("score", 0),
                    "preview": post.get("selftext", "")[:150],
                })

            prompt = f"""Based on this user's persona, select the {count} most relevant Reddit posts.

User Persona: {persona}

Candidates:
{json.dumps(candidates, indent=2)}

Return a JSON array of objects with "id" (the candidate id) and "reason" (why this matches the user, 10-15 words).
Example: [{{"id": 0, "reason": "Matches your interest in AI and machine learning"}}]

Return ONLY valid JSON array, no markdown or explanation."""

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You select content that best matches a user's interests. Return only valid JSON."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.5
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON
            if content.startswith("```"):
                content = content.replace("```json", "").replace("```", "").strip()

            selections = json.loads(content)

            # Build selected posts with AI reasons
            selected_posts = []
            for selection in selections[:count]:
                idx = selection.get("id", 0)
                if 0 <= idx < len(posts):
                    post = posts[idx].copy()
                    post["ai_reason"] = selection.get("reason", "Selected for you")
                    selected_posts.append(post)

            print(f"[Reddit] AI selected {len(selected_posts)} posts")
            return selected_posts

        except Exception as e:
            print(f"[Reddit] AI selection failed: {e}")
            # Fallback to top posts by score
            return posts[:count]

    async def get_x_keyword_recommendations(
        self,
        keywords: str,
        persona: Optional[str] = None,
        count: int = 10
    ) -> list[PostRecommendation]:
        """
        Get X/Twitter posts based on keywords and persona (no auth required).
        1. Generate search queries from persona using AI
        2. Search via Nitter and collect ~20 candidates
        3. Use AI to select the best ones based on persona
        Maximum 2 posts from the same author.
        """
        from datetime import datetime, timedelta
        import os
        from openai import OpenAI

        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        recommendations = []

        # Use AI to generate search queries from persona
        search_queries = []
        if persona:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": "Generate 5 diverse Twitter/X search queries to find the LATEST tweets from this week. Do NOT include years like 2024 or 2023. Include hashtags where relevant. Return only a comma-separated list of search terms."
                        },
                        {
                            "role": "user",
                            "content": f"User Persona: {persona}\n\nGenerate relevant search queries:"
                        }
                    ],
                    max_tokens=150,
                    temperature=0.8
                )
                query_text = response.choices[0].message.content.strip()
                search_queries = [q.strip() for q in query_text.split(",") if q.strip()]
                print(f"[X] AI generated queries: {search_queries}")
            except Exception as e:
                print(f"[X] Error generating queries from persona: {e}")

        # Add keywords as additional queries
        if keywords:
            keyword_list = [k.strip() for k in keywords.split(",") if k.strip()]
            search_queries.extend(keyword_list)

        if not search_queries:
            return []

        # Calculate 3 days ago (wider window for X)
        three_days_ago = datetime.utcnow() - timedelta(days=3)

        # Nitter instances to try (public Twitter frontend)
        nitter_instances = [
            "https://nitter.poast.org",
            "https://nitter.net",
        ]

        await self._ensure_browser()
        context = await self._create_context()

        try:
            page = await context.new_page()
            all_tweets = []

            # Search for each query - collect ~20 candidates
            for query in search_queries[:5]:  # Limit to 5 queries
                for nitter_url in nitter_instances:
                    try:
                        # Search Nitter with operators to filter noise
                        import urllib.parse
                        since_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
                        operators = f" -filter:retweets -filter:replies lang:en since:{since_date}"
                        encoded_query = urllib.parse.quote(query + operators)
                        search_url = f"{nitter_url}/search?f=tweets&q={encoded_query}"
                        await page.goto(search_url, wait_until="domcontentloaded", timeout=15000)
                        await page.wait_for_timeout(2000)

                        # Parse tweets from the page
                        tweets = await self._parse_nitter_page(page, query, three_days_ago)
                        if tweets:
                            all_tweets.extend(tweets)
                            break  # Success, move to next query

                    except Exception as e:
                        print(f"[X] Nitter {nitter_url} failed for '{query}': {e}")
                        continue

                await page.wait_for_timeout(300)

            print(f"[X] Found {len(all_tweets)} total tweets")

            # Deduplicate and limit to 2 per author
            seen_ids = set()
            author_count = {}
            unique_tweets = []
            for tweet in all_tweets:
                tweet_id = tweet["id"]
                author = tweet.get("author", "").lower()

                if tweet_id not in seen_ids:
                    if author_count.get(author, 0) < 2:
                        seen_ids.add(tweet_id)
                        author_count[author] = author_count.get(author, 0) + 1
                        unique_tweets.append(tweet)

            print(f"[X] {len(unique_tweets)} unique tweets after filtering")

            # Sort by engagement score before AI selection so best candidates appear first
            unique_tweets.sort(
                key=lambda t: t.get("likes", 0) + t.get("retweets", 0) * 3,
                reverse=True
            )

            # Use AI to select the best tweets if we have persona and enough candidates
            if persona and len(unique_tweets) > count:
                unique_tweets = await self._ai_select_tweets(openai_client, unique_tweets, persona, count)
            else:
                unique_tweets = unique_tweets[:count]

            # Build recommendations
            for tweet in unique_tweets:
                reason = tweet.get("ai_reason", f"Matches your interests on X")

                rec = PostRecommendation(
                    post_id=tweet.get("id", ""),
                    title=tweet.get("text", "")[:100],
                    author=tweet.get("author", "unknown"),
                    subreddit="X",
                    content_preview=tweet.get("text", ""),
                    thumbnail_url=tweet.get("image"),
                    score=tweet.get("likes", 0),
                    comment_count=tweet.get("retweets", 0),  # retweets = sharing strength
                    url=tweet.get("url", ""),
                    permalink=tweet.get("url", ""),
                    reason=reason,
                    source="ai_search",
                    post_type="tweet",
                )
                recommendations.append(rec)

        finally:
            await context.close()

        return recommendations

    async def _ai_select_tweets(
        self,
        openai_client,
        tweets: list[dict],
        persona: str,
        count: int
    ) -> list[dict]:
        """Use AI to select the best tweets based on user persona."""
        try:
            # Build candidates list for AI
            candidates = []
            for i, tweet in enumerate(tweets[:25]):
                candidates.append({
                    "id": i,
                    "text": tweet.get("text", "")[:200],
                    "author": tweet.get("author", ""),
                    "likes": tweet.get("likes", 0),
                    "retweets": tweet.get("retweets", 0),
                })

            prompt = f"""Based on this user's persona, select the {count} most relevant and high-quality tweets based on persona match AND engagement (likes/retweets signal quality and reach).

User Persona: {persona}

Candidates:
{json.dumps(candidates, indent=2)}

Return a JSON array of objects with "id" (the candidate id) and "reason" (why this matches the user, 10-15 words).
Example: [{{"id": 0, "reason": "Great insight on AI trends you follow"}}]

Return ONLY valid JSON array, no markdown or explanation."""

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You select content that best matches a user's interests. Return only valid JSON."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.5
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON
            if content.startswith("```"):
                content = content.replace("```json", "").replace("```", "").strip()

            selections = json.loads(content)

            # Build selected tweets with AI reasons
            selected_tweets = []
            for selection in selections[:count]:
                idx = selection.get("id", 0)
                if 0 <= idx < len(tweets):
                    tweet = tweets[idx].copy()
                    tweet["ai_reason"] = selection.get("reason", "Selected for you")
                    selected_tweets.append(tweet)

            print(f"[X] AI selected {len(selected_tweets)} tweets")
            return selected_tweets

        except Exception as e:
            print(f"[X] AI selection failed: {e}")
            # Fallback to first tweets
            return tweets[:count]

    async def _parse_nitter_page(self, page: Page, keyword: str, cutoff_date: datetime) -> list[dict]:
        """Parse Nitter page to extract recent tweets within the cutoff date."""
        tweets = []
        
        try:
            # Wait for tweet containers
            await page.wait_for_selector(".timeline-item", timeout=5000)
            
            # Get all tweet elements
            tweet_elements = await page.query_selector_all(".timeline-item")
            
            for element in tweet_elements[:20]:  # Limit to 20 tweets
                try:
                    # Extract tweet text
                    text_elem = await element.query_selector(".tweet-content")
                    if not text_elem:
                        continue
                    text = await text_elem.inner_text()
                    text = text.strip()
                    
                    if len(text) < 10:
                        continue
                    
                    # Extract author
                    author_elem = await element.query_selector(".username")
                    author = await author_elem.inner_text() if author_elem else "unknown"
                    author = author.strip().lstrip("@")
                    
                    # Extract link
                    link_elem = await element.query_selector(".tweet-link")
                    link = await link_elem.get_attribute("href") if link_elem else ""
                    
                    # Extract timestamp
                    time_elem = await element.query_selector(".tweet-date a")
                    time_str = await time_elem.get_attribute("title") if time_elem else ""
                    
                    # Check if within 24 hours (simple check - Nitter shows relative times)
                    # If we can't parse time, include it anyway as Nitter search should filter
                    
                    # Generate ID from link
                    tweet_id = link.split("/")[-1].split("#")[0] if link else str(hash(text))
                    
                    # Scrape engagement counts: order is replies, retweets, likes
                    stats = [0, 0, 0]
                    try:
                        stat_elements = await element.query_selector_all(".tweet-stats .tweet-stat-count")
                        for i, el in enumerate(stat_elements[:3]):
                            raw = (await el.inner_text()).strip().replace(",", "")
                            if raw:
                                if raw.endswith("K"):
                                    stats[i] = int(float(raw[:-1]) * 1000)
                                elif raw.endswith("M"):
                                    stats[i] = int(float(raw[:-1]) * 1000000)
                                else:
                                    stats[i] = int(raw)
                    except Exception:
                        pass  # Keep 0s on any parse failure

                    tweets.append({
                        "id": tweet_id,
                        "text": text[:500],
                        "author": author,
                        "url": f"https://twitter.com{link}" if link.startswith("/") else link,
                        "replies": stats[0],
                        "retweets": stats[1],
                        "likes": stats[2],
                        "matched_keyword": keyword,
                    })
                    
                except Exception as e:
                    print(f"Error parsing tweet element: {e}")
                    continue
                    
        except Exception as e:
            print(f"Error parsing Nitter page: {e}")
        
        return tweets

    def _parse_nitter_html(self, html: str, keyword: str) -> list[dict]:
        """Parse Nitter HTML to extract tweets."""
        tweets = []

        try:
            # Simple regex-based parsing for tweet content
            # Look for tweet containers
            tweet_pattern = r'class="tweet-content[^"]*"[^>]*>([^<]+)</div>'
            author_pattern = r'class="username"[^>]*>@([^<]+)</a>'
            link_pattern = r'class="tweet-link"[^>]*href="([^"]+)"'

            import re

            # Find all tweet texts
            texts = re.findall(r'<div class="tweet-content[^"]*">(.+?)</div>', html, re.DOTALL)
            authors = re.findall(r'<a class="username"[^>]*>@([^<]+)</a>', html)
            links = re.findall(r'<a class="tweet-link"[^>]*href="([^"]+)"', html)

            for i, text in enumerate(texts[:10]):
                # Clean HTML from text
                clean_text = re.sub(r'<[^>]+>', '', text).strip()
                if len(clean_text) < 10:
                    continue

                author = authors[i] if i < len(authors) else "unknown"
                link = links[i] if i < len(links) else ""

                # Generate ID from link
                tweet_id = link.split("/")[-1].split("#")[0] if link else str(hash(clean_text))

                tweets.append({
                    "id": tweet_id,
                    "text": clean_text[:500],
                    "author": author,
                    "url": f"https://twitter.com{link}" if link.startswith("/") else link,
                    "likes": 0,
                    "replies": 0,
                    "matched_keyword": keyword,
                })

        except Exception as e:
            print(f"Error parsing Nitter HTML: {e}")

        return tweets

    def _get_thumbnail(self, post: dict) -> Optional[str]:
        """Get a valid thumbnail URL from post."""
        thumbnail = post.get("thumbnail")
        if thumbnail in ["self", "default", "nsfw", "spoiler", "", None]:
            # Try preview images
            preview = post.get("preview", {})
            images = preview.get("images", [])
            if images:
                return images[0].get("source", {}).get("url", "").replace("&amp;", "&")
            return None
        return thumbnail

    def _get_post_type(self, post: dict) -> str:
        """Determine post type."""
        if post.get("is_self"):
            return "text"
        elif post.get("is_video"):
            return "video"
        elif post.get("url", "").endswith((".jpg", ".jpeg", ".png", ".gif")):
            return "image"
        return "link"

    async def shutdown(self):
        """Shutdown the service and clean up all resources."""
        for session_id in list(self._sessions.keys()):
            await self.cleanup_session(session_id)

        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
