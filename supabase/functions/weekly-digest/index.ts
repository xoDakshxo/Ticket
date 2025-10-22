import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log('Generating weekly digest...');

    // Get top clusters from the last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: topClusters, error } = await supabase
      .from('clusters')
      .select('*')
      .eq('status', 'active')
      .gte('created_at', oneWeekAgo.toISOString())
      .order('impact_score', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!topClusters || topClusters.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No clusters found for digest' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate summary with AI
    const clusterSummaries = topClusters.map(c => 
      `- ${c.theme} (${c.area}): ${c.mentions_count} mentions, sentiment: ${c.sentiment?.toFixed(2)}`
    ).join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a product manager summarizing weekly user feedback. Create a concise, actionable summary of the top themes.'
          },
          {
            role: 'user',
            content: `Summarize these feedback clusters:\n${clusterSummaries}`
          }
        ],
      }),
    });

    const aiData = await response.json();
    const digest = aiData.choices[0].message.content;

    // Log digest generation
    await supabase.from('events').insert({
      event_type: 'digest_generated',
      metadata: { clusters_count: topClusters.length, digest }
    });

    console.log('Digest generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        digest,
        clusters: topClusters
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in weekly-digest:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});