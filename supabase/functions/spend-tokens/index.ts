import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, mediaId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log(`User ${user.id} attempting to spend tokens for post ${postId} or media ${mediaId}`);

    // Get user's profile with token balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens_balance')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Get content cost
    let tokenCost = 0;
    if (postId) {
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('token_cost')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        throw new Error('Post not found');
      }
      tokenCost = post.token_cost || 0;
    } else if (mediaId) {
      const { data: media, error: mediaError } = await supabase
        .from('media')
        .select('token_cost')
        .eq('id', mediaId)
        .single();

      if (mediaError || !media) {
        throw new Error('Media not found');
      }
      tokenCost = media.token_cost || 0;
    }

    // Check if user already unlocked this content
    const { data: existingTransaction } = await supabase
      .from('token_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq(postId ? 'post_id' : 'media_id', postId || mediaId)
      .maybeSingle();

    if (existingTransaction) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already unlocked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has enough tokens
    if (profile.tokens_balance < tokenCost) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Недостаточно токенов',
          required: tokenCost,
          balance: profile.tokens_balance
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Deduct tokens
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ 
        tokens_balance: parseFloat(profile.tokens_balance) - tokenCost 
      })
      .eq('user_id', user.id);

    if (deductError) {
      console.error('Error deducting tokens:', deductError);
      throw deductError;
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: user.id,
        post_id: postId || null,
        media_id: mediaId || null,
        tokens_spent: tokenCost,
      });

    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      // Rollback tokens
      await supabase
        .from('profiles')
        .update({ 
          tokens_balance: parseFloat(profile.tokens_balance)
        })
        .eq('user_id', user.id);
      throw transactionError;
    }

    console.log(`User ${user.id} spent ${tokenCost} tokens. New balance: ${parseFloat(profile.tokens_balance) - tokenCost}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        newBalance: parseFloat(profile.tokens_balance) - tokenCost
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in spend-tokens function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});