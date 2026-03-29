import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export type AppRole = "owner" | "waiter" | "chef" | "manager" | string;

interface AccessContext {
  role: AppRole | null;
  hotelId: string | null;
}

type DbAppRole = Enums<"app_role">;

const resolveRole = (primaryRole: string | null | undefined, fallbackRole?: string | null): AppRole => {
  return (primaryRole ?? fallbackRole ?? "owner") as AppRole;
};

export async function ensureUserAccessContext(
  userId: string,
  _currentUser: any
): Promise<AccessContext> {
  const [profilesResult, userRoleResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, hotel_id, created_at")
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
  const metadataRole = _currentUser?.user_metadata?.role as string | undefined;

  if (!profile) {
    const bootstrapRole = resolveRole(resolvedRole, metadataRole) as DbAppRole;
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ user_id: userId, role: bootstrapRole });

    if (insertError && insertError.code !== "23505") throw insertError;

    if (!resolvedRole) {
      const { error: userRoleInsertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: bootstrapRole });

      if (userRoleInsertError && userRoleInsertError.code !== "23505") throw userRoleInsertError;
      resolvedRole = bootstrapRole;
    }

    return { role: bootstrapRole, hotelId: null };
  }

  if (!resolvedRole) {
    const fallbackRole = resolveRole(profile.role, metadataRole) as DbAppRole;
    const { error: userRoleInsertError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: fallbackRole });

    if (userRoleInsertError && userRoleInsertError.code !== "23505") throw userRoleInsertError;
    resolvedRole = fallbackRole;
  }

  if (profile.role !== resolvedRole) {
    await supabase
      .from("profiles")
      .update({ role: resolvedRole })
      .eq("user_id", userId);
  }

  return {
    role: resolveRole(resolvedRole, profile.role),
    hotelId: profile.hotel_id,
  };
}
