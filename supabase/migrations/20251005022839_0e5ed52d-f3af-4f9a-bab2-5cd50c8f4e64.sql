-- Add tokens balance to profiles
ALTER TABLE public.profiles 
ADD COLUMN tokens_balance DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- Create token_purchases table for payment history
CREATE TABLE public.token_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  tokens_amount DECIMAL(10,2) NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create token_transactions table for token usage history
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  media_id UUID REFERENCES public.media(id) ON DELETE CASCADE,
  tokens_spent DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add token_cost field to posts
ALTER TABLE public.posts 
ADD COLUMN token_cost DECIMAL(10,2) DEFAULT 0;

-- Add token_cost field to media
ALTER TABLE public.media 
ADD COLUMN token_cost DECIMAL(10,2) DEFAULT 0;

-- Enable RLS
ALTER TABLE public.token_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for token_purchases
CREATE POLICY "Users can view their own purchases"
ON public.token_purchases FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases"
ON public.token_purchases FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for token_transactions
CREATE POLICY "Users can view their own transactions"
ON public.token_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
ON public.token_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_token_purchases_user_id ON public.token_purchases(user_id);
CREATE INDEX idx_token_transactions_user_id ON public.token_transactions(user_id);
CREATE INDEX idx_posts_token_cost ON public.posts(token_cost) WHERE token_cost > 0;
CREATE INDEX idx_media_token_cost ON public.media(token_cost) WHERE token_cost > 0;