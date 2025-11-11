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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, User as UserIcon, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CreateGroupDialogProps {
  onGroupCreated: () => void;
}

export const CreateGroupDialog = ({ onGroupCreated }: CreateGroupDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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
        .neq('id', user?.id)
        .limit(10);

      if (error) throw error;

      const filteredResults = (data || []).filter(
        profile => !selectedUsers.some(u => u.id === profile.id)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleAddUser = (profile: any) => {
    setSelectedUsers([...selectedUsers, profile]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleCreateGroup = async () => {
    if (!name.trim() || selectedUsers.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Укажите название и добавьте хотя бы одного участника',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create group
      const { data: group, error: groupError } = await supabase
        .from('group_chats')
        .insert({
          name: name.trim(),
          description: description.trim(),
          created_by: user?.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as admin
      const { error: creatorError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user?.id,
          role: 'admin'
        });

      if (creatorError) throw creatorError;

      // Add selected users
      const memberInserts = selectedUsers.map(u => ({
        group_id: group.id,
        user_id: u.id,
        role: 'member'
      }));

      const { error: membersError } = await supabase
        .from('group_members')
        .insert(memberInserts);

      if (membersError) throw membersError;

      toast({
        title: 'Успешно',
        description: 'Группа создана'
      });

      setOpen(false);
      setName('');
      setDescription('');
      setSelectedUsers([]);
      onGroupCreated();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать группу',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Users className="mr-2 h-4 w-4" />
          Создать группу
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Создать группу</DialogTitle>
          <DialogDescription>
            Создайте новую группу для общения
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="group-name">Название группы</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название группы"
              maxLength={50}
            />
          </div>

          <div>
            <Label htmlFor="group-description">Описание (необязательно)</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание группы"
              rows={3}
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="user-search">Добавить участников</Label>
            <div className="relative">
              <Input
                id="user-search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder="Поиск пользователей..."
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <ScrollArea className="max-h-48">
                    {searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer"
                        onClick={() => handleAddUser(profile)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile.avatar_url} />
                          <AvatarFallback>
                            <UserIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{profile.username}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div>
              <Label>Выбранные участники ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedUsers.map((user) => (
                  <Badge key={user.id} variant="secondary" className="pr-1">
                    <span>{user.username}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => handleRemoveUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreateGroup}
            disabled={loading || !name.trim() || selectedUsers.length === 0}
          >
            Создать группу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
