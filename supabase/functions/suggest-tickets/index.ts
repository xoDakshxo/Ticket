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
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Calculate time boundaries for time-weighted fetching
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch feedback in time-weighted batches for diverse sampling
    const { data: recentHighPriority } = await supabase
      .from('feedback_sources')
      .select('*')
      .eq('source', 'reddit')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('engagement', { ascending: false })
      .limit(50);

    const { data: highEngagementAllTime } = await supabase
      .from('feedback_sources')
      .select('*')
      .eq('source', 'reddit')
      .order('engagement', { ascending: false })
      .limit(30);

    const { data: highDiscussion } = await supabase
      .from('feedback_sources')
      .select('*')
      .eq('source', 'reddit')
      .gte('comment_count', 10)
      .order('comment_count', { ascending: false })
      .limit(20);

    // Combine and deduplicate by id
    const combinedFeedback = [
      ...(recentHighPriority || []),
      ...(highEngagementAllTime || []),
      ...(highDiscussion || [])
    ];
    const uniqueFeedback = Array.from(
      new Map(combinedFeedback.map(item => [item.id, item])).values()
    );

    if (uniqueFeedback.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch engagement snapshots for velocity calculation (last 48 hours)
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const feedbackIds = uniqueFeedback.map(f => f.id);

    const { data: historicalSnapshots } = await supabase
      .from('feedback_engagement_snapshots')
      .select('feedback_id, engagement, followers, snapshot_at')
      .in('feedback_id', feedbackIds)
      .gte('snapshot_at', fortyEightHoursAgo.toISOString())
      .order('snapshot_at', { ascending: false });

    // Group snapshots by feedback_id for velocity calculation
    const snapshotsByFeedback = (historicalSnapshots || []).reduce((acc: any, snap: any) => {
      if (!acc[snap.feedback_id]) acc[snap.feedback_id] = [];
      acc[snap.feedback_id].push(snap);
      return acc;
    }, {});

    // Fetch recent tickets (last 30 days) to avoid duplicates
    const { data: recentTickets } = await supabase
      .from('tickets')
      .select('id, title, description, created_at, priority, state')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch pending suggestions to avoid re-suggesting
    const { data: pendingSuggestions } = await supabase
      .from('ticket_suggestions')
      .select('id, title, theme, status')
      .eq('status', 'pending')
      .limit(50);

    // Format existing work for AI context
    const existingContext = {
      recentTickets: recentTickets?.map(t => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        state: t.state
      })) || [],
      pendingSuggestions: pendingSuggestions?.map(s => ({
        title: s.title,
        theme: s.theme
      })) || []
    };

    // Group feedback by channel
    const channelGroups = uniqueFeedback.reduce((acc: any, item: any) => {
      const channel = item.channel || 'unknown';
      if (!acc[channel]) acc[channel] = [];
      acc[channel].push(item);
      return acc;
    }, {});

    // Calculate urgency score with velocity tracking
    const feedbackSummary = uniqueFeedback.map((item: any, index: number) => {
      const createdDate = new Date(item.created_at);
      const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate recency multiplier: recent posts get boost
      let recencyMultiplier = 1.0;
      if (daysOld <= 7) recencyMultiplier = 1.5;
      else if (daysOld <= 30) recencyMultiplier = 1.0;
      else recencyMultiplier = 0.6;
      
      // Calculate velocity (engagement growth rate)
      let velocityScore = 0;
      let velocityMultiplier = 1.0;
      
      const snapshots = snapshotsByFeedback[item.id] || [];
      if (snapshots.length >= 2) {
        // Sort by time (oldest first)
        const sortedSnaps = snapshots.sort((a: any, b: any) => 
          new Date(a.snapshot_at).getTime() - new Date(b.snapshot_at).getTime()
        );
        
        const oldest = sortedSnaps[0];
        const newest = sortedSnaps[sortedSnaps.length - 1];
        
        // Calculate percentage growth
        const engagementGrowth = oldest.engagement > 0 
          ? ((newest.engagement - oldest.engagement) / oldest.engagement) * 100 
          : 0;
        const followersGrowth = oldest.followers > 0 
          ? ((newest.followers - oldest.followers) / oldest.followers) * 100 
          : 0;
        
        // Average growth rate
        const avgGrowth = (engagementGrowth + followersGrowth) / 2;
        
        // Velocity score: 0-30 points based on growth rate
        velocityScore = Math.min(Math.max(avgGrowth, 0), 30);
        
        // Trending multiplier for urgency (>20% growth = 1.3x boost)
        if (avgGrowth > 20) velocityMultiplier = 1.3;
        else if (avgGrowth > 10) velocityMultiplier = 1.15;
      }
      
      // Enhanced urgency score with velocity
      const engagementNorm = Math.min((item.engagement || 0) / 1000, 1.0) * 40;
      const recencyScore = recencyMultiplier * 25;
      const discussionScore = Math.min((item.comment_count || 0) / 50, 1.0) * 20;
      const baseUrgency = engagementNorm + recencyScore + discussionScore;
      const urgencyScore = Math.round(baseUrgency * velocityMultiplier);
      
      return {
        ref_id: index,
        channel: item.channel || 'unknown',
        author: item.author,
        content: item.content,
        engagement: item.engagement || 0,
        followers: item.comment_count || 0,
        days_old: daysOld,
        urgency_score: urgencyScore,
        velocity_score: Math.round(velocityScore),
        is_trending: velocityScore > 15,
        external_id: item.external_id
      };
    }).sort((a, b) => b.urgency_score - a.urgency_score); // Sort by urgency

    const channelsList = Object.keys(channelGroups).join(', ');
    
    console.log(`Analyzing feedback:
  - Recent high-priority (last 7 days): ${recentHighPriority?.length || 0}
  - High engagement (all-time): ${highEngagementAllTime?.length || 0}
  - High discussion (>10 comments): ${highDiscussion?.length || 0}
  - Total unique after dedup: ${uniqueFeedback.length}
  - Trending items (>15% growth): ${feedbackSummary.filter(f => f.is_trending).length}
  - Existing tickets (last 30 days): ${recentTickets?.length || 0}
  - Pending suggestions: ${pendingSuggestions?.length || 0}
  - Channels: ${channelsList}`);

    // Call Lovable AI to analyze and suggest tickets
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a product manager analyzing user feedback from multiple products/channels. Your task is to identify the top 10-15 most important actionable tickets based on user feedback patterns.

