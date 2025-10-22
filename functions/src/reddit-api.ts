/**
 * Reddit API wrapper using OAuth script credentials
 */

import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions/v1';
import { RedditPost, RedditApiResponse } from './types';

const USER_AGENT = 'LoopdFeedbackBot/1.0 (+https://loopd.app/contact)';
const OAUTH_BASE = 'https://oauth.reddit.com';
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 30000;

interface OAuthToken {
  token: string;
  expiresAt: number;
}

let cachedToken: OAuthToken | null = null;

const normalizeSubreddit = (subreddit: string): string => {
  const cleaned = subreddit.trim().replace(/^r\//i, '');
  return cleaned.replace(/[^0-9a-zA-Z_]+/g, '').toLowerCase();
};

const getRedditCredentials = () => {
  const config = functions.config();
  const clientId = config?.reddit?.client_id || process.env.REDDIT_CLIENT_ID;
  const clientSecret = config?.reddit?.client_secret || process.env.REDDIT_CLIENT_SECRET;
  const username = config?.reddit?.username || process.env.REDDIT_USERNAME;
  const password = config?.reddit?.password || process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Reddit API credentials not configured. Set reddit.client_id, reddit.client_secret, reddit.username, and reddit.password.');
  }

  return { clientId, clientSecret, username, password };
};

const requestAccessToken = async (): Promise<OAuthToken> => {
  const { clientId, clientSecret, username, password } = getRedditCredentials();

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    scope: 'read'
  });

  try {
    const response = await axios.post('https://www.reddit.com/api/v1/access_token', params.toString(), {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      },
      timeout: REQUEST_TIMEOUT
    });

    const { access_token: accessToken, expires_in: expiresIn } = response.data;

    console.log('[reddit] obtained access token', { expiresIn });

    if (!accessToken) {
      throw new Error('Reddit access token missing in response');
    }

    const token: OAuthToken = {
      token: accessToken,
      expiresAt: Date.now() + (expiresIn - 30) * 1000 // small buffer
    };

    cachedToken = token;
    return token;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new Error(`Failed to obtain Reddit access token: ${axiosError.message}`);
  }
};

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const token = await requestAccessToken();
  return token.token;
};

const redditClient = async () => {
  const token = await getAccessToken();

  return axios.create({
    baseURL: OAUTH_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    },
    timeout: REQUEST_TIMEOUT
  });
};

/**
 * Delays execution for specified milliseconds
 */
const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches posts from a subreddit with exponential backoff retry logic
 */
async function fetchRedditPage(
  subreddit: string,
  after: string | null = null,
  retryCount = 0
): Promise<RedditApiResponse> {
  const safeSubreddit = normalizeSubreddit(subreddit);
  const apiClient = await redditClient();
  const params: Record<string, string | number | undefined> = {
    limit: 100,
    raw_json: 1,
    after: after ?? undefined,
    sort: 'new'
  };

  try {
    const response = await apiClient.get<RedditApiResponse>(`/r/${encodeURIComponent(safeSubreddit)}/new`, { params });
    console.log('[reddit] fetch page', {
      status: response.status,
      subreddit: safeSubreddit,
      after,
      dataKeys: response.data ? Object.keys(response.data) : []
    });

    if (response.status === 200 && response.data) {
      return response.data;
    }

    if (response.status === 404) {
      throw new Error(`Subreddit r/${safeSubreddit} not found or is private`);
    }

    if (response.status === 403) {
      throw new Error(`Subreddit r/${safeSubreddit} is private or restricted`);
    }

    throw new Error(`Unexpected Reddit API status ${response.status}`);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const waitTime = Math.pow(2, retryCount) * 10000; // 10s, 20s, 40s
      console.warn(`Retrying subreddit ${safeSubreddit} after ${waitTime}ms (attempt ${retryCount + 1})`);
      await delay(waitTime);
      return fetchRedditPage(subreddit, after, retryCount + 1);
    }
    const axiosError = error as AxiosError;
    console.error('[reddit] fetch page error', {
      subreddit: safeSubreddit,
      status: axiosError.response?.status,
      data: axiosError.response?.data
    });
    throw error;
  }
}

/**
 * Validates subreddit existence
 */
export async function validateSubreddit(subreddit: string): Promise<boolean> {
  const safeSubreddit = normalizeSubreddit(subreddit);
  const apiClient = await redditClient();

  try {
    const response = await apiClient.get(`/r/${encodeURIComponent(safeSubreddit)}/about`, { params: { raw_json: 1 } });
    console.log('[reddit] validate response', {
      subreddit: safeSubreddit,
      status: response.status,
      dataKeys: response.data ? Object.keys(response.data) : []
    });

    if (response.status === 200) {
      return response.data?.data?.subscribers !== undefined;
    }

    if (response.status === 403 || response.status === 401) {
      // Restricted or private subreddits still exist; treat as valid
      return true;
    }

    return false;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('[reddit] validate error', {
      subreddit: safeSubreddit,
      status: axiosError.response?.status,
      data: axiosError.response?.data
    });

    if (axiosError.response?.status === 403) {
      return true;
    }

    return false;
  }
}

/**
 * Fetches posts from Reddit within a date range
 */
export async function fetchRedditPosts(
  subreddit: string,
  startDate: Date,
  endDate: Date,
  maxPosts: number = 1000
): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);

  let after: string | null = null;
  let hasMore = true;
  let pageCount = 0;

  console.log(`Fetching posts from r/${subreddit} between ${startDate.toISOString()} and ${endDate.toISOString()}`);

  while (hasMore && posts.length < maxPosts) {
    pageCount++;
    console.log(`Fetching page ${pageCount}, collected ${posts.length} posts so far...`);

    try {
      const response = await fetchRedditPage(subreddit, after);
      const children = response.data?.children || [];

      if (children.length === 0) {
        console.log('No more posts available');
        hasMore = false;
        break;
      }

      for (const child of children) {
        const post = child.data;
        const postTimestamp = post.created_utc;

        // Since posts are sorted by new, stop if we've gone past the start date
        if (postTimestamp < startTimestamp) {
          console.log(`Reached posts older than start date (${new Date(postTimestamp * 1000).toISOString()})`);
          hasMore = false;
          break;
        }

        // Only include posts within the date range
        if (postTimestamp >= startTimestamp && postTimestamp <= endTimestamp) {
          // Only include text posts (self posts) or posts with meaningful content
          if (post.is_self || post.selftext) {
            posts.push(post);
          }
        }

        // Stop if we've reached the limit
        if (posts.length >= maxPosts) {
          console.log(`Reached maximum post limit (${maxPosts})`);
          hasMore = false;
          break;
        }
      }

      // Check for pagination
      after = response.data?.after;
      if (!after) {
        console.log('No more pages available');
        hasMore = false;
      }

      // Rate limiting: wait between requests
    if (hasMore) {
      await delay(RATE_LIMIT_DELAY);
    }

  } catch (error) {
      console.error(`Error fetching page ${pageCount}:`, error);
      throw error;
    }
  }

  console.log(`Successfully fetched ${posts.length} posts from r/${subreddit}`);
  return posts;
}

/**
 * Cleans subreddit name (removes r/ prefix if present)
 */
export function cleanSubredditName(input: string): string {
  return normalizeSubreddit(input);
}
