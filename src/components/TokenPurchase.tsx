import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Coins, Loader2 } from "lucide-react";

const TOKEN_PACKAGES = [
  { amount: 5, tokens: 1.99 },
  { amount: 10, tokens: 3.99 },
  { amount: 25, tokens: 9.99 },
  { amount: 50, tokens: 19.99 },
];

export const TokenPurchase = () => {
  const [loading, setLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePurchase = async (amount: number) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('cryptobot-payment', {
        body: { action: 'create-invoice', amount }
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
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TOKEN_PACKAGES.map((pkg) => (
            <Card key={pkg.amount} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold">${pkg.amount}</div>
                  <div className="text-sm text-muted-foreground">
                    {pkg.tokens.toFixed(2)} токенов
                  </div>
                  <Button
                    onClick={() => handlePurchase(pkg.amount)}
                    disabled={loading || !!checkingPayment}
                    className="w-full mt-4"
                  >
                    {loading || checkingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {checkingPayment ? 'Ожидание оплаты...' : 'Обработка...'}
                      </>
                    ) : (
                      'Купить'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Оплата через CryptoBot. После оплаты токены будут зачислены автоматически.
        </div>
      </CardContent>
    </Card>
  );
};