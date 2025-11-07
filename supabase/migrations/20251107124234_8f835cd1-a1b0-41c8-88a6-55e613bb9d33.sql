-- Add new fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS can_receive_messages_from TEXT DEFAULT 'everyone' CHECK (can_receive_messages_from IN ('everyone', 'subscribers', 'none'));

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, blocked_user_id)
);

-- Enable RLS on blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for blocked_users
CREATE POLICY "Users can view their own blocks"
ON public.blocked_users FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can block others"
ON public.blocked_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unblock others"
ON public.blocked_users FOR DELETE
USING (auth.uid() = user_id);

-- Add deleted fields to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_by_receiver BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update messages RLS to respect blocked users
CREATE POLICY "Cannot message blocked users"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  NOT EXISTS (
    SELECT 1 FROM public.blocked_users 
    WHERE (user_id = receiver_id AND blocked_user_id = sender_id)
       OR (user_id = sender_id AND blocked_user_id = receiver_id)
  )
);