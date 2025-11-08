import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Image as ImageIcon, User, Shield, Palette, FileText, MessageSquare, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
  likes_count: number;
  profiles?: {
    username: string;
  } | null;
}

const Index = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('category', 'general')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get profiles
      const userIds = [...new Set(postsData?.map(post => post.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const postsWithProfiles = postsData?.map(post => ({
        ...post,
        profiles: profilesData?.find(p => p.id === post.user_id) || null
      }));

      setPosts(postsWithProfiles as any || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold bg-gradient-to-r from-lavender to-lavender-dark bg-clip-text text-transparent">
          Добро пожаловать в Медиа Платформу
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Современная платформа для обмена медиа-контентом с уникальным лавандово-белым дизайном
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <Card className="p-6 border-lavender-light hover:shadow-lg transition-shadow group cursor-pointer" 
              onClick={() => navigate('/videos')}>
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-lavender-light rounded-full flex items-center justify-center group-hover:bg-lavender transition-colors">
              <Play className="w-8 h-8 text-lavender group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-semibold">Видео-контент</h2>
            <p className="text-muted-foreground">
              Загружайте и просматривайте движущиеся изображения. 
              Поделитесь своими видео с сообществом.
            </p>
            <Button variant="outline" className="border-lavender text-lavender hover:bg-lavender hover:text-white">
              Перейти к видео
            </Button>
          </CardContent>
        </Card>

        <Card className="p-6 border-lavender-light hover:shadow-lg transition-shadow group cursor-pointer"
              onClick={() => navigate('/photos')}>
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-lavender-light rounded-full flex items-center justify-center group-hover:bg-lavender transition-colors">
              <ImageIcon className="w-8 h-8 text-lavender group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-semibold">Фото-контент</h2>
            <p className="text-muted-foreground">
              Загружайте и просматривайте статичные изображения. 
              Делитесь своими фотографиями с другими пользователями.
            </p>
            <Button variant="outline" className="border-lavender text-lavender hover:bg-lavender hover:text-white">
              Перейти к фото
            </Button>
          </CardContent>
        </Card>

        <Card className="p-6 border-lavender-light hover:shadow-lg transition-shadow group cursor-pointer"
              onClick={() => navigate('/create-post')}>
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-lavender-light rounded-full flex items-center justify-center group-hover:bg-lavender transition-colors">
              <FileText className="w-8 h-8 text-lavender group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-semibold">Создать пост</h2>
            <p className="text-muted-foreground">
              Публикуйте текстовые посты и делитесь своими мыслями с сообществом.
            </p>
            <Button variant="outline" className="border-lavender text-lavender hover:bg-lavender hover:text-white">
              Написать пост
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Posts */}
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold">Последние посты</h2>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Загрузка...</p>
        ) : posts.length === 0 ? (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">
              Пока нет постов. Будьте первым, кто создаст пост!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-lavender" />
                      <span className="font-medium">{post.profiles?.username || 'Пользователь'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Heart className="w-4 h-4" />
                      <span className="text-sm">{post.likes_count || 0}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold">{post.title}</h3>
                  <p className="text-muted-foreground line-clamp-3">{post.content}</p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-lavender hover:text-lavender-dark"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Комментарии
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto text-center">
        <h3 className="text-lg font-medium mb-4">Особенности платформы</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-lavender-light rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-lavender" />
            </div>
            <p><strong>Простая регистрация</strong><br />Только username и пароль</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-lavender-light rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-lavender" />
            </div>
            <p><strong>Безопасность</strong><br />Контент только для взрослых (18+)</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-lavender-light rounded-full flex items-center justify-center">
              <Palette className="w-4 h-4 text-lavender" />
            </div>
            <p><strong>Уникальный дизайн</strong><br />Лавандово-белая цветовая схема</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
