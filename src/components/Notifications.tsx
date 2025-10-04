import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Notification {
  id: string;
  type: string;
  content: string;
  post_id: string | null;
  from_user_id: string;
  is_read: boolean;
  created_at: string;
  from_username?: string;
}

interface NotificationSettings {
  notify_on_new_posts: boolean;
}

export const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({ notify_on_new_posts: true });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchSettings();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        from_profile:profiles!notifications_from_user_id_fkey(username)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    const notificationsWithUsername = data.map((n: any) => ({
      ...n,
      from_username: n.from_profile?.username
    }));

    setNotifications(notificationsWithUsername);
    setUnreadCount(notificationsWithUsername.filter((n: Notification) => !n.is_read).length);
  };

  const fetchSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      return;
    }

    if (data) {
      setSettings({ notify_on_new_posts: data.notify_on_new_posts });
    }
  };

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      fetchNotifications();
    }
  };

  const updateSettings = async (notify_on_new_posts: boolean) => {
    if (!user) return;

    const { error } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: user.id,
        notify_on_new_posts
      });

    if (!error) {
      setSettings({ notify_on_new_posts });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.post_id) {
      // Navigate to the appropriate section based on notification type
      if (notification.type === 'new_video') {
        navigate('/videos');
      } else if (notification.type === 'new_photo') {
        navigate('/photos');
      } else {
        navigate('/');
      }
    }
  };

  if (!user) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Уведомления</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Прочитать все
                </Button>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {showSettings && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm">Уведомления о новых постах</span>
                <Switch
                  checked={settings.notify_on_new_posts}
                  onCheckedChange={updateSettings}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-4 space-y-2">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Нет уведомлений
            </p>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  !notification.is_read ? 'bg-accent/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {notification.content}
                        {notification.from_username && (
                          <span className="text-primary ml-1">
                            @{notification.from_username}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-1" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
