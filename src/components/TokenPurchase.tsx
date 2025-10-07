import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Coins, Loader2 } from "lucide-react";

export const TokenPurchase = () => {
  const [loading, setLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('1');
  const { toast } = useToast();

  const calculateTokens = (usdAmount: number) => {
    // 1 USD = 10 токенов
    return usdAmount * 10;
  };

  const handlePurchase = async () => {
    const usdAmount = parseFloat(amount);
    
    if (isNaN(usdAmount) || usdAmount < 0.25) {
      toast({
        title: "Ошибка",
        description: "Минимальная сумма для покупки - $0.25",
        variant: "destructive",
      });
      return;
    }
    
    if (usdAmount > 1000) {
      toast({
        title: "Ошибка",
        description: "Максимальная сумма для покупки - $1000",
        variant: "destructive",
      });
      return;
    }
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('cryptobot-payment', {
        body: { action: 'create-invoice', amount: usdAmount }
      });

      if (error) throw error;

      if (data.success && data.invoice_url) {
        // Open payment link in new window
        const paymentWindow = window.open(data.invoice_url, '_blank');
        
        toast({
          title: "Окно оплаты открыто",
          description: "Завершите оплату в новом окне",
        });

        // Start checking payment status
        setCheckingPayment(data.invoice_id);
        checkPaymentStatus(data.invoice_id);
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать счёт на оплату",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (invoiceId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals
    
    const interval = setInterval(async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase.functions.invoke('cryptobot-payment', {
          body: { action: 'check-payment', invoiceId }
        });

        if (error) {
          console.error('Error checking payment:', error);
          return;
        }

        if (data.status === 'paid') {
          clearInterval(interval);
          setCheckingPayment(null);
          
          toast({
            title: "Оплата успешна!",
            description: "Токены зачислены на ваш баланс",
          });
          
          // Reload page to update balance
          window.location.reload();
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setCheckingPayment(null);
        
        toast({
          title: "Время ожидания истекло",
          description: "Проверьте статус платежа вручную",
          variant: "destructive",
        });
      }
    }, 5000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Купить токены
        </CardTitle>
        <CardDescription>
          Токены используются для просмотра платного контента
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Сумма (USD)</Label>
            <Input
              id="amount"
              type="number"
              min="0.25"
              max="1000"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Введите сумму в USD (мин. 0.25$)"
              disabled={loading || !!checkingPayment}
            />
            <p className="text-sm text-muted-foreground">
              Минимум: $0.25 | Максимум: $1000
            </p>
          </div>
          
          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) >= 0.25 && (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Вы получите:</span>
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-primary">
                    {calculateTokens(parseFloat(amount))} токенов
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Курс: 1 USD = 10 токенов
              </p>
            </div>
          )}
          
          <Button
            onClick={handlePurchase}
            disabled={loading || !!checkingPayment || !amount || parseFloat(amount) < 0.25}
            className="w-full"
            size="lg"
          >
            {loading || checkingPayment ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {checkingPayment ? 'Ожидание оплаты...' : 'Обработка...'}
              </>
            ) : (
              <>
                <Coins className="mr-2 h-4 w-4" />
                Купить токены за ${amount}
              </>
            )}
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Оплата через CryptoBot. После оплаты токены будут зачислены автоматически.
        </div>
      </CardContent>
    </Card>
  );
};