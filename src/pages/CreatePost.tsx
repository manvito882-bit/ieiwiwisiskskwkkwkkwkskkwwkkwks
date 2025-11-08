import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText } from 'lucide-react';

const CreatePost = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [viewCondition, setViewCondition] = useState<'none' | 'like' | 'comment' | 'subscription'>('none');
  const [password, setPassword] = useState('');
  const [tokenCost, setTokenCost] = useState('0');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Войдите, чтобы создавать посты</p>
        <Button onClick={() => navigate('/auth')}>Войти</Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все обязательные поля',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const tokenCostValue = parseFloat(tokenCost) || 0;
      
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          title: title.trim(),
          content: content.trim(),
          category,
          view_condition: viewCondition,
          password: password || null,
          token_cost: tokenCostValue
        });

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Пост создан успешно'
      });

      navigate('/');
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать пост',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Создать пост</h1>
          <p className="text-muted-foreground">Поделитесь своими мыслями с сообществом</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Новый пост
          </CardTitle>
          <CardDescription>
            Заполните форму для создания нового поста
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Заголовок *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите заголовок поста"
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Содержание *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Напишите содержание поста..."
                required
                className="min-h-[200px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Общее</SelectItem>
                  <SelectItem value="media">Медиа</SelectItem>
                  <SelectItem value="news">Новости</SelectItem>
                  <SelectItem value="discussion">Обсуждение</SelectItem>
                  <SelectItem value="announcement">Объявление</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="view-condition">Условие просмотра</Label>
              <Select 
                value={viewCondition} 
                onValueChange={(value: 'none' | 'like' | 'comment' | 'subscription') => setViewCondition(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без условий (свободный просмотр)</SelectItem>
                  <SelectItem value="like">Требуется лайк 🔥</SelectItem>
                  <SelectItem value="comment">Требуется комментарий 💬</SelectItem>
                  <SelectItem value="subscription">Требуется подписка 👤</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Выберите условие для доступа к вашему посту
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль (необязательно)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Оставьте пустым для открытого доступа"
              />
              <p className="text-xs text-muted-foreground">
                Установите пароль для дополнительной защиты контента
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-cost">Стоимость в токенах</Label>
              <Input
                id="token-cost"
                type="number"
                min="0"
                step="0.01"
                value={tokenCost}
                onChange={(e) => setTokenCost(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Установите стоимость просмотра поста в токенах (0 = бесплатно)
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Создание...' : 'Создать пост'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                Отмена
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreatePost;