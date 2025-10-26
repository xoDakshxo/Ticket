import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { firebase } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ExternalLink, ThumbsUp, ThumbsDown, RefreshCw, Filter, TrendingUp, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";
import type { TicketSuggestion as TicketSuggestionRecord, Ticket, TicketFeedbackLink } from "@/types/firestore";

type TicketSuggestion = TicketSuggestionRecord & {
  status: string;
};
interface TicketSuggestionsProps {
  onTicketCreated?: () => void;
}
export function TicketSuggestions({
  onTicketCreated
}: TicketSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TicketSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingTicket, setGeneratingTicket] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [trendingFilter, setTrendingFilter] = useState<boolean>(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [suggestionToDecline, setSuggestionToDecline] = useState<TicketSuggestion | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const {
    toast
  } = useToast();
  const fetchExistingSuggestions = useCallback(async () => {
    try {
      const { data, error } = await firebase
        .from<TicketSuggestion>('ticket_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('impact_score', {
          ascending: false
        });
      if (error) throw error;

      console.log('Fetched suggestions:', data);
      console.log('Trending suggestions:', data?.filter(s => s.is_trending));
      
      setSuggestions((data || []) as TicketSuggestion[]);
    } catch (error: unknown) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchExistingSuggestions();

    // Real-time subscription
    const channel = firebase.channel('ticket-suggestions-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ticket_suggestions'
    }, () => {
      fetchExistingSuggestions();
    }).subscribe();
    return () => {
      firebase.removeChannel(channel);
    };
  }, [fetchExistingSuggestions]);
  const fetchSuggestions = async () => {
    try {
      setGenerating(true);
      const {
        data,
        error
      } = await firebase.functions.invoke('suggestTickets');
      if (error) throw error;
      if (data?.suggestions) {
        // Refresh from database to get the newly created suggestions
        await fetchExistingSuggestions();
        toast({
          title: "Success",
          description: `Generated ${data.suggestions.length} new ticket suggestions`
        });
      }
    } catch (error: unknown) {
      console.error('Error fetching suggestions:', error);
      const message = getErrorMessage(error);
      if (message.includes('429')) {
        toast({
          title: "Rate Limit",
          description: "Too many requests. Please try again later.",
          variant: "destructive"
        });
      } else if (message.includes('402')) {
        toast({
          title: "Usage Limit",
          description: "AI usage limit reached. Please add credits.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: message || "Failed to generate suggestions",
          variant: "destructive"
        });
      }
    } finally {
      setGenerating(false);
    }
  };
  const handleApprove = async (suggestion: TicketSuggestion) => {
    try {
      setGeneratingTicket(suggestion.id);

      // Create the ticket
      const {
        data: ticket,
        error: ticketError
      } = await firebase.from<Ticket>('tickets').insert({
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority,
        impact_score: suggestion.impact_score,
        state: 'backlog'
      }).select().single();
      if (ticketError) throw ticketError;

      // Link feedback sources if available
      if (suggestion.source_refs && suggestion.source_refs.length > 0) {
        const links: TicketFeedbackLink[] = suggestion.source_refs.map((refId: string) => ({
          ticket_id: ticket.id,
          feedback_id: refId
        }));
        const {
          error: linkError
        } = await firebase.from<TicketFeedbackLink>('ticket_feedback_links').insert(links);
        if (linkError) console.error('Error linking feedback:', linkError);
      }

      // Update suggestion status to approved
      const {
        error: updateError
      } = await firebase.from<TicketSuggestion>('ticket_suggestions').update({
        status: 'approved'
      }).eq('id', suggestion.id);
      if (updateError) throw updateError;

      // Optimistically remove from local list so UI updates immediately
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast({
        title: "Success",
        description: "Ticket created successfully"
      });
      if (onTicketCreated) {
        onTicketCreated();
      }
    } catch (error: unknown) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to create ticket",
        variant: "destructive"
      });
    } finally {
      setGeneratingTicket(null);
    }
  };
  const handleDeclineClick = (suggestion: TicketSuggestion) => {
    setSuggestionToDecline(suggestion);
    setDeclineReason("");
    setDeclineModalOpen(true);
  };

  const handleDeclineConfirm = async () => {
    if (!suggestionToDecline) return;
    
    try {
      const { error } = await firebase
        .from<TicketSuggestion>('ticket_suggestions')
        .update({ 
          status: 'declined',
          declined_reason: declineReason.trim() || null
        })
        .eq('id', suggestionToDecline.id);
      
      if (error) throw error;

      setSuggestions(prev => prev.filter(s => s.id !== suggestionToDecline.id));
      
      toast({
        title: "Declined",
        description: "Suggestion declined with feedback"
      });
      
      setDeclineModalOpen(false);
      setSuggestionToDecline(null);
    } catch (error: unknown) {
      console.error('Error declining suggestion:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to decline suggestion",
        variant: "destructive"
      });
    }
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // Extract unique themes for filter
  const uniqueThemes = useMemo(() => {
    const themes = new Set(suggestions.map(s => s.theme));
    return Array.from(themes);
  }, [suggestions]);

  // Count trending suggestions
  const trendingCount = useMemo(() => {
    return suggestions.filter(s => s.is_trending === true).length;
  }, [suggestions]);

  // Filter suggestions based on selected filters
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => {
      const matchesPriority = priorityFilter === "all" || suggestion.priority === priorityFilter;
      const matchesTheme = themeFilter === "all" || suggestion.theme === themeFilter;
      const matchesTrending = !trendingFilter || suggestion.is_trending === true;
      return matchesPriority && matchesTheme && matchesTrending;
    });
  }, [suggestions, priorityFilter, themeFilter, trendingFilter]);
  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Ticket Recommendations
          </CardTitle>
          <CardDescription>Loading suggestions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Ticket Recommendations
            </CardTitle>
            <CardDescription>
              Review and approve AI-generated ticket suggestions based on user feedback
            </CardDescription>
          </div>
        </div>

        {/* Filters */}
        {suggestions.length > 0 && (
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

          <Select value={themeFilter} onValueChange={setThemeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Themes</SelectItem>
              {uniqueThemes.map((theme) => (
                <SelectItem key={theme} value={theme}>
                  {theme}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={trendingFilter ? "default" : "outline"}
            size="sm"
            onClick={() => setTrendingFilter(!trendingFilter)}
            className="gap-2"
            disabled={trendingCount === 0}
          >
            <TrendingUp className="h-4 w-4" />
            {trendingFilter ? "Show All" : `Trending Only (${trendingCount})`}
          </Button>
        </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {suggestions.length === 0 ? (
              <p>No pending suggestions. Click "Generate Suggestions" to create new ones.</p>
            ) : (
              <p>No suggestions match the selected filters.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSuggestions.map((suggestion) => (
              <Card key={suggestion.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-lg">{suggestion.title}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getPriorityColor(suggestion.priority)}>
                  {suggestion.priority}
                </Badge>
                <Badge variant="outline">{suggestion.theme}</Badge>
                
                {suggestion.is_trending && (
                  <Badge variant="default" className="bg-orange-500 gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Trending
                  </Badge>
                )}
                
                {suggestion.velocity_score !== undefined && suggestion.velocity_score > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" />
                    +{Math.round(suggestion.velocity_score)}% velocity
                  </Badge>
                )}
                
                <span className="text-sm text-muted-foreground">
                  Impact: {Math.round(suggestion.impact_score)}
                </span>
                {suggestion.source_refs && Array.isArray(suggestion.source_refs) && (
                  <span className="text-sm text-muted-foreground">
                    {suggestion.source_refs.length} sources
                  </span>
                )}
              </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(suggestion)}
                      disabled={generatingTicket === suggestion.id}
                      className="gap-2"
                    >
                      {generatingTicket === suggestion.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="h-4 w-4" />
                          Create Ticket
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDeclineClick(suggestion)}
                      disabled={generatingTicket === suggestion.id}
                      className="gap-2"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={declineModalOpen} onOpenChange={setDeclineModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Suggestion</DialogTitle>
          <DialogDescription>
            Please provide a reason for declining this suggestion. This helps improve future recommendations.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {suggestionToDecline && (
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium text-sm">{suggestionToDecline.title}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for declining</label>
            <Textarea
              placeholder="e.g., Already implemented, out of scope, duplicate..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeclineModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeclineConfirm} variant="destructive">
            Confirm Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
