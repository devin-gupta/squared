export async function aiRequestHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import("@/lib/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to use AI entry.");
  return { Authorization: `Bearer ${session.access_token}` };
}
