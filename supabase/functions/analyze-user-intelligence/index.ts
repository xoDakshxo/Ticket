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

    console.log('Starting user intelligence analysis...');

    // Pre-filter: Only fetch qualified users (reduces dataset by ~95%)
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .or('total_feedback_count.gte.2,total_engagement.gte.10,follower_count.gte.50')
      .order('total_engagement', { ascending: false });

    if (profileError) throw profileError;

    console.log(`Analyzing ${profiles.length} user profiles...`);

    // Calculate dynamic thresholds based on community distribution
    const engagements = profiles.map(p => p.total_engagement).sort((a, b) => b - a);
    const followers = profiles.map(p => p.follower_count).sort((a, b) => b - a);
    const feedbackCounts = profiles.map(p => p.total_feedback_count).sort((a, b) => b - a);

    // Use 90th percentile as baseline for max scores (adaptive to community size)
    const p90Index = Math.floor(profiles.length * 0.1);
    const engagementThreshold = Math.max(engagements[p90Index] || 100, 50);
    const followerThreshold = Math.max(followers[p90Index] || 50, 20);
    const feedbackThreshold = Math.max(feedbackCounts[p90Index] || 5, 3);

    console.log(`Dynamic thresholds: engagement=${engagementThreshold}, followers=${followerThreshold}, feedback=${feedbackThreshold}`);

    // Calculate scores for all profiles first (no AI calls)
    const updates = [];
    const eliteUsers = []; // score >= 60
    const topUsers = []; // score 40-59
    const activeUsers = []; // score 25-39

    for (const profile of profiles) {
      // Dynamic scoring based on community percentiles
      const engagementScore = Math.min((profile.total_engagement / engagementThreshold) * 40, 40);
      const followerScore = Math.min((profile.follower_count / followerThreshold) * 30, 30);
      const qualityScore = profile.approved_suggestions > 0 
        ? Math.min((profile.approved_suggestions / profile.linked_suggestions) * 20, 20)
        : 0;
      const frequencyScore = Math.min((profile.total_feedback_count / feedbackThreshold) * 10, 10);
      
      const superuserScore = engagementScore + followerScore + qualityScore + frequencyScore;
      const feedbackFrequencyScore = Math.min(profile.total_feedback_count / 10, 1) * 100;
      const feedbackQualityScore = profile.linked_suggestions > 0
        ? (profile.approved_suggestions / profile.linked_suggestions) * 100
        : 0;

      updates.push({
        id: profile.id,
        superuser_score: superuserScore,
        feedback_quality_score: feedbackQualityScore,
        feedback_frequency_score: feedbackFrequencyScore,
      });

      // Tiered classification based on score (adjusted for actual data)
      if (superuserScore >= 60) {
        eliteUsers.push({ profile, score: superuserScore });
      } else if (superuserScore >= 40) {
        topUsers.push({ profile, score: superuserScore });
      } else if (superuserScore >= 25) {
        activeUsers.push({ profile, score: superuserScore });
      }
    }

    // Batch update scores without archetypes first
    for (const update of updates) {
      await supabase
        .from('user_profiles')
        .update({
          superuser_score: update.superuser_score,
          feedback_quality_score: update.feedback_quality_score,
          feedback_frequency_score: update.feedback_frequency_score,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id);
    }

    // Smart AI allocation: prioritize elite users, sample others
    const toClassify = [
      ...eliteUsers.map(u => u.profile), // All elite users (score >= 80)
      ...topUsers.slice(0, 15).map(u => u.profile), // Top 15 contributors (60-79)
      ...activeUsers.slice(0, 5).map(u => u.profile) // Sample 5 active members (40-59)
    ].slice(0, 25); // Hard cap at 25 AI calls

    // Calculate dynamic champion threshold (top 20% or score >= 25, whichever is higher)
    const allScores = updates.map(u => u.superuser_score).sort((a, b) => b - a);
    const dynamicThreshold = Math.max(allScores[Math.floor(allScores.length * 0.2)] || 15, 15);

    console.log(`Classified scores for ${profiles.length} profiles. Elite: ${eliteUsers.length}, Top: ${topUsers.length}, Active: ${activeUsers.length}. Dynamic champion threshold: ${dynamicThreshold.toFixed(2)}. Will classify ${toClassify.length} users with AI.`);

    // Batch AI classification with parallel processing
    const archetypePromises = toClassify.map(profile => 
      classifyUserArchetype(profile, supabase).catch(err => {
        console.error(`Failed to classify ${profile.author}:`, err);
        return { type: 'casual_contributor', confidence: 0.5 };
      })
    );

    const archetypes = await Promise.all(archetypePromises);

    // Update archetypes in batch
    for (let i = 0; i < toClassify.length; i++) {
      await supabase
        .from('user_profiles')
        .update({
          archetype: archetypes[i].type,
          archetype_confidence: archetypes[i].confidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', toClassify[i].id);
    }

    // Return top users based on dynamic threshold
    const { data: superusersList } = await supabase
      .from('user_profiles')
      .select('*')
      .gte('superuser_score', dynamicThreshold)
      .order('superuser_score', { ascending: false })
      .limit(20);

    console.log(`Analysis complete. Found ${superusersList?.length || 0} superusers`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profiles_analyzed: profiles.length,
        superusers_found: superusersList?.length || 0,
        top_users: superusersList,
        dynamic_threshold: dynamicThreshold,
        thresholds: {
          engagement: engagementThreshold,
          followers: followerThreshold,
          feedback: feedbackThreshold
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-user-intelligence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function classifyUserArchetype(profile: any, supabase: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return { type: 'casual_contributor', confidence: 0.5 };
  }

  const { data: feedbackSamples } = await supabase
    .from('feedback_sources')
    .select('content')
    .eq('author', profile.author)
    .limit(5);

  const feedbackText = feedbackSamples?.map((f: any) => f.content).join('\n\n') || '';

  const prompt = `Analyze this user's feedback patterns and classify them into ONE archetype:

User Stats:
- Total Feedback: ${profile.total_feedback_count}
- Avg Engagement: ${profile.avg_engagement}
- Followers: ${profile.follower_count}
- Approved Suggestions: ${profile.approved_suggestions}

Sample Feedback:
${feedbackText}

Archetypes:
1. power_user: Heavy user, posts frequently, deep product knowledge
2. feature_visionary: Suggests innovative features, thinks strategically
3. bug_hunter: Focuses on reporting bugs and edge cases
4. quality_gatekeeper: Provides detailed critiques, high standards
5. casual_contributor: Occasional feedback, general comments

Respond with ONLY the archetype name (no explanation).`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a user behavior analyst.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();
    const archetype = data.choices[0].message.content.trim().toLowerCase();
    
    return {
      type: archetype,
      confidence: 0.85
    };
  } catch (error) {
    console.error('AI classification error:', error);
    return { type: 'casual_contributor', confidence: 0.5 };
  }
}
