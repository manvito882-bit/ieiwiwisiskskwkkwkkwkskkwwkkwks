-- Удаляем старые функции
DROP FUNCTION IF EXISTS public.create_user_with_username;
DROP FUNCTION IF EXISTS public.authenticate_user;

-- Обновляем функцию handle_new_user для работы с username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, is_18_confirmed)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE((NEW.raw_user_meta_data ->> 'is_18_confirmed')::boolean, false)
  );
  RETURN NEW;
END;
$$;

-- Создаем триггер если его нет
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Создаем функцию для проверки уникальности username
CREATE OR REPLACE FUNCTION public.is_username_available(username_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = username_param);
END;
$$;