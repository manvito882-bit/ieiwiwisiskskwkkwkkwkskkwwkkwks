import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import Comments from '@/components/Comments';

interface MediaItem {
  id: string;
  title: string;
  description: string;
  file_url: string;
  content_type: string;
  user_id?: string;
  post_id?: string;
}

interface MediaViewerProps {
  media: MediaItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export const MediaViewer = ({ media, currentIndex, isOpen, onClose }: MediaViewerProps) => {
  const [index, setIndex] = useState(currentIndex);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const currentMedia = media[index];
  const isImage = currentMedia?.content_type === 'image';
  const canGoPrev = index > 0;
  const canGoNext = index < media.length - 1;

  useEffect(() => {
    if (currentMedia?.user_id) {
      loadProfile();
      loadLikeStatus();
      loadSubscriptionStatus();
    }
  }, [currentMedia?.user_id, currentMedia?.post_id]);

  const loadProfile = async () => {
    if (!currentMedia?.user_id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', currentMedia.user_id)
        .single();
      
      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadLikeStatus = async () => {
    if (!currentMedia?.post_id || !user) return;
    
    try {
      const { data: likes } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', currentMedia.post_id);
      
      setLikesCount(likes?.length || 0);
      
      const { data: userLike } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', currentMedia.post_id)
        .eq('user_id', user.id)
        .single();
      
      setIsLiked(!!userLike);
    } catch (error) {
      console.error('Error loading like status:', error);
    }
  };

  const loadSubscriptionStatus = async () => {
    if (!currentMedia?.user_id || !user) return;
    
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('subscriber_id', user.id)
        .eq('subscribed_to_id', currentMedia.user_id)
        .single();
      
      setIsSubscribed(!!data);
    } catch (error) {
      // Not subscribed
    }
  };

  const toggleLike = async () => {
    if (!user || !currentMedia?.post_id) {
      toast({
        title: 'Ошибка',
        description: 'Войдите, чтобы ставить лайки',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', currentMedia.post_id)
          .eq('user_id', user.id);
        
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        await supabase
          .from('post_likes')
          .insert({
            post_id: currentMedia.post_id,
            user_id: user.id,
          });
        
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось поставить лайк',
        variant: 'destructive',
      });
    }
  };

  const toggleSubscription = async () => {
    if (!user || !currentMedia?.user_id) {
      toast({
        title: 'Ошибка',
        description: 'Войдите, чтобы подписаться',
        variant: 'destructive',
      });
      return;
    }

    if (user.id === currentMedia.user_id) {
      toast({
        title: 'Ошибка',
        description: 'Вы не можете подписаться на себя',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isSubscribed) {
        await supabase
          .from('subscriptions')
          .delete()
          .eq('subscriber_id', user.id)
          .eq('subscribed_to_id', currentMedia.user_id);
        
        setIsSubscribed(false);
        toast({
          title: 'Успешно',
          description: 'Вы отписались',
        });
      } else {
        await supabase
          .from('subscriptions')
          .insert({
            subscriber_id: user.id,
            subscribed_to_id: currentMedia.user_id,
          });
        
        setIsSubscribed(true);
        toast({
          title: 'Успешно',
          description: 'Вы подписались',
        });
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось подписаться',
        variant: 'destructive',
      });
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      setIndex(index - 1);
      setShowComments(false);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setIndex(index + 1);
      setShowComments(false);
    }
  };

  if (!currentMedia) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0">
        <div className="relative w-full h-full flex bg-background">
          {/* Media Section */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              {profile && (
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/profile/${profile.username}`)}
                >
                  <Avatar>
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{profile.username}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {profile && user && user.id !== currentMedia.user_id && (
                  <Button
                    variant={isSubscribed ? "secondary" : "default"}
                    size="sm"
                    onClick={toggleSubscription}
                  >
                    {isSubscribed ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Отписаться
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Подписаться
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>

            {/* Media Content */}
            <div className="flex-1 flex items-center justify-center bg-black">
              {isImage ? (
                <img
                  src={currentMedia.file_url}
                  alt={currentMedia.title}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <video
                  src={currentMedia.file_url}
                  controls
                  className="max-w-full max-h-full"
                  autoPlay
                />
              )}
            </div>

            {/* Navigation */}
            {media.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrev}
                  disabled={!canGoPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/95 disabled:opacity-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  disabled={!canGoNext}
                  className="absolute right-96 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/95 disabled:opacity-0"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </>
            )}

            {/* Counter */}
            {media.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 px-4 py-2 rounded-full text-sm">
                {index + 1} / {media.length}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-96 border-l border-border flex flex-col bg-background">
            {/* Actions */}
            <div className="p-4 border-b border-border flex gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLike}
                className="flex-1"
              >
                <Heart className={`w-5 h-5 mr-2 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                {likesCount}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="flex-1"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Комментарии
              </Button>
            </div>

            {/* Description */}
            <div className="p-4 border-b border-border">
              <h3 className="font-bold text-lg mb-2">{currentMedia.title}</h3>
              {currentMedia.description && (
                <p className="text-sm text-muted-foreground">{currentMedia.description}</p>
              )}
            </div>

            {/* Comments Section */}
            {showComments && currentMedia.post_id && (
              <div className="flex-1 overflow-y-auto">
                <Comments postId={currentMedia.post_id} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
