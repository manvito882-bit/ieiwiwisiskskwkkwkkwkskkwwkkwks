-- Включаем расширение pgcrypto для функций хеширования
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Пересоздаем функцию создания пользователя с правильным хешированием
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
  result JSON;
BEGIN
  -- Проверяем, что username уникален
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = username_param) THEN
    RETURN json_build_object('error', 'Username уже занят');
  END IF;

  -- Создаем временный email для Supabase
  temp_email := username_param || '@temp.local';
  
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
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000'::uuid,
    temp_email,
    crypt(password_param, gen_salt('bf')),
    now(),
    json_build_object('username', username_param, 'is_18_confirmed', is_18_confirmed_param),
    'authenticated',
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO user_uuid;

  RETURN json_build_object('success', true, 'user_id', user_uuid);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;

-- Пересоздаем функцию аутентификации с правильным хешированием
CREATE OR REPLACE FUNCTION public.authenticate_user(
  username_param TEXT,
  password_param TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  temp_email TEXT;
BEGIN
  -- Получаем профиль пользователя
  SELECT p.user_id, p.username INTO user_record
  FROM public.profiles p
  WHERE p.username = username_param;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Неверный username или пароль');
  END IF;

  -- Создаем временный email
  temp_email := username_param || '@temp.local';

  -- Проверяем пароль через auth.users
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = temp_email 
    AND encrypted_password = crypt(password_param, encrypted_password)
  ) THEN
    RETURN json_build_object(
      'success', true, 
      'user_id', user_record.user_id,
      'username', user_record.username
    );
  ELSE
    RETURN json_build_object('error', 'Неверный username или пароль');
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;