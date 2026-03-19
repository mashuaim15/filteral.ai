"""
Bilibili service implementation.
Handles QR login and recommendation generation for Bilibili.
"""

import asyncio
import base64
import json
import os
import time
import io
from typing import Optional
import aiohttp
import qrcode
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from .base import (
    BaseSiteService,
    QRLoginResult,
    LoginStatusResult,
    VideoRecommendation,
)


class BilibiliService(BaseSiteService):
    """Bilibili implementation of site service."""

    BASE_URL = "https://www.bilibili.com"
    API_URL = "https://api.bilibili.com"
    PASSPORT_URL = "https://passport.bilibili.com"

    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self._sessions: dict[str, dict] = {}  # session_id -> session data

    @property
    def site_name(self) -> str:
        return "bilibili"

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
            return await self.browser.new_context(storage_state=state)
        return await self.browser.new_context()

    async def start_qr_login(self, user_id: str) -> QRLoginResult:
        """Start QR code login for Bilibili using official API."""
        try:
            # Headers required by Bilibili API
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.bilibili.com",
            }

            # Use Bilibili's official QR code API
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(
                    f"{self.PASSPORT_URL}/x/passport-login/web/qrcode/generate"
                ) as response:
                    if response.status != 200:
                        raise RuntimeError(f"Failed to generate QR code: HTTP {response.status}")

                    data = await response.json()
                    if data.get("code") != 0:
                        raise RuntimeError(f"Failed to generate QR code: {data.get('message')}")

                    qr_url = data["data"]["url"]
                    qrcode_key = data["data"]["qrcode_key"]

            # Generate QR code image
            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(qr_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")

            # Convert to base64
            buffer = io.BytesIO()
            qr_img.save(buffer, format="PNG")
            qr_base64 = base64.b64encode(buffer.getvalue()).decode()

            # Generate session ID
            session_id = f"bili_{user_id}_{int(time.time())}"

            # Store session (no browser context needed for API-based login)
            self._sessions[session_id] = {
                "qrcode_key": qrcode_key,
                "user_id": user_id,
                "started_at": time.time(),
            }

            print(f"[Bilibili] QR code generated, session: {session_id}")

            return QRLoginResult(
                session_id=session_id,
                qr_url=qr_url,
                qr_image_base64=qr_base64,
            )

        except Exception as e:
            raise RuntimeError(f"Failed to start QR login: {e}")

    async def check_login_status(self, session_id: str) -> LoginStatusResult:
        """Check if user has scanned and confirmed login using official API."""
        session = self._sessions.get(session_id)
        if not session:
            return LoginStatusResult(status="error", error="Session not found")

        qrcode_key = session.get("qrcode_key")
        if not qrcode_key:
            return LoginStatusResult(status="error", error="Invalid session")

        try:
            # Headers required by Bilibili API
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.bilibili.com",
            }

            # Poll Bilibili's official QR code status API
            async with aiohttp.ClientSession(headers=headers) as http_session:
                async with http_session.get(
                    f"{self.PASSPORT_URL}/x/passport-login/web/qrcode/poll",
                    params={"qrcode_key": qrcode_key}
                ) as response:
                    if response.status != 200:
                        return LoginStatusResult(status="error", error=f"HTTP {response.status}")

                    data = await response.json()
                    code = data.get("data", {}).get("code", -1)

                    # Status codes:
                    # 0 = Success (logged in)
                    # 86038 = QR code expired
                    # 86090 = QR code scanned, waiting for confirmation
                    # 86101 = QR code not scanned

                    if code == 0:
                        # Login successful - extract cookies from response
                        url = data["data"].get("url", "")
                        refresh_token = data["data"].get("refresh_token", "")

                        # Get cookies from the response
                        cookies = response.cookies

                        # Also need to visit the URL to set cookies properly
                        # Extract cookies from URL parameters as backup
                        cookie_dict = {}
                        for cookie in cookies.values():
                            cookie_dict[cookie.key] = cookie.value

                        # The URL contains additional auth info, need to fetch it
                        if url:
                            async with http_session.get(url, allow_redirects=False) as auth_resp:
                                # Get cookies set by this response
                                for cookie in auth_resp.cookies.values():
                                    cookie_dict[cookie.key] = cookie.value

                        # Build auth state for Playwright storage format
                        cookies_list = [
                            {
                                "name": name,
                                "value": value,
                                "domain": ".bilibili.com",
                                "path": "/",
                            }
                            for name, value in cookie_dict.items()
                        ]

                        auth_state = json.dumps({
                            "cookies": cookies_list,
                            "origins": [],
                            "refresh_token": refresh_token,
                        })

                        # Get user info
                        username = "Unknown"
                        user_mid = ""

                        # Create browser context with cookies to get user info
                        await self._ensure_browser()
                        context = await self.browser.new_context(storage_state={
                            "cookies": cookies_list,
                            "origins": []
                        })

                        try:
                            page = await context.new_page()
                            await page.goto(f"{self.API_URL}/x/web-interface/nav")
                            body = await page.locator("body").inner_text()
                            nav_data = json.loads(body)

                            if nav_data.get("code") == 0:
                                user_data = nav_data.get("data", {})
                                username = user_data.get("uname", "Unknown")
                                user_mid = str(user_data.get("mid", ""))

                                # Update auth_state with proper storage state
                                full_state = await context.storage_state()
                                full_state["refresh_token"] = refresh_token
                                auth_state = json.dumps(full_state)
                        finally:
                            await context.close()

                        print(f"[Bilibili] Login confirmed for user: {username}")

                        return LoginStatusResult(
                            status="confirmed",
                            username=username,
                            user_id=user_mid,
                            auth_state=auth_state,
                        )

                    elif code == 86038:
                        return LoginStatusResult(status="expired", error="QR code expired")

                    elif code == 86090:
                        return LoginStatusResult(status="scanned")  # Scanned, waiting confirmation

                    elif code == 86101:
                        # Check for timeout (5 minutes)
                        if time.time() - session["started_at"] > 300:
                            return LoginStatusResult(status="expired", error="QR code expired")
                        return LoginStatusResult(status="pending")

                    else:
                        return LoginStatusResult(status="pending")

        except Exception as e:
            print(f"[Bilibili] Status check error: {e}")
            return LoginStatusResult(status="error", error=str(e))

    async def validate_auth(self, auth_state: str) -> bool:
        """Check if auth state is still valid."""
        try:
            context = await self._create_context(auth_state)
            page = await context.new_page()

            try:
                await page.goto(f"{self.API_URL}/x/web-interface/nav")
                body = await page.locator("body").inner_text()
                data = json.loads(body)

                return data.get("code") == 0 and data.get("data", {}).get("isLogin")
            finally:
                await context.close()

        except Exception:
            return False

    async def get_recommendations(
        self,
        auth_state: str,
        count: int = 10,
        include_general: bool = True,
        persona: str = None,
        cached_history: str = None,
        cached_channels: str = None
    ) -> dict:
        """
        Generate recommendations for user using AI. Returns dict with recommendations and analysis.
        
        If auth fails, uses cached_history and cached_channels from DB.
        Returns updated_history and updated_channels when freshly fetched.
        Returns needs_reauth=True when auth has expired.
        """
        from recommenders.bilibili import BilibiliAIRecommender
        import time

        context = await self._create_context(auth_state)
        needs_reauth = False
        updated_history = None
        updated_channels = None

        try:
            page = await context.new_page()

            # First visit Bilibili homepage to initialize cookies properly
            print("[Bilibili] Initializing cookies by visiting homepage...")
            await page.goto("https://www.bilibili.com", wait_until="networkidle")
            await page.wait_for_timeout(2000)
            
            # Debug: Print cookies
            cookies = await context.cookies()
            cookie_names = [c["name"] for c in cookies]
            print(f"[Bilibili] Cookies loaded: {cookie_names}")
            
            # Check for required cookies
            has_sessdata = any(c["name"] == "SESSDATA" for c in cookies)
            has_bili_jct = any(c["name"] == "bili_jct" for c in cookies)
            has_buvid3 = any(c["name"] == "buvid3" for c in cookies)
            print(f"[Bilibili] SESSDATA: {has_sessdata}, bili_jct: {has_bili_jct}, buvid3: {has_buvid3}")

            # Get user info first
            await page.goto(f"{self.API_URL}/x/web-interface/nav")
            body = await page.locator("body").inner_text()
            nav_data = json.loads(body)
            user_mid = nav_data.get("data", {}).get("mid")
            is_logged_in = nav_data.get("data", {}).get("isLogin", False)
            print(f"[Bilibili] User MID: {user_mid}, login status: {is_logged_in}")

            # Try to get fresh watch history and followings
            watch_history = []
            followings = []
            
            if is_logged_in and user_mid:
                # Auth is valid - fetch fresh data
                watch_history = await self._get_watch_history(page, 50)
                print(f"[Bilibili] Got {len(watch_history)} watch history items")
                if watch_history:
                    print(f"[Bilibili] Sample history item keys: {list(watch_history[0].keys())}")
                    # Store for cache update
                    updated_history = json.dumps(watch_history)

                followings = await self._get_followings(page, user_mid, 50)
                print(f"[Bilibili] Got {len(followings)} followings")
                if followings:
                    # Store for cache update
                    updated_channels = json.dumps(followings)
            else:
                # Auth expired - use cached data
                print("[Bilibili] Auth expired, using cached data...")
                needs_reauth = True
                
                if cached_history:
                    try:
                        watch_history = json.loads(cached_history)
                        print(f"[Bilibili] Using {len(watch_history)} cached history items")
                    except:
                        watch_history = []
                
                if cached_channels:
                    try:
                        followings = json.loads(cached_channels)
                        print(f"[Bilibili] Using {len(followings)} cached followings")
                    except:
                        followings = []

            # Get videos from subscriptions
            subscribed_videos = []
            for following in followings[:30]:  # Limit to avoid too many requests
                mid = following.get("mid")
                name = following.get("uname", "Unknown")
                if mid:
                    videos = await self._get_user_videos(page, context, mid, 10)
                    for v in videos:
                        v["_author"] = name
                        v["_author_mid"] = mid
                        v["_source"] = "subscribed"
                    subscribed_videos.extend(videos)

            # Filter watched
            watched_bvids = {h.get("history", {}).get("bvid") for h in watch_history if h.get("history", {}).get("bvid")}
            unwatched = [v for v in subscribed_videos if v.get("bvid") not in watched_bvids]

            # Get general recommendations if enabled
            all_candidates = unwatched.copy()
            if include_general:
                general_videos = await self._get_popular_videos(page, 50)
                followed_mids = {f.get("mid") for f in followings}

                unwatched_general = [
                    v for v in general_videos
                    if v.get("bvid") not in watched_bvids
                    and v.get("owner", {}).get("mid") not in followed_mids
                ]
                for video in unwatched_general:
                    video["_author"] = video.get("owner", {}).get("name", "Unknown")
                    video["_author_mid"] = video.get("owner", {}).get("mid", 0)
                    video["_source"] = "general"
                all_candidates.extend(unwatched_general)

            # Filter by publish date - only videos from last 7 days
            current_time = int(time.time())
            seven_days_ago = current_time - (7 * 24 * 60 * 60)
            
            # Separate subscribed and general videos first
            recent_subscribed = []
            recent_general = []
            
            for video in all_candidates:
                # Bilibili uses 'created' or 'pubdate' field (Unix timestamp)
                pub_date = video.get("created") or video.get("pubdate") or 0
                if pub_date >= seven_days_ago:
                    if video.get("_source") == "subscribed":
                        recent_subscribed.append(video)
                    else:
                        recent_general.append(video)
            
            print(f"[Bilibili] Found {len(recent_subscribed)} subscribed videos and {len(recent_general)} general videos from last 7 days")
            
            # Build candidate pool with 70% subscribed, 30% general
            # Target 50 candidates total for AI
            target_total = 50
            target_subscribed = int(target_total * 0.7)  # 35 subscribed
            target_general = target_total - target_subscribed  # 15 general
            
            # Fill subscribed slots first
            selected_subscribed = recent_subscribed[:target_subscribed]
            remaining_slots = target_total - len(selected_subscribed)
            
            # Fill remaining with general, but cap at target_general unless we need more
            if len(selected_subscribed) >= target_subscribed:
                selected_general = recent_general[:target_general]
            else:
                # Not enough subscribed videos, fill more with general
                selected_general = recent_general[:remaining_slots]
            
            recent_candidates = selected_subscribed + selected_general
            print(f"[Bilibili] Final candidates: {len(selected_subscribed)} subscribed + {len(selected_general)} general = {len(recent_candidates)} total")

            # Use AI to select best videos with 50% persona and 50% history weighting
            ai_recommender = BilibiliAIRecommender()
            
            # Get viewing analysis
            viewing_analysis = ai_recommender.analyze_watch_history(watch_history)
            
            recommendations = ai_recommender.enhance_recommendations(
                candidates=recent_candidates,
                watch_history=watch_history,
                count=count,
                source="mixed",
                persona=persona or ""
            )

            return {
                "recommendations": recommendations,
                "viewing_analysis": viewing_analysis,
                "updated_history": updated_history,
                "updated_channels": updated_channels,
                "needs_reauth": needs_reauth
            }

        finally:
            await context.close()

    def _build_recommendation(self, video: dict, reason: str, source: str) -> VideoRecommendation:
        """Build a VideoRecommendation from video data."""
        duration = video.get("length") or video.get("duration") or "0:00"
        if isinstance(duration, str):
            parts = duration.split(":")
            if len(parts) == 2:
                duration_sec = int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                duration_sec = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            else:
                duration_sec = 0
        else:
            duration_sec = int(duration)

        author = video.get("_author") or video.get("owner", {}).get("name") or "Unknown"
        author_id = str(video.get("_author_mid") or video.get("owner", {}).get("mid") or 0)

        play = video.get("play") or video.get("stat", {}).get("view") or 0
        if isinstance(play, str):
            play = 0

        bvid = video.get("bvid", "")

        return VideoRecommendation(
            video_id=bvid,
            title=video.get("title", "Unknown"),
            author=author,
            author_id=author_id,
            cover_url=video.get("pic", ""),
            duration=duration_sec,
            view_count=play,
            url=f"https://www.bilibili.com/video/{bvid}",
            reason=reason,
            source=source,
        )

    async def _get_watch_history(self, page: Page, max_items: int = 100) -> list[dict]:
        """Get user's watch history using page.evaluate for authenticated API calls."""
        history = []
        
        try:
            # Use page.evaluate to make authenticated fetch calls with proper headers
            print("[WatchHistory] Fetching via API...")
            result = await page.evaluate("""
                async () => {
                    try {
                        // Get CSRF token from cookie
                        const csrf = document.cookie.split('; ').find(row => row.startsWith('bili_jct='))?.split('=')[1] || '';
                        
                        const response = await fetch('https://api.bilibili.com/x/web-interface/history/cursor?view_at=0&ps=50&business=archive', {
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json, text/plain, */*',
                                'Referer': 'https://www.bilibili.com/',
                                'Origin': 'https://www.bilibili.com'
                            }
                        });
                        const data = await response.json();
                        return data;
                    } catch (e) {
                        return { code: -1, message: e.toString() };
                    }
                }
            """)
            
            print(f"[WatchHistory] API response code: {result.get('code')}, message: {result.get('message', 'no message')}")
            
            if result.get("code") == 0:
                items = result.get("data", {}).get("list", [])
                history.extend(items)
                print(f"[WatchHistory] Got {len(items)} items from API")
            else:
                # Try alternative history API endpoint
                print("[WatchHistory] Trying alternative endpoint...")
                result = await page.evaluate("""
                    async () => {
                        try {
                            const response = await fetch('https://api.bilibili.com/x/v2/history?pn=1&ps=50', {
                                credentials: 'include',
                                headers: {
                                    'Accept': 'application/json, text/plain, */*',
                                    'Referer': 'https://www.bilibili.com/'
                                }
                            });
                            const data = await response.json();
                            return data;
                        } catch (e) {
                            return { code: -1, message: e.toString() };
                        }
                    }
                """)
                print(f"[WatchHistory] Alt API response code: {result.get('code')}, message: {result.get('message', 'no message')}")
                if result.get("code") == 0:
                    items = result.get("data", [])
                    history.extend(items)
                    print(f"[WatchHistory] Got {len(items)} items from alt API")
            
        except Exception as e:
            print(f"[WatchHistory] Error: {e}")

        return history[:max_items]

    async def _get_followings(self, page: Page, mid: int, max_count: int = 50) -> list[dict]:
        """Get user's followed channels using page.evaluate for authenticated fetch."""
        followings = []

        for pn in range(1, (max_count // 50) + 2):
            try:
                result = await page.evaluate(f"""
                    async () => {{
                        try {{
                            // Get wbi signature if needed - use simple endpoint first
                            const response = await fetch('https://api.bilibili.com/x/relation/followings?vmid={mid}&pn={pn}&ps=50&order=desc&order_type=attention', {{
                                credentials: 'include',
                                headers: {{
                                    'Accept': 'application/json, text/plain, */*',
                                    'Referer': 'https://space.bilibili.com/{mid}/fans/follow',
                                    'Origin': 'https://space.bilibili.com'
                                }}
                            }});
                            return await response.json();
                        }} catch (e) {{
                            return {{ code: -1, message: e.toString() }};
                        }}
                    }}
                """)

                if result.get("code") != 0:
                    error_code = result.get("code")
                    error_msg = result.get("message", "unknown")
                    print(f"[Followings] API error: code={error_code}, msg={error_msg}")
                    
                    # If -352 (risk control), try navigating to space page first
                    if error_code == -352 and pn == 1:
                        print("[Followings] Risk control detected, visiting space page...")
                        await page.goto(f"https://space.bilibili.com/{mid}/fans/follow", wait_until="networkidle")
                        await page.wait_for_timeout(2000)
                        # Retry
                        result = await page.evaluate(f"""
                            async () => {{
                                try {{
                                    const response = await fetch('https://api.bilibili.com/x/relation/followings?vmid={mid}&pn={pn}&ps=50', {{
                                        credentials: 'include'
                                    }});
                                    return await response.json();
                                }} catch (e) {{
                                    return {{ code: -1, message: e.toString() }};
                                }}
                            }}
                        """)
                        if result.get("code") != 0:
                            print(f"[Followings] Retry failed: {result.get('message')}")
                            break
                    else:
                        break

                items = result.get("data", {}).get("list", [])
                if not items:
                    break

                followings.extend(items)
                await page.wait_for_timeout(500)

                if len(followings) >= max_count:
                    break
            except Exception as e:
                print(f"[Followings] Error: {e}")
                break

        return followings[:max_count]

    async def _get_user_videos(self, page: Page, context: BrowserContext, mid: int, count: int = 10) -> list[dict]:
        """Get videos from a specific user by intercepting API calls."""
        captured = []

        async def handle_response(response):
            if "x/space/wbi/arc/search" in response.url and f"mid={mid}" in response.url:
                try:
                    data = await response.json()
                    if data.get("code") == 0:
                        vlist = data.get("data", {}).get("list", {}).get("vlist", [])
                        captured.extend(vlist)
                except Exception:
                    pass

        page.on("response", handle_response)

        try:
            await page.goto(f"https://space.bilibili.com/{mid}/video", wait_until="load")
            await page.wait_for_timeout(1500)
            await page.evaluate("window.scrollTo(0, 300)")
            await page.wait_for_timeout(2000)
        except Exception:
            pass
        finally:
            page.remove_listener("response", handle_response)

        return captured[:count]

    async def _get_popular_videos(self, page: Page, count: int = 50) -> list[dict]:
        """Get popular videos from Bilibili."""
        url = f"{self.API_URL}/x/web-interface/popular?pn=1&ps={count}"
        await page.goto(url)

        try:
            body = await page.locator("body").inner_text()
            data = json.loads(body)

            if data.get("code") == 0:
                return data.get("data", {}).get("list", [])
        except Exception:
            pass

        return []

    async def cleanup_session(self, session_id: str) -> None:
        """Clean up resources for a login session."""
        session = self._sessions.pop(session_id, None)
        # No browser context to clean up with API-based login
        if session:
            print(f"[Bilibili] Session {session_id} cleaned up")

    async def shutdown(self):
        """Shutdown the service and clean up all resources."""
        for session_id in list(self._sessions.keys()):
            await self.cleanup_session(session_id)

        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
