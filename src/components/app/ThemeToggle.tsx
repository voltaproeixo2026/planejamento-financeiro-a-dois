import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && preference.matches));
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  const toggle = () => {
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    setDark(!dark);
  };
  return <Button variant="outline" size="icon" className="shell-icon" aria-label={dark ? "Ativar modo claro" : "Ativar modo noturno"} title={dark ? "Modo claro" : "Modo noturno"} onClick={toggle}>{dark ? <Sun /> : <Moon />}</Button>;
}