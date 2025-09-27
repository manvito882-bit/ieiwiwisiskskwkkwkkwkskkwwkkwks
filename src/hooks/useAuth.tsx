import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (username: string, password: string, is18Confirmed: boolean) => Promise<{ error?: string; success?: boolean }>;
  signIn: (username: string, password: string) => Promise<{ error?: string; success?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Настройка слушателя изменений аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Проверка существующей сессии
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (username: string, password: string, is18Confirmed: boolean) => {
    try {
      setLoading(true);
      
      // Проверяем уникальность username
      const { data: isAvailable, error: checkError } = await supabase.rpc('is_username_available', {
        username_param: username
      });

      if (checkError) {
        return { error: 'Ошибка проверки username' };
      }

      if (!isAvailable) {
        return { error: 'Username уже занят' };
      }

      // Создаем временный email для Supabase auth
      const tempEmail = `${username}@temp.local`;
      
      // Регистрируем пользователя через стандартный Supabase auth
      const { error: signUpError } = await supabase.auth.signUp({
        email: tempEmail,
        password: password,
        options: {
          data: {
            username: username,
            is_18_confirmed: is18Confirmed
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          return { error: 'Пользователь уже существует' };
        }
        return { error: signUpError.message };
      }

      return { success: true };
    } catch (error) {
      return { error: 'Произошла ошибка при регистрации' };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      // Создаем временный email для Supabase auth
      const tempEmail = `${username}@temp.local`;
      
      // Входим через стандартный Supabase auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: tempEmail,
        password: password
      });

      if (signInError) {
        return { error: 'Неверный username или пароль' };
      }

      return { success: true };
    } catch (error) {
      return { error: 'Произошла ошибка при входе' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};