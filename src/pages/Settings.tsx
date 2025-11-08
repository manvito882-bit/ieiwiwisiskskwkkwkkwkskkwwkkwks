import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { User, Upload, Shield, Trash2, Lock, UserX, Bell } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  can_receive_messages_from?: string;
  notifications_enabled?: boolean;
  notify_likes?: boolean;
  notify_comments?: boolean;
  notify_messages?: boolean;
  notify_subscriptions?: boolean;
}

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  username: string;
}

const Settings = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [messagePrivacy, setMessagePrivacy] = useState('everyone');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchBlockedUsers();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setUsername(data.username || '');
      setBio(data.bio || '');
      setAvatarPreview(data.avatar_url || '');
      setMessagePrivacy(data.can_receive_messages_from || 'everyone');
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить профиль',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    if (!user) return;

    try {
      const { data: blockedData, error } = await supabase
        .from('blocked_users')
        .select('id, blocked_user_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const usersWithNames = await Promise.all(
        (blockedData || []).map(async (block) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', block.blocked_user_id)
            .single();

          return {
            ...block,
            username: profileData?.username || 'Пользователь'
          };
        })
      );

      setBlockedUsers(usersWithNames);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    if (!user || !username.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Имя пользователя не может быть пустым',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media-images')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media-images')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          can_receive_messages_from: messagePrivacy
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Профиль обновлён'
      });

      fetchProfile();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить профиль',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } : null);

      toast({
        title: 'Успешно',
        description: 'Настройки сохранены'
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить настройки',
        variant: 'destructive'
      });
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast({
        title: 'Ошибка',
        description: 'Пароли не совпадают',
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Ошибка',
        description: 'Пароль должен содержать минимум 6 символов',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Пароль изменён'
      });

      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить пароль',
        variant: 'destructive'
      });
    }
  };

  const unblockUser = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('id', blockId);

      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Пользователь разблокирован'
      });

      fetchBlockedUsers();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось разблокировать пользователя',
        variant: 'destructive'
      });
    }
  };

  const deleteAccount = async () => {
    if (!user) return;

    try {
      // Delete user data
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.from('messages').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      await supabase.from('posts').delete().eq('user_id', user.id);
      await supabase.from('media').delete().eq('user_id', user.id);

      // Sign out
      await signOut();

      toast({
        title: 'Успешно',
        description: 'Аккаунт удалён'
      });

      navigate('/');
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить аккаунт',
        variant: 'destructive'
      });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Войдите в систему для доступа к настройкам
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
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Настройки</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="w-4 h-4 mr-2" />
            Приватность
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Уведомления
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Безопасность
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Настройки профиля</CardTitle>
              <CardDescription>
                Управляйте информацией вашего профиля
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="w-32 h-32">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} alt={username} />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                      <User className="w-16 h-16" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <div>
                      <Upload className="w-4 h-4 mr-2" />
                      Загрузить аватар
                      <input
                        id="avatar"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>
                  </Button>
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Имя пользователя</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ваше имя"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">О себе</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Расскажите о себе..."
                  rows={4}
                />
              </div>

              <Button onClick={saveProfile} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Приватность и безопасность</CardTitle>
              <CardDescription>
                Контролируйте кто может с вами взаимодействовать
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Кто может отправлять мне сообщения</Label>
                <Select value={messagePrivacy} onValueChange={setMessagePrivacy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Все пользователи</SelectItem>
                    <SelectItem value="subscribers">Только подписчики</SelectItem>
                    <SelectItem value="none">Никто</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={saveProfile} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </Button>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">Заблокированные пользователи</h3>
                {blockedUsers.length === 0 ? (
                  <p className="text-muted-foreground">Нет заблокированных пользователей</p>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map((blocked) => (
                      <div key={blocked.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span>{blocked.username}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unblockUser(blocked.id)}
                        >
                          Разблокировать
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Настройки уведомлений</CardTitle>
              <CardDescription>
                Управляйте уведомлениями о различных событиях
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notifications-enabled">Все уведомления</Label>
                    <p className="text-sm text-muted-foreground">Включить/выключить все уведомления</p>
                  </div>
                  <Switch 
                    id="notifications-enabled"
                    checked={profile?.notifications_enabled ?? true}
                    onCheckedChange={async (checked) => {
                      await updateProfile({ notifications_enabled: checked });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-likes">Уведомления о лайках</Label>
                    <p className="text-sm text-muted-foreground">Когда кто-то лайкает ваши посты</p>
                  </div>
                  <Switch 
                    id="notify-likes"
                    checked={profile?.notify_likes ?? true}
                    onCheckedChange={async (checked) => {
                      await updateProfile({ notify_likes: checked });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-comments">Уведомления о комментариях</Label>
                    <p className="text-sm text-muted-foreground">Когда кто-то комментирует ваши посты</p>
                  </div>
                  <Switch 
                    id="notify-comments"
                    checked={profile?.notify_comments ?? true}
                    onCheckedChange={async (checked) => {
                      await updateProfile({ notify_comments: checked });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-messages">Уведомления о сообщениях</Label>
                    <p className="text-sm text-muted-foreground">Когда вам приходят новые сообщения</p>
                  </div>
                  <Switch 
                    id="notify-messages"
                    checked={profile?.notify_messages ?? true}
                    onCheckedChange={async (checked) => {
                      await updateProfile({ notify_messages: checked });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-subscriptions">Уведомления о подписках</Label>
                    <p className="text-sm text-muted-foreground">Когда на вас подписываются</p>
                  </div>
                  <Switch 
                    id="notify-subscriptions"
                    checked={profile?.notify_subscriptions ?? true}
                    onCheckedChange={async (checked) => {
                      await updateProfile({ notify_subscriptions: checked });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Безопасность аккаунта</CardTitle>
              <CardDescription>
                Управляйте паролем и безопасностью аккаунта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Изменить пароль</h3>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Новый пароль</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите новый пароль"
                  />
                </div>
                <Button onClick={changePassword}>
                  Изменить пароль
                </Button>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="text-lg font-semibold text-destructive">Опасная зона</h3>
                <p className="text-sm text-muted-foreground">
                  После удаления аккаунта все ваши данные будут безвозвратно удалены
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить аккаунт
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все ваши данные, включая профиль, сообщения и контент, будут безвозвратно удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Да, удалить аккаунт
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;