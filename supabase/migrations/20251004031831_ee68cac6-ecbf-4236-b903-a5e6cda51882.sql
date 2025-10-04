-- Add password field to media table
ALTER TABLE public.media 
  ADD COLUMN password TEXT;

-- Add password field to posts table
ALTER TABLE public.posts 
  ADD COLUMN password TEXT;

-- Create index for faster queries
CREATE INDEX idx_media_password ON public.media(password) WHERE password IS NOT NULL;
CREATE INDEX idx_posts_password ON public.posts(password) WHERE password IS NOT NULL;