import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  user_id: string;
  username: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

const Messages = () => {
  const location = useLocation();
  const { selectedUserId, selectedUsername } = (location.state as any) || {};
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(selectedUserId || null);
  const [activeUsername, setActiveUsername] = useState<string>(selectedUsername || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
      markAsRead(activeConversation);
      
      // Subscribe to new messages
      const channel = supabase
        .channel('messages-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user?.id}`
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (newMsg.sender_id === activeConversation) {
              setMessages(prev => [...prev, newMsg]);
              markAsRead(activeConversation);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeConversation, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Get all messages where user is sender or receiver
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Group by conversation partner
      const conversationMap = new Map<string, Conversation>();

      for (const msg of messagesData || []) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          // Get partner's username
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', partnerId)
            .single();

          // Count unread messages
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', partnerId)
            .eq('receiver_id', user.id)
            .eq('is_read', false);

          conversationMap.set(partnerId, {
            user_id: partnerId,
            username: profileData?.username || 'Пользователь',
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: count || 0
          });
        }
      }

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить беседы',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (partnerId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить сообщения',
        variant: 'destructive'
      });
    }
  };

  const markAsRead = async (partnerId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeConversation || !newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: activeConversation,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
      fetchMessages(activeConversation);
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение',
        variant: 'destructive'
      });
    }
  };

  const selectConversation = (userId: string, username: string) => {
    setActiveConversation(userId);
    setActiveUsername(username);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Войдите в систему, чтобы отправлять сообщения
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Загрузка...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {/* Conversations List */}
      <Card className={`${activeConversation ? 'hidden md:block' : ''}`}>
        <CardHeader>
          <CardTitle>Сообщения</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>Нет сообщений</p>
                <Button
                  variant="link"
                  onClick={() => navigate('/search')}
                  className="mt-2"
                >
                  Найти пользователей
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.user_id}
                    onClick={() => selectConversation(conv.user_id, conv.username)}
                    className={`w-full p-4 text-left hover:bg-muted transition-colors ${
                      activeConversation === conv.user_id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{conv.username}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.last_message}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(conv.last_message_time).toLocaleDateString('ru-RU')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Messages */}
      {activeConversation ? (
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center space-y-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-2"
              onClick={() => setActiveConversation(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{activeUsername}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[440px] p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_id === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.sender_id === user.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="break-words">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender_id === user.id
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="hidden md:flex md:col-span-2 items-center justify-center">
          <CardContent>
            <p className="text-center text-muted-foreground">
              Выберите беседу или <br />
              <Button
                variant="link"
                onClick={() => navigate('/search')}
                className="p-0 h-auto"
              >
                найдите пользователя
              </Button>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Messages;
