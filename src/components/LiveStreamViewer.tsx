import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye } from 'lucide-react';

interface LiveStreamViewerProps {
  streamId: string | null;
  onClose: () => void;
}

export const LiveStreamViewer = ({ streamId, onClose }: LiveStreamViewerProps) => {
  const { toast } = useToast();
  const [streamData, setStreamData] = useState<any>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!streamId) return;

    loadStreamData();
    incrementViewerCount();

    return () => {
      decrementViewerCount();
    };
  }, [streamId]);

  const loadStreamData = async () => {
    if (!streamId) return;

    try {
      const { data, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('id', streamId)
        .single();

      if (error) throw error;
      setStreamData(data);
      setViewerCount(data.viewer_count || 0);
    } catch (error) {
      console.error('Error loading stream:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить трансляцию',
        variant: 'destructive',
      });
    }
  };

  const incrementViewerCount = async () => {
    if (!streamId) return;

    try {
      const { data } = await supabase
        .from('live_streams')
        .select('viewer_count')
        .eq('id', streamId)
        .single();

      if (data) {
        await supabase
          .from('live_streams')
          .update({ viewer_count: (data.viewer_count || 0) + 1 })
          .eq('id', streamId);
      }
    } catch (error) {
      console.error('Error incrementing viewer count:', error);
    }
  };

  const decrementViewerCount = async () => {
    if (!streamId) return;

    try {
      const { data } = await supabase
        .from('live_streams')
        .select('viewer_count')
        .eq('id', streamId)
        .single();

      if (data && data.viewer_count > 0) {
        await supabase
          .from('live_streams')
          .update({ viewer_count: data.viewer_count - 1 })
          .eq('id', streamId);
      }
    } catch (error) {
      console.error('Error decrementing viewer count:', error);
    }
  };

  return (
    <Dialog open={!!streamId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{streamData?.title || 'Прямой эфир'}</span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <Eye className="h-4 w-4" />
              <span>{viewerCount}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-semibold">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span>В ЭФИРЕ</span>
            </div>
          </div>

          {streamData?.description && (
            <div className="text-sm text-muted-foreground">
              {streamData.description}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
