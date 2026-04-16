import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { getScopedStorageKey } from "@/lib/backend-cache";
import { safeStorage } from "@/lib/safe-storage";

export type AppRole = "owner" | "waiter" | "chef" | "manager" | string;

interface AccessContext {
  role: AppRole | null;
  hotelId: string | null;
}

type DbAppRole = Enums<"app_role">;

const STAFF_ROLES = new Set<DbAppRole>(["waiter", "chef", "manager"]);

const resolveRole = (primaryRole: string | null | undefined, fallbackRole?: string | null): AppRole | null => {
  const role = primaryRole ?? fallbackRole ?? null;
  return role as AppRole | null;
};

const readMetadataValue = (currentUser: any, key: string): string | null => {
  const value = currentUser?.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getStaffHotelCodeCacheKey = (email: string) =>
  getScopedStorageKey(`qb_staff_hotel_code:${email.trim().toLowerCase()}`);

const readCachedHotelCode = (email: string | null): string | null => {
  if (!email || typeof window === "undefined") return null;

  try {
    const value = safeStorage.getItem(getStaffHotelCodeCacheKey(email));
    return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
  } catch {
    return null;
  }
};

async function ensureOwnerHotel(userId: string): Promise<string | null> {
  const { data: existingHotel, error: existingHotelError } = await supabase
    .from("hotels")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingHotelError) throw existingHotelError;
  if (existingHotel?.id) return existingHotel.id;

  const { data: createdHotel, error: createHotelError } = await supabase
    .from("hotels")
    .insert({
      owner_id: userId,
      name: "My Hotel",
      subscription_tier: "free",
      subscription_start_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createHotelError) throw createHotelError;
  return createdHotel.id;
}

export async function ensureUserAccessContext(
  userId: string,
  _currentUser: any
): Promise<AccessContext> {
  const [profilesResult, userRoleResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, hotel_id, full_name, email, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (userRoleResult.error) throw userRoleResult.error;

  const profileRows = profilesResult.data ?? [];
  const profile = profileRows.find((row) => row.hotel_id) ?? profileRows[0] ?? null;
  let resolvedRole = userRoleResult.data?.role as AppRole | null;
  const metadataRole = readMetadataValue(_currentUser, "role");
  const metadataFullName = readMetadataValue(_currentUser, "full_name") ?? "";
  const metadataEmail = typeof _currentUser?.email === "string" ? _currentUser.email : null;
  const metadataHotelCode = (
    readMetadataValue(_currentUser, "hotel_code") ?? readCachedHotelCode(metadataEmail)
  )?.toUpperCase() ?? null;

  resolvedRole = (resolveRole(resolvedRole, profile?.role ?? metadataRole) ?? "owner") as AppRole;
  const bootstrapRole = resolvedRole as DbAppRole;

  if (!userRoleResult.data?.role) {
    const { error: userRoleInsertError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: bootstrapRole });

    if (userRoleInsertError && userRoleInsertError.code !== "23505") throw userRoleInsertError;
  }

  if (!profile) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        role: bootstrapRole,
        full_name: metadataFullName,
        email: metadataEmail,
      });

    if (insertError && insertError.code !== "23505") throw insertError;
  }

  let resolvedHotelId = profile?.hotel_id ?? null;

  if (bootstrapRole === "owner") {
    resolvedHotelId = await ensureOwnerHotel(userId);
  } else if (STAFF_ROLES.has(bootstrapRole) && !resolvedHotelId && metadataHotelCode) {
    const { data: linkedHotelId, error: linkHotelError } = await supabase.rpc("link_waiter_to_hotel", {
      _user_id: userId,
      _hotel_code: metadataHotelCode,
    });

    if (linkHotelError && !String(linkHotelError.message || "").includes("already assigned")) throw linkHotelError;
    resolvedHotelId = linkedHotelId ?? resolvedHotelId;
  }

  const profileUpdates: Partial<{ role: string; hotel_id: string; full_name: string; email: string }> = {};

  if (profile?.role !== bootstrapRole) profileUpdates.role = bootstrapRole;
  if (resolvedHotelId && profile?.hotel_id !== resolvedHotelId) profileUpdates.hotel_id = resolvedHotelId;
  if ((!profile?.full_name || !profile.full_name.trim()) && metadataFullName) profileUpdates.full_name = metadataFullName;
  if ((!profile?.email || !profile.email.trim()) && metadataEmail) profileUpdates.email = metadataEmail;

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("user_id", userId);

    if (profileUpdateError) throw profileUpdateError;
  }

  return {
    role: resolveRole(bootstrapRole, profile?.role),
    hotelId: resolvedHotelId,
  };
}
