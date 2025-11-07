import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Eye, Plus } from 'lucide-react';
import { LiveStream } from '@/components/LiveStream';
import { LiveStreamViewer } from '@/components/LiveStreamViewer';

interface Stream {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  viewer_count: number;
  created_at: string;
  profiles?: {
    username: string;
  } | null;
}

const LiveStreams = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveStreamOpen, setIsLiveStreamOpen] = useState(false);
  const [viewingStreamId, setViewingStreamId] = useState<string | null>(null);

  useEffect(() => {
    fetchStreams();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('live_streams_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_streams',
        },
        () => {
          fetchStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStreams = async () => {
    try {
      const { data: streamsData, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for stream owners
      const userIds = [...new Set(streamsData?.map(s => s.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const streamsWithProfiles = streamsData?.map(stream => ({
        ...stream,
        profiles: profilesData?.find(p => p.id === stream.user_id) || null,
      }));

      setStreams(streamsWithProfiles as Stream[] || []);
    } catch (error) {
      console.error('Error fetching streams:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить трансляции',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Загрузка трансляций...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Radio className="w-8 h-8 text-red-500" />
          Прямые эфиры
        </h1>
        {user && (
          <Button
            onClick={() => setIsLiveStreamOpen(true)}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Начать эфир
          </Button>
        )}
      </div>

      <LiveStream
        isOpen={isLiveStreamOpen}
        onClose={() => {
          setIsLiveStreamOpen(false);
          fetchStreams();
        }}
        onStreamStart={(streamId) => {
          fetchStreams();
        }}
      />

      <LiveStreamViewer
        streamId={viewingStreamId}
        onClose={() => setViewingStreamId(null)}
      />

      {streams.length === 0 ? (
        <Card className="text-center p-8">
          <CardContent className="space-y-4 pt-6">
            <Radio className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">Нет активных трансляций</h3>
              <p className="text-muted-foreground">
                {user
                  ? 'Будьте первым, кто начнёт прямой эфир!'
                  : 'Сейчас нет активных трансляций'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map((stream) => (
            <Card
              key={stream.id}
              className="overflow-hidden border-red-200 hover:shadow-xl transition-all cursor-pointer hover:scale-105"
              onClick={() => setViewingStreamId(stream.id)}
            >
              <div className="aspect-video bg-gradient-to-br from-red-500 to-pink-500 relative flex items-center justify-center">
                <Radio className="w-20 h-20 text-white/30 animate-pulse" />
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-full text-sm font-bold shadow-lg">
                  <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                  <span>В ЭФИРЕ</span>
                </div>
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 text-white rounded-full text-sm backdrop-blur-sm">
                  <Eye className="w-4 h-4" />
                  <span className="font-semibold">{stream.viewer_count || 0}</span>
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-base line-clamp-2">{stream.title}</h3>
                {stream.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {stream.description}
                  </p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (stream.profiles?.username) {
                      navigate(`/profile/${stream.profiles.username}`);
                    }
                  }}
                  className="text-sm text-lavender hover:text-lavender-dark font-medium transition-colors"
                >
                  {stream.profiles?.username || 'Пользователь'}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveStreams;
