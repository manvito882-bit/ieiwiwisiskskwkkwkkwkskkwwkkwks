import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { User, Flame, MessageSquare, Calendar, Lock, Coins } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import Comments from '@/components/Comments';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PasswordPrompt } from '@/components/PasswordPrompt';
import { ContentUnlock } from '@/components/ContentUnlock';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
  likes_count: number;
  category: string;
  view_condition: 'none' | 'like' | 'comment' | 'subscription';
  password?: string | null;
  token_cost?: number;
  profiles?: {
    username: string;
  } | null;
  isLiked?: boolean;
  hasCommented?: boolean;
  isSubscribed?: boolean;
  canView?: boolean;
  passwordVerified?: boolean;
  tokenUnlocked?: boolean;
}

const Posts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ isOpen: boolean; postId: string | null }>({ 
    isOpen: false, 
    postId: null 
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, [user]);

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Получаем профили пользователей
      const userIds = [...new Set(postsData?.map(post => post.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      // Получаем лайки, комментарии, подписки и токен-транзакции пользователя
      let userLikes: string[] = [];
      let userComments: string[] = [];
      let userSubscriptions: string[] = [];
      let unlockedPosts: string[] = [];
      if (user) {
        const [{ data: likesData }, { data: commentsData }, { data: subsData }, { data: transactionsData }] = await Promise.all([
          supabase.from('post_likes').select('post_id').eq('user_id', user.id),
          supabase.from('comments').select('post_id').eq('user_id', user.id),
          supabase.from('subscriptions').select('subscribed_to_id').eq('subscriber_id', user.id),
          supabase.from('token_transactions').select('post_id').eq('user_id', user.id).not('post_id', 'is', null)
        ]);
        userLikes = likesData?.map(like => like.post_id) || [];
        userComments = [...new Set(commentsData?.map(comment => comment.post_id) || [])];
        userSubscriptions = subsData?.map(sub => sub.subscribed_to_id) || [];
        unlockedPosts = transactionsData?.map(t => t.post_id).filter(Boolean) as string[] || [];
      }

      // Объединяем данные
      const postsWithData = postsData?.map(post => {
        const isLiked = userLikes.includes(post.id);
        const hasCommented = userComments.includes(post.id);
        const isSubscribed = userSubscriptions.includes(post.user_id);
        const isOwner = user?.id === post.user_id;
        const tokenUnlocked = unlockedPosts.includes(post.id);
        
        let canView = true;
        if (!isOwner && post.view_condition !== 'none') {
          if (post.view_condition === 'like' && !isLiked) {
            canView = false;
          } else if (post.view_condition === 'comment' && !hasCommented) {
            canView = false;
          } else if (post.view_condition === 'subscription' && !isSubscribed) {
            canView = false;
          }
        }

        return {
          ...post,
          profiles: profilesData?.find(p => p.id === post.user_id) || null,
          isLiked,
          hasCommented,
          isSubscribed,
          canView,
          passwordVerified: false,
          tokenUnlocked
        };
      });

      setPosts(postsWithData as any || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить посты",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите, чтобы ставить лайки",
        variant: "destructive"
      });
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      }

      setPosts(posts.map(p => 
        p.id === postId 
          ? { 
              ...p, 
              isLiked: !p.isLiked,
              likes_count: p.isLiked ? p.likes_count - 1 : p.likes_count + 1
            }
          : p
      ));
      
      fetchPosts(); // Обновляем для проверки условий просмотра
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить лайк",
        variant: "destructive"
      });
    }
  };

  const handlePasswordSubmit = (postId: string, password: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post || !post.password) return;

    if (password === post.password) {
      setPosts(posts.map(p => 
        p.id === postId ? { ...p, passwordVerified: true } : p
      ));
      setPasswordPrompt({ isOpen: false, postId: null });
      toast({
        title: "Успешно",
        description: "Пароль принят",
      });
    } else {
      toast({
        title: "Ошибка",
        description: "Неверный пароль",
        variant: "destructive"
      });
    }
  };

  const handleUnlockContent = async (postId: string) => {
    fetchPosts(); // Обновляем после разблокировки
  };

  const canViewContent = (post: Post): boolean => {
    const isOwner = user?.id === post.user_id;
    if (isOwner) return true;
    if (!post.canView) return false;
    if ((post.token_cost ?? 0) > 0 && !post.tokenUnlocked) return false;
    if (post.password && !post.passwordVerified) return false;
    return true;
  };

  const handleViewPost = (post: Post) => {
    if (post.password && !post.passwordVerified && user?.id !== post.user_id) {
      setPasswordPrompt({ isOpen: true, postId: post.id });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Загрузка постов...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Все посты</h1>
        <Button onClick={() => navigate('/create-post')} className="bg-primary hover:bg-primary/90">
          Создать пост
        </Button>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center mb-4">
              Пока нет постов. Будьте первым!
            </p>
            <Button onClick={() => navigate('/create-post')} className="bg-primary hover:bg-primary/90">
              Создать первый пост
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {posts.map((post) => {
            const isOwner = user?.id === post.user_id;
            const showContent = canViewContent(post);

            return (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-xl">{post.title}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{post.profiles?.username || 'Пользователь'}</span>
                        <Calendar className="w-4 h-4 ml-2" />
                        <span>
                          {formatDistanceToNow(new Date(post.created_at), {
                            addSuffix: true,
                            locale: ru
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.password && <Lock className="w-4 h-4 text-muted-foreground" />}
                      {(post.token_cost ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Coins className="w-4 h-4" />
                          <span>{post.token_cost}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showContent ? (
                    <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-muted/50 border-2 border-dashed border-border rounded-lg p-8 text-center">
                        <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground mb-4">
                          {!post.canView && post.view_condition === 'like' && 'Поставьте лайк, чтобы просмотреть контент'}
                          {!post.canView && post.view_condition === 'comment' && 'Оставьте комментарий, чтобы просмотреть контент'}
                          {!post.canView && post.view_condition === 'subscription' && 'Подпишитесь на автора, чтобы просмотреть контент'}
                          {post.canView && (post.token_cost ?? 0) > 0 && !post.tokenUnlocked && 'Разблокируйте контент токенами'}
                          {post.canView && post.password && !post.passwordVerified && 'Введите пароль для просмотра'}
                        </p>
                        {post.canView && (post.token_cost ?? 0) > 0 && !post.tokenUnlocked && (
                          <ContentUnlock
                            postId={post.id}
                            tokenCost={post.token_cost ?? 0}
                            onUnlocked={() => handleUnlockContent(post.id)}
                          />
                        )}
                        {post.canView && post.password && !post.passwordVerified && (
                          <Button onClick={() => handleViewPost(post)}>
                            Ввести пароль
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLike(post.id)}
                      className={post.isLiked ? 'text-primary' : ''}
                    >
                      <Flame className={`w-4 h-4 mr-1 ${post.isLiked ? 'fill-current' : ''}`} />
                      {post.likes_count}
                    </Button>
                    <Collapsible open={openComments === post.id} onOpenChange={(open) => setOpenComments(open ? post.id : null)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Комментарии
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        <Comments postId={post.id} />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={() => setPasswordPrompt({ isOpen: false, postId: null })}
        onSubmit={(password) => {
          if (passwordPrompt.postId) {
            handlePasswordSubmit(passwordPrompt.postId, password);
          }
        }}
      />
    </div>
  );
};

export default Posts;
