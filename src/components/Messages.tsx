import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ArrowLeft, Image as ImageIcon, X, User, Search, Trash2, CircleDot } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  image_url?: string | null;
  deleted_by_sender?: boolean;
  deleted_by_receiver?: boolean;
}

interface Conversation {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  is_online?: boolean;
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
  const [activeUserAvatar, setActiveUserAvatar] = useState<string>('');
  const [activeUserOnline, setActiveUserOnline] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Update online status
  useEffect(() => {
    if (!user) return;
    
    const updateOnlineStatus = async (isOnline: boolean) => {
      await supabase
        .from('profiles')
        .update({ 
          is_online: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);
    };

    updateOnlineStatus(true);

    const handleBeforeUnload = () => {
      updateOnlineStatus(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      updateOnlineStatus(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
      markAsRead(activeConversation);
      fetchActiveUserInfo(activeConversation);
      
      // Subscribe to new messages
      const messagesChannel = supabase
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
            fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
          },
          () => {
            if (activeConversation) {
              fetchMessages(activeConversation);
            }
          }
        )
        .subscribe();

      // Subscribe to typing indicator
      const typingChannel = supabase.channel(`typing:${activeConversation}`)
        .on('presence', { event: 'sync' }, () => {
          const state = typingChannel.presenceState();
          const otherUsersTyping = Object.values(state).some(
            (presences: any) => presences.some((p: any) => p.user_id === activeConversation && p.typing)
          );
          setIsTyping(otherUsersTyping);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await typingChannel.track({ user_id: user?.id, typing: false });
          }
        });

      // Subscribe to online status
      const profileChannel = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${activeConversation}`
          },
          (payload) => {
            const profile = payload.new as any;
            setActiveUserOnline(profile.is_online || false);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(typingChannel);
        supabase.removeChannel(profileChannel);
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

  const fetchActiveUserInfo = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, is_online')
      .eq('id', userId)
      .single();
    
    if (data) {
      setActiveUsername(data.username);
      setActiveUserAvatar(data.avatar_url || '');
      setActiveUserOnline(data.is_online || false);
    }
  };

  const fetchConversations = async () => {
    if (!user) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at, read, deleted_by_sender, deleted_by_receiver')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      const conversationMap = new Map<string, Conversation>();

      for (const msg of messagesData || []) {
        const isSender = msg.sender_id === user.id;
        const isDeleted = isSender ? msg.deleted_by_sender : msg.deleted_by_receiver;
        
        if (isDeleted) continue;

        const partnerId = isSender ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url, is_online')
            .eq('id', partnerId)
            .single();

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', partnerId)
            .eq('receiver_id', user.id)
            .eq('read', false)
            .eq('deleted_by_receiver', false);

          conversationMap.set(partnerId, {
            user_id: partnerId,
            username: profileData?.username || 'Пользователь',
            avatar_url: profileData?.avatar_url,
            is_online: profileData?.is_online,
            last_message: msg.content || '📷 Изображение',
            last_message_time: msg.created_at,
            unread_count: count || 0
          });
        }
      }

      const sortedConversations = Array.from(conversationMap.values()).sort((a, b) => 
        new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      );
      
      setConversations(sortedConversations);
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
      
      const filteredMessages = (data || []).filter(msg => {
        if (msg.sender_id === user.id) {
          return !msg.deleted_by_sender;
        } else {
          return !msg.deleted_by_receiver;
        }
      });
      
      setMessages(filteredMessages);
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
        .update({ read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', user.id)
        .eq('read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleTyping = async () => {
    if (!user || !activeConversation) return;

    const channel = supabase.channel(`typing:${user.id}`);
    await channel.track({ user_id: user.id, typing: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      await channel.track({ user_id: user.id, typing: false });
    }, 3000);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Ошибка',
          description: 'Размер файла не должен превышать 5 МБ',
          variant: 'destructive'
        });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview('');
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeConversation || (!newMessage.trim() && !selectedImage)) return;

    setUploading(true);
    try {
      let imageUrl = null;

      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${user.id}/messages/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media-images')
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: activeConversation,
          content: newMessage.trim() || '',
          image_url: imageUrl
        });

      if (error) throw error;

      setNewMessage('');
      removeImage();
      fetchMessages(activeConversation);
      fetchConversations();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отправить сообщение',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId || !user) return;

    try {
      const message = messages.find(m => m.id === deleteMessageId);
      if (!message) return;

      const isSender = message.sender_id === user.id;
      
      await supabase
        .from('messages')
        .update(
          isSender 
            ? { deleted_by_sender: true }
            : { deleted_by_receiver: true }
        )
        .eq('id', deleteMessageId);

      toast({
        title: 'Успешно',
        description: 'Сообщение удалено'
      });

      fetchMessages(activeConversation!);
      fetchConversations();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить сообщение',
        variant: 'destructive'
      });
    } finally {
      setDeleteMessageId(null);
    }
  };

  const selectConversation = (userId: string, username: string) => {
    setActiveConversation(userId);
    setActiveUsername(username);
    setSearchQuery('');
  };

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter(conv =>
    conv.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Conversations List */}
        <Card className={`${activeConversation ? 'hidden md:block' : ''}`}>
          <CardHeader>
            <CardTitle>Сообщения</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[480px]">
              {filteredConversations.length === 0 ? (
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
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.user_id}
                      onClick={() => selectConversation(conv.user_id, conv.username)}
                      className={`w-full p-4 text-left hover:bg-muted transition-colors ${
                        activeConversation === conv.user_id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            {conv.avatar_url ? (
                              <AvatarImage src={conv.avatar_url} alt={conv.username} />
                            ) : (
                              <AvatarFallback className="bg-primary/10 text-primary">
                                <User className="w-5 h-5" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                          {conv.is_online && (
                            <CircleDot className="absolute -bottom-1 -right-1 w-3 h-3 text-green-500 fill-green-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="font-medium truncate">{conv.username}</p>
                            {conv.unread_count > 0 && (
                              <span className="ml-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.last_message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(conv.last_message_time), {
                              addSuffix: true,
                              locale: ru
                            })}
                          </p>
                        </div>
                      </div>
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
            <CardHeader className="flex flex-row items-center space-y-0 gap-3 border-b">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setActiveConversation(null)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="relative">
                <Avatar className="w-10 h-10">
                  {activeUserAvatar ? (
                    <AvatarImage src={activeUserAvatar} alt={activeUsername} />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  )}
                </Avatar>
                {activeUserOnline && (
                  <CircleDot className="absolute -bottom-1 -right-1 w-3 h-3 text-green-500 fill-green-500" />
                )}
              </div>
              <div className="flex-1">
                <CardTitle>{activeUsername}</CardTitle>
                {activeUserOnline && (
                  <p className="text-xs text-muted-foreground">В сети</p>
                )}
              </div>
              {!activeConversation.includes('search') && (
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск в чате..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[440px] p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex group ${
                        msg.sender_id === user.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 relative ${
                          msg.sender_id === user.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.image_url && (
                          <img
                            src={msg.image_url}
                            alt="Attached"
                            className="rounded-lg mb-2 max-w-full h-auto cursor-pointer"
                            onClick={() => window.open(msg.image_url!, '_blank')}
                          />
                        )}
                        {msg.content && <p className="break-words">{msg.content}</p>}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p
                            className={`text-xs ${
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
                          {msg.sender_id === user.id && (
                            <span className={`text-xs ${msg.read ? 'text-primary-foreground/70' : 'text-primary-foreground/50'}`}>
                              {msg.read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteMessageId(msg.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">печатает...</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <form onSubmit={sendMessage} className="p-4 border-t space-y-2">
                {imagePreview && (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-6 h-6"
                      onClick={removeImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Введите сообщение..."
                    className="flex-1"
                    disabled={uploading}
                  />
                  <Label htmlFor="message-image" className="cursor-pointer">
                    <Button type="button" variant="outline" size="icon" asChild disabled={uploading}>
                      <div>
                        <ImageIcon className="w-4 h-4" />
                        <input
                          id="message-image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageSelect}
                          disabled={uploading}
                        />
                      </div>
                    </Button>
                  </Label>
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={(!newMessage.trim() && !selectedImage) || uploading}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="hidden md:block md:col-span-2">
            <CardContent className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Выберите беседу</p>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteMessageId} onOpenChange={() => setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сообщение?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Сообщение будет удалено только для вас.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Messages;