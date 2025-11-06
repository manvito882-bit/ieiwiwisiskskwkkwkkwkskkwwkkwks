-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  category text NOT NULL DEFAULT 'general',
  view_condition text DEFAULT 'none' CHECK (view_condition IN ('none', 'like', 'comment', 'subscription')),
  password text,
  token_cost numeric DEFAULT 0,
  likes_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create media table
CREATE TABLE IF NOT EXISTS public.media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text,
  content_type text NOT NULL CHECK (content_type IN ('image', 'video', 'audio')),
  file_size bigint,
  token_cost numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Create post_likes table
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subscribed_to_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(subscriber_id, subscribed_to_id),
  CHECK (subscriber_id != subscribed_to_id)
);

-- Create token_transactions table
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  amount numeric NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'spend', 'refund')),
  post_id uuid REFERENCES public.posts ON DELETE SET NULL,
  media_id uuid REFERENCES public.media ON DELETE SET NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create live_streams table
CREATE TABLE IF NOT EXISTS public.live_streams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  stream_key text,
  is_active boolean DEFAULT false,
  viewer_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone
);

-- Enable RLS on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for media
CREATE POLICY "Anyone can view media" ON public.media FOR SELECT USING (true);
CREATE POLICY "Users can create their own media" ON public.media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own media" ON public.media FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own media" ON public.media FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for post_likes
CREATE POLICY "Anyone can view likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users can create their own likes" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comments
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can create their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for subscriptions
CREATE POLICY "Anyone can view subscriptions" ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY "Users can create their own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "Users can delete their own subscriptions" ON public.subscriptions FOR DELETE USING (auth.uid() = subscriber_id);

-- RLS Policies for token_transactions
CREATE POLICY "Users can view their own transactions" ON public.token_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own transactions" ON public.token_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for live_streams
CREATE POLICY "Anyone can view active streams" ON public.live_streams FOR SELECT USING (true);
CREATE POLICY "Users can create their own streams" ON public.live_streams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own streams" ON public.live_streams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own streams" ON public.live_streams FOR DELETE USING (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media-images', 'media-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('media-videos', 'media-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for media-images
CREATE POLICY "Anyone can view images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'media-images');

CREATE POLICY "Users can upload their own images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'media-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'media-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'media-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for media-videos
CREATE POLICY "Anyone can view videos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'media-videos');

CREATE POLICY "Users can upload their own videos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'media-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own videos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'media-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'media-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for better performance
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_category ON public.posts(category);
CREATE INDEX idx_media_user_id ON public.media(user_id);
CREATE INDEX idx_media_post_id ON public.media(post_id);
CREATE INDEX idx_media_content_type ON public.media(content_type);
CREATE INDEX idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_subscriptions_subscriber_id ON public.subscriptions(subscriber_id);
CREATE INDEX idx_subscriptions_subscribed_to_id ON public.subscriptions(subscribed_to_id);

-- Create trigger for updating posts timestamp
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix profiles table to use id instead of user_id
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.profiles ADD PRIMARY KEY (id);