-- Обновляем функцию создания пользователя чтобы она также создавала профиль
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
    encode(sha256(password_param::bytea), 'hex'),
    now(),
    json_build_object('username', username_param, 'is_18_confirmed', is_18_confirmed_param),
    'authenticated',
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO user_uuid;

  -- Создаем профиль для пользователя
  INSERT INTO public.profiles (
    user_id,
    username,
    is_18_confirmed,
    created_at,
    updated_at
  )
  VALUES (
    user_uuid,
    username_param,
    is_18_confirmed_param,
    now(),
    now()
  );

  RETURN json_build_object('success', true, 'user_id', user_uuid);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;