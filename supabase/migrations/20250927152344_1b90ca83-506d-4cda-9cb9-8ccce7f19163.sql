-- Добавляем внешний ключ к таблице profiles для связи с auth.users
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Обновляем функцию создания пользователя для лучшей обработки ошибок
CREATE OR REPLACE FUNCTION public.create_user_with_username(
  username_param TEXT,
  password_param TEXT,
  is_18_confirmed_param BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp_email TEXT;
  user_uuid UUID;
BEGIN
  -- Проверяем, что username уникален
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = username_param) THEN
    RETURN json_build_object('error', 'Username уже занят');
  END IF;

  -- Проверяем, что email уникален
  temp_email := username_param || '@temp.local';
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = temp_email) THEN
    RETURN json_build_object('error', 'Пользователь уже существует');
  END IF;
  
  -- Генерируем UUID для пользователя
  user_uuid := gen_random_uuid();
  
  -- Создаем пользователя через auth
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  )
  VALUES (
    user_uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    temp_email,
    encode(sha256(password_param::bytea), 'hex'),
    now(),
    json_build_object('username', username_param, 'is_18_confirmed', is_18_confirmed_param),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Создаем профиль для пользователя
  INSERT INTO public.profiles (
    user_id,
    username,
    is_18_confirmed
  )
  VALUES (
    user_uuid,
    username_param,
    is_18_confirmed_param
  );

  RETURN json_build_object('success', true, 'user_id', user_uuid);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', 'Ошибка создания пользователя: ' || SQLERRM);
END;
$$;