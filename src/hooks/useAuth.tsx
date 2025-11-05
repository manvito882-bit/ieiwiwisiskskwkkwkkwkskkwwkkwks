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
    let mounted = true;
    
    // Таймаут на случай если Supabase недоступен
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 3000);

    // Настройка слушателя изменений аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          clearTimeout(timeout);
        }
      }
    );

    // Проверка существующей сессии
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          clearTimeout(timeout);
        }
      })
      .catch((error) => {
        console.error('Error getting session:', error);
        if (mounted) {
          setLoading(false);
          clearTimeout(timeout);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (username: string, password: string, is18Confirmed: boolean) => {
    try {
      setLoading(true);
      
      // Проверяем уникальность username с таймаутом
      const checkTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const checkPromise = supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      const { data: existingProfiles, error: checkError } = await Promise.race([
        checkPromise, 
        checkTimeoutPromise
      ]) as any;

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Username check error:', checkError);
        if (checkError.message === 'Timeout') {
          return { error: 'Сервер недоступен. Попробуйте позже' };
        }
        return { error: 'Ошибка проверки username' };
      }

      if (existingProfiles) {
        return { error: 'Username уже занят' };
      }

      // Создаем временный email для Supabase auth
      const tempEmail = `${username}@temp.local`;
      
      // Регистрируем пользователя через стандартный Supabase auth с таймаутом
      const signUpTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const signUpPromise = supabase.auth.signUp({
        email: tempEmail,
        password: password,
        options: {
          data: {
            username: username,
            is_18_confirmed: is18Confirmed
          }
        }
      });

      const { error: signUpError } = await Promise.race([
        signUpPromise, 
        signUpTimeoutPromise
      ]) as any;

      if (signUpError) {
        if (signUpError.message === 'Timeout') {
          return { error: 'Сервер недоступен. Попробуйте позже' };
        }
        if (signUpError.message.includes('already registered')) {
          return { error: 'Пользователь уже существует' };
        }
        return { error: signUpError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.message === 'Timeout') {
        return { error: 'Сервер недоступен. Попробуйте позже' };
      }
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
      
      // Входим через стандартный Supabase auth с таймаутом
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const signInPromise = supabase.auth.signInWithPassword({
        email: tempEmail,
        password: password
      });

      const { error: signInError } = await Promise.race([signInPromise, timeoutPromise]) as any;

      if (signInError) {
        if (signInError.message === 'Timeout') {
          return { error: 'Сервер недоступен. Попробуйте позже' };
        }
        return { error: 'Неверный username или пароль' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.message === 'Timeout') {
        return { error: 'Сервер недоступен. Попробуйте позже' };
      }
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