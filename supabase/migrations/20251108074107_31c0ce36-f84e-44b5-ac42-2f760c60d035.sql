-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  actor_id UUID,
  post_id UUID,
  comment_id UUID,
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Add notification settings to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_likes BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_comments BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_subscriptions BOOLEAN DEFAULT true;

-- Create function to send notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_settings RECORD;
BEGIN
  -- Get user notification settings
  SELECT notifications_enabled, notify_likes, notify_comments, notify_messages, notify_subscriptions
  INTO v_settings
  FROM profiles
  WHERE id = p_user_id;

  -- Check if notifications are enabled
  IF NOT COALESCE(v_settings.notifications_enabled, true) THEN
    RETURN NULL;
  END IF;

  -- Check specific notification type settings
  IF p_type = 'like' AND NOT COALESCE(v_settings.notify_likes, true) THEN
    RETURN NULL;
  ELSIF p_type = 'comment' AND NOT COALESCE(v_settings.notify_comments, true) THEN
    RETURN NULL;
  ELSIF p_type = 'message' AND NOT COALESCE(v_settings.notify_messages, true) THEN
    RETURN NULL;
  ELSIF p_type = 'subscription' AND NOT COALESCE(v_settings.notify_subscriptions, true) THEN
    RETURN NULL;
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, message, link, actor_id, post_id, comment_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_actor_id, p_post_id, p_comment_id)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Create trigger function for new likes
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner UUID;
  v_post_title TEXT;
  v_liker_username TEXT;
BEGIN
  -- Get post owner and title
  SELECT user_id, title INTO v_post_owner, v_post_title
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't notify if user liked their own post
  IF v_post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker username
  SELECT username INTO v_liker_username
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create notification
  PERFORM create_notification(
    v_post_owner,
    'like',
    'Новый лайк',
    v_liker_username || ' поставил лайк на ваш пост "' || v_post_title || '"',
    '/photos',
    NEW.user_id,
    NEW.post_id
  );

  RETURN NEW;
END;
$$;

-- Create trigger for likes
DROP TRIGGER IF EXISTS on_post_like ON public.post_likes;
CREATE TRIGGER on_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

-- Create trigger function for new comments
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner UUID;
  v_post_title TEXT;
  v_commenter_username TEXT;
BEGIN
  -- Get post owner and title
  SELECT user_id, title INTO v_post_owner, v_post_title
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't notify if user commented on their own post
  IF v_post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter username
  SELECT username INTO v_commenter_username
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create notification
  PERFORM create_notification(
    v_post_owner,
    'comment',
    'Новый комментарий',
    v_commenter_username || ' оставил комментарий к вашему посту "' || v_post_title || '"',
    '/photos',
    NEW.user_id,
    NEW.post_id,
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- Create trigger for comments
DROP TRIGGER IF EXISTS on_new_comment ON public.comments;
CREATE TRIGGER on_new_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_comment();

-- Create trigger function for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_username TEXT;
BEGIN
  -- Get sender username
  SELECT username INTO v_sender_username
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Create notification
  PERFORM create_notification(
    NEW.receiver_id,
    'message',
    'Новое сообщение',
    'У вас новое сообщение от ' || v_sender_username,
    '/messages',
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;

-- Create trigger for messages
DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- Create trigger function for new subscriptions
CREATE OR REPLACE FUNCTION public.notify_new_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscriber_username TEXT;
BEGIN
  -- Get subscriber username
  SELECT username INTO v_subscriber_username
  FROM profiles
  WHERE id = NEW.subscriber_id;

  -- Create notification
  PERFORM create_notification(
    NEW.subscribed_to_id,
    'subscription',
    'Новый подписчик',
    v_subscriber_username || ' подписался на вас',
    '/profile/' || NEW.subscriber_id,
    NEW.subscriber_id
  );

  RETURN NEW;
END;
$$;

-- Create trigger for subscriptions
DROP TRIGGER IF EXISTS on_new_subscription ON public.subscriptions;
CREATE TRIGGER on_new_subscription
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_subscription();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;