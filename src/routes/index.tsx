import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Heart, Wallet, CalendarClock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Contas do Casal — planejamento financeiro a dois" },
      { name: "description", content: "Divida despesas, acompanhe dívidas, a conta conjunta e planeje os próximos meses juntos." },
      { property: "og:title", content: "Contas do Casal" },
      { property: "og:description", content: "Planejamento financeiro a dois, sincronizado entre os celulares." },
    ],
  }),
  component: Index,
});

function Index() {
  const features = [
    { icon: Wallet, t: "Divisão justa", d: "Quanto cada um transfere, em cada recebimento." },
    { icon: CalendarClock, t: "Vencimentos", d: "Contas fixas e parcelas aparecem sozinhas no mês certo." },
    { icon: TrendingUp, t: "Próximos meses", d: "Projeções e simulação da renda autônoma." },
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <Heart className="mb-6 h-10 w-10 text-person-a" />
      <h1 className="text-5xl leading-tight md:text-6xl">Contas do Casal</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">Organizem a vida financeira a dois com clareza e tranquilidade — cada um no seu celular, os mesmos dados.</p>
      <div className="mt-8"><Button asChild size="lg"><Link to="/app">Entrar no app</Link></Button></div>
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="rounded-2xl border bg-card p-6 shadow-soft">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 text-xl">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