**MULTI-FACTOR PRIORITIZATION (weighted):**
1. **Urgency Score (calculated)** - Each feedback item has a calculated urgency_score (0-100) based on:
   - Engagement (upvotes/score) - 40% weight
   - Recency (days_old) - Posts <7 days old get 1.5x boost, >30 days get 0.6x
   - Discussion volume (followers/comments) - 20% weight
   - **NEW: Velocity multiplier** - Trending items (>20% growth in 48h) get 1.3x boost
   
2. **Velocity/Trending** - Items with high velocity_score (>15) indicate rapidly growing issues
   - velocity_score represents % growth in engagement over last 48 hours
   - is_trending flag marks items with >15% growth
   - Prioritize trending items as they may become critical soon

3. **Frequency** - Multiple users mentioning similar issues across different posts

4. **Impact** - Issues affecting core functionality or widespread user experience

5. **Clarity** - Specific, actionable feedback over vague complaints

**CRITICAL CONTEXT:**
You are provided with:
- Recent tickets already created (last 30 days) - DO NOT duplicate these
- Pending suggestions already in queue - DO NOT re-suggest these
- Feedback items pre-sorted by urgency_score (includes velocity boost)
- Velocity data showing which issues are gaining traction

**DEDUPLICATION RULES:**
- Check if similar issues are already in recentTickets or pendingSuggestions
- If similar ticket exists, only suggest if feedback provides significant new insight
- Prefer grouping multiple related feedback items into one comprehensive ticket

