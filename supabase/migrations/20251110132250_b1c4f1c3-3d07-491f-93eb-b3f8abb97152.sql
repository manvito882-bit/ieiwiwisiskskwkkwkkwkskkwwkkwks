-- Add image_url column to messages table for image attachments
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add REPLICA IDENTITY FULL for realtime updates on comments
ALTER TABLE public.comments REPLICA IDENTITY FULL;

-- Add the comments table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;