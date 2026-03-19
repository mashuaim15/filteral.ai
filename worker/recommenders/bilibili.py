"""
AI-powered recommendation engine for Bilibili.
Uses OpenAI GPT-4o-mini to analyze preferences and select videos.
"""

import json
import os
from openai import OpenAI

from services.base import VideoRecommendation


class BilibiliAIRecommender:
    """AI-enhanced recommender using GPT to analyze preferences."""

    def __init__(self, api_key: str = None):
        self.openai = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    def analyze_watch_history(self, history: list[dict]) -> str:
        """Analyze watch history to understand user preferences."""
        recent_watches = []
        
        print(f"[WatchHistory] Analyzing {len(history)} items")
        
        for item in history[:50]:
            # Bilibili history API returns nested structure with 'history' containing video details
            # and top-level 'title', 'author_name' etc.
            title = item.get("title", "")
            
            # Try different field names for author
            author = (
                item.get("author_name") or 
                item.get("owner", {}).get("name") or
                item.get("author_mid") or
                "Unknown"
            )
            
            if title:
                recent_watches.append(f"- {title} (by {author})")

        print(f"[WatchHistory] Found {len(recent_watches)} videos with titles")
        
        if not recent_watches:
            return "No watch history available."

        watch_list = "\n".join(recent_watches)
        
        print(f"[WatchHistory] Sending to AI for analysis...")

        response = self.openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are analyzing a user's Bilibili video watch history. Summarize their interests in 2-3 sentences in Chinese. Be specific about topics, creators, and content types they enjoy."
                },
                {
                    "role": "user",
                    "content": f"Here are the recent videos this user watched:\n\n{watch_list}\n\nWhat are their main interests?"
                }
            ],
            max_tokens=200,
            temperature=0.7
        )

        analysis = response.choices[0].message.content
        print(f"[WatchHistory] AI Analysis: {analysis}")
        
        return analysis

    def select_best_videos(
        self,
        candidates: list[dict],
        user_interests: str,
        top_n: int = 10,
        persona: str = ""
    ) -> list[dict]:
        """Use AI to select and rank the best videos."""
        candidate_list = []
        
        # Track authors in candidates for debugging
        author_video_count = {}
        for i, video in enumerate(candidates[:50]):
            author = video.get("_author", "Unknown")
            author_video_count[author] = author_video_count.get(author, 0) + 1
            
            play_count = video.get("play", 0)
            if isinstance(play_count, str):
                play_count = 0
            candidate_list.append({
                "id": i,
                "title": video.get("title", ""),
                "author": author,
                "views": play_count,
                "duration": video.get("length", "0:00")
            })
        
        # Log authors with multiple videos
        multi_video_authors = {k: v for k, v in author_video_count.items() if v > 2}
        if multi_video_authors:
            print(f"⚠️ Authors with >2 videos in candidates: {multi_video_authors}")

        persona_section = f"\n\nUser Persona:\n{persona}" if persona else ""

        response = self.openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are an expert Bilibili content curator. Select the top {top_n} videos for this user.

WEIGHTING:
- User Persona (interests, preferences from profile): 100% importance

CRITICAL CONSTRAINTS (MUST FOLLOW):
- **MAXIMUM 2 VIDEOS from the same author/channel** - Check the "author" field carefully.
- Prioritize content diversity across different topics and creators
- Balance between familiar content and discovery

IMPORTANCE SCORING (1-10):
- 9-10: Must-watch — perfectly matches user interests, high engagement, timely topic
- 7-8: Highly relevant — strong match to persona or viewing patterns
- 5-6: Interesting — decent relevance, worth checking out
- 1-4: Filler — tangentially related, included for diversity

Scoring criteria: relevance to user (40%), content quality signals like views (30%), discovery value (30%).

