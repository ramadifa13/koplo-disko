/* oxlint-disable react/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { Capabilities, Profile } from "../../types/domain";
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  capabilities: Capabilities | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
};
type ProfileRpcRow = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: "owner" | "manager" | "member";
};
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    // Jangan menahan layar pembuka terlalu lama jika pemulihan sesi terhambat.
    const loadingTimeout = window.setTimeout(() => setLoading(false), 3500);
    let requestId = 0;
    const load = async (next: Session | null) => {
      const currentRequest = ++requestId;
      setSession(next);
      if (!next) {
        setProfile(null);
        setCapabilities(null);
        queryClient.clear();
        setLoading(false);
        return;
      }
      const [profileResult, capabilityResult] = await Promise.all([
        client.rpc("get_my_profile").single(),
        client.rpc("get_my_capabilities"),
      ]);
      if (currentRequest !== requestId) return;
      if (profileResult.error || capabilityResult.error) {
        setProfile(null);
        setCapabilities(null);
        setLoading(false);
        return;
      }
      const row = profileResult.data as ProfileRpcRow | null;
      const rawRole = row?.role;
      setProfile(
        row
          ? {
              id: row.id,
              full_name: row.full_name,
              email: row.email,
              is_active: row.is_active,
              role:
                rawRole === "owner" || rawRole === "manager"
                  ? rawRole
                  : "member",
            }
          : null,
      );
      setCapabilities(capabilityResult.data as Capabilities);
      setLoading(false);
    };
    void client.auth.getSession().then(({ data }) => load(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      // Hindari query Supabase dari dalam callback Auth. Menundanya satu task
      // mencegah lock internal yang dapat membuat profil tampak tidak tersedia.
      window.setTimeout(() => void load(next), 0);
    });
    return () => {
      window.clearTimeout(loadingTimeout);
      data.subscription.unsubscribe();
    };
  }, [queryClient]);
  const value = useMemo(
    () => ({
      session,
      profile,
      capabilities,
      loading,
      configured: isSupabaseConfigured,
      signOut: async () => {
        await supabase?.auth.signOut();
        queryClient.clear();
      },
    }),
    [session, profile, capabilities, loading, queryClient],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth harus berada di dalam AuthProvider");
  return value;
}
