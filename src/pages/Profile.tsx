import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Video, Image as ImageIcon, ArrowLeft, UserPlus, UserMinus, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  user_id: string;
  username: string;
  created_at: string;
  subscribers_count: number;
}

interface MediaItem {
  id: string;
  title: string;
  file_url: string;
  content_type: string;
  created_at: string;
  file_type: string;
}

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Check if current user is subscribed
        if (user && user.id !== profileData.user_id) {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('subscriber_id', user.id)
            .eq('subscribed_to_id', profileData.user_id)
            .single();
          
          setIsSubscribed(!!subData);
        }

        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('user_id', profileData.user_id)
          .order('created_at', { ascending: false });

        if (mediaError) throw mediaError;
        setMedia(mediaData || []);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username, user]);

  const toggleSubscription = async () => {
    if (!user || !profile) {
      toast({
        title: 'Ошибка',
        description: 'Войдите в систему',
        variant: 'destructive'
      });
      return;
    }

    setSubscribing(true);
    try {
      if (isSubscribed) {
        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('subscriber_id', user.id)
          .eq('subscribed_to_id', profile.user_id);

        if (error) throw error;
        
        setIsSubscribed(false);
        setProfile(prev => prev ? { ...prev, subscribers_count: prev.subscribers_count - 1 } : null);
        toast({
          title: 'Успешно',
          description: 'Вы отписались'
        });
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            subscriber_id: user.id,
            subscribed_to_id: profile.user_id
          });

        if (error) throw error;

        setIsSubscribed(true);
        setProfile(prev => prev ? { ...prev, subscribers_count: prev.subscribers_count + 1 } : null);
        toast({
          title: 'Успешно',
          description: 'Вы подписались'
        });
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить подписку',
        variant: 'destructive'
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleMessage = () => {
    if (!user) {
      toast({
        title: 'Ошибка',
        description: 'Войдите в систему',
        variant: 'destructive'
      });
      return;
    }
    navigate('/messages', { 
      state: { 
        selectedUserId: profile?.user_id, 
        selectedUsername: profile?.username 
      } 
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Профиль не найден</h2>
        <Button onClick={() => navigate('/')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          На главную
        </Button>
      </div>
    );
  }

  const videos = media.filter(m => m.content_type === 'video');
  const photos = media.filter(m => m.content_type === 'image');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Button onClick={() => navigate(-1)} variant="ghost" className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-lavender-light rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-lavender" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{profile.username}</h1>
                <p className="text-muted-foreground">
                  На платформе {formatDistanceToNow(new Date(profile.created_at), {
                    addSuffix: true,
                    locale: ru
                  })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Подписчиков: {profile.subscribers_count}
                </p>
              </div>
            </div>
            {user && user.id !== profile.user_id && (
              <div className="flex gap-2">
                <Button
                  variant={isSubscribed ? "outline" : "default"}
                  onClick={toggleSubscription}
                  disabled={subscribing}
                >
                  {isSubscribed ? (
                    <>
                      <UserMinus className="w-4 h-4 mr-2" />
                      Отписаться
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Подписаться
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleMessage}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Сообщение
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <Badge variant="outline" className="border-lavender">
              <Video className="w-4 h-4 mr-2" />
              {videos.length} видео
            </Badge>
            <Badge variant="outline" className="border-lavender">
              <ImageIcon className="w-4 h-4 mr-2" />
              {photos.length} фото
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Контент пользователя</h2>
        {media.length === 0 ? (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">
              Пользователь еще не загружал контент
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {media.map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-muted relative">
                  {item.content_type === 'video' ? (
                    <video
                      src={item.file_url}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img
                      src={item.file_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold truncate">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), {
                      addSuffix: true,
                      locale: ru
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;