Return a JSON array with exactly {top_n} objects, each containing:
- "id": the video id from the list
- "reason": a specific 1-sentence explanation in Chinese about WHY they should watch this TODAY (not generic "matches your interests" — mention the specific topic, what makes it timely, or what they'll learn)
- "score": importance score 1-10

Only return valid JSON, no other text."""
                },
                {
                    "role": "user",
                    "content": f"""Watch History & Subscriptions (for candidate context only):
{user_interests}{persona_section}

Available videos:
{json.dumps(candidate_list, ensure_ascii=False, indent=2)}

Select the top {top_n} videos following the weighting and constraints."""
                }
            ],
            max_tokens=1200,
            temperature=0.75
        )

        try:
            result = response.choices[0].message.content.strip()
            
            # Clean markdown code blocks more robustly
            if result.startswith("```json"):
                result = result[7:].strip()  # Remove ```json
            elif result.startswith("```"):
                result = result[3:].strip()  # Remove ```
            
            if result.endswith("```"):
                result = result[:-3].strip()  # Remove trailing ```
            
            # Try to fix incomplete JSON by adding missing closing brackets
            if not result.endswith("]"):
                # Count opening and closing brackets
                open_brackets = result.count("[")
                close_brackets = result.count("]")
                open_braces = result.count("{")
                close_braces = result.count("}")
                
                # Try to close incomplete objects and arrays
                if open_braces > close_braces:
                    # Close incomplete object
                    result += "}"
                if open_brackets > close_brackets:
                    # Close incomplete array
                    result += "]"
            
            parsed = json.loads(result)
            
            # Validate that each item has required fields
            valid_items = []
            for item in parsed:
                if isinstance(item, dict) and "id" in item and "reason" in item:
                    # Ensure score is present, default to 5
                    if "score" not in item:
                        item["score"] = 5
                    else:
                        item["score"] = max(1, min(10, int(item["score"])))
                    valid_items.append(item)
            
            if not valid_items:
                print(f"No valid items in AI response: {result[:200]}")
                return []
            
            return valid_items
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse AI response: {response.choices[0].message.content}")
            print(f"JSON error: {e}")
            
            # Fallback: try to extract valid JSON objects manually
            try:
                content = response.choices[0].message.content
                # Look for individual JSON objects
                import re
                pattern = r'\{\s*"id"\s*:\s*(\d+)\s*,\s*"reason"\s*:\s*"([^"]+)"\s*(?:,\s*"score"\s*:\s*(\d+)\s*)?\}'
                matches = re.findall(pattern, content)

                if matches:
                    print(f"Extracted {len(matches)} items using regex fallback")
                    return [{"id": int(m[0]), "reason": m[1], "score": int(m[2]) if m[2] else 5} for m in matches]
            except Exception:
                pass
            
            return []

    def enhance_recommendations(
        self,
        candidates: list[dict],
        watch_history: list[dict],
        count: int = 10,
        source: str = "subscribed",
        persona: str = ""
    ) -> list[VideoRecommendation]:
        """
        Use AI to select best videos and generate personalized reasons.

        Args:
            candidates: List of candidate videos
            watch_history: User's watch history
            count: Number of recommendations to return
            source: "subscribed" or "general"
            persona: User's compiled persona from preferences

        Returns:
            List of VideoRecommendation with AI-generated reasons
        """
        # Analyze user interests from watch history (50% weight)
        user_interests = self.analyze_watch_history(watch_history)

        print(f"[BilibiliAI] enhance_recommendations called with {len(candidates)} candidates, count={count}")

        if not candidates:
            print("[BilibiliAI] WARNING: No candidates provided!")
            return []

        # IMPORTANT: Limit to same 50 candidates that AI will see
        candidates_for_ai = candidates[:50]

        # Get AI selections with 50/50 persona and history weighting
        # Request ALL candidates to be ranked to ensure we can fill the count
        selections = self.select_best_videos(candidates_for_ai, user_interests, len(candidates_for_ai), persona)

        print(f"AI returned {len(selections)} selections for {count} requested recommendations")

        recommendations = []
        author_count = {}  # Track videos per author
        used_video_ids = set()  # Track which videos we've already added

        # First pass: Add AI-selected videos with their reasons
        for selection in selections:
            video_id = selection.get("id", 0)
            reason = selection.get("reason", "Matches your interests")
            score = selection.get("score", 5)

            # Use the same candidates_for_ai list to retrieve the video
            if video_id < len(candidates_for_ai) and video_id not in used_video_ids:
                video = candidates_for_ai[video_id]

                # Get author identifier - use mid if available, otherwise use name
                author_mid = video.get("_author_mid") or video.get("owner", {}).get("mid")
                author_name = video.get("_author") or video.get("owner", {}).get("name") or "Unknown"

                # Use author_mid if available (more reliable), otherwise use name
                author_key = str(author_mid) if author_mid else author_name

                # Skip if author_key is invalid (0 or empty)
                if not author_key or author_key == "0" or author_key == "Unknown":
                    # Use the author name as fallback
                    author_key = author_name

                # Limit to 2 videos per channel
                current_count = author_count.get(author_key, 0)
                if current_count >= 2:
                    print(f"Skipping video from {author_name} (already have {current_count} videos)")
                    continue

                rec = self._build_recommendation(video, reason, source, score)
                recommendations.append(rec)
                author_count[author_key] = author_count.get(author_key, 0) + 1
                used_video_ids.add(video_id)

                print(f"Added video from {author_name} (count: {author_count[author_key]}, score: {score})")

                # Stop when we have enough recommendations
                if len(recommendations) >= count:
                    break

        # Second pass: If still not enough, fill with remaining candidates
        if len(recommendations) < count:
            print(f"[FillUp] Need {count - len(recommendations)} more recommendations to reach {count}")

            for i, video in enumerate(candidates_for_ai):
                if i in used_video_ids:
                    continue

                author_mid = video.get("_author_mid") or video.get("owner", {}).get("mid")
                author_name = video.get("_author") or video.get("owner", {}).get("name") or "Unknown"
                author_key = str(author_mid) if author_mid else author_name

                if not author_key or author_key == "0" or author_key == "Unknown":
                    author_key = author_name

                # Limit to 2 videos per channel
                current_count = author_count.get(author_key, 0)
                if current_count >= 2:
                    continue

                # Generate a generic reason for fill-up videos
                video_source = video.get("_source", "general")
                if video_source == "subscribed":
                    reason = f"来自你关注的 {author_name} 的新视频"
                else:
                    reason = "热门推荐，可能符合你的兴趣"

                rec = self._build_recommendation(video, reason, source, 3)
                recommendations.append(rec)
                author_count[author_key] = author_count.get(author_key, 0) + 1
                used_video_ids.add(i)

                print(f"[FillUp] Added video from {author_name} (count: {author_count[author_key]})")

                if len(recommendations) >= count:
                    break

        print(f"Final recommendation count: {len(recommendations)} / {count} requested")

        return recommendations

    def _build_recommendation(self, video: dict, reason: str, source: str, importance_score: int = 0) -> VideoRecommendation:
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
        source_label = "关注" if source == "subscribed" else "发现"

        return VideoRecommendation(
            video_id=bvid,
            title=video.get("title", "Unknown"),
            author=author,
            author_id=author_id,
            cover_url=video.get("pic", ""),
            duration=duration_sec,
            view_count=play,
            url=f"https://www.bilibili.com/video/{bvid}",
            reason=f"[{source_label}] {reason}",
            source=source,
            importance_score=importance_score,
        )
