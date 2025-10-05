import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Coins, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ContentUnlockProps {
  postId?: string;
  mediaId?: string;
  tokenCost: number;
  onUnlocked: () => void;
}

export const ContentUnlock = ({ postId, mediaId, tokenCost, onUnlocked }: ContentUnlockProps) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleUnlock = async () => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите, чтобы разблокировать контент",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('spend-tokens', {
        body: { postId, mediaId }
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Недостаточно токенов",
          description: `У вас ${data.balance} токенов, требуется ${data.required}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Контент разблокирован!",
        description: `Списано ${tokenCost} токенов. Новый баланс: ${data.newBalance}`,
      });

      onUnlocked();
    } catch (error) {
      console.error('Error unlocking content:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось разблокировать контент",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-black/60 backdrop-blur-sm border-primary">
      <CardContent className="p-6 text-center space-y-4">
        <div className="flex justify-center">
          <Lock className="h-16 w-16 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Платный контент</h3>
          <p className="text-muted-foreground">
            Этот контент доступен за {tokenCost} токенов
          </p>
        </div>
        <Button 
          onClick={handleUnlock} 
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Обработка...
            </>
          ) : (
            <>
              <Coins className="mr-2 h-4 w-4" />
              Разблокировать за {tokenCost} токенов
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};