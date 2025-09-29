import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Video, VideoOff, Mic, MicOff } from 'lucide-react';

interface LiveStreamProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamStart: (streamId: string) => void;
}

export const LiveStream = ({ isOpen, onClose, onStreamStart }: LiveStreamProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      startPreview();
    } else {
      stopPreview();
    }
    return () => stopPreview();
  }, [isOpen]);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить доступ к камере и микрофону',
        variant: 'destructive',
      });
    }
  };

  const stopPreview = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const startStream = async () => {
    if (!title.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название трансляции',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('live_streams')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      streamIdRef.current = data.id;
      setIsStreaming(true);
      onStreamStart(data.id);

      toast({
        title: 'Успешно',
        description: 'Прямой эфир начался!',
      });
    } catch (error) {
      console.error('Error starting stream:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось начать трансляцию',
        variant: 'destructive',
      });
    }
  };

  const endStream = async () => {
    if (!streamIdRef.current) return;

    try {
      const { error } = await supabase
        .from('live_streams')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', streamIdRef.current);

      if (error) throw error;

      stopPreview();
      setIsStreaming(false);
      streamIdRef.current = null;
      onClose();

      toast({
        title: 'Успешно',
        description: 'Трансляция завершена',
      });
    } catch (error) {
      console.error('Error ending stream:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось завершить трансляцию',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Прямой эфир</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                size="icon"
                variant={isCameraOn ? "default" : "destructive"}
                onClick={toggleCamera}
              >
                {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant={isMicOn ? "default" : "destructive"}
                onClick={toggleMic}
              >
                {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {!isStreaming ? (
            <>
              <Input
                placeholder="Название трансляции"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Описание (необязательно)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <Button onClick={startStream} className="w-full">
                Начать трансляцию
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 p-2 bg-red-500 text-white rounded">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="font-semibold">В ЭФИРЕ</span>
              </div>
              <Button onClick={endStream} variant="destructive" className="w-full">
                Завершить трансляцию
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
