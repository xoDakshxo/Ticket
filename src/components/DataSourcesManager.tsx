import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, AlertTriangle, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { firebase } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";

interface DataSource {
  id: string;
  integration_type: string;
  channel: string;
  config: {
    subreddit: string;
  };
  created_at: string;
}

export const DataSourcesManager = () => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSubreddit, setNewSubreddit] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [clearingFeedback, setClearingFeedback] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  const { toast } = useToast();

  const fetchSources = useCallback(async () => {
    try {
      const { data: { user } } = await firebase.auth.getUser();
      if (!user) return;

      const { data, error } = await firebase
        .from('integration_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSources((data || []) as unknown as DataSource[]);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSources();

    // Real-time subscription to feedback sources
    const channel = firebase
      .channel('feedback-sources-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feedback_sources'
      }, () => {
        fetchSources();
      })
      .subscribe();

    return () => {
      firebase.removeChannel(channel);
    };
  }, [fetchSources]);

  const addSource = async () => {
    if (!newSubreddit.trim()) {
      toast({
        title: "Error",
        description: "Please enter a subreddit name",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await firebase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Clean up subreddit name (remove r/ prefix if present)
      const cleanSubreddit = newSubreddit.replace(/^r\//, '').trim();

      // Check for duplicates
      const duplicate = sources.find(
        s => s.config.subreddit.toLowerCase() === cleanSubreddit.toLowerCase()
      );
      if (duplicate) {
        toast({
          title: "Duplicate",
          description: "This subreddit is already being tracked",
          variant: "destructive",
        });
        return;
      }

      const { data: insertData, error } = await firebase
        .from('integration_configs')
        .insert({
          user_id: user.id,
          integration_type: 'reddit',
          config: { subreddit: cleanSubreddit },
          channel: cleanSubreddit,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Set syncing state and start progress animation
      setSyncingSourceId(insertData.id);
      setSyncProgress(0);
      setSyncStatus("🔍 Fetching posts from Reddit...");

      // Animate progress
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) return prev;
          const increment = Math.random() * 10;
          return Math.min(prev + increment, 90);
        });
      }, 300);

      // Update status messages based on progress
      const statusInterval = setInterval(() => {
        setSyncProgress(current => {
          if (current < 30) setSyncStatus("🔍 Fetching posts from Reddit...");
          else if (current < 60) setSyncStatus("📊 Analyzing content...");
          else if (current < 90) setSyncStatus("💾 Saving feedback...");
          return current;
        });
      }, 1500);

      // Start background sync
      firebase.functions.invoke('redditSync', {
        body: { 
          subreddit: cleanSubreddit,
          user_id: user.id,
          source_config_id: insertData.id,
          limit: 1000,
          start_date: dateRange.startDate.toISOString().split('T')[0],
          end_date: dateRange.endDate.toISOString().split('T')[0]
        }
      }).then(({ data: syncData, error: syncError }) => {
        clearInterval(progressInterval);
        clearInterval(statusInterval);
        
        if (syncError) {
          console.error('Background sync error:', syncError);
          setSyncingSourceId(null);
          toast({
            title: "Sync Error",
            description: "Failed to sync posts",
            variant: "destructive",
          });
        } else {
          const postsSynced = syncData?.posts_synced || 0;
          setSyncStatus("✨ Finishing up...");
          setSyncProgress(100);
          
          setTimeout(() => {
            setSyncingSourceId(null);
            toast({
              title: "🎉 Sync Complete",
              description: `Successfully synced ${postsSynced} posts from r/${cleanSubreddit}`,
            });

            // Auto-generate suggestions if enough new feedback collected
            if (postsSynced >= 10) {
              toast({
                title: "🤖 Analyzing feedback...",
                description: "Generating ticket suggestions from new data",
              });

              firebase.functions.invoke('suggestTickets').then(({ data: suggestData, error: suggestError }) => {
                if (suggestError) {
                  console.error('Auto-suggest error:', suggestError);
                } else if (suggestData?.suggestions) {
                  toast({
                    title: "✨ Suggestions ready!",
                    description: `Generated ${suggestData.suggestions.length} new ticket suggestions`,
                  });
                }
              });
            }
          }, 500);
        }
      });

      setNewSubreddit("");
      fetchSources();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const removeSource = async (id: string, subreddit: string) => {
    setRemovingId(id);
    try {
      const { error } = await firebase
        .from('integration_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Source Removed",
        description: `Stopped tracking r/${subreddit}. All related feedback and ticket suggestions have been cleaned up.`,
      });

      fetchSources();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const clearAllFeedback = async () => {
    if (!confirm("Are you sure you want to clear all feedback data? This cannot be undone.")) {
      return;
    }

    setClearingFeedback(true);
    try {
      const { error } = await firebase
        .from('feedback_sources')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) throw error;

      toast({
        title: "Feedback Cleared",
        description: "All feedback data has been removed",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setClearingFeedback(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reddit Threads</CardTitle>
            <CardDescription>
              Add and manage subreddit threads to analyze
            </CardDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearAllFeedback}
            disabled={clearingFeedback}
            className="gap-2"
          >
            {clearingFeedback ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Clear All Feedback
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Source */}
        <div className="space-y-3">
          {/* Date Range Selection */}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.startDate ? format(dateRange.startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.startDate}
                    onSelect={(date) => date && setDateRange({ ...dateRange, startDate: date })}
                    disabled={(date) => date > dateRange.endDate || date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.endDate ? format(dateRange.endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.endDate}
                    onSelect={(date) => date && setDateRange({ ...dateRange, endDate: date })}
                    disabled={(date) => date < dateRange.startDate || date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Subreddit (e.g., lovable or r/lovable)"
              value={newSubreddit}
              onChange={(e) => setNewSubreddit(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSource()}
              className="flex-1"
            />
            <Button onClick={addSource} disabled={adding} className="gap-2 shrink-0">
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Thread
            </Button>
          </div>
        </div>

        {/* Active Threads */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Active Threads ({sources.length})</p>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No subreddits added yet. Add your first thread above!
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div key={source.id} className="space-y-2">
                  <div
                    className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                      syncingSourceId === source.id 
                        ? 'bg-primary/5 border-primary/30 shadow-sm' 
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline">Reddit</Badge>
                      <span className="font-medium">r/{source.config.subreddit}</span>
                      {source.channel && (
                        <Badge variant="secondary">{source.channel}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Added {new Date(source.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSource(source.id, source.config.subreddit)}
                      disabled={removingId === source.id || syncingSourceId === source.id}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      {removingId === source.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove
                    </Button>
                  </div>
                  
                  {/* Progress Bar */}
                  {syncingSourceId === source.id && (
                    <div className="px-3 pb-2 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">{syncStatus}</span>
                        <span className="text-primary font-bold">{Math.round(syncProgress)}%</span>
                      </div>
                      <Progress 
                        value={syncProgress} 
                        className="h-2 bg-secondary/50"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
