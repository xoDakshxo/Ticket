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

    const { source_type, external_id, channel, author, content, metadata } = await req.json();

    console.log(`Ingesting feedback from ${source_type}:`, { external_id, author });

    // Insert feedback into database
    const { data: feedback, error } = await supabase
      .from('feedback_sources')
      .insert({
        source_type,
        external_id,
        channel,
        author,
        content,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting feedback:', error);
      throw error;
    }

    // Log event
    await supabase.from('events').insert({
      event_type: 'feedback_ingested',
      metadata: { source_type, external_id }
    });

    return new Response(
      JSON.stringify({ success: true, feedback }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ingest-feedback:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});