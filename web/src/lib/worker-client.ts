/**
 * Client for communicating with the Python Playwright worker.
 * Includes retry logic with exponential backoff for resilience.
 */

const WORKER_URL = process.env.WORKER_URL || "http://localhost:3001";

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes for long-running requests

interface VideoRecommendation {
  video_id: string;
  title: string;
  author: string;
  author_id: string;
  cover_url: string;
  duration: number;
  view_count: number;
  url: string;
  reason: string;
  source: string;
  importance_score: number;
}

interface RecommendationsResponse {
  recommendations: VideoRecommendation[];
  viewing_analysis?: string;
  updated_history?: string;
  updated_channels?: string;
  needs_reauth: boolean;
}

interface PostRecommendation {
  post_id: string;
  title: string;
  author: string;
  subreddit: string;
  content_preview: string;
  thumbnail_url?: string;
  score: number;
  comment_count: number;
  url: string;
  permalink: string;
  reason: string;
  source: string;
  post_type: string;
}

interface RedditRecommendationsResponse {
  recommendations: PostRecommendation[];
}

interface PersonaResponse {
  summary: string;
  interests: string;
  profession: string;
  expertise: string;
  contentPref: string;
  compiledPersona?: string;
}

interface AgentRecommendationItem {
  item_id: string;
  title: string;
  author: string;
  author_id: string;
  cover_url: string;
  url: string;
  reason: string;
  source: string;
  platform: string;
  content_type: string;
  view_count: number;
  duration: number;
  score: number;
  importance_score: number;
}

interface AgentRecommendationResponse {
  recommendations: AgentRecommendationItem[];
  agent_reasoning: string;
  iterations_used: number;
  platforms_queried: string[];
  needs_reauth: Record<string, boolean>;
}

interface AgentRecommendationRequest {
  persona?: string;
  target_count?: number;
  available_connections: Record<string, string | null>;
  keywords?: string;
  viewing_signals?: string;
  cached_history?: string;
  cached_channels?: string;
  ai_model?: string;
  ai_api_key?: string;
  followed_accounts?: { x: string[]; youtube: string[]; bilibili: string[]; wildSearch: string[] };
}

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors
    if (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("socket")
    ) {
      return true;
    }
    // Retry on 5xx server errors
    if (message.includes("request failed: 5")) {
      return true;
    }
  }
  return false;
}

class WorkerClient {
  private baseUrl: string;

  constructor(baseUrl: string = WORKER_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make a request with retry logic and exponential backoff
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = DEFAULT_MAX_RETRIES,
      baseDelayMs = DEFAULT_BASE_DELAY_MS,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = retryOptions;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          const errorMessage = error.detail || `Request failed: ${response.status}`;

          // Don't retry on 4xx client errors (except 429 rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(errorMessage);
          }

