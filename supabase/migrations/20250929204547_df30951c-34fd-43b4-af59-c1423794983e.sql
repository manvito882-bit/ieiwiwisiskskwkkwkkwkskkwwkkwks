-- Add foreign key relationship between media and profiles
ALTER TABLE public.media
ADD CONSTRAINT media_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;