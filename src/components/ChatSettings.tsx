import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Trash2, Crown, User as UserIcon } from 'lucide-react';

interface ChatSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  groupDescription: string;
  members: any[];
  isAdmin: boolean;
  onUpdate: () => void;
}

export const ChatSettings = ({
  open,
  onOpenChange,
  groupId,
  groupName,
  groupDescription,
  members,
  isAdmin,
  onUpdate
}: ChatSettingsProps) => {
  const [name, setName] = useState(groupName);
  const [description, setDescription] = useState(groupDescription);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleUpdateGroup = async () => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('group_chats')
        .update({
          name,
          description
        })
        .eq('id', groupId);

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Настройки группы обновлены'
      });
      onUpdate();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить настройки',
        variant: 'destructive'
      });
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
        .limit(10);

      if (error) throw error;

      const filteredResults = (data || []).filter(
        profile => !members.some(member => member.user_id === profile.id)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!isAdmin) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role: 'member'
        });

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Участник добавлен в группу'
      });
      onUpdate();
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить участника',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!isAdmin || userId === user?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Участник удален из группы'
      });
      onUpdate();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить участника',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Вы покинули группу'
      });
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось покинуть группу',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Настройки группы</DialogTitle>
          <DialogDescription>
            Управление группой и участниками
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isAdmin && (
            <>
              <div>
                <Label htmlFor="name">Название группы</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название группы"
                />
              </div>

              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание группы"
                  rows={3}
                />
              </div>

              <Button onClick={handleUpdateGroup} className="w-full">
                Сохранить изменения
              </Button>
            </>
          )}

          <div>
            <Label htmlFor="search">Добавить участников</Label>
            <div className="relative">
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder="Поиск пользователей..."
                disabled={!isAdmin}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <ScrollArea className="max-h-48">
                    {searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar_url} />
                            <AvatarFallback>
                              <UserIcon className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{profile.username}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAddMember(profile.id)}
                          disabled={loading}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Участники ({members.length})</Label>
            <ScrollArea className="h-64 border rounded-md p-2">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-2 hover:bg-accent rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profiles?.avatar_url} />
                      <AvatarFallback>
                        <UserIcon className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{member.profiles?.username || 'Пользователь'}</span>
                      {member.role === 'admin' && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                    </div>
                  </div>
                  {isAdmin && member.user_id !== user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={handleLeaveGroup} disabled={loading}>
            Покинуть группу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