**SCORING GUIDANCE:**
- impact_score should correlate with urgency_score of source feedback
- High urgency_score (>70) + trending = impact_score 85-100 (URGENT)
- High urgency_score (>70) + multiple mentions = impact_score 80-95
- Medium urgency_score (40-70) + trending = impact_score 65-85
- Medium urgency_score (40-70) = impact_score 50-75
- Low urgency_score (<40) but frequent = impact_score 60-75
- Single mention, low urgency = impact_score 20-50

**OUTPUT REQUIREMENTS:**
- Return 10-15 tickets maximum
- Prioritize high urgency_score items AND trending items
- Include channel name in title (e.g., "ChatGPT: Issue Title")
- Reference all relevant source_refs that support the ticket
- Ensure tickets are actionable and specific
- Flag trending issues in the description`
          },
          {
            role: 'user',
            content: `Analyze user feedback from channels: ${channelsList}

**EXISTING WORK TO AVOID DUPLICATING:**
Recent Tickets (last 30 days):
${JSON.stringify(existingContext.recentTickets, null, 2)}

Pending Suggestions:
${JSON.stringify(existingContext.pendingSuggestions, null, 2)}

**FEEDBACK DATA** (pre-sorted by urgency_score - higher scores = more urgent):
${JSON.stringify(feedbackSummary, null, 2)}

Generate 10-15 actionable tickets. Avoid duplicating existing tickets/suggestions. Prioritize items with high urgency_score and/or multiple similar mentions. Weight recent feedback (low days_old) more heavily.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_tickets',
              description: 'Return 10-15 actionable ticket suggestions prioritized by engagement and impact',
              parameters: {
                type: 'object',
                properties: {
                  tickets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: {
                          type: 'string',
                          description: 'Clear, actionable ticket title (max 80 chars)'
                        },
                        description: {
                          type: 'string',
                          description: 'Detailed description of the issue/request and why it matters'
                        },
                        priority: {
                          type: 'string',
                          enum: ['low', 'medium', 'high'],
                          description: 'Priority based on user impact and frequency'
                        },
                        impact_score: {
                          type: 'number',
                          description: 'Impact score from 1-100 based on user engagement and frequency'
                        },
                        theme: {
                          type: 'string',
                          description: 'Category/theme of the ticket (e.g., UX, Performance, Feature Request)'
                        },
                        velocity_score: {
                          type: 'number',
                          description: 'Velocity score (0-30) representing growth momentum of the issue'
                        },
                        is_trending: {
                          type: 'boolean',
                          description: 'Whether this issue is rapidly gaining traction'
                        },
                        source_refs: {
                          type: 'array',
                          items: { type: 'number' },
                          description: 'Array of ref_id numbers from the feedback that support this ticket'
                        }
                      },
                      required: ['title', 'description', 'priority', 'impact_score', 'theme', 'velocity_score', 'is_trending', 'source_refs'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['tickets'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_tickets' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI usage limit reached. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received:', JSON.stringify(aiData, null, 2));

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    console.log(`Generated ${suggestions.tickets?.length || 0} ticket suggestions`);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map source_refs to feedback IDs and insert into database
    const ticketSuggestions = suggestions.tickets?.map((ticket: any) => ({
      user_id: user.id,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      impact_score: ticket.impact_score,
      theme: ticket.theme,
      velocity_score: ticket.velocity_score || 0,
      is_trending: ticket.is_trending || false,
      status: 'pending',
      source_refs: ticket.source_refs?.map((refId: number) => uniqueFeedback[refId]?.id) || []
    })) || [];

    // Insert suggestions into database
    const { error: insertError } = await supabase
      .from('ticket_suggestions')
      .insert(ticketSuggestions);

    if (insertError) {
      console.error('Error inserting suggestions:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ suggestions: ticketSuggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-tickets:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
