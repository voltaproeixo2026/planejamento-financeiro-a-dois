import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exampleState, type AppState } from "./finance";

interface Ctx {
  loading: boolean;
  householdId: string | null;
  inviteCode: string | null;
  members: number;
  state: AppState | null;
  update: (fn: (s: AppState) => AppState) => void;
  create: () => Promise<void>;
  join: (code: string) => Promise<void>;
  replace: (s: AppState) => void;
}
const HouseholdCtx = createContext<Ctx | null>(null);
export const useHousehold = () => {
  const c = useContext(HouseholdCtx);
  if (!c) throw new Error("HouseholdProvider missing");
  return c;
};
export const useAppState = () => {
  const c = useHousehold();
  return { s: c.state!, update: c.update };
};

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [householdId, setId] = useState<string | null>(null);
  const [inviteCode, setCode] = useState<string | null>(null);
  const [members, setMembers] = useState(0);
  const [state, setState] = useState<AppState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setLoading(false);
    const { data: mem } = await supabase.from("household_members").select("household_id").eq("user_id", u.user.id).maybeSingle();
    if (!mem) { setLoading(false); return; }
    const { data: h } = await supabase.from("households").select("*").eq("id", mem.household_id).single();
    const { count } = await supabase.from("household_members").select("*", { count: "exact", head: true }).eq("household_id", mem.household_id);
    if (h) {
      setId(h.id); setCode(h.invite_code); setMembers(count ?? 1);
      const d = h.data as unknown as AppState;
      lastSaved.current = JSON.stringify(d);
      setState(d && d.names ? d : exampleState());
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!householdId) return;
    const ch = supabase.channel(`hh-${householdId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "households", filter: `id=eq.${householdId}` }, (p) => {
        const d = (p.new as { data: AppState }).data;
        const j = JSON.stringify(d);
        if (j !== lastSaved.current) { lastSaved.current = j; setState(d); }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [householdId]);

  const persist = useCallback((s: AppState) => {
    if (!householdId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const j = JSON.stringify(s);
      lastSaved.current = j;
      await supabase.from("households").update({ data: JSON.parse(j) }).eq("id", householdId);
    }, 500);
  }, [householdId]);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => { if (!prev) return prev; const n = fn(prev); persist(n); return n; });
  }, [persist]);
  const replace = useCallback((s: AppState) => { setState(s); persist(s); }, [persist]);

  const create = async () => {
    const { error } = await supabase.rpc("create_household", { _data: JSON.parse(JSON.stringify(exampleState())) });
    if (error) throw error;
    await load();
  };
  const join = async (code: string) => {
    const { error } = await supabase.rpc("join_household", { _code: code });
    if (error) throw error;
    await load();
  };

  return (
    <HouseholdCtx.Provider value={{ loading, householdId, inviteCode, members, state, update, create, join, replace }}>
      {children}
    </HouseholdCtx.Provider>
  );
}
