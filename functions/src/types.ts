/**
 * Type definitions for Loopd Cloud Functions
 */

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  created_utc: number;
  score: number;
  num_comments: number;
  permalink: string;
  url: string;
  is_self: boolean;
}

export interface RedditApiResponse {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
    after: string | null;
    before: string | null;
  };
}

export interface FeedbackSource {
  content: string;
  author: string;
  channel: string;
  source: 'reddit';
  external_id: string;
  engagement: number;
  created_at: FirebaseFirestore.Timestamp;
  metadata: {
    post_type: 'post';
    permalink: string;
    num_comments: number;
    url: string;
    original_title?: string;
    summarized: boolean;
  };
  user_id: string;
  source_config_id: string;
}

export interface RedditSyncRequest {
  subreddit: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  limit?: number;
  source_config_id: string;
}

export interface SummarizedPost {
  original_title: string;
  summary: string;
  key_points: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}
