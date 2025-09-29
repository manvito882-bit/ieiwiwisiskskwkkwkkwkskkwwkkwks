-- Create live_streams table
CREATE TABLE public.live_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  thumbnail_url TEXT
);

-- Enable RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Live streams are viewable by everyone"
ON public.live_streams
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own live streams"
ON public.live_streams
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own live streams"
ON public.live_streams
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own live streams"
ON public.live_streams
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_live_streams_active ON public.live_streams(is_active, created_at DESC);