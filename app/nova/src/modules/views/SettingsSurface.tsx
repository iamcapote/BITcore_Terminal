/**
 * Why: Central admin panel where operators toggle, configure, and control every surface, flag, preference, and command.
 * What: Tabbed settings UI wired to /api/commands, /api/config, /api/preferences/*, and /api/models/venice.
 * How: Fetches real data on mount, renders dynamic sections, persists changes via PATCH endpoints and localStorage.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpenCheck,
  ChevronRight,
  Command,
  Eye,
  EyeOff,
  Key,
  Layers,
  Monitor,
  Palette,
  Save,
  Settings,
  Shield,
  ToggleRight,
} from "lucide-react";
import { useNotifications } from "@/modules/notifications/NotificationProvider";
import {
  fetchCliMetadata,
  fetchConfig,
  fetchTerminalPreferences,
  fetchResearchPreferences,
  fetchVeniceModels,
  updateTerminalPreferences,
  updateResearchPreferences,
  type CliCommand,
  type FeatureFlag,
  type VeniceModel,
} from "@/modules/admin/adminClient";

/* ── Surface visibility persistence ────────────────────────────────── */

const SURFACE_VIS_KEY = "nova.admin.surfaceVisibility";

function loadSurfaceVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SURFACE_VIS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSurfaceVisibility(vis: Record<string, boolean>) {
  localStorage.setItem(SURFACE_VIS_KEY, JSON.stringify(vis));
}

/* ── Component ─────────────────────────────────────────────────────── */

