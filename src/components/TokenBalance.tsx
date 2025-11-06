import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const TokenBalance = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!user) return;

    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('token_balance')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setBalance(parseFloat(data.token_balance.toString()) || 0);
      }
    };

    fetchBalance();

    // Subscribe to balance changes
    const channel = supabase
      .channel('balance-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && 'token_balance' in payload.new) {
            const balanceValue = payload.new.token_balance;
            setBalance(parseFloat(typeof balanceValue === 'string' ? balanceValue : String(balanceValue)) || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
      <Coins className="h-5 w-5 text-primary" />
      <span className="font-semibold">{balance.toFixed(2)} токенов</span>
    </div>
  );
};