-- 1. Add captain to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'captain';

-- 2. Add section assignment column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_section_id uuid REFERENCES public.floor_sections(id) ON DELETE SET NULL;

-- 3. Update link_waiter_to_hotel to also accept captain role
CREATE OR REPLACE FUNCTION public.link_waiter_to_hotel(_user_id uuid, _hotel_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _hotel_id uuid;
DECLARE _staff_role public.app_role;
BEGIN
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only link own profile';
  END IF;

  SELECT role INTO _staff_role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY id
  LIMIT 1;

  IF _staff_role IS NULL OR _staff_role NOT IN ('waiter', 'chef', 'manager', 'captain') THEN
    RAISE EXCEPTION 'Only waiter, chef, manager, or captain accounts can link to hotels via code';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND hotel_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already assigned to a hotel';
  END IF;

  SELECT id INTO _hotel_id
  FROM public.hotels
  WHERE hotel_code = _hotel_code;

  IF _hotel_id IS NULL THEN
    RAISE EXCEPTION 'Invalid hotel code';
  END IF;

  UPDATE public.profiles
  SET hotel_id = _hotel_id,
      role = _staff_role::text
  WHERE user_id = _user_id;

  RETURN _hotel_id;
END;
$function$;