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
import { Upload, Image, X } from 'lucide-react';

interface MediaItem {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
}

const PhotoSection = () => {
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', description: '', files: [] as File[] });
  const [selectedPhoto, setSelectedPhoto] = useState<MediaItem | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('content_type', 'image')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить фотографии",
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

        // Save media info to database
        const { error: dbError } = await supabase
          .from('media')
          .insert({
            user_id: user.id,
            title: uploadData.title,
            description: uploadData.description,
            file_url: publicUrl,
            file_type: file.type,
            content_type: 'image',
            file_size: file.size
          });

        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);

      toast({
        title: "Успешно",
        description: `${uploadData.files.length} фотографий загружено успешно`,
      });

      setUploadData({ title: '', description: '', files: [] });
      fetchPhotos();
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить фотографии",
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

      {photos.length === 0 ? (
        <Card className="text-center p-8 border-lavender-light">
          <CardContent className="space-y-4">
            <Image className="w-16 h-16 mx-auto text-lavender" />
            <div>
              <h3 className="text-lg font-medium">Пока нет фотографий</h3>
              <p className="text-muted-foreground">
                {user ? 'Будьте первым, кто загрузит фото!' : 'Войдите в систему, чтобы загружать фото'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {photos.map((photo) => (
            <Card 
              key={photo.id} 
              className="overflow-hidden border-lavender-light hover:shadow-lg transition-shadow group cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={photo.file_url}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm mb-1 line-clamp-2">{photo.title}</h3>
                {photo.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{photo.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(photo.created_at).toLocaleDateString('ru-RU')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Photo Detail Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          {selectedPhoto && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPhoto.title}</DialogTitle>
                {selectedPhoto.description && (
                  <DialogDescription>{selectedPhoto.description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="flex justify-center items-center max-h-[70vh] overflow-hidden">
                <img
                  src={selectedPhoto.file_url}
                  alt={selectedPhoto.title}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Загружено: {new Date(selectedPhoto.created_at).toLocaleDateString('ru-RU')}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedPhoto.file_url, '_blank')}
                >
                  Открыть в новой вкладке
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoSection;