"""
Base service interface for all site integrations.
Each site (Bilibili, YouTube, etc.) implements this interface.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class QRLoginResult:
    """Result of starting QR login."""
    session_id: str
    qr_url: str
    qr_image_base64: Optional[str] = None


@dataclass
class LoginStatusResult:
    """Result of checking login status."""
    status: str  # "pending", "scanned", "confirmed", "expired", "error"
    username: Optional[str] = None
    user_id: Optional[str] = None
    auth_state: Optional[str] = None
    error: Optional[str] = None


@dataclass
class VideoRecommendation:
    """A video recommendation."""
    video_id: str
    title: str
    author: str
    author_id: str
    cover_url: str
    duration: int  # seconds
    view_count: int
    url: str
    reason: str
    source: str  # "subscribed" or "general"
    importance_score: int = 0  # 1-10 AI importance rating


@dataclass
class RecommendationResult:
    """Result containing recommendations and viewing analysis."""
    recommendations: list[VideoRecommendation]
    viewing_analysis: Optional[str] = None


@dataclass
class PostRecommendation:
    """A post recommendation (for Reddit, etc.)."""
    post_id: str
    title: str
    author: str
    subreddit: str
    content_preview: str  # First ~200 chars of content
    thumbnail_url: Optional[str]
    score: int  # upvotes - downvotes
    comment_count: int
    url: str
    permalink: str
    reason: str
    source: str  # "subscribed" or "exploration"
    post_type: str  # "text", "link", "image", "video"


class BaseSiteService(ABC):
    """Abstract base class for all site services."""

    @property
    @abstractmethod
    def site_name(self) -> str:
        """Return the site name (e.g., 'bilibili', 'youtube')."""
        pass

    @abstractmethod
    async def start_qr_login(self, user_id: str) -> QRLoginResult:
        """
        Start QR code login process.

        Args:
            user_id: The platform user ID (for session tracking)

        Returns:
            QRLoginResult with session_id and QR code URL
        """
        pass

    @abstractmethod
    async def check_login_status(self, session_id: str) -> LoginStatusResult:
        """
        Check if user has scanned QR and logged in.

        Args:
            session_id: The session ID from start_qr_login

        Returns:
            LoginStatusResult with current status
        """
        pass

    @abstractmethod
    async def validate_auth(self, auth_state: str) -> bool:
        """
        Check if saved auth state is still valid.

        Args:
            auth_state: The encrypted auth state from database

        Returns:
            True if auth is still valid
        """
        pass

    @abstractmethod
    async def get_recommendations(
        self,
        auth_state: str,
        count: int = 10,
        include_general: bool = True
    ) -> list[VideoRecommendation]:
        """
        Generate recommendations for user.

        Args:
            auth_state: The encrypted auth state
            count: Number of recommendations to return
            include_general: Include recommendations from general feed

        Returns:
            List of VideoRecommendation objects
        """
        pass

    @abstractmethod
    async def cleanup_session(self, session_id: str) -> None:
        """
        Clean up resources for a login session.

        Args:
            session_id: The session ID to clean up
        """
        pass
