import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    username: '', 
    password: '', 
    confirmPassword: '', 
    is18Confirmed: false 
  });
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginData.username, loginData.password);
    
    if (error) {
      toast({
        title: "Ошибка входа",
        description: error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Успешный вход",
        description: "Добро пожаловать!",
      });
      navigate('/');
    }
    
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Ошибка",
        description: "Пароли не совпадают",
        variant: "destructive"
      });
      return;
    }

    if (!signupData.is18Confirmed) {
      toast({
        title: "Ошибка",
        description: "Необходимо подтвердить, что вам есть 18 лет",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(signupData.username, signupData.password, signupData.is18Confirmed);
    
    if (error) {
      toast({
        title: "Ошибка регистрации",
        description: error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Успешная регистрация",
        description: "Добро пожаловать на платформу!",
      });
      navigate('/');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Медиа Платформа</h1>
          <p className="text-muted-foreground">Обмен медиа-контентом с лавандовым дизайном</p>
        </div>

        <Card className="shadow-lg border-lavender-light">
          <CardHeader>
            <CardTitle className="text-center">Вход в систему</CardTitle>
            <CardDescription className="text-center">
              Войдите или создайте новый аккаунт
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Имя пользователя</Label>
                    <Input
                      id="login-username"
                      type="text"
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                      required
                      className="border-lavender-light focus:ring-lavender"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Пароль</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      className="border-lavender-light focus:ring-lavender"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-lavender hover:bg-lavender-dark"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Вход...' : 'Войти'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Имя пользователя</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      value={signupData.username}
                      onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                      required
                      className="border-lavender-light focus:ring-lavender"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Пароль</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                      className="border-lavender-light focus:ring-lavender"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      required
                      className="border-lavender-light focus:ring-lavender"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="age-confirmation"
                      checked={signupData.is18Confirmed}
                      onCheckedChange={(checked) => 
                        setSignupData({ ...signupData, is18Confirmed: checked as boolean })
                      }
                    />
                    <Label htmlFor="age-confirmation" className="text-sm">
                      Подтверждаю, что мне есть 18 лет
                    </Label>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-lavender hover:bg-lavender-dark"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;