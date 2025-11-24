export type RoomStatus = 'lobby' | 'in_progress' | 'finished';
export type FamilyLabel = '신랑네' | '신부네' | '우리부부';

export interface Room {
  id: string;
  code: string;
  current_round: number | null;
  status: RoomStatus;
  created_at: string;
}

export interface Family {
  id: string;
  room_id: string;
  label: FamilyLabel;
  device_id: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  room_id: string;
  url: string;
  order_index: number;
  created_at: string;
}

export interface Round {
  id: string;
  room_id: string;
  round_number: number;
  photo_ids: string[];
  winning_photo_id: string | null;
  created_at: string;
}

export interface Vote {
  id: string;
  room_id: string;
  round_id: string;
  family_id: string;
  photo_id: string;
  created_at: string;
}

export interface VoteWithFamily extends Vote {
  family: Family;
}

export interface RoundWithPhotos extends Round {
  photos: Photo[];
}