          throw new Error(errorMessage);
        }

        return response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const shouldRetry = attempt < maxRetries && isRetryableError(lastError);

        if (shouldRetry) {
          // Exponential backoff with jitter
          const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          console.log(
            `[WorkerClient] Retry ${attempt + 1}/${maxRetries} for ${endpoint} after ${Math.round(delay)}ms: ${lastError.message}`
          );
          await sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/health");
      return true;
    } catch {
      return false;
    }
  }

  // Bilibili methods
  async bilibiliGetRecommendations(
    authState: string,
    count: number = 10,
    includeGeneral: boolean = true,
    persona?: string,
    cachedHistory?: string,
    cachedChannels?: string
  ): Promise<RecommendationsResponse> {
    return this.request<RecommendationsResponse>(
      "/bilibili/recommendations",
      {
        method: "POST",
        body: JSON.stringify({
          auth_state: authState,
          count,
          include_general: includeGeneral,
          persona,
          cached_history: cachedHistory,
          cached_channels: cachedChannels,
        }),
      },
      { timeoutMs: 300000 } // 5 minutes for Bilibili (Playwright is slow)
    );
  }

  // Reddit methods
  async redditGetRecommendations(
    authState: string,
    count: number = 10,
    includeGeneral: boolean = true
  ): Promise<PostRecommendation[]> {
    const response = await this.request<RedditRecommendationsResponse>(
      "/reddit/recommendations",
      {
        method: "POST",
        body: JSON.stringify({
          auth_state: authState,
          count,
          include_general: includeGeneral,
        }),
      }
    );
    return response.recommendations;
  }

  // Reddit keyword-based recommendations (no auth required)
  async redditGetKeywordRecommendations(
    keywords: string,
    count: number = 10,
    persona?: string
  ): Promise<PostRecommendation[]> {
    const response = await this.request<RedditRecommendationsResponse>(
      "/reddit/recommendations/keywords",
      {
        method: "POST",
        body: JSON.stringify({
          keywords,
          count,
          persona,
        }),
      }
    );
    return response.recommendations;
  }

  // X (Twitter) keyword-based recommendations (no auth required)
  async xGetKeywordRecommendations(
    keywords: string,
    count: number = 10,
    persona?: string
  ): Promise<PostRecommendation[]> {
    const response = await this.request<RedditRecommendationsResponse>(
      "/x/recommendations/keywords",
      {
        method: "POST",
        body: JSON.stringify({
          keywords,
          count,
          persona,
        }),
      }
    );
    return response.recommendations;
  }

  // YouTube keyword-based recommendations (no auth required)
  async youtubeGetKeywordRecommendations(
    keywords: string,
    count: number = 10,
    persona?: string
  ): Promise<VideoRecommendation[]> {
    const response = await this.request<RecommendationsResponse>(
      "/youtube/recommendations/keywords",
      {
        method: "POST",
        body: JSON.stringify({
          keywords,
          count,
          persona,
        }),
      }
    );
    return response.recommendations;
  }

  // YouTube methods
  async youtubeGetRecommendations(
    authState: string,
    count: number = 10,
    includeGeneral: boolean = true,
    persona?: string
  ): Promise<VideoRecommendation[]> {
    const response = await this.request<RecommendationsResponse>(
      "/youtube/recommendations",
      {
        method: "POST",
        body: JSON.stringify({
          auth_state: authState,
          count,
          include_general: includeGeneral,
          persona,
        }),
      }
    );
    return response.recommendations;
  }

  // Persona methods
  async personaExtract(
    newInput: string,
    previousInput?: string,
    viewingSignals?: string,
    keywords?: string
  ): Promise<PersonaResponse> {
    return this.request<PersonaResponse>("/persona/extract", {
      method: "POST",
      body: JSON.stringify({
        new_input: newInput,
        previous_input: previousInput,
        viewing_signals: viewingSignals,
        keywords,
      }),
    });
  }

  async personaUpdateFromSignals(
    currentPersona?: string,
    viewingSignals?: string
  ): Promise<PersonaResponse> {
    return this.request<PersonaResponse>("/persona/update-from-signals", {
      method: "POST",
      body: JSON.stringify({
        current_persona: currentPersona,
        viewing_signals: viewingSignals,
      }),
    });
  }

  async agentRecommendations(
    request: AgentRecommendationRequest
  ): Promise<AgentRecommendationResponse> {
    return this.request<AgentRecommendationResponse>(
      "/agent/recommendations",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
      { timeoutMs: 420000 } // 7 minutes for agentic loop (worker timeout is 360s)
    );
  }

  /**
   * Stream agent recommendations as SSE events.
   * Returns the raw Response — does NOT use the retry wrapper (retrying a
   * streaming connection would restart the entire agent run).
   * Uses a 600 s AbortController timeout matching Cloud Run's worker request limit.
   */
  async streamAgentRecommendations(
    request: AgentRecommendationRequest
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600_000); // 600 s
    try {
      const response = await fetch(`${this.baseUrl}/agent/recommendations/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }
}

// Export singleton instance
export const workerClient = new WorkerClient();

// Export types
export type {
  VideoRecommendation,
  RecommendationsResponse,
  PostRecommendation,
  RedditRecommendationsResponse,
  PersonaResponse,
  AgentRecommendationItem,
  AgentRecommendationResponse,
  AgentRecommendationRequest,
};
