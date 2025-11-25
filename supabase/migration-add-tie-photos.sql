-- Migration: Add tie_photos column to rounds table
-- This column stores photo IDs that tied in a round

ALTER TABLE rounds 
ADD COLUMN IF NOT EXISTS tie_photos UUID[];

-- Add comment for documentation
COMMENT ON COLUMN rounds.tie_photos IS 'Array of photo IDs that tied in this round. Used for retie voting.';



