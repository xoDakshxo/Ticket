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

    // Fetch all active feedback (from last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeFeedback, error: fetchError } = await supabase
      .from('feedback_sources')
      .select('id, engagement, comment_count')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (fetchError) throw fetchError;

    if (!activeFeedback || activeFeedback.length === 0) {
      console.log('No active feedback to snapshot');
      return new Response(
        JSON.stringify({ message: 'No active feedback', snapshots: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create snapshots
    const snapshots = activeFeedback.map(item => ({
      feedback_id: item.id,
      engagement: item.engagement || 0,
      followers: item.comment_count || 0,
      snapshot_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('feedback_engagement_snapshots')
      .insert(snapshots);

    if (insertError) throw insertError;

    console.log(`Created ${snapshots.length} engagement snapshots`);

    // Clean up old snapshots (keep only last 7 days)
    const { error: deleteError } = await supabase
      .from('feedback_engagement_snapshots')
      .delete()
      .lt('snapshot_at', sevenDaysAgo.toISOString());

    if (deleteError) console.error('Error cleaning old snapshots:', deleteError);

    return new Response(
      JSON.stringify({ 
        message: 'Snapshots collected successfully',
        snapshots: snapshots.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in collect-engagement-snapshots:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
