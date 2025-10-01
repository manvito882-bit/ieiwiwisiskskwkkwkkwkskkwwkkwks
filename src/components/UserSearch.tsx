import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface SearchResult {
  username: string;
  user_id: string;
}

const UserSearch = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, user_id')
        .ilike('username', `%${query}%`)
        .limit(5);

      if (error) throw error;
      setResults(data || []);
      setOpen(true);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: 'Ошибка поиска',
        description: 'Не удалось найти пользователей',
        variant: 'destructive'
      });
    }
  };

  const handleSelectUser = (username: string) => {
    navigate(`/profile/${username}`);
    setOpen(false);
    setSearch('');
    setResults([]);
  };

  const handleMessage = (userId: string, username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/messages', { state: { selectedUserId: userId, selectedUsername: username } });
    setOpen(false);
    setSearch('');
    setResults([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск по username..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 w-full md:w-64"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {results.length > 0 ? (
          <div className="py-2">
            {results.map((result) => (
              <div
                key={result.user_id}
                className="flex items-center justify-between px-4 py-2 hover:bg-muted group"
              >
                <Button
                  variant="ghost"
                  className="flex-1 justify-start p-0 h-auto hover:bg-transparent"
                  onClick={() => handleSelectUser(result.username)}
                >
                  <User className="w-4 h-4 mr-2 text-lavender" />
                  {result.username}
                </Button>
                {user && user.id !== result.user_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleMessage(result.user_id, result.username, e)}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : search.trim() ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Пользователи не найдены
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

export default UserSearch;