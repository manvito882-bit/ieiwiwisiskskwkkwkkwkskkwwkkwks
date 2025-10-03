-- Fix search_path for update_subscribers_count function
CREATE OR REPLACE FUNCTION public.update_subscribers_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles 
    SET subscribers_count = subscribers_count + 1 
    WHERE user_id = NEW.subscribed_to_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles 
    SET subscribers_count = subscribers_count - 1 
    WHERE user_id = OLD.subscribed_to_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;