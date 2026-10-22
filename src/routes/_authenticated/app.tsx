import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChartPie, List, CreditCard, Percent, CalendarDays, Target, LogOut, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { HouseholdProvider, useHousehold } from "@/lib/household";
import { exampleState, monthLabel, ym } from "@/lib/finance";
import { MonthNav } from "@/components/app/ui-bits";
import { Dashboard } from "@/components/app/Dashboard";
import { Accounts, Debts } from "@/components/app/Accounts";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Split } from "@/components/app/Split";
import { Cashflow } from "@/components/app/Cashflow";
import { Planning } from "@/components/app/Planning";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Painel — Contas do Casal" },
      { name: "description", content: "Painel financeiro do casal." },
      { property: "og:title", content: "Painel — Contas do Casal" },
      { property: "og:description", content: "Painel financeiro do casal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <HouseholdProvider><AppShell /></HouseholdProvider>,
});

const tabs = [
  { id: "inicio", label: "Resumo", icon: ChartPie },
  { id: "contas", label: "Contas", icon: List },
  { id: "dividas", label: "Dívidas", icon: CreditCard },
  { id: "divisao", label: "Divisão", icon: Percent },
  { id: "fluxo", label: "Mês", icon: CalendarDays },
  { id: "plano", label: "Metas", icon: Target },
] as const;

function AppShell() {
  const h = useHousehold();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("inicio");
  const [month, setMonth] = useState(ym(new Date()));

  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); nav({ to: "/auth", replace: true }); };

  if (h.loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!h.householdId || !h.state) return <Onboarding onSignOut={signOut} />;
  const s = h.state;

  return (
    <div className="household-shell">
      <div className="household-frame">
      <header className="household-top">
        <div className="min-w-0">
          <p className="shell-eyebrow">{monthLabel(month)}</p>
          <h1>Contas do Casal</h1>
        </div>
        <div className="household-top-actions">
          {h.members >= 2 && <span className="shell-sync"><span />Sincronizado</span>}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" className="shell-ghost">Recomeçar</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Voltar aos valores de exemplo?</AlertDialogTitle>
                  <AlertDialogDescription>Isso apaga o que vocês dois digitaram, nos dois celulares. Isso não pode ser desfeito.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Manter</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { h.replace(exampleState()); toast.success("Exemplos restaurados."); }}>Voltar</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="space-y-4">
        {s.isExample && (
          <div className="shell-notice">
            <p>Os valores desta página são exemplos. Comece pela aba Contas e troque pelos números de vocês.</p>
            <Button variant="link" onClick={() => h.update((st) => ({ ...st, isExample: false }))}>Entendi</Button>
          </div>
        )}
        <div className="shell-month"><MonthNav month={month} setMonth={setMonth} /></div>
        {tab === "inicio" && <Dashboard month={month} />}
        {tab === "contas" && <Accounts month={month} />}
        {tab === "dividas" && <Debts />}
        {tab === "divisao" && <Split month={month} />}
        {tab === "fluxo" && <Cashflow month={month} />}
        {tab === "plano" && <Planning month={month} />}

        <footer className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm text-muted-foreground">
          <span className="flex flex-wrap items-center gap-2">
            {h.members < 2 ? <>Convide {s.names[1]}: código <b className="text-foreground">{h.inviteCode}</b></> : <>Sincronizado entre {s.names[0]} e {s.names[1]}</>}
            {h.members < 2 && <Button size="icon" variant="ghost" aria-label="Copiar código" onClick={() => { navigator.clipboard.writeText(h.inviteCode ?? ""); toast.success("Código copiado."); }}><Copy className="h-4 w-4" /></Button>}
          </span>
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </footer>
      </main>
      </div>
      <nav className="household-tabbar" aria-label="Seções">{tabs.map((t) => (
        <Button variant="ghost" key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}><t.icon />{t.label}</Button>
      ))}</nav>
    </div>
  );
}

function Onboarding({ onSignOut }: { onSignOut: () => void }) {
  const h = useHousehold();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-soft">
        <div className="flex justify-end"><ThemeToggle /></div>
        <h1 className="text-3xl">Bem-vindos!</h1>
        <div className="space-y-2"><p className="text-sm text-muted-foreground">Primeira pessoa do casal? Crie o espaço de vocês.</p>
          <Button className="w-full" disabled={busy} onClick={() => run(h.create)}>Criar espaço do casal</Button></div>
        <div className="space-y-2 border-t pt-6"><p className="text-sm text-muted-foreground">Recebeu um código de convite? Digite aqui.</p>
          <div className="flex gap-2"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" maxLength={6} />
            <Button variant="outline" disabled={busy || code.length < 6} onClick={() => run(() => h.join(code))}>Entrar</Button></div></div>
        <button className="text-xs text-muted-foreground underline" onClick={onSignOut}>Sair</button>
      </div>
    </div>
  );
}
