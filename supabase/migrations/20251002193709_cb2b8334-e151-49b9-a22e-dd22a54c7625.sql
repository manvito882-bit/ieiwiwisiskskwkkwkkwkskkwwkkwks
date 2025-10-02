-- Add view condition to posts table
CREATE TYPE public.view_condition AS ENUM ('none', 'like', 'comment');

ALTER TABLE public.posts 
ADD COLUMN view_condition public.view_condition NOT NULL DEFAULT 'none';

-- Add image support to messages
ALTER TABLE public.messages
ADD COLUMN image_url text;

COMMENT ON COLUMN public.posts.view_condition IS 'Condition to view media: none (free), like (requires like), comment (requires comment)';
COMMENT ON COLUMN public.messages.image_url IS 'URL of attached image in message';