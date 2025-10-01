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
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Upload, Image, X, ZoomIn, User, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Comments from '@/components/Comments';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface MediaItem {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
  content_type: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
  media: MediaItem[];
  profiles?: {
    username: string;
  } | null;
}

const PhotoSection = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', description: '', files: [] as File[] });
  const [selectedMedia, setSelectedMedia] = useState<{ media: MediaItem[], currentIndex: number } | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey:user_id(username),
          media (
            id,
            title,
            description,
            file_url,
            created_at,
            content_type
          )
        `)
        .eq('category', 'media')
        .eq('media.content_type', 'image')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data as any || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить фото-посты",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.files.length || !user) return;

    setUploading(true);
    try {
      // First create a post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          title: uploadData.title,
          content: uploadData.description,
          category: 'media'
        })
        .select()
        .single();

      if (postError) throw postError;

      // Upload each file and create media records
      const uploadPromises = uploadData.files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('media-images')
          .getPublicUrl(filePath);

        // Save media info to database with post_id
        const { error: dbError } = await supabase
          .from('media')
          .insert({
            user_id: user.id,
            title: uploadData.title,
            description: uploadData.description,
            file_url: publicUrl,
            file_type: file.type,
            content_type: 'image',
            file_size: file.size,
            post_id: postData.id
          });

        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);

      toast({
        title: "Успешно",
        description: `Пост с ${uploadData.files.length} фотографиями создан успешно`,
      });

      setUploadData({ title: '', description: '', files: [] });
      fetchPosts();
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать пост с фотографиями",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Загрузка фотографий...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Фото-контент</h1>
        {user && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-lavender hover:bg-lavender-dark">
                <Upload className="w-4 h-4 mr-2" />
                Загрузить фото
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Загрузить новое фото</DialogTitle>
                <DialogDescription>
                  Добавьте название, описание и выберите изображение для загрузки
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="photo-title">Название фото</Label>
                  <Input
                    id="photo-title"
                    type="text"
                    value={uploadData.title}
                    onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                    required
                    className="border-lavender-light focus:ring-lavender"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photo-description">Описание</Label>
                  <Textarea
                    id="photo-description"
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    className="border-lavender-light focus:ring-lavender"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photo-file">Изображения (до 10 файлов)</Label>
                  <Input
                    id="photo-file"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).slice(0, 10);
                      setUploadData({ ...uploadData, files });
                    }}
                    required
                    className="border-lavender-light"
                  />
                  {uploadData.files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Выбрано файлов: {uploadData.files.length}/10
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {uploadData.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newFiles = uploadData.files.filter((_, i) => i !== index);
                                setUploadData({ ...uploadData, files: newFiles });
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={uploading} className="w-full bg-lavender hover:bg-lavender-dark">
                  {uploading ? 'Загрузка...' : 'Загрузить фото'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {posts.length === 0 ? (
        <Card className="text-center p-8 border-lavender-light">
          <CardContent className="space-y-4">
            <Image className="w-16 h-16 mx-auto text-lavender" />
            <div>
              <h3 className="text-lg font-medium">Пока нет фото-постов</h3>
              <p className="text-muted-foreground">
                {user ? 'Будьте первым, кто создаст фото-пост!' : 'Войдите в систему, чтобы создавать фото-посты'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden border-lavender-light hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-gray-100 overflow-hidden relative">
                {post.media.length > 1 ? (
                  <Carousel className="w-full h-full">
                    <CarouselContent>
                      {post.media.map((media, index) => (
                        <CarouselItem key={media.id}>
                          <img
                            src={media.file_url}
                            alt={media.title}
                            className="w-full h-full object-cover cursor-pointer"
                            loading="lazy"
                            onClick={() => setSelectedMedia({ media: post.media, currentIndex: index })}
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </Carousel>
                ) : post.media.length === 1 ? (
                  <img
                    src={post.media[0].file_url}
                    alt={post.media[0].title}
                    className="w-full h-full object-cover cursor-pointer"
                    loading="lazy"
                    onClick={() => setSelectedMedia({ media: post.media, currentIndex: 0 })}
                  />
                ) : null}
                
                {post.media.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    {post.media.length} фото
                  </div>
                )}
                
                <Button
                  size="sm"
                  className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setSelectedMedia({ media: post.media, currentIndex: 0 })}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-lavender" />
                  <button
                    onClick={() => post.profiles?.username && navigate(`/profile/${post.profiles.username}`)}
                    className="font-medium hover:text-lavender transition-colors"
                  >
                    {post.profiles?.username || 'Пользователь'}
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                
                <h3 className="font-medium text-lg line-clamp-2">{post.title}</h3>
                {post.content && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{post.content}</p>
                )}
                
                <Collapsible
                  open={openComments === post.id}
                  onOpenChange={(open) => setOpenComments(open ? post.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Комментарии
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <Comments postId={post.id} />
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Media Detail Modal with Carousel */}
      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
          {selectedMedia && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedMedia.media.length > 1 
                    ? `Фото ${selectedMedia.currentIndex + 1} из ${selectedMedia.media.length}`
                    : selectedMedia.media[selectedMedia.currentIndex]?.title || 'Фото'
                  }
                </DialogTitle>
                {selectedMedia.media[selectedMedia.currentIndex]?.description && (
                  <DialogDescription>
                    {selectedMedia.media[selectedMedia.currentIndex].description}
                  </DialogDescription>
                )}
              </DialogHeader>
              
              {selectedMedia.media.length > 1 ? (
                <Carousel className="w-full max-h-[75vh]">
                  <CarouselContent>
                    {selectedMedia.media.map((media, index) => (
                      <CarouselItem key={media.id}>
                        <div className="flex justify-center items-center h-[75vh] overflow-hidden">
                          <img
                            src={media.file_url}
                            alt={media.title}
                            className="max-w-full max-h-full object-contain cursor-zoom-in"
                            onClick={() => window.open(media.file_url, '_blank')}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-4" />
                  <CarouselNext className="right-4" />
                </Carousel>
              ) : (
                <div className="flex justify-center items-center max-h-[75vh] overflow-hidden">
                  <img
                    src={selectedMedia.media[0].file_url}
                    alt={selectedMedia.media[0].title}
                    className="max-w-full max-h-full object-contain cursor-zoom-in"
                    onClick={() => window.open(selectedMedia.media[0].file_url, '_blank')}
                  />
                </div>
              )}
              
              <div className="flex justify-between items-center text-sm text-muted-foreground mt-4">
                <span>
                  Загружено: {new Date(selectedMedia.media[selectedMedia.currentIndex].created_at).toLocaleDateString('ru-RU')}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(selectedMedia.media[selectedMedia.currentIndex].file_url, '_blank')}
                  >
                    <ZoomIn className="w-4 h-4 mr-2" />
                    Увеличить
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoSection;