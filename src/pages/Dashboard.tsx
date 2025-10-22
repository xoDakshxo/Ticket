import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataSourcesManager } from "@/components/DataSourcesManager";
import { TicketSuggestions } from "@/components/TicketSuggestions";
import { CommunityChampions } from "@/components/CommunityChampions";
import { firebase } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Ticket, Sparkles, RefreshCw, TrendingUp } from "lucide-react";
export default function Dashboard() {
  const [stats, setStats] = useState({
    totalFeedback: 0,
    pendingSuggestions: 0,
    createdTickets: 0,
    trendingCount: 0
  });
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    fetchStats();

    // Real-time subscriptions
    const feedbackChannel = firebase.channel('feedback-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'feedback_sources'
    }, () => {
      fetchStats();
    }).subscribe();
    const ticketsChannel = firebase.channel('tickets-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tickets'
    }, () => {
      fetchStats();
    }).subscribe();
    const suggestionsChannel = firebase.channel('suggestions-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ticket_suggestions'
    }, () => {
      fetchStats();
    }).subscribe();
    return () => {
      firebase.removeChannel(feedbackChannel);
      firebase.removeChannel(ticketsChannel);
      firebase.removeChannel(suggestionsChannel);
    };
  }, []);
  const fetchStats = async () => {
    try {
      // Get total feedback count
      const {
        count: feedbackCount
      } = await firebase.from('feedback_sources').select('*', {
        count: 'exact',
        head: true
      });

      // Get pending suggestions count
      const {
        count: suggestionsCount
      } = await firebase.from('ticket_suggestions').select('*', {
        count: 'exact',
        head: true
      }).eq('status', 'pending');

      // Get created tickets count
      const { count: ticketsCount } = await firebase
        .from('tickets')
        .select('*', { count: 'exact', head: true });

      const { count: trendingCount } = await firebase
        .from('ticket_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('is_trending', true);

      setStats({
        totalFeedback: feedbackCount || 0,
        pendingSuggestions: suggestionsCount || 0,
        createdTickets: ticketsCount || 0,
        trendingCount: trendingCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleGenerateSuggestions = async () => {
    try {
      setGenerating(true);
      const { data, error } = await firebase.functions.invoke('suggest-tickets');
      
      if (error) throw error;
      
      if (data?.suggestions) {
        await fetchStats();
        toast({
          title: "Success",
          description: `Generated ${data.suggestions.length} new ticket suggestions`
        });
      }
    } catch (error: any) {
      console.error('Error generating suggestions:', error);
      if (error.message?.includes('429')) {
        toast({
          title: "Rate Limit",
          description: "Too many requests. Please try again later.",
          variant: "destructive"
        });
      } else if (error.message?.includes('402')) {
        toast({
          title: "Usage Limit",
          description: "AI usage limit reached. Please add credits.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to generate suggestions",
          variant: "destructive"
        });
      }
    } finally {
      setGenerating(false);
    }
  };
  return <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Feedback Intelligence</h1>
            <p className="text-lg text-muted-foreground">Turn User feedback into actionable tickets with AI</p>
          </div>
          <Button 
            onClick={handleGenerateSuggestions}
            disabled={generating}
            size="lg"
            className="gap-2"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Suggestions
              </>
            )}
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reddit Posts Synced</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFeedback}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total feedback collected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Suggestions</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingSuggestions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI-generated ticket ideas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Created Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.createdTickets}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Approved and tracked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trending Issues</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Rapidly growing feedback
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Community Champions */}
        <CommunityChampions />

        {/* AI Ticket Suggestions */}
        <TicketSuggestions onTicketCreated={fetchStats} />
      </div>
    </Layout>;
}