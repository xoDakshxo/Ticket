export type TicketState = 'draft' | 'backlog' | 'open' | 'in_progress' | 'done' | 'closed' | 'archived';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical' | 'default';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  state: TicketState;
  priority: TicketPriority;
  owner?: string | null;
  impact_score: number;
  export_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FeedbackSource {
  id: string;
  external_id?: string;
  author?: string;
  content?: string;
  url?: string;
  channel?: string;
  created_at?: string;
}

export interface TicketSuggestion {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority | 'default';
  impact_score: number;
  theme: string;
  status: string;
  source_refs: string[];
  velocity_score?: number;
  is_trending?: boolean;
  declined_reason?: string | null;
  sources?: FeedbackSource[];
}

export interface IntegrationConfig {
  id: string;
  integration_type: string;
  channel: string;
  config: Record<string, unknown>;
  created_at?: string;
  is_active?: boolean;
  user_id?: string;
}

export interface UserProfile {
  id: string;
  author: string;
  source: string;
  total_feedback_count: number;
  total_engagement: number;
  avg_engagement: number;
  follower_count: number;
  superuser_score: number;
  feedback_quality_score: number;
  feedback_frequency_score: number;
  archetype: string;
  archetype_confidence: number;
  profile_url: string | null;
  linked_suggestions: number;
  approved_suggestions: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface TicketFeedbackLink {
  ticket_id: string;
  feedback_id: string;
}
