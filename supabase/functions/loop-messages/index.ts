import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const context = url.searchParams.get('context') || 'page';
    const relatedId = url.searchParams.get('id') || null;
    
    console.log('Loop Messages called with context:', context, 'relatedId:', relatedId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch relevant data based on context
    let contextData = '';
    let systemPrompt = `You are Loop, a friendly and empathetic junior PM assistant who helps teams understand user feedback. 

Your personality:
- Speak in first person ("I noticed...", "I think...")
- Be warm, confident, and encouraging (not cutesy)
- Keep messages short and actionable
- Use max 1 emoji per message
- Celebrate wins and acknowledge challenges
- Be attentive and helpful

Your tone should be:
- Professional but friendly
- Empathetic to both users and team
- Forward-looking and solution-oriented`;

    if (context === 'dashboard') {
      const { data: clusters } = await supabase
        .from('clusters')
        .select('theme, area, mentions_count, delta_48h')
        .order('delta_48h', { ascending: false })
        .limit(3);

      contextData = `Recent feedback clusters: ${JSON.stringify(clusters)}`;
      systemPrompt += `\n\nCreate a friendly greeting message for the dashboard. Highlight any interesting trends or spikes in the feedback data.`;
    } else if (context === 'ticket' && relatedId) {
      const { data: ticket } = await supabase
        .from('tickets')
        .select('*, clusters(*)')
        .eq('id', relatedId)
        .single();

      contextData = `Ticket details: ${JSON.stringify(ticket)}`;
      systemPrompt += `\n\nProvide context about this ticket and suggest a helpful next step. Connect it to related feedback patterns if relevant.`;
    } else if (context === 'digest') {
      const { data: clusters } = await supabase
        .from('clusters')
        .select('theme, area, sentiment, mentions_count')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      const { data: tickets } = await supabase
        .from('tickets')
        .select('state')
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const doneTickets = tickets?.filter(t => t.state === 'done').length || 0;

      contextData = `Weekly data - Clusters: ${JSON.stringify(clusters)}, Completed tickets: ${doneTickets}`;
      systemPrompt += `\n\nCreate a warm, narrative weekly summary. Highlight what users loved and struggled with, and celebrate team progress. Keep it conversational and encouraging.`;
    } else if (context === 'tip') {
      const { data: clusters } = await supabase
        .from('clusters')
        .select('*')
        .is('status', null)
        .limit(10);

      if (!clusters || clusters.length < 5) {
        return new Response(
          JSON.stringify({ message: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      contextData = `Unassigned clusters: ${clusters.length}`;
      systemPrompt += `\n\nSuggest a helpful action about the ${clusters.length} unassigned clusters. Be proactive but not pushy.`;
    }

    // Generate AI response using Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context: ${contextData}\n\nGenerate a message (max 2 sentences).` }
        ],
        max_completion_tokens: 150,
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status, await aiResponse.text());
      throw new Error('Failed to generate Loop message');
    }

    const aiData = await aiResponse.json();
    const message = aiData.choices[0].message.content;

    // Store the message
    const { error: insertError } = await supabase
      .from('loop_messages')
      .insert({
        message,
        context_type: context || 'page',
        related_id: relatedId || null,
        tone: context === 'digest' ? 'celebratory' : 'friendly',
      });

    if (insertError) {
      console.error('Error storing message:', insertError);
    }

    return new Response(
      JSON.stringify({ message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in loop-messages function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
