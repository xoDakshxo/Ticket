import { useCallback, useEffect, useState } from "react";
import { firebase } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import type { Ticket } from "@/types/firestore";

interface Metrics {
  totalClusters: number;
  activeClusters: number;
  totalTickets: number;
  openTickets: number;
  totalEvents: number;
  feedbackIngested: number;
}

const Analytics = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalClusters: 0,
    activeClusters: 0,
    totalTickets: 0,
    openTickets: 0,
    totalEvents: 0,
    feedbackIngested: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMetrics = useCallback(async () => {
    try {
      type ClusterRecord = { id: string; status?: string };
      const [clusters, tickets, events, feedback] = await Promise.all([
        firebase.from<ClusterRecord>('clusters').select('status', { count: 'exact' }),
        firebase.from<Ticket>('tickets').select('state', { count: 'exact' }),
        firebase.from('events').select('*', { count: 'exact' }),
        firebase.from('feedback_sources').select('*', { count: 'exact' }),
      ]);

      const activeClusters = clusters.data?.filter((cluster) => cluster.status === 'active').length ?? 0;
      const openTickets = tickets.data?.filter((ticket) => ticket.state === 'open').length ?? 0;

      setMetrics({
        totalClusters: clusters.count || 0,
        activeClusters,
        totalTickets: tickets.count || 0,
        openTickets,
        totalEvents: events.count || 0,
        feedbackIngested: feedback.count || 0,
      });
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
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics & Metrics</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Feedback</CardDescription>
            <CardTitle className="text-4xl">{metrics.feedbackIngested}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Active Clusters</CardDescription>
            <CardTitle className="text-4xl">
              {metrics.activeClusters} <span className="text-muted-foreground text-base">/ {metrics.totalClusters}</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Open Tickets</CardDescription>
            <CardTitle className="text-4xl">
              {metrics.openTickets} <span className="text-muted-foreground text-base">/ {metrics.totalTickets}</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Events Logged</CardDescription>
            <CardTitle className="text-4xl">{metrics.totalEvents}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Research Metrics</CardTitle>
          <CardDescription>
            This system tracks all user interactions for research validation including:
            feedback ingestion, clustering, ticket creation, state changes, and exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Feedback Ingested:</span>
              <span className="font-semibold">{metrics.feedbackIngested}</span>
            </div>
            <div className="flex justify-between">
              <span>Clusters Created:</span>
              <span className="font-semibold">{metrics.totalClusters}</span>
            </div>
            <div className="flex justify-between">
              <span>Tickets Created:</span>
              <span className="font-semibold">{metrics.totalTickets}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Interactions:</span>
              <span className="font-semibold">{metrics.totalEvents}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
