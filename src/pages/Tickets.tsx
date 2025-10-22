import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { TicketSuggestions } from "@/components/TicketSuggestions";
type LinkedFeedback = {
  id: string;
  author: string;
  content: string;
  external_id: string;
  channel: string;
  created_at: string;
};
export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [linkedFeedback, setLinkedFeedback] = useState<LinkedFeedback[]>([]);
  const [filter, setFilter] = useState("all");
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchTickets();
    const channel = supabase.channel('tickets-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tickets'
    }, payload => {
      // Apply minimal local updates for snappier UI
      if (payload.eventType === 'DELETE') {
        setTickets(prev => prev.filter(t => t.id !== (payload.old as any)?.id));
        if (selectedTicket?.id === (payload.old as any)?.id) {
          setSelectedTicket(null);
        }
      } else {
        // Fallback to full refresh for INSERT/UPDATE
        fetchTickets();
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    if (selectedTicket) {
      fetchLinkedFeedback(selectedTicket.id);
    }
  }, [selectedTicket]);
  const fetchTickets = async () => {
    try {
      const {
        data,
        error
      } = await (supabase as any).from('tickets').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setTickets(data || []);
      if (data?.length && !selectedTicket) {
        setSelectedTicket(data[0]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const fetchLinkedFeedback = async (ticketId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('ticket_feedback_links').select(`
          feedback_id,
          feedback_sources (
            id,
            author,
            content,
            external_id,
            channel,
            created_at
          )
        `).eq('ticket_id', ticketId);
      if (error) throw error;
      const feedback = data?.map((link: any) => link.feedback_sources).filter(Boolean) || [];
      setLinkedFeedback(feedback);
    } catch (error: any) {
      console.error('Error fetching linked feedback:', error);
      setLinkedFeedback([]);
    }
  };
  const updateTicket = async (ticketId: string, updates: any) => {
    try {
      const {
        error
      } = await (supabase as any).from('tickets').update(updates).eq('id', ticketId);
      if (error) throw error;

      // Celebrate if marking as done
      if (updates.state === 'done') {
        toast({
          title: "Ticket completed! 🎉",
          description: "Great work!"
        });
      }
      fetchTickets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const deleteTicket = async (ticketId: string) => {
    try {
      const {
        error
      } = await supabase.from('tickets').delete().eq('id', ticketId);
      if (error) throw error;

      // Optimistically update UI
      setTickets(prev => {
        const remaining = prev.filter(t => t.id !== ticketId);
        // If the deleted ticket was selected, select the next available
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(remaining[0] || null);
        }
        return remaining;
      });
      toast({
        title: "Ticket deleted",
        description: "The ticket has been removed"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const getPriorityBadge = (priority: string) => {
    const variants: any = {
      critical: "destructive",
      high: "default",
      medium: "secondary",
      low: "outline"
    };
    return <Badge variant={variants[priority] || "outline"}>P{priority === "critical" ? "0" : priority === "high" ? "1" : priority === "medium" ? "2" : "3"}</Badge>;
  };
  const getStateBadge = (state: string) => {
    return <Badge variant={state === "done" ? "default" : "secondary"}>{state}</Badge>;
  };
  const filteredTickets = tickets.filter(t => {
    if (filter === "all") return true;
    return t.state === filter;
  });
  return <Layout>
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Ticket List */}
        <div className="w-2/5 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                <TabsTrigger value="draft" className="flex-1">Draft</TabsTrigger>
                <TabsTrigger value="in_progress" className="flex-1">In Progress</TabsTrigger>
                <TabsTrigger value="done" className="flex-1">Done</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input placeholder="Search tickets..." />
          </div>

          <div className="flex-1 overflow-auto">
            {filteredTickets.map(ticket => <div key={ticket.id} className={`p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors ${selectedTicket?.id === ticket.id ? "bg-accent" : ""}`} onClick={() => setSelectedTicket(ticket)}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium line-clamp-1">{ticket.title}</h4>
                  {ticket.export_status && <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex gap-2 items-center">
                  {getPriorityBadge(ticket.priority)}
                  {getStateBadge(ticket.state)}
                  <Badge variant="outline">
                    {ticket.impact_score?.toFixed(1) || 0}
                  </Badge>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {ticket.owner?.substring(0, 2).toUpperCase() || "UN"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>)}
          </div>
        </div>

        {/* Right Panel - Ticket Detail */}
        <div className="flex-1 overflow-auto">
          {selectedTicket ? <div className="p-6 max-w-3xl">
              <div className="space-y-6">
                <div>
                  <Input value={selectedTicket.title} onChange={e => {
                setSelectedTicket({
                  ...selectedTicket,
                  title: e.target.value
                });
                updateTicket(selectedTicket.id, {
                  title: e.target.value
                });
              }} className="text-2xl font-bold border-none p-0 h-auto focus-visible:ring-0" />
                </div>

                <div className="flex gap-4">
                  <Select value={selectedTicket.state} onValueChange={value => updateTicket(selectedTicket.id, {
                state: value
              })}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedTicket.priority} onValueChange={value => updateTicket(selectedTicket.id, {
                priority: value
              })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Problem Statement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea value={selectedTicket.description || ""} onChange={e => {
                  setSelectedTicket({
                    ...selectedTicket,
                    description: e.target.value
                  });
                  updateTicket(selectedTicket.id, {
                    description: e.target.value
                  });
                }} placeholder="Describe the problem or opportunity..." rows={6} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Linked Feedback</CardTitle>
                    <CardDescription>
                      {linkedFeedback.length > 0 ? `${linkedFeedback.length} Reddit post${linkedFeedback.length > 1 ? 's' : ''} linked to this ticket` : 'User quotes related to this ticket'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {linkedFeedback.length > 0 ? <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                          {linkedFeedback.map(feedback => <Card key={feedback.id} className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium">u/{feedback.author}</span>
                                    <Badge variant="outline" className="text-xs">
                                      r/{feedback.channel}
                                    </Badge>
                                  </div>
                                  <a href={(() => {
                            const eid = feedback.external_id || '';
                            if (eid.startsWith('http')) return eid;
                            if (eid.startsWith('/r/')) return `https://www.reddit.com${eid}`;
                            if (eid.startsWith('reddit-')) return `https://redd.it/${eid.replace(/^reddit-/, '')}`;
                            if (eid.startsWith('t3_')) return `https://redd.it/${eid.slice(3)}`;
                            if (eid.includes('/')) return `https://www.reddit.com${eid.startsWith('/') ? '' : '/'}${eid}`;
                            return `https://redd.it/${eid}`;
                          })()} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" />
                                    View
                                  </a>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                  {feedback.content}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(feedback.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </Card>)}
                        </div>
                      </ScrollArea> : <p className="text-sm text-muted-foreground">
                        No feedback linked yet
                      </p>}
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => updateTicket(selectedTicket.id, {
                state: 'done'
              })}>
                    Mark Done
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Export to Linear
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => deleteTicket(selectedTicket.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div> : <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a ticket to view details
            </div>}
        </div>
      </div>
    </Layout>;
}