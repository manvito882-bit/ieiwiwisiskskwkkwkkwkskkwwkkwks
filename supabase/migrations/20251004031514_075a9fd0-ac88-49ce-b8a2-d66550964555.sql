-- Add foreign keys to notifications table
ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_from_user_id_fkey 
  FOREIGN KEY (from_user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_post_id_fkey 
  FOREIGN KEY (post_id) 
  REFERENCES public.posts(id) 
  ON DELETE CASCADE;

-- Fix search_path for existing functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, is_18_confirmed)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE((NEW.raw_user_meta_data ->> 'is_18_confirmed')::boolean, false)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;