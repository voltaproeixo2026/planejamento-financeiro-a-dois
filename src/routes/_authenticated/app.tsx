import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Home, Wallet, Scale, ArrowLeftRight, LineChart, LogOut, RotateCcw, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { HouseholdProvider, useHousehold } from "@/lib/household";
import { emptyState, exampleState, ym } from "@/lib/finance";
import { MonthNav } from "@/components/app/ui-bits";
import { Dashboard } from "@/components/app/Dashboard";
import { Accounts } from "@/components/app/Accounts";
import { Split } from "@/components/app/Split";
import { Cashflow } from "@/components/app/Cashflow";
import { Planning } from "@/components/app/Planning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Painel — Contas do Casal" },
      { name: "description", content: "Painel financeiro do casal." },
      { property: "og:title", content: "Painel — Contas do Casal" },
      { property: "og:description", content: "Painel financeiro do casal." },
    ],
  }),
  component: () => <HouseholdProvider><AppShell /></HouseholdProvider>,
});

const tabs = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "contas", label: "Contas", icon: Wallet },
  { id: "divisao", label: "Divisão", icon: Scale },
  { id: "fluxo", label: "Fluxo", icon: ArrowLeftRight },
  { id: "plano", label: "Planejamento", icon: LineChart },
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
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="font-display text-xl">Contas do Casal</span>
          <nav className="hidden gap-1 md:flex">{tabs.map((t) => (
            <Button key={t.id} variant={tab === t.id ? "default" : "ghost"} size="sm" onClick={() => setTab(t.id)}><t.icon className="h-4 w-4" />{t.label}</Button>
          ))}</nav>
          <div className="flex items-center gap-1">
            <MonthNav month={month} setMonth={setMonth} />
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {s.isExample && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning bg-warning/15 p-4 text-sm">
            <span><b>Dados de exemplo.</b> Os valores mostrados são fictícios — substitua pelos de vocês.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => h.update((st) => ({ ...st, isExample: false }))}>Manter e editar</Button>
              <Button size="sm" onClick={() => { h.replace(emptyState(s.names)); toast.success("Pronto! Comece cadastrando suas rendas em Contas."); setTab("contas"); }}>Começar do zero</Button>
            </div>
          </div>
        )}
        {tab === "inicio" && <Dashboard month={month} />}
        {tab === "contas" && <Accounts month={month} />}
        {tab === "divisao" && <Split month={month} />}
        {tab === "fluxo" && <Cashflow month={month} />}
        {tab === "plano" && <Planning month={month} />}

        <footer className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            {h.members < 2 ? <>Convide {s.names[1]}: código <b className="text-foreground">{h.inviteCode}</b></> : <>Sincronizado entre {s.names[0]} e {s.names[1]}</>}
            {h.members < 2 && <Button size="icon" variant="ghost" aria-label="Copiar código" onClick={() => { navigator.clipboard.writeText(h.inviteCode ?? ""); toast.success("Código copiado."); }}><Copy className="h-4 w-4" /></Button>}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm"><RotateCcw className="h-4 w-4" />Restaurar exemplos</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Apagar os dados do casal?</AlertDialogTitle>
                <AlertDialogDescription>Todos os dados inseridos por {s.names[0]} e {s.names[1]} serão apagados e substituídos pelos valores de exemplo. Isso não pode ser desfeito.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { h.replace(exampleState()); toast.success("Exemplos restaurados."); }}>Sim, apagar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </footer>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-card md:hidden">{tabs.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", tab === t.id ? "text-primary" : "text-muted-foreground")}><t.icon className="h-5 w-5" />{t.label}</button>
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
