export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clusters: {
        Row: {
          area: string | null
          created_at: string
          delta_48h: number | null
          id: string
          impact_score: number | null
          mentions_count: number | null
          sentiment: number | null
          sources: Json | null
          status: string | null
          summary: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          delta_48h?: number | null
          id?: string
          impact_score?: number | null
          mentions_count?: number | null
          sentiment?: number | null
          sources?: Json | null
          status?: string | null
          summary?: string | null
          theme: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          delta_48h?: number | null
          id?: string
          impact_score?: number | null
          mentions_count?: number | null
          sentiment?: number | null
          sources?: Json | null
          status?: string | null
          summary?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          cluster_id: string | null
          event_type: string
          id: string
          ticket_id: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          cluster_id?: string | null
          event_type: string
          id?: string
          ticket_id?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          cluster_id?: string | null
          event_type?: string
          id?: string
          ticket_id?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_engagement_snapshots: {
        Row: {
          created_at: string | null
          engagement: number
          feedback_id: string | null
          followers: number
          id: string
          snapshot_at: string | null
        }
        Insert: {
          created_at?: string | null
          engagement: number
          feedback_id?: string | null
          followers: number
          id?: string
          snapshot_at?: string | null
        }
        Update: {
          created_at?: string | null
          engagement?: number
          feedback_id?: string | null
          followers?: number
          id?: string
          snapshot_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_engagement_snapshots_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_sources: {
        Row: {
          author: string | null
          channel: string | null
          content: string | null
          created_at: string
          engagement: number | null
          external_id: string | null
          followers: number | null
          id: string
          source: string | null
          source_config_id: string | null
        }
        Insert: {
          author?: string | null
          channel?: string | null
          content?: string | null
          created_at?: string
          engagement?: number | null
          external_id?: string | null
          followers?: number | null
          id?: string
          source?: string | null
          source_config_id?: string | null
        }
        Update: {
          author?: string | null
          channel?: string | null
          content?: string | null
          created_at?: string
          engagement?: number | null
          external_id?: string | null
          followers?: number | null
          id?: string
          source?: string | null
          source_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_sources_source_config_id_fkey"
            columns: ["source_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          channel: string | null
          config: Json
          created_at: string
          id: string
          integration_type: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          config?: Json
          created_at?: string
          id?: string
          integration_type: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string | null
          config?: Json
          created_at?: string
          id?: string
          integration_type?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loop_messages: {
        Row: {
          context_type: string
          created_at: string
          id: string
          message: string
          related_id: string | null
          tone: string | null
        }
        Insert: {
          context_type: string
          created_at?: string
          id?: string
          message: string
          related_id?: string | null
          tone?: string | null
        }
        Update: {
          context_type?: string
          created_at?: string
          id?: string
          message?: string
          related_id?: string | null
          tone?: string | null
        }
        Relationships: []
      }
      outreach_log: {
        Row: {
          created_at: string | null
          id: string
          message_preview: string | null
          outreach_type: string
          sent_by: string | null
          status: string | null
          user_profile_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_preview?: string | null
          outreach_type: string
          sent_by?: string | null
          status?: string | null
          user_profile_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_preview?: string | null
          outreach_type?: string
          sent_by?: string | null
          status?: string | null
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_log_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_feedback_links: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_feedback_links_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_feedback_links_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_suggestions: {
        Row: {
          created_at: string
          declined_reason: string | null
          description: string
          id: string
          impact_score: number
          is_trending: boolean | null
          priority: string
          source_refs: Json
          status: string
          theme: string
          title: string
          updated_at: string
          user_id: string
          velocity_score: number | null
        }
        Insert: {
          created_at?: string
          declined_reason?: string | null
          description: string
          id?: string
          impact_score?: number
          is_trending?: boolean | null
          priority: string
          source_refs?: Json
          status?: string
          theme: string
          title: string
          updated_at?: string
          user_id: string
          velocity_score?: number | null
        }
        Update: {
          created_at?: string
          declined_reason?: string | null
          description?: string
          id?: string
          impact_score?: number
          is_trending?: boolean | null
          priority?: string
          source_refs?: Json
          status?: string
          theme?: string
          title?: string
          updated_at?: string
          user_id?: string
          velocity_score?: number | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          cluster_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          export_id: string | null
          export_provider: string | null
          export_status: string | null
          id: string
          impact_score: number | null
          owner: string | null
          priority: string
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          cluster_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          export_id?: string | null
          export_provider?: string | null
          export_status?: string | null
          id?: string
          impact_score?: number | null
          owner?: string | null
          priority?: string
          state?: string
          title: string
          updated_at?: string
        }
        Update: {
          cluster_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          export_id?: string | null
          export_provider?: string | null
          export_status?: string | null
          id?: string
          impact_score?: number | null
          owner?: string | null
          priority?: string
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          approved_suggestions: number | null
          archetype: string | null
          archetype_confidence: number | null
          author: string
          avg_engagement: number | null
          created_at: string | null
          feedback_frequency_score: number | null
          feedback_quality_score: number | null
          first_seen_at: string | null
          follower_count: number | null
          id: string
          last_seen_at: string | null
          linked_suggestions: number | null
          profile_url: string | null
          source: string
          superuser_score: number | null
          total_engagement: number | null
          total_feedback_count: number | null
          updated_at: string | null
        }
        Insert: {
          approved_suggestions?: number | null
          archetype?: string | null
          archetype_confidence?: number | null
          author: string
          avg_engagement?: number | null
          created_at?: string | null
          feedback_frequency_score?: number | null
          feedback_quality_score?: number | null
          first_seen_at?: string | null
          follower_count?: number | null
          id?: string
          last_seen_at?: string | null
          linked_suggestions?: number | null
          profile_url?: string | null
          source: string
          superuser_score?: number | null
          total_engagement?: number | null
          total_feedback_count?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_suggestions?: number | null
          archetype?: string | null
          archetype_confidence?: number | null
          author?: string
          avg_engagement?: number | null
          created_at?: string | null
          feedback_frequency_score?: number | null
          feedback_quality_score?: number | null
          first_seen_at?: string | null
          follower_count?: number | null
          id?: string
          last_seen_at?: string | null
          linked_suggestions?: number | null
          profile_url?: string | null
          source?: string
          superuser_score?: number | null
          total_engagement?: number | null
          total_feedback_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aggregate_user_profiles: {
        Args: Record<PropertyKey, never>
        Returns: {
          author: string
          avg_engagement: number
          feedback_count: number
          first_seen: string
          last_seen: string
          max_followers: number
          source: string
          total_engagement: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
