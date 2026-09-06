export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          risk_tolerance: 'conservative' | 'balanced' | 'aggressive' | null
          base_currency: 'EUR' | 'USD' | null
          investment_horizon_years: number | null
          data_sharing_consent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          risk_tolerance?: 'conservative' | 'balanced' | 'aggressive' | null
          base_currency?: 'EUR' | 'USD' | null
          investment_horizon_years?: number | null
          data_sharing_consent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          risk_tolerance?: 'conservative' | 'balanced' | 'aggressive' | null
          base_currency?: 'EUR' | 'USD' | null
          investment_horizon_years?: number | null
          data_sharing_consent?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_saved_etfs: {
        Row: {
          user_id: string
          isin: string
          created_at: string
        }
        Insert: {
          user_id: string
          isin: string
          created_at?: string
        }
        Update: {
          user_id?: string
          isin?: string
          created_at?: string
        }
      }
      chat_history: {
        Row: {
          id: string
          user_id: string
          messages: Json
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          messages: Json
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          messages?: Json
          updated_at?: string
        }
      }
    }
  }
}
