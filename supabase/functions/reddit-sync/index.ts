import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    created_utc: number;
    subreddit: string;
    score: number;
    num_comments: number;
    permalink: string;
  };
}

// Get Reddit OAuth access token using client_credentials flow
async function getRedditAccessToken(): Promise<string> {
  const clientId = Deno.env.get('REDDIT_CLIENT_ID');
  const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Reddit API credentials not configured');
  }

  console.log('Fetching Reddit OAuth token...');

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'LoopStation:FeedbackCollector:v1.0.0'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OAuth token error:', errorText);
    throw new Error(`Failed to get Reddit access token: ${response.status}`);
  }

  const data = await response.json();
  console.log('Successfully obtained OAuth token');
  return data.access_token;
}

// Helper to delay between batches
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { subreddit, user_id, source_config_id, limit = 100, start_date, end_date } = await req.json();

    // Input validation
    if (!subreddit || typeof subreddit !== 'string') {
      throw new Error('Valid subreddit name is required');
    }
    
    if (!source_config_id || typeof source_config_id !== 'string') {
      throw new Error('Source config ID is required');
    }
    
    if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
      throw new Error('Limit must be a number between 1 and 1000');
    }

    // Validate and parse date range
    const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = end_date ? new Date(end_date) : new Date();
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format provided');
    }
    
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
    
    const daysBack = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Sanitize subreddit name (alphanumeric and underscores only)
    const sanitizedSubreddit = subreddit.replace(/[^a-zA-Z0-9_]/g, '');
    if (!sanitizedSubreddit) {
      throw new Error('Invalid subreddit name format');
    }

    console.log(`Fetching posts from r/${sanitizedSubreddit} (${startDate.toISOString()} to ${endDate.toISOString()}, max ${limit} posts)...`);

    // Get OAuth access token
    const accessToken = await getRedditAccessToken();

    // Calculate cutoff timestamps (end date inclusive to end-of-day UTC)
    const cutoffStart = Math.floor(startDate.getTime() / 1000);
    const endOfDay = new Date(endDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const cutoffEnd = Math.floor(endOfDay.getTime() / 1000);
    
    // Fetch posts with pagination (Reddit requires sequential pagination)
    const REDDIT_PAGE_LIMIT = 100; // Reddit's max per request
    
    console.log(`Starting fetch (range: ${startDate.toISOString()} to ${endDate.toISOString()})...`);

    let allPosts: RedditPost[] = [];
    let currentAfter: string | null = null;
    let pageCount = 0;

    // Fetch pages sequentially (Reddit pagination requires previous page's token)
    while (allPosts.length < limit) {
      const requestUrl: string = `https://oauth.reddit.com/r/${sanitizedSubreddit}/new?limit=${REDDIT_PAGE_LIMIT}${currentAfter ? `&after=${currentAfter}` : ''}`;
      
      console.log(`[Page ${pageCount}] Fetching... (after: ${currentAfter || 'start'}, collected: ${allPosts.length}/${limit})`);
      
      const response: Response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'LoopStation:FeedbackCollector:v1.0.0'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('[Rate limit] Waiting 60 seconds...');
          await delay(60000);
          continue; // Retry this page
        }
        
        if (response.status === 403) {
          throw new Error(`Reddit API access forbidden. Please check your API credentials.`);
        } else if (response.status === 404) {
          throw new Error(`Subreddit r/${sanitizedSubreddit} not found or is private.`);
        } else if (response.status === 401) {
          throw new Error(`Reddit authentication failed. Please verify your client credentials.`);
        }
        
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data: any = await response.json();
      const posts = data.data?.children || [];
      
      if (posts.length === 0) {
        console.log('No more posts available');
        break;
      }
      
      // Filter by date range
      const filteredPosts = posts.filter((post: RedditPost) => 
        post.data.created_utc >= cutoffStart && post.data.created_utc <= cutoffEnd
      );
      
      console.log(`[Page ${pageCount}] Got ${posts.length} posts, ${filteredPosts.length} within date range`);
      
      // If no posts match date filter, we've gone too far back
      if (filteredPosts.length === 0) {
        console.log('Reached posts outside date range, stopping');
        break;
      }
      
      allPosts.push(...filteredPosts);
      currentAfter = data.data?.after || null;
      pageCount++;
      
      // Stop if we've collected enough or no more pages
      if (allPosts.length >= limit || !currentAfter) {
        break;
      }
      
      // If we got fewer filtered posts than total posts, we're at the date boundary
      if (filteredPosts.length < posts.length) {
        console.log('Hit date boundary, stopping pagination');
        break;
      }
      
      // Small delay to avoid rate limits (Reddit allows 60 requests/min)
      await delay(1000);
    }
    
    // Trim to exact limit
    allPosts = allPosts.slice(0, limit);

    console.log(`Fetched ${allPosts.length} total posts within date range`);

    // Process database inserts concurrently for speed
    const BATCH_SIZE = 10;
    const CONCURRENT_DB_BATCHES = 3; // Process 3 batches at once
    let processed = 0;

    // Prepare all batches
    const batches: any[][] = [];
    for (let i = 0; i < allPosts.length; i += BATCH_SIZE) {
      const batch = allPosts.slice(i, i + BATCH_SIZE);
      
      const feedbackBatch = batch.map((post: RedditPost) => ({
        source: 'reddit',
        source_config_id,
        channel: sanitizedSubreddit,
        external_id: `reddit-${post.data.id}`,
        author: post.data.author,
        content: `${post.data.title}\n\n${post.data.selftext}`,
        engagement: post.data.score || 0,
        comment_count: post.data.num_comments || 0
      }));
      
      batches.push(feedbackBatch);
    }

    // Process batches concurrently
    console.log(`Inserting ${batches.length} batches concurrently...`);
    
    for (let i = 0; i < batches.length; i += CONCURRENT_DB_BATCHES) {
      const batchGroup = batches.slice(i, i + CONCURRENT_DB_BATCHES);
      
      const insertPromises = batchGroup.map(async (feedbackBatch) => {
        const { data: upserted, error } = await supabase
          .from('feedback_sources')
          .upsert(feedbackBatch, { 
            onConflict: 'external_id',
            ignoreDuplicates: true 
          })
          .select('id');

        if (error) {
          console.error('Batch insert error:', error);
          return 0;
        }
        return feedbackBatch.length;
      });
      
      const results = await Promise.all(insertPromises);
      processed += results.reduce((sum, count) => sum + count, 0);
    }

    // Log sync event
    await supabase.from('events').insert({
      event_type: 'reddit_sync',
      user_id,
      metadata: { 
        subreddit: sanitizedSubreddit, 
        posts_synced: processed 
      }
    });

    console.log(`Successfully synced ${processed} posts from r/${sanitizedSubreddit}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        posts_synced: processed,
        subreddit: sanitizedSubreddit 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in reddit-sync:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
