
-- 1. Fix platform_config SELECT: owners only for PIN rows
DROP POLICY IF EXISTS "Users can read own hotel config" ON platform_config;

CREATE POLICY "Users can read own hotel config"
  ON platform_config FOR SELECT TO authenticated
  USING (
    (config_key NOT LIKE 'owner_pin_%')
    OR (
      config_key = 'owner_pin_' || get_user_hotel_id(auth.uid())::text
      AND has_role(auth.uid(), 'owner'::app_role)
    )
  );

-- 2. Create a verify_owner_pin RPC so client never needs to read the PIN value
CREATE OR REPLACE FUNCTION public.verify_owner_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _hotel_id uuid;
  _stored_pin text;
BEGIN
  _hotel_id := get_user_hotel_id(auth.uid());
  IF _hotel_id IS NULL THEN RETURN false; END IF;
  
  SELECT config_value INTO _stored_pin
  FROM platform_config
  WHERE config_key = 'owner_pin_' || _hotel_id::text;
  
  IF _stored_pin IS NULL THEN RETURN false; END IF;
  RETURN _stored_pin = _pin;
END;
$$;

-- 3. Fix licenses: remove the broad "Read available licenses" SELECT
DROP POLICY IF EXISTS "Read available licenses" ON licenses;

-- 4. Fix licenses: tighten the Activate license UPDATE policy
DROP POLICY IF EXISTS "Activate license" ON licenses;

CREATE POLICY "Activate license"
  ON licenses FOR UPDATE TO authenticated
  USING (
    is_used = false
    AND used_by_hotel_id IS NULL
  )
  WITH CHECK (
    is_used = true
    AND used_by_hotel_id = get_user_hotel_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  );

-- 5. Fix user_roles INSERT: add cross-hotel check
DROP POLICY IF EXISTS "Owners can assign roles to hotel staff" ON user_roles;

CREATE POLICY "Owners can assign roles to hotel staff"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role)
    AND user_id <> auth.uid()
    AND get_user_hotel_id(user_id) = get_user_hotel_id(auth.uid())
  );

-- 6. Remove overly broad anon SELECT on menu_items and menu_item_modifiers
-- QR ordering uses the qr-order edge function with service role, so anon access is not needed
DROP POLICY IF EXISTS "Anon can read menu items" ON menu_items;
DROP POLICY IF EXISTS "Anon can read modifiers" ON menu_item_modifiers;
