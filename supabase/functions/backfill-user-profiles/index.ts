import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting optimized backfill of user profiles...');

    // Single aggregation query instead of N queries
    const { data: aggregatedData, error: aggError } = await supabase.rpc('aggregate_user_profiles');
    
    if (aggError) {
      console.error('Aggregation query failed, falling back to direct queries');
      throw aggError;
    }

    console.log(`Aggregated data for ${aggregatedData?.length || 0} unique authors`);

    // Batch fetch all suggestions once
    const { data: allSuggestions } = await supabase
      .from('ticket_suggestions')
      .select('status, source_refs');

    // Build a map of feedback_id -> suggestions
    const feedbackToSuggestions = new Map<string, { linked: number; approved: number }>();
    
    for (const suggestion of allSuggestions || []) {
      const sourceRefs = (suggestion.source_refs || []) as string[];
      for (const feedbackId of sourceRefs) {
        const current = feedbackToSuggestions.get(feedbackId) || { linked: 0, approved: 0 };
        current.linked++;
        if (suggestion.status === 'approved') current.approved++;
        feedbackToSuggestions.set(feedbackId, current);
      }
    }

    // Prepare bulk upsert data
    const profiles = [];
    
    for (const row of aggregatedData || []) {
      // Get all feedback IDs for this author
      const { data: feedbackIds } = await supabase
        .from('feedback_sources')
        .select('id')
        .eq('author', row.author);

      const ids = feedbackIds?.map(f => f.id) || [];
      let linkedSuggestions = 0;
      let approvedSuggestions = 0;

      // Sum up suggestions from the map
      for (const id of ids) {
        const stats = feedbackToSuggestions.get(id);
        if (stats) {
          linkedSuggestions += stats.linked;
          approvedSuggestions += stats.approved;
        }
      }

      profiles.push({
        author: row.author,
        source: row.source,
        total_feedback_count: row.feedback_count,
        total_engagement: row.total_engagement,
        avg_engagement: row.avg_engagement,
        follower_count: row.max_followers,
        first_seen_at: row.first_seen,
        last_seen_at: row.last_seen,
        linked_suggestions: linkedSuggestions,
        approved_suggestions: approvedSuggestions,
        profile_url: row.source === 'reddit' ? `https://reddit.com/u/${row.author}` : null
      });
    }

    // Bulk upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      await supabase
        .from('user_profiles')
        .upsert(batch, { onConflict: 'author' });
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}`);
    }

    console.log('Backfill complete!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        profiles_created: profiles.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill-user-profiles:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
