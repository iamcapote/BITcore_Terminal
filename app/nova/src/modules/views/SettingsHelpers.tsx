/**
 * Why: Isolates provider route data and settings helper components from the main SettingsSurface.
 * What: PROVIDER_ROUTE_MAP constant, ProviderRoute type, and reusable sub-components (PreferencesCard, ApiKeyRow, ConfigSection, ThemeCard, InfoRow).
 * How: Pure presentational components with typed props; no side effects; imported by SettingsSurface.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  Shield,
} from "lucide-react";

/* ── Provider route map ────────────────────────────────────────────── */

export type ProviderRoute = {
  readonly label: string;
  readonly method: "GET" | "POST";
  readonly base: string;
  readonly path: string;
  readonly streaming?: boolean;
};

export const PROVIDER_ROUTE_MAP = {
  openai: [
    { label: "Responses", method: "POST", base: "https://api.openai.com/v1", path: "/responses", streaming: false },
    { label: "Chat Completions", method: "POST", base: "https://api.openai.com/v1", path: "/chat/completions", streaming: true },
    { label: "Models", method: "GET", base: "https://api.openai.com/v1", path: "/models" },
  ],
  openrouter: [
    { label: "Chat Completions", method: "POST", base: "https://openrouter.ai/api/v1", path: "/chat/completions", streaming: true },
    { label: "Completions", method: "POST", base: "https://openrouter.ai/api/v1", path: "/completions", streaming: false },
  ],
  venice: [
    { label: "Chat Completions", method: "POST", base: "https://api.venice.ai/api/v1", path: "/chat/completions", streaming: true },
  ],
  nous: [
    { label: "Chat Completions", method: "POST", base: "https://inference-api.nousresearch.com/v1", path: "/chat/completions", streaming: true },
    { label: "Completions", method: "POST", base: "https://inference-api.nousresearch.com/v1", path: "/completions", streaming: false },
  ],
  morpheus: [
    { label: "Chat Completions", method: "POST", base: "https://api.mor.org/api/v1", path: "/chat/completions", streaming: true },
  ],
  discourse: [
    { label: "Personas (proxy)", method: "GET", base: "https://hub.bitwiki.org/api", path: "/discourse_ai/personas" },
  ],
} as const satisfies Record<string, readonly ProviderRoute[]>;

export type ProviderRouteId = keyof typeof PROVIDER_ROUTE_MAP;

/* ── PreferencesCard ───────────────────────────────────────────────── */

export function PreferencesCard({ title, prefs, onChange, onSave }: {
  title: string;
  prefs: Record<string, unknown>;
  onChange: (n: Record<string, unknown>) => void;
  onSave: () => void;
}) {
  const entries = Object.entries(prefs).filter(([k]) => !k.startsWith("_"));
  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{key}</span>
            {typeof value === "boolean" ? (
              <Switch checked={value} onCheckedChange={(c) => onChange({ ...prefs, [key]: c })} />
            ) : typeof value === "number" ? (
              <Input type="number" className="h-8 w-full sm:w-28" value={value} onChange={(e) => onChange({ ...prefs, [key]: Number(e.target.value) })} />
            ) : typeof value === "string" ? (
              <Input className="h-8 w-full sm:w-48" value={value} onChange={(e) => onChange({ ...prefs, [key]: e.target.value })} />
            ) : (
              <span className="max-w-full break-words text-xs text-muted-foreground">{JSON.stringify(value)}</span>
            )}
          </div>
        ))}
        <div className="flex justify-end pt-2"><Button size="sm" onClick={onSave}><Save className="mr-1 h-4 w-4" /> Save</Button></div>
      </CardContent>
    </Card>
  );
}

/* ── ApiKeyRow ─────────────────────────────────────────────────────── */

export function ApiKeyRow({ id, label, envVar, configured, keyVisibility, toggleKeyVis }: {
  id: string;
  label: string;
  envVar: string;
  configured: boolean;
  keyVisibility: Record<string, boolean>;
  toggleKeyVis: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0">
        <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0"><div className="text-sm font-medium truncate">{label}</div><div className="text-xs text-muted-foreground truncate">{envVar}</div></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={configured ? "default" : "secondary"}>{configured ? "Configured" : "Not Set"}</Badge>
        <Input type={keyVisibility[id] ? "text" : "password"} className="h-8 w-32 sm:w-48" placeholder={configured ? "••••••••••••" : "Enter key"} readOnly={configured} />
        <Button size="icon" variant="ghost" onClick={() => toggleKeyVis(id)} aria-label={keyVisibility[id] ? "Hide" : "Show"}>
          {keyVisibility[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/* ── ConfigSection ─────────────────────────────────────────────────── */

export function ConfigSection({ title, data }: { title: string; data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <details className="group rounded-lg border border-border/60">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="capitalize">{title}</span>
        <Badge variant="outline" className="ml-auto text-[9px]">{entries.length} fields</Badge>
      </summary>
      <div className="space-y-1 border-t border-border/40 px-4 py-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{key}</span>
            <span className="max-w-full break-all font-mono sm:max-w-[60%]">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

/* ── ThemeCard ──────────────────────────────────────────────────────── */

export function ThemeCard({ theme }: { theme: "dark" | "light" | "retro" }) {
  const colors: Record<typeof theme, readonly string[]> = {
    dark: ["#0A0E1A", "#1D2538", "#3B82F6", "#8B5CF6"],
    light: ["#FFFFFF", "#E2E8F0", "#4F46E5", "#0EA5E9"],
    retro: ["#C0C0C0", "#E8E8E8", "#000080", "#808080", "#FFFFFF"],
  };
  const isRetro = theme === "retro";
  return (
    <button
      onClick={() => {
        document.documentElement.setAttribute("data-nova-theme", theme);
        localStorage.setItem("nova.theme", theme);
      }}
      className="rounded-lg border-2 border-border/60 bg-background/60 p-4 text-center transition-colors hover:border-primary"
      style={isRetro ? { boxShadow: "inset 1px 1px 0 #FFFFFF, inset -1px -1px 0 #404040" } : undefined}
      type="button"
    >
      <div className="mb-2 text-sm font-medium capitalize">{theme}</div>
      <div className="flex justify-center gap-1.5">
        {colors[theme].map((color) => (
          <span
            key={`${theme}-${color}`}
            className="h-4 w-4 rounded-full border border-border/60"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </button>
  );
}

/* ── InfoRow ────────────────────────────────────────────────────────── */

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-full break-all font-mono text-xs sm:max-w-[60%]">{value}</span>
    </div>
  );
}
