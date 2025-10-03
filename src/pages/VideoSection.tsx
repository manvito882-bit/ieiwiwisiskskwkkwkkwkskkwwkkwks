import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Play, Radio, Eye, Trash2, User, MessageSquare, Flame, Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LiveStream } from '@/components/LiveStream';
import { LiveStreamViewer } from '@/components/LiveStreamViewer';
import { useNavigate } from 'react-router-dom';
import Comments from '@/components/Comments';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface MediaItem {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
  user_id: string;
  post_id?: string | null;
  likes_count?: number;
  isLiked?: boolean;
  view_condition?: 'none' | 'like' | 'comment' | 'subscription';
  hasCommented?: boolean;
  isSubscribed?: boolean;
  canView?: boolean;
  profiles?: {
    username: string;
  } | null;
}

const VideoSection = () => {
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ 
    title: '', 
    description: '', 
    file: null as File | null,
    viewCondition: 'none' as 'none' | 'like' | 'comment' | 'subscription'
  });
  const [isLiveStreamOpen, setIsLiveStreamOpen] = useState(false);
  const [viewingStreamId, setViewingStreamId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const toggleLike = async (video: MediaItem) => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите, чтобы ставить лайки",
        variant: "destructive"
      });
      return;
    }

    if (!video.post_id) return;

    try {
      if (video.isLiked) {
        // Удаляем лайк
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', video.post_id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Добавляем лайк
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: video.post_id, user_id: user.id });

        if (error) throw error;
      }

      // Обновляем локальное состояние
      setVideos(videos.map(v => 
        v.id === video.id 
          ? { 
              ...v, 
              isLiked: !v.isLiked,
              likes_count: (v.likes_count || 0) + (v.isLiked ? -1 : 1)
            }
          : v
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить лайк",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchLiveStreams();
  }, [user]);

  const fetchVideos = async () => {
    try {
      const { data: videosData, error } = await supabase
        .from('media')
        .select('*')
        .eq('content_type', 'video')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Получаем профили и посты для видео
      const userIds = [...new Set(videosData?.map(v => v.user_id) || [])];
      const postIds = videosData?.filter(v => v.post_id).map(v => v.post_id) || [];

      const [{ data: profilesData }, { data: postsData }] = await Promise.all([
        supabase.from('profiles').select('user_id, username').in('user_id', userIds),
        postIds.length > 0 
          ? supabase.from('posts').select('id, likes_count, view_condition').in('id', postIds)
          : Promise.resolve({ data: [] })
      ]);

      // Получаем лайки, комментарии и подписки пользователя если он авторизован
      let userLikes: string[] = [];
      let userComments: string[] = [];
      let userSubscriptions: string[] = [];
      if (user) {
        const promises = [
          postIds.length > 0 
            ? supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
            : Promise.resolve({ data: [] }),
          postIds.length > 0
            ? supabase.from('comments').select('post_id').eq('user_id', user.id).in('post_id', postIds)
            : Promise.resolve({ data: [] }),
          supabase.from('subscriptions').select('subscribed_to_id').eq('subscriber_id', user.id)
        ];
        const [{ data: likesData }, { data: commentsData }, { data: subsData }] = await Promise.all(promises);
        userLikes = likesData?.map(like => like.post_id) || [];
        userComments = [...new Set(commentsData?.map(comment => comment.post_id) || [])];
        userSubscriptions = subsData?.map(sub => sub.subscribed_to_id) || [];
      }

      // Объединяем данные
      const videosWithData = videosData?.map(video => {
        const post = postsData?.find(p => p.id === video.post_id);
        const isLiked = video.post_id ? userLikes.includes(video.post_id) : false;
        const hasCommented = video.post_id ? userComments.includes(video.post_id) : false;
        const isSubscribed = userSubscriptions.includes(video.user_id);
        const isOwner = user?.id === video.user_id;
        
        // Определяем можно ли просматривать контент
        let canView = true;
        if (!isOwner && post?.view_condition && post.view_condition !== 'none') {
          if (post.view_condition === 'like' && !isLiked) {
            canView = false;
          } else if (post.view_condition === 'comment' && !hasCommented) {
            canView = false;
          } else if (post.view_condition === 'subscription' && !isSubscribed) {
            canView = false;
          }
        }
        
        return {
          ...video,
          profiles: profilesData?.find(p => p.user_id === video.user_id) || null,
          likes_count: post?.likes_count || 0,
          view_condition: post?.view_condition || 'none',
          isLiked,
          hasCommented,
          isSubscribed,
          canView
        };
      });

      setVideos(videosWithData as any || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить видео",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId: string, filePath: string) => {
    try {
      // Удаляем файл из storage
      const path = filePath.split('/media-videos/')[1];
      if (path) {
        await supabase.storage.from('media-videos').remove([path]);
      }

      // Удаляем запись из базы данных
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Видео удалено",
      });

      fetchVideos();
    } catch (error) {
      console.error('Error deleting video:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить видео",
        variant: "destructive"
      });
    }
  };

  const fetchLiveStreams = async () => {
    try {
      const { data, error } = await supabase
        .from('live_streams')
        .select('*, profiles(username)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLiveStreams(data || []);
    } catch (error) {
      console.error('Error fetching live streams:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file || !user) return;

    setUploading(true);
    try {
      // Создаем пост для видео
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          title: uploadData.title,
          content: uploadData.description,
          category: 'media',
          view_condition: uploadData.viewCondition
        })
        .select()
        .single();

      if (postError) throw postError;

      // Загружаем файл в Supabase Storage
      const fileExt = uploadData.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media-videos')
        .upload(filePath, uploadData.file);

      if (uploadError) throw uploadError;

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('media-videos')
        .getPublicUrl(filePath);

      // Сохраняем информацию о медиа в базу данных
      const { error: dbError } = await supabase
        .from('media')
        .insert({
          user_id: user.id,
          title: uploadData.title,
          description: uploadData.description,
          file_url: publicUrl,
          file_type: uploadData.file.type,
          content_type: 'video',
          file_size: uploadData.file.size,
          post_id: postData.id
        });

      if (dbError) throw dbError;

      toast({
        title: "Успешно",
        description: "Видео загружено успешно",
      });

      setUploadData({ title: '', description: '', file: null, viewCondition: 'none' });
      fetchVideos();
    } catch (error) {
      console.error('Error uploading video:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить видео",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Загрузка видео...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Видео-контент</h1>
        {user && (
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsLiveStreamOpen(true)}
              className="bg-red-500 hover:bg-red-600"
            >
              <Radio className="w-4 h-4 mr-2" />
              Начать эфир
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-lavender hover:bg-lavender-dark">
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить видео
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Загрузить новое видео</DialogTitle>
                <DialogDescription>
                  Добавьте название, описание и выберите видео файл для загрузки
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="video-title">Название видео</Label>
                  <Input
                    id="video-title"
                    type="text"
                    value={uploadData.title}
                    onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                    required
                    className="border-lavender-light focus:ring-lavender"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-description">Описание</Label>
                  <Textarea
                    id="video-description"
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    className="border-lavender-light focus:ring-lavender"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="view-condition">Условие просмотра</Label>
                  <Select
                    value={uploadData.viewCondition}
                    onValueChange={(value: 'none' | 'like' | 'comment' | 'subscription') => 
                      setUploadData({ ...uploadData, viewCondition: value })
                    }
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
                    Выберите условие для доступа к вашим видео
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-file">Видео файл</Label>
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/*"
                    onChange={(e) => setUploadData({ ...uploadData, file: e.target.files?.[0] || null })}
                    required
                    className="border-lavender-light"
                  />
                </div>
                <Button type="submit" disabled={uploading} className="w-full bg-lavender hover:bg-lavender-dark">
                  {uploading ? 'Загрузка...' : 'Загрузить видео'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <LiveStream 
        isOpen={isLiveStreamOpen}
        onClose={() => {
          setIsLiveStreamOpen(false);
          fetchLiveStreams();
        }}
        onStreamStart={(streamId) => {
          fetchLiveStreams();
        }}
      />

      <LiveStreamViewer 
        streamId={viewingStreamId}
        onClose={() => setViewingStreamId(null)}
      />

      {liveStreams.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            Прямые эфиры
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveStreams.map((stream) => (
              <Card 
                key={stream.id} 
                className="overflow-hidden border-red-200 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setViewingStreamId(stream.id)}
              >
                <div className="aspect-video bg-gradient-to-br from-red-500 to-pink-500 relative flex items-center justify-center">
                  <Radio className="w-16 h-16 text-white/50" />
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-semibold">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span>В ЭФИРЕ</span>
                  </div>
                  <div className="absolute bottom-4 right-4 flex items-center gap-1 px-2 py-1 bg-black/50 text-white rounded text-sm">
                    <Eye className="w-3 h-3" />
                    <span>{stream.viewer_count || 0}</span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium text-sm mb-1 line-clamp-2">{stream.title}</h3>
                  {stream.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{stream.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {stream.profiles?.username || 'Пользователь'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <Card className="text-center p-8 border-lavender-light">
          <CardContent className="space-y-4">
            <Play className="w-16 h-16 mx-auto text-lavender" />
            <div>
              <h3 className="text-lg font-medium">Пока нет видео</h3>
              <p className="text-muted-foreground">
                {user ? 'Будьте первым, кто загрузит видео!' : 'Войдите в систему, чтобы загружать видео'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden border-lavender-light hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-gray-100 relative">
                {video.canView ? (
                  <video
                    src={video.file_url}
                    controls
                    className="w-full h-full object-cover"
                    preload="metadata"
                  >
                    Ваш браузер не поддерживает воспроизведение видео.
                  </video>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                    <Lock className="w-16 h-16 mb-4 text-muted-foreground" />
                    <p className="text-center font-semibold px-4">
                      {video.view_condition === 'like' && 'Поставьте лайк 🔥 чтобы просмотреть видео'}
                      {video.view_condition === 'comment' && 'Оставьте комментарий 💬 чтобы просмотреть видео'}
                      {video.view_condition === 'subscription' && 'Подпишитесь 👤 чтобы просмотреть видео'}
                    </p>
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <User className="w-4 h-4 text-lavender flex-shrink-0" />
                    <button
                      onClick={() => video.profiles?.username && navigate(`/profile/${video.profiles.username}`)}
                      className="font-medium text-sm hover:text-lavender transition-colors truncate"
                    >
                      {video.profiles?.username || 'Пользователь'}
                    </button>
                  </div>
                  {user?.id === video.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => handleDelete(video.id, video.file_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <h3 className="font-medium text-sm line-clamp-2">{video.title}</h3>
                {video.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{video.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(video.created_at).toLocaleDateString('ru-RU')}
                </p>
                
                {video.post_id && (
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLike(video)}
                      className={video.isLiked ? "text-orange-500 hover:text-orange-600" : ""}
                    >
                      <Flame className={`w-5 h-5 mr-1 ${video.isLiked ? 'fill-current' : ''}`} />
                      {video.likes_count || 0}
                    </Button>
                  </div>
                )}
                
                {video.post_id && (
                  <Collapsible
                    open={openComments === video.id}
                    onOpenChange={(open) => setOpenComments(open ? video.id : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Комментарии
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <Comments postId={video.post_id} />
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoSection;