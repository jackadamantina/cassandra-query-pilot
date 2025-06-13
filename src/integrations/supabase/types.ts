export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          id: string
          target: string | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          id?: string
          target?: string | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          id?: string
          target?: string | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          adverso: string | null
          andamento: string | null
          cep: string | null
          complemento: string | null
          created_at: string | null
          data_audiencia: string | null
          data_verificacao: string | null
          endereco: string | null
          hora_audiencia: string | null
          id: string
          local: string | null
          nome: string
          numero: string | null
          processo: string
          status: string | null
          telefone: string | null
          updated_at: string | null
          vara: string | null
        }
        Insert: {
          adverso?: string | null
          andamento?: string | null
          cep?: string | null
          complemento?: string | null
          created_at?: string | null
          data_audiencia?: string | null
          data_verificacao?: string | null
          endereco?: string | null
          hora_audiencia?: string | null
          id?: string
          local?: string | null
          nome: string
          numero?: string | null
          processo: string
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          vara?: string | null
        }
        Update: {
          adverso?: string | null
          andamento?: string | null
          cep?: string | null
          complemento?: string | null
          created_at?: string | null
          data_audiencia?: string | null
          data_verificacao?: string | null
          endereco?: string | null
          hora_audiencia?: string | null
          id?: string
          local?: string | null
          nome?: string
          numero?: string | null
          processo?: string
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          vara?: string | null
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          created_at: string
          first_attempt: string
          id: string
          ip_address: unknown
          last_attempt: string
          updated_at: string
          username: string | null
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          first_attempt?: string
          id?: string
          ip_address: unknown
          last_attempt?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          first_attempt?: string
          id?: string
          ip_address?: unknown
          last_attempt?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_mfa_settings: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          id: string
          mfa_enabled: boolean
          secret_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          id?: string
          mfa_enabled?: boolean
          secret_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          id?: string
          mfa_enabled?: boolean
          secret_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          id: string
          password: string
          role: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password: string
          role?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password?: string
          role?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
