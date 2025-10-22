import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const FeedbackIngestion = () => {
  const [sourceType, setSourceType] = useState("discord");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(false);
  const [clusterLoading, setClusterLoading] = useState(false);
  const { toast } = useToast();

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ingest-feedback', {
        body: {
          source_type: sourceType,
          external_id: `manual-${Date.now()}`,
          channel,
          author,
          content,
          metadata: { manual_entry: true }
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feedback ingested successfully",
      });

      setContent("");
      setAuthor("");
      setChannel("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCluster = async () => {
    setClusterLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('cluster-feedback');

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message || "Clustering completed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setClusterLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Feedback Ingestion</CardTitle>
          <CardDescription>
            Add feedback manually for testing. In production, this would be automated via webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleIngest} className="space-y-4">
            <div>
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="x">X (Twitter)</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Author</Label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Username or author name"
                required
              />
            </div>

            <div>
              <Label>Channel/Location</Label>
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="e.g., #general, r/feedback"
              />
            </div>

            <div>
              <Label>Feedback Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter feedback text..."
                rows={6}
                required
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Ingesting..." : "Ingest Feedback"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cluster Feedback</CardTitle>
          <CardDescription>
            Process unprocessed feedback and group into clusters using AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCluster} disabled={clusterLoading}>
            {clusterLoading ? "Clustering..." : "Run Clustering"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackIngestion;