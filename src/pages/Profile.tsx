import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Video, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Profile {
  user_id: string;
  username: string;
  created_at: string;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [username]);

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
            </div>
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