export function SettingsSurface(): JSX.Element {
  const [tab, setTab] = useState("general");
  const { notify } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [commands, setCommands] = useState<Record<string, CliCommand>>({});
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [configSnapshot, setConfigSnapshot] = useState<Record<string, unknown>>({});
  const [models, setModels] = useState<VeniceModel[]>([]);
  const [termPrefs, setTermPrefs] = useState<Record<string, unknown>>({});
  const [researchPrefs, setResearchPrefs] = useState<Record<string, unknown>>({});
  const [surfaceVis, setSurfaceVis] = useState<Record<string, boolean>>(() => loadSurfaceVisibility());
  const [keyVisibility, setKeyVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const results = await Promise.allSettled([
        fetchCliMetadata(),
        fetchConfig(),
        fetchTerminalPreferences(),
        fetchResearchPreferences(),
        fetchVeniceModels(),
      ]);
      if (cancelled) return;
      if (results[0].status === "fulfilled") setCommands(results[0].value.commands);
      if (results[1].status === "fulfilled") {
        setFlags(results[1].value.featureFlags);
        setConfigSnapshot(results[1].value.config);
        const defaults = results[1].value.surfaceDefaults;
        setSurfaceVis((prev) => {
          const merged = { ...defaults, ...prev };
          saveSurfaceVisibility(merged);
          return merged;
        });
      }
      if (results[2].status === "fulfilled") setTermPrefs(results[2].value);
      if (results[3].status === "fulfilled") setResearchPrefs(results[3].value);
      if (results[4].status === "fulfilled") setModels(results[4].value);
      const failCount = results.filter(r => r.status === "rejected").length;
      if (failCount > 0 && failCount < results.length) {
        notify("warning", "Partial settings load", `${failCount} endpoint(s) unreachable.`);
      } else if (failCount === results.length) {
        notify("error", "Settings load failed", "Could not reach any settings endpoint.");
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [notify]);

  const handleSaveTermPrefs = useCallback(async () => {
    try {
      const updated = await updateTerminalPreferences(termPrefs as Record<string, unknown>);
      setTermPrefs(updated);
      notify("success", "Terminal preferences saved");
    } catch (e) { notify("error", "Save failed", e instanceof Error ? e.message : String(e)); }
  }, [termPrefs, notify]);

  const handleSaveResearchPrefs = useCallback(async () => {
    try {
      const updated = await updateResearchPreferences(researchPrefs as Record<string, unknown>);
      setResearchPrefs(updated);
      notify("success", "Research preferences saved");
    } catch (e) { notify("error", "Save failed", e instanceof Error ? e.message : String(e)); }
  }, [researchPrefs, notify]);

  const toggleSurface = useCallback((id: string) => {
    setSurfaceVis((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveSurfaceVisibility(next);
      return next;
    });
  }, []);

  const toggleKeyVis = useCallback((id: string) => {
    setKeyVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const commandList = Object.values(commands);
  const categories = [...new Set(commandList.map(c => c.category))].sort();
  const configSections = Object.entries(configSnapshot).filter(([, v]) => typeof v === "object" && v !== null);

  if (loading) {
    return (
      <div className="flex h-full w-full justify-center p-6">
        <div className="w-full max-w-4xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full justify-center overflow-auto p-4">
      <div className="w-full max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Settings</h2>
          <Badge variant="outline" className="border-emerald-500/40 text-[10px] uppercase text-emerald-400">wired</Badge>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="general"><Monitor className="mr-1 h-3.5 w-3.5" />General</TabsTrigger>
            <TabsTrigger value="keys"><Key className="mr-1 h-3.5 w-3.5" />API Keys</TabsTrigger>
            <TabsTrigger value="providers"><Layers className="mr-1 h-3.5 w-3.5" />Providers</TabsTrigger>
            <TabsTrigger value="commands"><Command className="mr-1 h-3.5 w-3.5" />Commands</TabsTrigger>
            <TabsTrigger value="surfaces"><Monitor className="mr-1 h-3.5 w-3.5" />Surfaces</TabsTrigger>
            <TabsTrigger value="flags"><ToggleRight className="mr-1 h-3.5 w-3.5" />Flags</TabsTrigger>
            <TabsTrigger value="theme"><Palette className="mr-1 h-3.5 w-3.5" />Theme</TabsTrigger>
            <TabsTrigger value="security"><Shield className="mr-1 h-3.5 w-3.5" />Security</TabsTrigger>
            <TabsTrigger value="about"><BookOpenCheck className="mr-1 h-3.5 w-3.5" />About</TabsTrigger>
          </TabsList>

          {/* ── General ──────────────────────────────────────────── */}
          <TabsContent value="general">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <div className="space-y-4">
                <PreferencesCard title="Terminal Preferences" prefs={termPrefs} onChange={setTermPrefs} onSave={handleSaveTermPrefs} />
                <PreferencesCard title="Research Preferences" prefs={researchPrefs} onChange={setResearchPrefs} onSave={handleSaveResearchPrefs} />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── API Keys ─────────────────────────────────────────── */}
          <TabsContent value="keys">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <Card>
                <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Key className="h-4 w-4" /> API Key Management</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <ApiKeyRow id="venice" label="Venice AI" envVar="VENICE_API_KEY" configured={Boolean((configSnapshot as Record<string, Record<string, unknown>>)?.venice?.apiKey)} keyVisibility={keyVisibility} toggleKeyVis={toggleKeyVis} />
                  <ApiKeyRow id="brave" label="Brave Search" envVar="BRAVE_API_KEY" configured={Boolean((configSnapshot as Record<string, Record<string, unknown>>)?.brave?.apiKey)} keyVisibility={keyVisibility} toggleKeyVis={toggleKeyVis} />
                  <ApiKeyRow id="github" label="GitHub Token" envVar="GITHUB_TOKEN" configured={false} keyVisibility={keyVisibility} toggleKeyVis={toggleKeyVis} />
                  <Separator />
                  <p className="text-xs text-muted-foreground">Keys stored via encrypted-config.store. Never exposed in logs. Masked values show ••••••••.</p>
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── Providers ────────────────────────────────────────── */}
          <TabsContent value="providers">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Venice Models ({models.length})</CardTitle></CardHeader>
                <CardContent>
                  {models.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No models loaded. Check Venice API key.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {models.map((m) => (
                        <div key={m.id} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                          <p className="text-sm font-medium">{m.id}</p>
                          {m.owned_by ? <p className="text-xs text-muted-foreground">{m.owned_by}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── Commands ──────────────────────────────────────────── */}
          <TabsContent value="commands">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{commandList.length} commands in {categories.length} categories.</p>
                {categories.map((cat) => (
                  <Card key={cat}>
                    <CardHeader className="py-3"><CardTitle className="text-sm capitalize">{cat}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {commandList.filter(c => c.category === cat).map((cmd) => (
                        <details key={cmd.id} className="group rounded-lg border border-border/60 bg-background/60">
                          <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                            <code className="font-mono text-xs">/{cmd.id}</code>
                            <span className="text-muted-foreground">— {cmd.description}</span>
                            {cmd.requiresAuth ? <Badge variant="secondary" className="ml-auto text-[9px]">auth</Badge> : null}
                          </summary>
                          <div className="space-y-2 border-t border-border/40 px-4 py-3 text-xs">
                            <p><span className="font-semibold">Signature:</span> <code>{cmd.signature}</code></p>
                            <p><span className="font-semibold">Example:</span> <code>{cmd.example}</code></p>
                            {cmd.flags.length > 0 ? (
                              <div>
                                <span className="font-semibold">Flags:</span>
                                <ul className="mt-1 list-disc pl-5">{cmd.flags.map((f) => (<li key={f.name}><code>--{f.name}</code> ({f.type}){f.required ? " — required" : ""}</li>))}</ul>
                              </div>
                            ) : null}
                            {cmd.subcommands.length > 0 ? (
                              <div>
                                <span className="font-semibold">Subcommands:</span>
                                <ul className="mt-1 list-disc pl-5">{cmd.subcommands.map((s) => (<li key={s.name}><code>{s.name}</code>{s.description ? ` — ${s.description}` : ""}</li>))}</ul>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Surfaces ──────────────────────────────────────────── */}
          <TabsContent value="surfaces">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Surface Visibility</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="mb-3 text-xs text-muted-foreground">Toggle surfaces on/off. Persists in browser storage.</p>
                  {Object.entries(surfaceVis).sort(([a], [b]) => a.localeCompare(b)).map(([id, visible]) => (
                    <div key={id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-2.5">
                      <span className="text-sm font-medium">{id}</span>
                      <Switch checked={visible} onCheckedChange={() => toggleSurface(id)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── Flags ────────────────────────────────────────────── */}
          <TabsContent value="flags">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <Card>
                <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><ToggleRight className="h-4 w-4" /> Feature Flags ({flags.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {flags.map((flag) => (
                    <div key={flag.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{flag.label}</span>
                          <Badge variant="outline" className="text-[9px]">{flag.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{flag.description}</p>
                      </div>
                      <Badge variant={flag.enabled ? "default" : "secondary"} className="ml-3 shrink-0">{flag.enabled ? "On" : "Off"}</Badge>
                    </div>
                  ))}
                  <Separator />
                  <p className="text-xs text-muted-foreground">Flags reflect server config. Toggle via env vars or overlay.</p>
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── Theme ────────────────────────────────────────────── */}
          <TabsContent value="theme">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <Card>
                <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Palette className="h-4 w-4" /> Theme Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["dark", "light", "retro"] as const).map((t) => (<ThemeCard key={t} theme={t} />))}
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground">Theme via CSS custom properties on <code>data-nova-theme</code>.</p>
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── Security ──────────────────────────────────────────── */}
          <TabsContent value="security">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <Card>
                <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /> Security</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <ConfigSection title="security" data={(configSnapshot as Record<string, unknown>)?.security} />
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── About ─────────────────────────────────────────────── */}
          <TabsContent value="about">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">System Information</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <InfoRow label="Platform" value="BITcore Terminal — Nova IDE" />
                    <InfoRow label="Commands" value={`${commandList.length} registered`} />
                    <InfoRow label="Models" value={`${models.length} available`} />
                    <InfoRow label="Feature Flags" value={`${flags.length} (${flags.filter(f => f.enabled).length} active)`} />
                  </CardContent>
                </Card>
                {configSections.length > 0 ? (
                  <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm">Runtime Config Overview</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {configSections.map(([key, value]) => (<ConfigSection key={key} title={key} data={value} />))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function PreferencesCard({ title, prefs, onChange, onSave }: { title: string; prefs: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void; onSave: () => void }) {
  const entries = Object.entries(prefs).filter(([k]) => !k.startsWith("_"));
  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{key}</span>
            {typeof value === "boolean" ? (
              <Switch checked={value} onCheckedChange={(c) => onChange({ ...prefs, [key]: c })} />
            ) : typeof value === "number" ? (
              <Input type="number" className="h-8 w-28" value={value} onChange={(e) => onChange({ ...prefs, [key]: Number(e.target.value) })} />
            ) : typeof value === "string" ? (
              <Input className="h-8 w-48" value={value} onChange={(e) => onChange({ ...prefs, [key]: e.target.value })} />
            ) : (
              <span className="text-xs text-muted-foreground">{JSON.stringify(value)}</span>
            )}
          </div>
        ))}
        <div className="flex justify-end pt-2"><Button size="sm" onClick={onSave}><Save className="mr-1 h-4 w-4" /> Save</Button></div>
      </CardContent>
    </Card>
  );
}

function ApiKeyRow({ id, label, envVar, configured, keyVisibility, toggleKeyVis }: { id: string; label: string; envVar: string; configured: boolean; keyVisibility: Record<string, boolean>; toggleKeyVis: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{envVar}</div></div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={configured ? "default" : "secondary"}>{configured ? "Configured" : "Not Set"}</Badge>
        <Input type={keyVisibility[id] ? "text" : "password"} className="h-8 w-48" placeholder={configured ? "••••••••••••" : "Enter key"} readOnly={configured} />
        <Button size="icon" variant="ghost" onClick={() => toggleKeyVis(id)} aria-label={keyVisibility[id] ? "Hide" : "Show"}>
          {keyVisibility[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ConfigSection({ title, data }: { title: string; data: unknown }) {
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
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{key}</span>
            <span className="max-w-[60%] truncate font-mono">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function ThemeCard({ theme }: { theme: "dark" | "light" | "retro" }) {
  const colors: Record<string, string[]> = {
    dark: ["bg-zinc-900", "bg-zinc-700", "bg-emerald-500"],
    light: ["bg-white", "bg-gray-300", "bg-blue-500"],
    retro: ["bg-amber-900", "bg-amber-600", "bg-green-400"],
  };
  return (
    <button onClick={() => { document.documentElement.setAttribute("data-nova-theme", theme); localStorage.setItem("nova.theme", theme); }} className="rounded-lg border-2 border-border/60 bg-background/60 p-4 text-center transition-colors hover:border-primary" type="button">
      <div className="mb-2 text-sm font-medium capitalize">{theme}</div>
      <div className="flex justify-center gap-1">{colors[theme].map((c, i) => (<div key={i} className={`h-4 w-4 rounded-full ${c}`} />))}</div>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono text-xs">{value}</span></div>);
}
