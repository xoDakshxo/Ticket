import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { firebase } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Award,
  Target,
  Zap
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";
import type { UserProfile } from "@/types/firestore";

export function CommunityChampions() {
  const [superusers, setSuperusers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [outreachModalOpen, setOutreachModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [outreachMessage, setOutreachMessage] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchSuperusers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch top 20% of users by score (minimum 10 users, maximum 50) for current user
      const { count } = await firebase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.uid);

      const topPercentCount = Math.min(Math.max(Math.floor((count || 0) * 0.2), 10), 50);

      const { data, error } = await firebase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.uid)
        .order('superuser_score', { ascending: false })
        .limit(topPercentCount);

      if (error) throw error;
      setSuperusers(data || []);
    } catch (error: unknown) {
      console.error('Error fetching superusers:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to load community champions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSuperusers();

    const channel = firebase
      .channel('user-profiles-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_profiles'
      }, () => {
        fetchSuperusers();
      })
      .subscribe();

    return () => {
      firebase.removeChannel(channel);
    };
  }, [fetchSuperusers]);

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      toast({
        title: "Analyzing...",
        description: "Calculating superuser scores and archetypes"
      });

      const { data, error } = await firebase.functions.invoke('analyze-user-intelligence');
      
      if (error) throw error;

      toast({
        title: "Analysis Complete",
        description: `Found ${data.superusers_found} community champions`
      });

      await fetchSuperusers();
    } catch (error: unknown) {
      console.error('Error analyzing users:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to analyze users",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOutreachClick = (user: UserProfile) => {
    setSelectedUser(user);
    setOutreachMessage(
      `Hi ${user.author}! 👋\n\nWe've noticed your valuable contributions to our community feedback. Your insights have been incredibly helpful in shaping our product.\n\nWould you be interested in joining our early access program or providing more direct feedback?\n\nBest,\nThe Team`
    );
    setOutreachModalOpen(true);
  };

  const handleOutreachSend = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await firebase
        .from('outreach_log')
        .insert({
          user_profile_id: selectedUser.id,
          outreach_type: selectedUser.source === 'reddit' ? 'reddit_dm' : 'discord_dm',
          message_preview: outreachMessage.substring(0, 200),
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Outreach Logged",
        description: `Outreach attempt saved. Visit ${selectedUser.profile_url} to send the message.`
      });

      setOutreachModalOpen(false);
    } catch (error: unknown) {
      console.error('Error logging outreach:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to log outreach attempt",
        variant: "destructive"
      });
    }
  };

  const getArchetypeIcon = (archetype: string) => {
    switch (archetype) {
      case 'power_user': return <Zap className="h-4 w-4" />;
      case 'feature_visionary': return <Sparkles className="h-4 w-4" />;
      case 'bug_hunter': return <Target className="h-4 w-4" />;
      case 'quality_gatekeeper': return <Award className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getArchetypeLabel = (archetype: string) => {
    return archetype?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Contributor';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-blue-500';
    if (score >= 30) return 'text-orange-500';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Champions
          </CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Community Champions
              </CardTitle>
              <CardDescription>
                Your most valuable community members based on engagement and feedback quality
              </CardDescription>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze Users
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {superusers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No superusers identified yet.</p>
              <p className="text-sm mt-2">Click "Analyze Users" to identify community champions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {superusers.map((user) => (
                <Card key={user.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>
                          {user.author.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{user.author}</h3>
                              {user.profile_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => window.open(user.profile_url!, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="gap-1">
                                {getArchetypeIcon(user.archetype)}
                                {getArchetypeLabel(user.archetype)}
                              </Badge>
                              <Badge variant="secondary">
                                {user.source}
                              </Badge>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getScoreColor(user.superuser_score)}`}>
                              {Math.round(user.superuser_score)}
                            </div>
                            <div className="text-xs text-muted-foreground">Champion Score</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">Feedback</div>
                            <div className="font-semibold">{user.total_feedback_count}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Engagement</div>
                            <div className="font-semibold">{Math.round(user.avg_engagement)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Followers</div>
                            <div className="font-semibold">{user.follower_count}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Quality</div>
                            <div className="font-semibold">{Math.round(user.feedback_quality_score)}%</div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleOutreachClick(user)}
                            className="gap-2"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Connect
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={outreachModalOpen} onOpenChange={setOutreachModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect with {selectedUser?.author}</DialogTitle>
            <DialogDescription>
              Draft your outreach message. This will be logged and you can send it via {selectedUser?.source}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedUser && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Champion Score</div>
                      <div className="font-semibold text-lg">{Math.round(selectedUser.superuser_score)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Feedback</div>
                      <div className="font-semibold text-lg">{selectedUser.total_feedback_count}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Quality Score</div>
                      <div className="font-semibold text-lg">{Math.round(selectedUser.feedback_quality_score)}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Textarea
              value={outreachMessage}
              onChange={(e) => setOutreachMessage(e.target.value)}
              rows={10}
              placeholder="Write your message..."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOutreachModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOutreachSend}>
              Log Outreach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
