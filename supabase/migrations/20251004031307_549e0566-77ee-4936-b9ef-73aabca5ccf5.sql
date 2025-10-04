-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  post_id UUID,
  from_user_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  notify_on_new_posts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for notification_settings
CREATE POLICY "Users can view their own notification settings"
  ON public.notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
  ON public.notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
  ON public.notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to create notifications for subscribers when a new post is created
CREATE OR REPLACE FUNCTION public.notify_subscribers_on_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notifications for all subscribers who have notifications enabled
  INSERT INTO public.notifications (user_id, type, content, post_id, from_user_id)
  SELECT 
    s.subscriber_id,
    'new_post',
    'Новый пост от пользователя',
    NEW.id,
    NEW.user_id
  FROM public.subscriptions s
  LEFT JOIN public.notification_settings ns ON ns.user_id = s.subscriber_id
  WHERE s.subscribed_to_id = NEW.user_id
    AND (ns.notify_on_new_posts = true OR ns.notify_on_new_posts IS NULL);
  
  RETURN NEW;
END;
$$;

-- Create trigger for new posts
CREATE TRIGGER on_new_post_notify_subscribers
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscribers_on_new_post();

-- Function to create notifications for subscribers when new media is uploaded
CREATE OR REPLACE FUNCTION public.notify_subscribers_on_new_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notifications for all subscribers who have notifications enabled
  INSERT INTO public.notifications (user_id, type, content, post_id, from_user_id)
  SELECT 
    s.subscriber_id,
    CASE 
      WHEN NEW.content_type = 'video' THEN 'new_video'
      WHEN NEW.content_type = 'image' THEN 'new_photo'
      ELSE 'new_media'
    END,
    CASE 
      WHEN NEW.content_type = 'video' THEN 'Новое видео от пользователя'
      WHEN NEW.content_type = 'image' THEN 'Новое фото от пользователя'
      ELSE 'Новый контент от пользователя'
    END,
    NEW.post_id,
    NEW.user_id
  FROM public.subscriptions s
  LEFT JOIN public.notification_settings ns ON ns.user_id = s.subscriber_id
  WHERE s.subscribed_to_id = NEW.user_id
    AND (ns.notify_on_new_posts = true OR ns.notify_on_new_posts IS NULL);
  
  RETURN NEW;
END;
$$;

-- Create trigger for new media
CREATE TRIGGER on_new_media_notify_subscribers
  AFTER INSERT ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscribers_on_new_media();