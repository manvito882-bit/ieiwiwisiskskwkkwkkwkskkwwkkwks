-- Add post_id column to media table to link media files to posts
ALTER TABLE public.media 
ADD COLUMN post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_media_post_id ON public.media(post_id);

-- Update existing media records to be individual posts (optional migration for existing data)
-- This will create a post for each existing media item
DO $$
DECLARE
    media_record RECORD;
    new_post_id UUID;
BEGIN
    FOR media_record IN SELECT * FROM public.media WHERE post_id IS NULL LOOP
        -- Create a new post for each existing media
        INSERT INTO public.posts (user_id, title, content, category)
        VALUES (
            media_record.user_id,
            media_record.title,
            COALESCE(media_record.description, ''),
            'media'
        )
        RETURNING id INTO new_post_id;
        
        -- Update the media record with the new post_id
        UPDATE public.media 
        SET post_id = new_post_id 
        WHERE id = media_record.id;
    END LOOP;
END $$;