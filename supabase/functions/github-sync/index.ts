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

    const { repo_owner, repo_name, github_token, user_id } = await req.json();

    if (!repo_owner || !repo_name || !github_token) {
      throw new Error('Missing required fields: repo_owner, repo_name, github_token');
    }

    console.log(`Syncing GitHub issues from ${repo_owner}/${repo_name}`);

    // Fetch issues from GitHub
    const githubResponse = await fetch(
      `https://api.github.com/repos/${repo_owner}/${repo_name}/issues?state=all&per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${github_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Loopstation'
        }
      }
    );

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error('GitHub API error:', errorText);
      throw new Error(`GitHub API error: ${githubResponse.status} ${errorText}`);
    }

    const issues = await githubResponse.json();
    console.log(`Fetched ${issues.length} issues from GitHub`);

    // Insert feedback into database
    const feedbackItems = issues
      .filter((issue: any) => !issue.pull_request) // Exclude pull requests
      .map((issue: any) => ({
        source_type: 'github',
        external_id: `github-${issue.id}`,
        channel: `${repo_owner}/${repo_name}`,
        author: issue.user?.login || 'unknown',
        content: `${issue.title}\n\n${issue.body || ''}`,
        metadata: {
          state: issue.state,
          labels: issue.labels?.map((l: any) => l.name) || [],
          comments: issue.comments,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          url: issue.html_url
        }
      }));

    if (feedbackItems.length > 0) {
      const { data, error } = await supabase
        .from('feedback_sources')
        .upsert(feedbackItems, { 
          onConflict: 'external_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Error inserting feedback:', error);
        throw error;
      }

      console.log(`Inserted ${feedbackItems.length} feedback items`);
    }

    // Log event
    await supabase.from('events').insert({
      event_type: 'github_sync',
      user_id: user_id,
      metadata: { repo: `${repo_owner}/${repo_name}`, count: feedbackItems.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: feedbackItems.length,
        repo: `${repo_owner}/${repo_name}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in github-sync:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
