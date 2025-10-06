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
    const { action, amount } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cryptobotToken = Deno.env.get('CRYPTOBOT_API_KEY')!;
    
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

    if (action === 'create-invoice') {
      // Calculate tokens: 1 USD = 10 tokens
      const tokensAmount = amount * 10;
      
      console.log(`Creating invoice for user ${user.id}: $${amount} = ${tokensAmount} tokens`);

      // Create invoice via CryptoBot API
      const invoiceResponse = await fetch('https://pay.crypt.bot/api/createInvoice', {
        method: 'POST',
        headers: {
          'Crypto-Pay-API-Token': cryptobotToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          currency_type: 'fiat',
          fiat: 'USD',
          description: `Покупка ${tokensAmount.toFixed(2)} токенов`,
          paid_btn_name: 'callback',
          paid_btn_url: `${supabaseUrl}/functions/v1/cryptobot-payment`,
        }),
      });

      const invoiceData = await invoiceResponse.json();
      console.log('CryptoBot invoice response:', invoiceData);

      if (!invoiceData.ok) {
        throw new Error(invoiceData.error?.name || 'Failed to create invoice');
      }

      // Save purchase record
      const { error: purchaseError } = await supabase
        .from('token_purchases')
        .insert({
          user_id: user.id,
          amount: amount,
          tokens_amount: tokensAmount,
          payment_id: invoiceData.result.invoice_id.toString(),
          status: 'pending',
        });

      if (purchaseError) {
        console.error('Error saving purchase:', purchaseError);
        throw purchaseError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          invoice_url: invoiceData.result.pay_url,
          invoice_id: invoiceData.result.invoice_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check-payment') {
      const body = await req.json();
      const { invoiceId } = body;
      
      console.log(`Checking payment status for invoice ${invoiceId}`);

      // Check invoice status via CryptoBot API
      const statusResponse = await fetch(`https://pay.crypt.bot/api/getInvoices?invoice_ids=${invoiceId}`, {
        headers: {
          'Crypto-Pay-API-Token': cryptobotToken,
        },
      });

      const statusData = await statusResponse.json();
      console.log('CryptoBot status response:', statusData);

      if (!statusData.ok || !statusData.result.items.length) {
        throw new Error('Invoice not found');
      }

      const invoice = statusData.result.items[0];
      
      if (invoice.status === 'paid') {
        // Update purchase status
        const { data: purchase, error: fetchError } = await supabase
          .from('token_purchases')
          .select('*')
          .eq('payment_id', invoiceId.toString())
          .single();

        if (fetchError || !purchase) {
          console.error('Purchase not found:', fetchError);
          throw new Error('Purchase not found');
        }

        if (purchase.status === 'pending') {
          // Update purchase status
          const { error: updateError } = await supabase
            .from('token_purchases')
            .update({ status: 'completed' })
            .eq('payment_id', invoiceId.toString());

          if (updateError) {
            console.error('Error updating purchase:', updateError);
            throw updateError;
          }

          // Add tokens to user balance
          const { error: balanceError } = await supabase.rpc('add_tokens', {
            p_user_id: purchase.user_id,
            p_amount: purchase.tokens_amount,
          });

          if (balanceError) {
            console.error('Error adding tokens:', balanceError);
            throw balanceError;
          }

          console.log(`Added ${purchase.tokens_amount} tokens to user ${purchase.user_id}`);
        }

        return new Response(
          JSON.stringify({ success: true, status: 'paid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: invoice.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in cryptobot-payment function:', error);
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