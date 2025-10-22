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

    console.log('Starting feedback clustering...');

    // Get unprocessed feedback
    const { data: feedbackItems, error: fetchError } = await supabase
      .from('feedback_sources')
      .select('*')
      .is('processed_at', null)
      .limit(100);

    if (fetchError) throw fetchError;

    if (!feedbackItems || feedbackItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unprocessed feedback found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${feedbackItems.length} feedback items`);

    // Analyze and classify feedback
    for (const item of feedbackItems) {
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
              content: 'You are a feedback classifier. Analyze the feedback and extract: theme (main topic), area (product area), and sentiment (-1 to 1). Respond in JSON format with keys: theme, area, sentiment.'
            },
            {
              role: 'user',
              content: `Analyze this feedback: "${item.content}"`
            }
          ],
        }),
      });

      const aiData = await response.json();
      const analysis = JSON.parse(aiData.choices[0].message.content);

      // Find or create cluster
      const { data: existingCluster } = await supabase
        .from('clusters')
        .select('*')
        .eq('theme', analysis.theme)
        .eq('area', analysis.area)
        .maybeSingle();

      let clusterId;

      if (existingCluster) {
        // Update existing cluster
        const { data: updated } = await supabase
          .from('clusters')
          .update({
            mentions_count: existingCluster.mentions_count + 1,
            sentiment: (existingCluster.sentiment * existingCluster.mentions_count + analysis.sentiment) / (existingCluster.mentions_count + 1),
          })
          .eq('id', existingCluster.id)
          .select()
          .single();
        
        clusterId = updated?.id;
      } else {
        // Create new cluster
        const { data: newCluster } = await supabase
          .from('clusters')
          .insert({
            theme: analysis.theme,
            area: analysis.area,
            sentiment: analysis.sentiment,
            mentions_count: 1,
            impact_score: 0,
          })
          .select()
          .single();
        
        clusterId = newCluster?.id;
      }

      // Update feedback with cluster and sentiment
      await supabase
        .from('feedback_sources')
        .update({
          cluster_id: clusterId,
          sentiment: analysis.sentiment,
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      console.log(`Processed feedback ${item.id} -> cluster ${clusterId}`);
    }

    // Log clustering event
    await supabase.from('events').insert({
      event_type: 'feedback_clustered',
      metadata: { processed_count: feedbackItems.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: feedbackItems.length,
        message: 'Feedback clustering completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cluster-feedback:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});