/**
 * Reddit JSON API Wrapper
 * Uses public endpoint - no authentication required
 */

import axios, { AxiosError } from 'axios';
import { RedditPost, RedditApiResponse } from './types';

const USER_AGENT = 'Loopd/1.0 (Feedback Aggregator)';
const BASE_URL = 'https://www.reddit.com';
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;

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
  const url = `${BASE_URL}/r/${subreddit}/new.json`;
  const params: any = {
    limit: 100,
    raw_json: 1
  };

  if (after) {
    params.after = after;
  }

  try {
    const response = await axios.get<RedditApiResponse>(url, {
      params,
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;

    // Handle rate limiting (429)
    if (axiosError.response?.status === 429 && retryCount < MAX_RETRIES) {
      const waitTime = Math.pow(2, retryCount) * 10000; // 10s, 20s, 40s
      console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
      await delay(waitTime);
      return fetchRedditPage(subreddit, after, retryCount + 1);
    }

    // Handle subreddit not found (404)
    if (axiosError.response?.status === 404) {
      throw new Error(`Subreddit r/${subreddit} not found or is private`);
    }

    // Handle subreddit banned/quarantined (403)
    if (axiosError.response?.status === 403) {
      throw new Error(`Subreddit r/${subreddit} is private or restricted`);
    }

    throw new Error(`Reddit API error: ${axiosError.message}`);
  }
}

/**
 * Validates subreddit existence
 */
export async function validateSubreddit(subreddit: string): Promise<boolean> {
  try {
    const url = `${BASE_URL}/r/${subreddit}/about.json`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    return response.data?.data?.subscribers !== undefined;
  } catch (error) {
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
  const cleaned = input.trim().toLowerCase();
  return cleaned.startsWith('r/') ? cleaned.substring(2) : cleaned;
}
