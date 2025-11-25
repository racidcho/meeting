import type { Room, Photo, Round, Family, Vote } from './types';
import { supabase } from './supabaseClient';

// Generate a random room code (4-6 digits)
export function generateRoomCode(): string {
  const length = 4 + Math.floor(Math.random() * 3); // 4-6 digits
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}

// Room operations
export async function createRoom(): Promise<Room> {
  const code = generateRoomCode();
  const { data, error } = await supabase
    .from('rooms')
    .insert({ code, status: 'lobby' } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

export async function updateRoom(
  roomId: string,
  updates: Partial<Room>
): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update(updates as any)
    .eq('id', roomId);

  if (error) throw error;
}

// Photo operations
export async function addPhoto(photo: {
  room_id: string;
  url: string;
  order_index: number;
}): Promise<Photo> {
  const { data, error } = await supabase
    .from('photos')
    .insert(photo)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPhotosByRoom(roomId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('room_id', roomId)
    .order('order_index');

  if (error) throw error;
  return data || [];
}

// Round operations
export async function createRound(round: {
  room_id: string;
  round_number: number;
  photo_ids: string[];
}): Promise<Round> {
  const { data, error } = await supabase
    .from('rounds')
    .insert(round)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRoundByRoomAndNumber(
  roomId: string,
  roundNumber: number
): Promise<Round | null> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function getRoundsByRoom(roomId: string): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('room_id', roomId)
    .order('round_number');

  if (error) throw error;
  return data || [];
}

export async function updateRound(
  roundId: string,
  updates: Partial<Round>
): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update(updates as any)
    .eq('id', roundId);

  if (error) throw error;
}

// Family operations
export async function getOrCreateFamily(
  roomId: string,
  label: '신랑네' | '신부네' | '우리부부'
): Promise<Family> {
  // Try to get existing family
  const { data: existing } = await supabase
    .from('families')
    .select('*')
    .eq('room_id', roomId)
    .eq('label', label)
    .single();

  if (existing) return existing;

  // Create new family
  const { data, error } = await supabase
    .from('families')
    .insert({ room_id: roomId, label })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFamiliesByRoom(roomId: string): Promise<Family[]> {
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('room_id', roomId);

  if (error) throw error;
  return data || [];
}

// Vote operations
export async function createVote(vote: {
  room_id: string;
  round_id: string;
  family_id: string;
  photo_id: string;
}): Promise<Vote> {
  const { data, error } = await supabase
    .from('votes')
    .insert(vote)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getVotesByRound(roundId: string): Promise<Vote[]> {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('round_id', roundId);

  if (error) throw error;
  return data || [];
}

export async function getVoteByFamilyAndRound(
  familyId: string,
  roundId: string
): Promise<Vote | null> {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('family_id', familyId)
    .eq('round_id', roundId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function deleteVote(voteId: string): Promise<void> {
  const { error } = await supabase.from('votes').delete().eq('id', voteId);
  if (error) throw error;
}

export async function deleteVotesByRound(roundId: string, familyId?: string): Promise<void> {
  let query = supabase.from('votes').delete().eq('round_id', roundId);
  
  if (familyId) {
    query = query.eq('family_id', familyId);
  }
  
  const { error } = await query;
  if (error) throw error;
}

// Helper: Shuffle array
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper: Calculate winning photo with tie handling
// Returns the winning photo ID (null if tie) and tie information
export function calculateWinningPhoto(votes: Vote[]): {
  winningPhotoId: string | null;
  isTie: boolean;
  tiePhotos: string[];
} {
  if (votes.length === 0) {
    throw new Error('투표가 없습니다.');
  }

  // Count votes for each photo
  const voteCounts: Record<string, number> = {};
  votes.forEach((vote) => {
    voteCounts[vote.photo_id] = (voteCounts[vote.photo_id] || 0) + 1;
  });

  // Find maximum vote count
  const maxVotes = Math.max(...Object.values(voteCounts));

  // Find all photos with maximum votes (handle ties)
  const tiedPhotos = Object.entries(voteCounts)
    .filter(([_, count]) => count === maxVotes)
    .map(([photoId]) => photoId);

  const isTie = tiedPhotos.length > 1;

  // If tie, return null (will be handled later with retie)
  // If no tie, return the winning photo ID
  const winningPhotoId = isTie ? null : tiedPhotos[0];

  return {
    winningPhotoId,
    isTie,
    tiePhotos: tiedPhotos,
  };
}

// Helper: Create rounds from photos (3 photos per round)
export async function generateRounds(
  roomId: string,
  photos: Photo[]
): Promise<Round[]> {
  if (photos.length < 3) {
    throw new Error('최소 3장의 사진이 필요합니다.');
  }

  // Shuffle photos
  const shuffled = shuffleArray(photos);

  // Group into rounds of 3
  const rounds: Round[] = [];
  for (let i = 0; i < shuffled.length; i += 3) {
    const roundPhotos = shuffled.slice(i, i + 3);
    if (roundPhotos.length === 3) {
      const round = await createRound({
        room_id: roomId,
        round_number: Math.floor(i / 3) + 1,
        photo_ids: roundPhotos.map((p) => p.id),
      });
      rounds.push(round);
    }
  }

  return rounds;
}

