// AUTO-GENERATED par `pnpm gen:types` — DO NOT EDIT.
// Régénérer après chaque migration. Versionné dans git (AR8).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admission_requests: {
        Row: {
          contact_channel: Database['public']['Enums']['admission_contact_channel'];
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: Database['public']['Enums']['admission_decision_reason'] | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          email_verified_at: string | null;
          first_name: string;
          id: string;
          residence_id: string;
          state: Database['public']['Enums']['admission_state'];
          tranche: string | null;
          updated_at: string;
          user_id: string;
          villa: number;
        };
        Insert: {
          contact_channel: Database['public']['Enums']['admission_contact_channel'];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: Database['public']['Enums']['admission_decision_reason'] | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          email_verified_at?: string | null;
          first_name: string;
          id?: string;
          residence_id: string;
          state?: Database['public']['Enums']['admission_state'];
          tranche?: string | null;
          updated_at?: string;
          user_id: string;
          villa: number;
        };
        Update: {
          contact_channel?: Database['public']['Enums']['admission_contact_channel'];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: Database['public']['Enums']['admission_decision_reason'] | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          email_verified_at?: string | null;
          first_name?: string;
          id?: string;
          residence_id?: string;
          state?: Database['public']['Enums']['admission_state'];
          tranche?: string | null;
          updated_at?: string;
          user_id?: string;
          villa?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_requests_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_requests_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_requests_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      alert_templates: {
        Row: {
          created_at: string;
          default_body_ar: string | null;
          default_body_fr: string | null;
          default_duration_hours: number;
          icon: string;
          id: string;
          label_ar: string | null;
          label_fr: string;
          sort_order: number;
          template_key: string;
        };
        Insert: {
          created_at?: string;
          default_body_ar?: string | null;
          default_body_fr?: string | null;
          default_duration_hours?: number;
          icon: string;
          id?: string;
          label_ar?: string | null;
          label_fr: string;
          sort_order?: number;
          template_key: string;
        };
        Update: {
          created_at?: string;
          default_body_ar?: string | null;
          default_body_fr?: string | null;
          default_duration_hours?: number;
          icon?: string;
          id?: string;
          label_ar?: string | null;
          label_fr?: string;
          sort_order?: number;
          template_key?: string;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          body_ar: string | null;
          body_fr: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          expires_at: string;
          id: string;
          residence_id: string;
          slug: string;
          template_id: string | null;
          title_ar: string | null;
          title_fr: string;
          updated_at: string;
        };
        Insert: {
          body_ar?: string | null;
          body_fr: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          expires_at: string;
          id?: string;
          residence_id: string;
          slug: string;
          template_id?: string | null;
          title_ar?: string | null;
          title_fr: string;
          updated_at?: string;
        };
        Update: {
          body_ar?: string | null;
          body_fr?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          expires_at?: string;
          id?: string;
          residence_id?: string;
          slug?: string;
          template_id?: string | null;
          title_ar?: string | null;
          title_fr?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alerts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'alerts_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'alerts_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'alerts_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'alert_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      artisan_consent_tokens: {
        Row: {
          artisan_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          purpose: Database['public']['Enums']['consent_token_purpose'];
          residence_id: string;
          token_hash: string;
          used_at: string | null;
        };
        Insert: {
          artisan_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          purpose?: Database['public']['Enums']['consent_token_purpose'];
          residence_id: string;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          artisan_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          purpose?: Database['public']['Enums']['consent_token_purpose'];
          residence_id?: string;
          token_hash?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'artisan_consent_tokens_artisan_id_fkey';
            columns: ['artisan_id'];
            isOneToOne: false;
            referencedRelation: 'artisans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisan_consent_tokens_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      artisan_rectification_requests: {
        Row: {
          artisan_id: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          field_target: Database['public']['Enums']['artisan_rectification_field'];
          id: string;
          justification_text: string;
          requested_value: string;
          residence_id: string;
          state: Database['public']['Enums']['artisan_rectification_state'];
          updated_at: string;
        };
        Insert: {
          artisan_id: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          field_target: Database['public']['Enums']['artisan_rectification_field'];
          id?: string;
          justification_text: string;
          requested_value: string;
          residence_id: string;
          state?: Database['public']['Enums']['artisan_rectification_state'];
          updated_at?: string;
        };
        Update: {
          artisan_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          field_target?: Database['public']['Enums']['artisan_rectification_field'];
          id?: string;
          justification_text?: string;
          requested_value?: string;
          residence_id?: string;
          state?: Database['public']['Enums']['artisan_rectification_state'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'artisan_rectification_requests_artisan_id_fkey';
            columns: ['artisan_id'];
            isOneToOne: false;
            referencedRelation: 'artisans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisan_rectification_requests_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisan_rectification_requests_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      artisan_responses: {
        Row: {
          artisan_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          residence_id: string;
          response_text: string;
          response_tsv: unknown;
          target_id: string | null;
          target_kind: Database['public']['Enums']['artisan_response_target'];
        };
        Insert: {
          artisan_id: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          residence_id: string;
          response_text: string;
          response_tsv?: unknown;
          target_id?: string | null;
          target_kind: Database['public']['Enums']['artisan_response_target'];
        };
        Update: {
          artisan_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          residence_id?: string;
          response_text?: string;
          response_tsv?: unknown;
          target_id?: string | null;
          target_kind?: Database['public']['Enums']['artisan_response_target'];
        };
        Relationships: [
          {
            foreignKeyName: 'artisan_responses_artisan_id_fkey';
            columns: ['artisan_id'];
            isOneToOne: false;
            referencedRelation: 'artisans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisan_responses_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisan_responses_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      artisan_tags: {
        Row: {
          artisan_id: string;
          tag_id: string;
        };
        Insert: {
          artisan_id: string;
          tag_id: string;
        };
        Update: {
          artisan_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'artisan_tags_artisan_id_fkey';
            columns: ['artisan_id'];
            isOneToOne: false;
            referencedRelation: 'artisans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisan_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
      };
      artisans: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          display_name_ar: string | null;
          display_name_ar_tsv: unknown;
          display_name_fr: string;
          display_name_fr_tsv: unknown;
          has_invoice: Database['public']['Enums']['artisan_has_invoice'] | null;
          id: string;
          pending_display_name_fr: string | null;
          pending_phone_e164: string | null;
          phone_e164: string;
          price_relative: Database['public']['Enums']['artisan_price_relative'] | null;
          published_at: string | null;
          residence_id: string;
          slug: string;
          state: Database['public']['Enums']['artisan_state'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          display_name_ar?: string | null;
          display_name_ar_tsv?: unknown;
          display_name_fr: string;
          display_name_fr_tsv?: unknown;
          has_invoice?: Database['public']['Enums']['artisan_has_invoice'] | null;
          id?: string;
          pending_display_name_fr?: string | null;
          pending_phone_e164?: string | null;
          phone_e164: string;
          price_relative?: Database['public']['Enums']['artisan_price_relative'] | null;
          published_at?: string | null;
          residence_id: string;
          slug: string;
          state?: Database['public']['Enums']['artisan_state'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          display_name_ar?: string | null;
          display_name_ar_tsv?: unknown;
          display_name_fr?: string;
          display_name_fr_tsv?: unknown;
          has_invoice?: Database['public']['Enums']['artisan_has_invoice'] | null;
          id?: string;
          pending_display_name_fr?: string | null;
          pending_phone_e164?: string | null;
          phone_e164?: string;
          price_relative?: Database['public']['Enums']['artisan_price_relative'] | null;
          published_at?: string | null;
          residence_id?: string;
          slug?: string;
          state?: Database['public']['Enums']['artisan_state'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'artisans_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisans_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artisans_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      guide_entries: {
        Row: {
          ar_complete: boolean | null;
          body_ar_markdown: string | null;
          body_fr_markdown: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          order_in_theme: number;
          residence_id: string;
          search_ar_tsv: unknown;
          search_fr_tsv: unknown;
          slug: string;
          theme_key: Database['public']['Enums']['guide_theme_key'];
          title_ar: string | null;
          title_fr: string;
          updated_at: string;
        };
        Insert: {
          ar_complete?: boolean | null;
          body_ar_markdown?: string | null;
          body_fr_markdown: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          order_in_theme?: number;
          residence_id: string;
          search_ar_tsv?: unknown;
          search_fr_tsv?: unknown;
          slug: string;
          theme_key: Database['public']['Enums']['guide_theme_key'];
          title_ar?: string | null;
          title_fr: string;
          updated_at?: string;
        };
        Update: {
          ar_complete?: boolean | null;
          body_ar_markdown?: string | null;
          body_fr_markdown?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          order_in_theme?: number;
          residence_id?: string;
          search_ar_tsv?: unknown;
          search_fr_tsv?: unknown;
          slug?: string;
          theme_key?: Database['public']['Enums']['guide_theme_key'];
          title_ar?: string | null;
          title_fr?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'guide_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guide_entries_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guide_entries_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_log: {
        Row: {
          action: Database['public']['Enums']['moderation_action'];
          actor_id: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          payload_json: Json | null;
          reason_code: string | null;
          reason_text_anonymized: string | null;
          residence_id: string;
          target_id: string | null;
          target_kind: string;
        };
        Insert: {
          action: Database['public']['Enums']['moderation_action'];
          actor_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          payload_json?: Json | null;
          reason_code?: string | null;
          reason_text_anonymized?: string | null;
          residence_id: string;
          target_id?: string | null;
          target_kind: string;
        };
        Update: {
          action?: Database['public']['Enums']['moderation_action'];
          actor_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          payload_json?: Json | null;
          reason_code?: string | null;
          reason_text_anonymized?: string | null;
          residence_id?: string;
          target_id?: string | null;
          target_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_log_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_log_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications_prefs: {
        Row: {
          activite_contributions_enabled: boolean;
          alerts_urgentes_enabled: boolean;
          nouvelles_entrees_annuaire_enabled: boolean;
          residence_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          activite_contributions_enabled?: boolean;
          alerts_urgentes_enabled?: boolean;
          nouvelles_entrees_annuaire_enabled?: boolean;
          residence_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          activite_contributions_enabled?: boolean;
          alerts_urgentes_enabled?: boolean;
          nouvelles_entrees_annuaire_enabled?: boolean;
          residence_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_prefs_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      pack_entries: {
        Row: {
          body_ar_markdown: string | null;
          body_fr_markdown: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          order_in_section: number;
          residence_id: string;
          search_ar_tsv: unknown;
          search_fr_tsv: unknown;
          section_key: string;
          title_ar: string | null;
          title_fr: string;
          updated_at: string;
        };
        Insert: {
          body_ar_markdown?: string | null;
          body_fr_markdown: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          order_in_section?: number;
          residence_id: string;
          search_ar_tsv?: unknown;
          search_fr_tsv?: unknown;
          section_key: string;
          title_ar?: string | null;
          title_fr: string;
          updated_at?: string;
        };
        Update: {
          body_ar_markdown?: string | null;
          body_fr_markdown?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          order_in_section?: number;
          residence_id?: string;
          search_ar_tsv?: unknown;
          search_fr_tsv?: unknown;
          section_key?: string;
          title_ar?: string | null;
          title_fr?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pack_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pack_entries_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pack_entries_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          identity_mode: string;
          language: string;
          residence_id: string;
          tranche: string | null;
          updated_at: string;
          user_id: string;
          villa: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          identity_mode?: string;
          language?: string;
          residence_id: string;
          tranche?: string | null;
          updated_at?: string;
          user_id: string;
          villa: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          identity_mode?: string;
          language?: string;
          residence_id?: string;
          tranche?: string | null;
          updated_at?: string;
          user_id?: string;
          villa?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ratings: {
        Row: {
          artisan_id: string;
          author_display_name: string | null;
          comment_text: string | null;
          comment_tsv: unknown;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          residence_id: string;
          score_depannage: number | null;
          score_petits_travaux: number | null;
          score_travail_soigne: number | null;
          score_urgences: number | null;
          updated_at: string;
          user_id: string | null;
          visibility: Database['public']['Enums']['rating_visibility'];
        };
        Insert: {
          artisan_id: string;
          author_display_name?: string | null;
          comment_text?: string | null;
          comment_tsv?: unknown;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          residence_id: string;
          score_depannage?: number | null;
          score_petits_travaux?: number | null;
          score_travail_soigne?: number | null;
          score_urgences?: number | null;
          updated_at?: string;
          user_id?: string | null;
          visibility?: Database['public']['Enums']['rating_visibility'];
        };
        Update: {
          artisan_id?: string;
          author_display_name?: string | null;
          comment_text?: string | null;
          comment_tsv?: unknown;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          residence_id?: string;
          score_depannage?: number | null;
          score_petits_travaux?: number | null;
          score_travail_soigne?: number | null;
          score_urgences?: number | null;
          updated_at?: string;
          user_id?: string | null;
          visibility?: Database['public']['Enums']['rating_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'ratings_artisan_id_fkey';
            columns: ['artisan_id'];
            isOneToOne: false;
            referencedRelation: 'artisans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          note_text: string | null;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string | null;
          residence_id: string;
          resolution_motive: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          state: Database['public']['Enums']['report_state'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target_type'];
        };
        Insert: {
          created_at?: string;
          id?: string;
          note_text?: string | null;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id?: string | null;
          residence_id: string;
          resolution_motive?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          state?: Database['public']['Enums']['report_state'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target_type'];
        };
        Update: {
          created_at?: string;
          id?: string;
          note_text?: string | null;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string | null;
          residence_id?: string;
          resolution_motive?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          state?: Database['public']['Enums']['report_state'];
          target_id?: string;
          target_type?: Database['public']['Enums']['report_target_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      residences: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
          villa_count: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
          villa_count: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
          villa_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'residences_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          label_ar: string | null;
          label_fr: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          label_ar?: string | null;
          label_fr: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          label_ar?: string | null;
          label_fr?: string;
        };
        Relationships: [];
      };
      tips: {
        Row: {
          body_ar: string | null;
          body_fr: string;
          category_key: Database['public']['Enums']['tip_category'];
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          expires_at: string;
          id: string;
          residence_id: string;
          slug: string;
          title_ar: string | null;
          title_fr: string;
          updated_at: string;
        };
        Insert: {
          body_ar?: string | null;
          body_fr: string;
          category_key: Database['public']['Enums']['tip_category'];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          expires_at: string;
          id?: string;
          residence_id: string;
          slug: string;
          title_ar?: string | null;
          title_fr: string;
          updated_at?: string;
        };
        Update: {
          body_ar?: string | null;
          body_fr?: string;
          category_key?: Database['public']['Enums']['tip_category'];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          expires_at?: string;
          id?: string;
          residence_id?: string;
          slug?: string;
          title_ar?: string | null;
          title_fr?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tips_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tips_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tips_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      useful_numbers: {
        Row: {
          category_key: Database['public']['Enums']['useful_number_category'];
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          label_ar: string | null;
          label_fr: string;
          notes_ar: string | null;
          notes_fr: string | null;
          order_in_category: number;
          phone_e164: string;
          residence_id: string;
          updated_at: string;
        };
        Insert: {
          category_key: Database['public']['Enums']['useful_number_category'];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          label_ar?: string | null;
          label_fr: string;
          notes_ar?: string | null;
          notes_fr?: string | null;
          order_in_category?: number;
          phone_e164: string;
          residence_id: string;
          updated_at?: string;
        };
        Update: {
          category_key?: Database['public']['Enums']['useful_number_category'];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          label_ar?: string | null;
          label_fr?: string;
          notes_ar?: string | null;
          notes_fr?: string | null;
          order_in_category?: number;
          phone_e164?: string;
          residence_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'useful_numbers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'useful_numbers_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'useful_numbers_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          display_name: string | null;
          first_login_at: string | null;
          id: string;
          pack_accueil_dismissed_at: string | null;
          residence_id: string;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          display_name?: string | null;
          first_login_at?: string | null;
          id: string;
          pack_accueil_dismissed_at?: string | null;
          residence_id: string;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          display_name?: string | null;
          first_login_at?: string | null;
          id?: string;
          pack_accueil_dismissed_at?: string | null;
          residence_id?: string;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'users_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      artisan_rating_aggregates: {
        Row: {
          artisan_id: string | null;
          avg_depannage: number | null;
          avg_petits_travaux: number | null;
          avg_travail_soigne: number | null;
          avg_urgences: number | null;
          n_depannage: number | null;
          n_petits_travaux: number | null;
          n_total: number | null;
          n_travail_soigne: number | null;
          n_urgences: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ratings_artisan_id_fkey';
            columns: ['artisan_id'];
            isOneToOne: false;
            referencedRelation: 'artisans';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_log_public: {
        Row: {
          action: Database['public']['Enums']['moderation_action'] | null;
          actor_display_name: string | null;
          created_at: string | null;
          id: string | null;
          payload_json: Json | null;
          reason_code: string | null;
          residence_id: string | null;
          target_id: string | null;
          target_kind: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_log_residence_id_fkey';
            columns: ['residence_id'];
            isOneToOne: false;
            referencedRelation: 'residences';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      accept_admission: {
        Args: { p_actor_id: string; p_admission_id: string };
        Returns: {
          requester_user_id: string;
          residence_id: string;
          villa: number;
        }[];
      };
      auth_residence_id: { Args: never; Returns: string };
      auth_role: { Args: never; Returns: string };
      moderate_keep_content: {
        Args: { p_note?: string; p_report_id: string };
        Returns: {
          out_reporter_id: string;
          out_residence_id: string;
        }[];
      };
      moderate_remove_content: {
        Args: { p_motive: string; p_note?: string; p_report_id: string };
        Returns: {
          out_residence_id: string;
          out_target_id: string;
          out_target_type: string;
          target_author_id: string;
        }[];
      };
      process_artisan_consent: {
        Args: { p_decision: string; p_token_hash: string };
        Returns: {
          artisan_id: string;
          contributor_id: string;
          display_name_ar: string;
          display_name_fr: string;
          slug: string;
          state: Database['public']['Enums']['artisan_state'];
          status: string;
        }[];
      };
      process_artisan_response: {
        Args: { p_kind: string; p_payload: Json; p_token_hash: string };
        Returns: {
          artisan_id: string;
          slug: string;
          status: string;
        }[];
      };
      reject_admission: {
        Args: {
          p_actor_id: string;
          p_admission_id: string;
          p_reason: Database['public']['Enums']['admission_decision_reason'];
        };
        Returns: {
          requester_user_id: string;
          residence_id: string;
          villa: number;
        }[];
      };
      request_account_deletion: { Args: never; Returns: undefined };
      request_artisan_contact_link: {
        Args: {
          p_expires_at: string;
          p_phone_e164: string;
          p_token_hash: string;
        };
        Returns: {
          sms_artisan_name: string;
          sms_target_phone: string;
          status: string;
        }[];
      };
      request_artisan_reconsent: {
        Args: {
          p_artisan_id: string;
          p_new_name_fr: string;
          p_new_phone: string;
          p_new_token_hash: string;
        };
        Returns: {
          sms_artisan_name: string;
          sms_target_phone: string;
          status: string;
        }[];
      };
      retire_durable_entry: {
        Args: { p_id: string; p_kind: string; p_reason: string };
        Returns: undefined;
      };
      retract_artisan: { Args: { p_artisan_id: string }; Returns: undefined };
      retract_own_comment: { Args: { p_rating_id: string }; Returns: undefined };
      retract_own_ephemeral: {
        Args: { p_id: string; p_kind: string; p_reason: string };
        Returns: undefined;
      };
      retract_own_rating: { Args: { p_rating_id: string }; Returns: undefined };
      search_guide_entries: {
        Args: { p_locale: string; p_query: string };
        Returns: {
          rank: number;
          slug: string;
          snippet: string;
          theme_key: Database['public']['Enums']['guide_theme_key'];
          title: string;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
    };
    Enums: {
      admission_contact_channel: 'email' | 'sms';
      admission_decision_reason:
        | 'villa_out_of_range'
        | 'duplicate'
        | 'incomplete_info'
        | 'manual_review_needed';
      admission_state: 'pending' | 'accepted' | 'rejected';
      artisan_has_invoice: 'oui' | 'non' | 'sur_demande';
      artisan_price_relative: '$' | '$$' | '$$$' | '$$$$';
      artisan_rectification_field:
        | 'display_name_fr'
        | 'display_name_ar'
        | 'phone_e164'
        | 'competences'
        | 'price_relative'
        | 'has_invoice';
      artisan_rectification_state: 'pending' | 'accepted' | 'rejected';
      artisan_response_target: 'listing' | 'rating';
      artisan_state: 'pending_consent' | 'published' | 'refused';
      consent_token_purpose: 'consent' | 'respond';
      guide_theme_key:
        | 'codes_portails'
        | 'horaires_gardien'
        | 'regles_jardin'
        | 'dechets'
        | 'traditions'
        | 'securite'
        | 'autre';
      moderation_action:
        | 'admission_accepted'
        | 'admission_rejected'
        | 'user_deleted'
        | 'content_removed'
        | 'rating_removed'
        | 'comment_removed'
        | 'purge_completed'
        | 'artisan_published'
        | 'artisan_consent_refused'
        | 'artisan_retracted'
        | 'artisan_reconsent_requested'
        | 'artisan_reconsent_refused'
        | 'artisan_response_published'
        | 'artisan_rectification_requested'
        | 'rating_self_retracted'
        | 'comment_self_retracted'
        | 'artisan_reconsent_accepted'
        | 'alert_created'
        | 'tip_created'
        | 'alert_self_retracted'
        | 'tip_self_retracted'
        | 'content_expired'
        | 'report_opened'
        | 'content_kept'
        | 'escalation_triggered';
      rating_visibility: 'pseudonym' | 'named';
      report_reason:
        | 'diffamation'
        | 'info_erronee'
        | 'harcelement'
        | 'spam'
        | 'hors_charte'
        | 'autre';
      report_state: 'open' | 'closed_removed' | 'closed_kept';
      report_target_type:
        | 'artisan'
        | 'rating'
        | 'alert'
        | 'alert_comment'
        | 'tip'
        | 'guide_entry'
        | 'useful_number';
      tip_category: 'offre_voisin' | 'pret_objet' | 'evenement' | 'autre';
      useful_number_category: 'securite' | 'syndic' | 'urgences' | 'sante' | 'autre';
      user_role: 'resident' | 'co_mod' | 'demandeur' | 'public';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admission_contact_channel: ['email', 'sms'],
      admission_decision_reason: [
        'villa_out_of_range',
        'duplicate',
        'incomplete_info',
        'manual_review_needed',
      ],
      admission_state: ['pending', 'accepted', 'rejected'],
      artisan_has_invoice: ['oui', 'non', 'sur_demande'],
      artisan_price_relative: ['$', '$$', '$$$', '$$$$'],
      artisan_rectification_field: [
        'display_name_fr',
        'display_name_ar',
        'phone_e164',
        'competences',
        'price_relative',
        'has_invoice',
      ],
      artisan_rectification_state: ['pending', 'accepted', 'rejected'],
      artisan_response_target: ['listing', 'rating'],
      artisan_state: ['pending_consent', 'published', 'refused'],
      consent_token_purpose: ['consent', 'respond'],
      guide_theme_key: [
        'codes_portails',
        'horaires_gardien',
        'regles_jardin',
        'dechets',
        'traditions',
        'securite',
        'autre',
      ],
      moderation_action: [
        'admission_accepted',
        'admission_rejected',
        'user_deleted',
        'content_removed',
        'rating_removed',
        'comment_removed',
        'purge_completed',
        'artisan_published',
        'artisan_consent_refused',
        'artisan_retracted',
        'artisan_reconsent_requested',
        'artisan_reconsent_refused',
        'artisan_response_published',
        'artisan_rectification_requested',
        'rating_self_retracted',
        'comment_self_retracted',
        'artisan_reconsent_accepted',
        'alert_created',
        'tip_created',
        'alert_self_retracted',
        'tip_self_retracted',
        'content_expired',
        'report_opened',
        'content_kept',
        'escalation_triggered',
      ],
      rating_visibility: ['pseudonym', 'named'],
      report_reason: ['diffamation', 'info_erronee', 'harcelement', 'spam', 'hors_charte', 'autre'],
      report_state: ['open', 'closed_removed', 'closed_kept'],
      report_target_type: [
        'artisan',
        'rating',
        'alert',
        'alert_comment',
        'tip',
        'guide_entry',
        'useful_number',
      ],
      tip_category: ['offre_voisin', 'pret_objet', 'evenement', 'autre'],
      useful_number_category: ['securite', 'syndic', 'urgences', 'sante', 'autre'],
      user_role: ['resident', 'co_mod', 'demandeur', 'public'],
    },
  },
} as const;
