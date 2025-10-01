import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Play, Image as ImageIcon, Home, LogOut, User, MessageCircle } from 'lucide-react';
import UserSearch from '@/components/UserSearch';

const Layout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-lavender-light bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold text-primary">Медиа Платформа</h1>
              <div className="hidden md:block">
                <UserSearch />
              </div>
              <nav className="hidden md:flex items-center space-x-1">
                <Button
                  variant={isActive('/') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/')}
                  className={isActive('/') ? 'bg-lavender hover:bg-lavender-dark' : ''}
                >
                  <Home className="w-4 h-4 mr-2" />
                  Главная
                </Button>
                <Button
                  variant={isActive('/videos') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/videos')}
                  className={isActive('/videos') ? 'bg-lavender hover:bg-lavender-dark' : ''}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Видео
                </Button>
                <Button
                  variant={isActive('/photos') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/photos')}
                  className={isActive('/photos') ? 'bg-lavender hover:bg-lavender-dark' : ''}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Фото
                </Button>
                <Button
                  variant={isActive('/messages') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/messages')}
                  className={isActive('/messages') ? 'bg-lavender hover:bg-lavender-dark' : ''}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Сообщения
                </Button>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <Badge variant="outline" className="border-lavender text-lavender">
                    <User className="w-3 h-3 mr-1" />
                    {user.user_metadata?.username || 'Пользователь'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Выйти
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b border-lavender-light bg-background">
        <div className="container mx-auto px-4 py-2">
          <nav className="flex items-center justify-center space-x-1">
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/')}
              className={isActive('/') ? 'bg-lavender hover:bg-lavender-dark' : ''}
            >
              <Home className="w-4 h-4 mr-1" />
              Главная
            </Button>
            <Button
              variant={isActive('/videos') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/videos')}
              className={isActive('/videos') ? 'bg-lavender hover:bg-lavender-dark' : ''}
            >
              <Play className="w-4 h-4 mr-1" />
              Видео
            </Button>
            <Button
              variant={isActive('/photos') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/photos')}
              className={isActive('/photos') ? 'bg-lavender hover:bg-lavender-dark' : ''}
            >
              <ImageIcon className="w-4 h-4 mr-1" />
              Фото
            </Button>
            <Button
              variant={isActive('/messages') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/messages')}
              className={isActive('/messages') ? 'bg-lavender hover:bg-lavender-dark' : ''}
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              Чат
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-lavender-light bg-background/95">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 Медиа Платформа. Современный обмен контентом с лавандовым дизайном.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;