import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User } from 'lucide-react';
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
      <PopoverContent className="w-64 p-0" align="start">
        {results.length > 0 ? (
          <div className="py-2">
            {results.map((result) => (
              <Button
                key={result.user_id}
                variant="ghost"
                className="w-full justify-start px-4 py-2"
                onClick={() => handleSelectUser(result.username)}
              >
                <User className="w-4 h-4 mr-2 text-lavender" />
                {result.username}
              </Button>
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