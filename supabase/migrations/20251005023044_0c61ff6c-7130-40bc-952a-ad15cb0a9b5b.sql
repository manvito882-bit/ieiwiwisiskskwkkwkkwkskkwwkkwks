-- Create function to add tokens to user balance
CREATE OR REPLACE FUNCTION public.add_tokens(p_user_id UUID, p_amount DECIMAL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET tokens_balance = tokens_balance + p_amount
  WHERE user_id = p_user_id;
END;
$$;