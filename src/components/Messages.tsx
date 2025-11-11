import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ArrowLeft, Image as ImageIcon, X, User, Search, Trash2, CircleDot, Edit2, Settings, Users as UsersIcon, Check } from 'lucide-react';
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
import { CreateGroupDialog } from './CreateGroupDialog';
import { ChatSettings } from './ChatSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  is_edited?: boolean;
  edited_at?: string | null;
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  image_url?: string | null;
  is_edited?: boolean;
  edited_at?: string | null;
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

interface GroupConversation {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string | null;
  last_message: string;
  last_message_time: string;
  member_count: number;
}

const Messages = () => {
  const location = useLocation();
  const { selectedUserId, selectedUsername } = (location.state as any) || {};
  
  const [chatType, setChatType] = useState<'personal' | 'group'>('personal');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(selectedUserId || null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeUsername, setActiveUsername] = useState<string>(selectedUsername || '');
  const [activeUserAvatar, setActiveUserAvatar] = useState<string>('');
  const [activeUserOnline, setActiveUserOnline] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
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
      fetchGroupConversations();
    }
  }, [user]);

  useEffect(() => {
    if (chatType === 'personal' && activeConversation) {
      fetchMessages(activeConversation);
      markAsRead(activeConversation);
      fetchActiveUserInfo(activeConversation);
      
      // Subscribe to new messages
      const messagesChannel = supabase
        .channel('messages-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            if (activeConversation) {
              fetchMessages(activeConversation);
              fetchConversations();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    } else if (chatType === 'group' && activeGroupId) {
      fetchGroupMessages(activeGroupId);
      fetchGroupMembers(activeGroupId);
      
      // Subscribe to new group messages
      const groupMessagesChannel = supabase
        .channel('group-messages-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${activeGroupId}`
          },
          () => {
            if (activeGroupId) {
              fetchGroupMessages(activeGroupId);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(groupMessagesChannel);
      };
    }
  }, [activeConversation, activeGroupId, chatType, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, groupMessages]);

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

  const fetchGroupMembers = async (groupId: string) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('user_id, role, profiles(username, avatar_url)')
      .eq('group_id', groupId);

    if (error) {
      console.error('Error fetching group members:', error);
      return;
    }

    setGroupMembers(data || []);
    const member = data?.find(m => m.user_id === user?.id);
    setIsGroupAdmin(member?.role === 'admin');
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
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupConversations = async () => {
    if (!user) return;

    try {
      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const groupIds = memberGroups?.map(m => m.group_id) || [];
      
      if (groupIds.length === 0) {
        setGroupConversations([]);
        return;
      }

      const { data: groups, error: groupsError } = await supabase
        .from('group_chats')
        .select('*')
        .in('id', groupIds);

      if (groupsError) throw groupsError;

      const groupConvs: GroupConversation[] = [];

      for (const group of groups || []) {
        const { data: lastMsg } = await supabase
          .from('group_messages')
          .select('content, created_at')
          .eq('group_id', group.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);

        groupConvs.push({
          id: group.id,
          name: group.name,
          description: group.description,
          avatar_url: group.avatar_url,
          last_message: lastMsg?.content || 'Нет сообщений',
          last_message_time: lastMsg?.created_at || group.created_at,
          member_count: count || 0
        });
      }

      groupConvs.sort((a, b) => 
        new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      );

      setGroupConversations(groupConvs);
    } catch (error) {
      console.error('Error fetching group conversations:', error);
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
    }
  };

  const fetchGroupMessages = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setGroupMessages(data || []);
    } catch (error) {
      console.error('Error fetching group messages:', error);
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
    if (!user || (!newMessage.trim() && !selectedImage)) return;

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

      if (chatType === 'personal' && activeConversation) {
        const { error } = await supabase
          .from('messages')
          .insert({
            sender_id: user.id,
            receiver_id: activeConversation,
            content: newMessage.trim() || '',
            image_url: imageUrl
          });

        if (error) throw error;
        fetchMessages(activeConversation);
      } else if (chatType === 'group' && activeGroupId) {
        const { error } = await supabase
          .from('group_messages')
          .insert({
            group_id: activeGroupId,
            sender_id: user.id,
            content: newMessage.trim() || '',
            image_url: imageUrl
          });

        if (error) throw error;
        fetchGroupMessages(activeGroupId);
      }

      setNewMessage('');
      removeImage();
      fetchConversations();
      fetchGroupConversations();
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

  const handleEditMessage = async () => {
    if (!editingMessageId || !editContent.trim()) return;

    try {
      if (chatType === 'personal') {
        const { error } = await supabase
          .from('messages')
          .update({
            content: editContent.trim(),
            is_edited: true,
            edited_at: new Date().toISOString()
          })
          .eq('id', editingMessageId);

        if (error) throw error;
        if (activeConversation) fetchMessages(activeConversation);
      } else {
        const { error } = await supabase
          .from('group_messages')
          .update({
            content: editContent.trim(),
            is_edited: true,
            edited_at: new Date().toISOString()
          })
          .eq('id', editingMessageId);

        if (error) throw error;
        if (activeGroupId) fetchGroupMessages(activeGroupId);
      }

      toast({
        title: 'Успешно',
        description: 'Сообщение отредактировано'
      });
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отредактировать сообщение',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId || !user) return;

    try {
      if (chatType === 'personal') {
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

        if (activeConversation) fetchMessages(activeConversation);
      } else {
        await supabase
          .from('group_messages')
          .delete()
          .eq('id', deleteMessageId);

        if (activeGroupId) fetchGroupMessages(activeGroupId);
      }

      toast({
        title: 'Успешно',
        description: 'Сообщение удалено'
      });

      fetchConversations();
      fetchGroupConversations();
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
    setChatType('personal');
    setActiveConversation(userId);
    setActiveGroupId(null);
    setActiveUsername(username);
    setSearchQuery('');
  };

  const selectGroupConversation = (groupId: string, groupName: string) => {
    setChatType('group');
    setActiveGroupId(groupId);
    setActiveConversation(null);
    setActiveUsername(groupName);
    setSearchQuery('');
  };

  const startEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
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

  const currentMessages = chatType === 'personal' ? messages : groupMessages;
  const filteredMessages = currentMessages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Conversations List */}
        <Card className={`${(activeConversation || activeGroupId) ? 'hidden md:block' : ''}`}>
          <CardHeader>
            <CardTitle>Сообщения</CardTitle>
            <CreateGroupDialog onGroupCreated={() => {
              fetchGroupConversations();
              setChatType('group');
            }} />
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={chatType} onValueChange={(v) => setChatType(v as 'personal' | 'group')}>
              <TabsList className="w-full">
                <TabsTrigger value="personal" className="flex-1">Личные</TabsTrigger>
                <TabsTrigger value="group" className="flex-1">Группы</TabsTrigger>
              </TabsList>
              <TabsContent value="personal" className="mt-0">
                <ScrollArea className="h-[420px]">
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
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="group" className="mt-0">
                <ScrollArea className="h-[420px]">
                  {groupConversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <p>Нет групп</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {groupConversations.map((group) => (
                        <button
                          key={group.id}
                          onClick={() => selectGroupConversation(group.id, group.name)}
                          className={`w-full p-4 text-left hover:bg-muted transition-colors ${
                            activeGroupId === group.id ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              {group.avatar_url ? (
                                <AvatarImage src={group.avatar_url} alt={group.name} />
                              ) : (
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  <UsersIcon className="w-5 h-5" />
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{group.name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {group.last_message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {group.member_count} участников
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Messages */}
        {(activeConversation || activeGroupId) ? (
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center space-y-0 gap-3 border-b">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => {
                  setActiveConversation(null);
                  setActiveGroupId(null);
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Avatar className="w-10 h-10">
                {activeUserAvatar ? (
                  <AvatarImage src={activeUserAvatar} alt={activeUsername} />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {chatType === 'group' ? <UsersIcon className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <CardTitle>{activeUsername}</CardTitle>
                {chatType === 'personal' && activeUserOnline && (
                  <p className="text-xs text-muted-foreground">В сети</p>
                )}
                {chatType === 'group' && (
                  <p className="text-xs text-muted-foreground">{groupMembers.length} участников</p>
                )}
              </div>
              {chatType === 'group' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[440px] p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {filteredMessages.map((msg) => {
                    const isOwnMessage = msg.sender_id === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex group ${
                          isOwnMessage ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 relative ${
                            isOwnMessage
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
                          {editingMessageId === msg.id ? (
                            <div className="space-y-2">
                              <Input
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="bg-background"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleEditMessage}>
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.content && <p className="break-words">{msg.content}</p>}
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <p
                                  className={`text-xs ${
                                    isOwnMessage
                                      ? 'text-primary-foreground/70'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  {msg.is_edited && ' (изменено)'}
                                </p>
                                {chatType === 'personal' && isOwnMessage && (
                                  <span className={`text-xs ${(msg as Message).read ? 'text-primary-foreground/70' : 'text-primary-foreground/50'}`}>
                                    {(msg as Message).read ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                          {isOwnMessage && editingMessageId !== msg.id && (
                            <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6"
                                onClick={() => startEditMessage(msg.id, msg.content)}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6"
                                onClick={() => setDeleteMessageId(msg.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                    onChange={(e) => setNewMessage(e.target.value)}
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
              Это действие нельзя отменить. Сообщение будет удалено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeGroupId && (
        <ChatSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          groupId={activeGroupId}
          groupName={activeUsername}
          groupDescription=""
          members={groupMembers}
          isAdmin={isGroupAdmin}
          onUpdate={() => {
            fetchGroupConversations();
            fetchGroupMembers(activeGroupId);
          }}
        />
      )}
    </>
  );
};

export default Messages;
