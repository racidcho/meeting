// This file is auto-generated. You can generate it using Supabase CLI:
// npx supabase gen types typescript --project-id your-project-id > lib/database.types.ts
// For now, we'll define a basic structure

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
      rooms: {
        Row: {
          id: string
          code: string
          current_round: number | null
          status: 'lobby' | 'in_progress' | 'finished'
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          current_round?: number | null
          status?: 'lobby' | 'in_progress' | 'finished'
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          current_round?: number | null
          status?: 'lobby' | 'in_progress' | 'finished'
          created_at?: string
        }
      }
      families: {
        Row: {
          id: string
          room_id: string
          label: '신랑네' | '신부네' | '우리부부'
          device_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          label: '신랑네' | '신부네' | '우리부부'
          device_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          label?: '신랑네' | '신부네' | '우리부부'
          device_id?: string | null
          created_at?: string
        }
      }
      photos: {
        Row: {
          id: string
          room_id: string
          url: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          url: string
          order_index: number
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          url?: string
          order_index?: number
          created_at?: string
        }
      }
      rounds: {
        Row: {
          id: string
          room_id: string
          round_number: number
          photo_ids: string[]
          winning_photo_id: string | null
          tie_photos: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          round_number: number
          photo_ids: string[]
          winning_photo_id?: string | null
          tie_photos?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          round_number?: number
          photo_ids?: string[]
          winning_photo_id?: string | null
          tie_photos?: string[] | null
          created_at?: string
        }
      }
      votes: {
        Row: {
          id: string
          room_id: string
          round_id: string
          family_id: string
          photo_id: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          round_id: string
          family_id: string
          photo_id: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          round_id?: string
          family_id?: string
          photo_id?: string
          created_at?: string
        }
      }
    }
  }
}

