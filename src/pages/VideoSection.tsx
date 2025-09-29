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
import { Upload, Play, Radio, Eye, Trash2 } from 'lucide-react';
import { LiveStream } from '@/components/LiveStream';
import { LiveStreamViewer } from '@/components/LiveStreamViewer';

interface MediaItem {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
  user_id: string;
  profiles?: {
    username: string;
  };
}

const VideoSection = () => {
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', description: '', file: null as File | null });
  const [isLiveStreamOpen, setIsLiveStreamOpen] = useState(false);
  const [viewingStreamId, setViewingStreamId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchVideos();
    fetchLiveStreams();
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*, profiles(username)')
        .eq('content_type', 'video')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
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
          file_size: uploadData.file.size
        });

      if (dbError) throw dbError;

      toast({
        title: "Успешно",
        description: "Видео загружено успешно",
      });

      setUploadData({ title: '', description: '', file: null });
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
              <div className="aspect-video bg-gray-100">
                <video
                  src={video.file_url}
                  controls
                  className="w-full h-full object-cover"
                  preload="metadata"
                >
                  Ваш браузер не поддерживает воспроизведение видео.
                </video>
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-sm line-clamp-2 flex-1">{video.title}</h3>
                  {user?.id === video.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(video.id, video.file_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {video.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{video.description}</p>
                )}
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{(video as any).profiles?.username || 'Пользователь'}</span>
                  <span>{new Date(video.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoSection;