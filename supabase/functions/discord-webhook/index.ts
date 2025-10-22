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

    const body = await req.json();

    // Discord webhook verification
    if (body.type === 1) {
      return new Response(
        JSON.stringify({ type: 1 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle Discord message
    if (body.type === 0 && body.content) {
      console.log('Received Discord message:', body.content);

      const feedback = {
        source_type: 'discord',
        external_id: `discord-${body.id}`,
        channel: body.channel_id,
        author: body.author?.username || 'unknown',
        content: body.content,
        metadata: {
          message_id: body.id,
          timestamp: body.timestamp,
          guild_id: body.guild_id,
          attachments: body.attachments?.length || 0
        }
      };

      const { error } = await supabase
        .from('feedback_sources')
        .upsert([feedback], { 
          onConflict: 'external_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Error inserting feedback:', error);
        throw error;
      }

      // Log event
      await supabase.from('events').insert({
        event_type: 'discord_message',
        metadata: { channel: body.channel_id, author: body.author?.username }
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in discord-webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
