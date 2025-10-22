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

    const { action_id, cluster_id, user_id, metadata } = await req.json();

    console.log(`Slack action: ${action_id} for cluster ${cluster_id} by user ${user_id}`);

    // Handle different action types
    switch (action_id) {
      case 'create_ticket':
        const { data: cluster } = await supabase
          .from('clusters')
          .select('*')
          .eq('id', cluster_id)
          .single();

        if (cluster) {
          await supabase.from('tickets').insert({
            title: cluster.theme,
            description: `Auto-generated from cluster: ${cluster.theme}`,
            cluster_id: cluster.id,
            priority: 'medium',
            created_by: user_id,
          });
        }
        break;

      case 'mute_cluster':
        await supabase
          .from('clusters')
          .update({ status: 'muted' })
          .eq('id', cluster_id);
        break;

      case 'ask_engineer':
        // Log the ask engineer event
        await supabase.from('events').insert({
          event_type: 'ask_engineer',
          user_id,
          cluster_id,
          metadata: metadata || {}
        });
        break;

      default:
        console.log('Unknown action:', action_id);
    }

    // Log the action
    await supabase.from('events').insert({
      event_type: 'slack_action',
      user_id,
      cluster_id,
      metadata: { action_id, ...metadata }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in slack-action:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});