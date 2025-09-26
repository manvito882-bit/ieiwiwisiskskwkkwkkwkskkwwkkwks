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
      
      // Вызываем нашу кастомную функцию регистрации
      const { data, error } = await supabase.rpc('create_user_with_username', {
        username_param: username,
        password_param: password,
        is_18_confirmed_param: is18Confirmed
      });

      if (error) {
        return { error: error.message };
      }

      if (data && typeof data === 'object' && 'error' in data) {
        return { error: data.error as string };
      }

      // После успешной регистрации входим через стандартный Supabase auth
      const tempEmail = `${username}@temp.local`;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: tempEmail,
        password: password
      });

      if (signInError) {
        return { error: 'Ошибка входа после регистрации' };
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
      
      // Вызываем нашу кастомную функцию аутентификации
      const { data, error } = await supabase.rpc('authenticate_user', {
        username_param: username,
        password_param: password
      });

      if (error) {
        return { error: error.message };
      }

      if (data && typeof data === 'object' && 'error' in data) {
        return { error: data.error as string };
      }

      if (data && typeof data === 'object' && 'success' in data) {
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
      }

      return { error: 'Неверный username или пароль' };
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