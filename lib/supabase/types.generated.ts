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
      moderation_log: {
        Row: {
          action: Database['public']['Enums']['moderation_action'];
          actor_id: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
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
      [_ in never]: never;
    };
    Functions: {
      auth_residence_id: { Args: never; Returns: string };
      auth_role: { Args: never; Returns: string };
    };
    Enums: {
      admission_contact_channel: 'email' | 'sms';
      admission_decision_reason:
        | 'villa_out_of_range'
        | 'duplicate'
        | 'incomplete_info'
        | 'manual_review_needed';
      admission_state: 'pending' | 'accepted' | 'rejected';
      moderation_action:
        | 'admission_accepted'
        | 'admission_rejected'
        | 'user_deleted'
        | 'content_removed'
        | 'rating_removed'
        | 'comment_removed';
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
      moderation_action: [
        'admission_accepted',
        'admission_rejected',
        'user_deleted',
        'content_removed',
        'rating_removed',
        'comment_removed',
      ],
      user_role: ['resident', 'co_mod', 'demandeur', 'public'],
    },
  },
} as const;
