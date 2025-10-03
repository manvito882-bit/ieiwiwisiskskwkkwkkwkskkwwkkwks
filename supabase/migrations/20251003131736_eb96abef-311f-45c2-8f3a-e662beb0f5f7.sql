-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL,
  subscribed_to_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, subscribed_to_id),
  CONSTRAINT no_self_subscription CHECK (subscriber_id != subscribed_to_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Subscriptions are viewable by everyone"
  ON public.subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Users can subscribe to others"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Users can unsubscribe"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = subscriber_id);

-- Update view_condition enum to include subscription
ALTER TYPE public.view_condition ADD VALUE 'subscription';

-- Add subscribers_count to profiles
ALTER TABLE public.profiles
ADD COLUMN subscribers_count INTEGER NOT NULL DEFAULT 0;

-- Function to update subscribers count
CREATE OR REPLACE FUNCTION public.update_subscribers_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger for subscribers count
CREATE TRIGGER update_subscribers_count_trigger
AFTER INSERT OR DELETE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_subscribers_count();

COMMENT ON TABLE public.subscriptions IS 'User subscriptions/follows';
COMMENT ON COLUMN public.profiles.subscribers_count IS 'Number of subscribers for this user';