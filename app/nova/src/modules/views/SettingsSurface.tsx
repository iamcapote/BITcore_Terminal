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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpenCheck,
  ChevronRight,
  Command,
  Globe,
  Key,
  Layers,
  MessageSquare,
  Monitor,
  Palette,
  Route,
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
import {
  PROVIDER_ROUTE_MAP,
  type ProviderRouteId,
  PreferencesCard,
  ApiKeyRow,
  ConfigSection,
  ThemeCard,
  InfoRow,
} from "@/modules/views/SettingsHelpers";
import { LocalizationSettingsCard } from "@/modules/settings/LocalizationSettingsCard";
import { CommandRunnerCard } from "@/modules/command-palette/CommandRunnerCard";
import {
  loadChatDefaults,
  saveChatDefaults,
  type ChatDefaults,
} from "@/modules/chat/chatDefaults";

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

/* ── Surface visibility persistence ────────────────────────────────── */

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
  const [activeRouteProvider, setActiveRouteProvider] = useState<ProviderRouteId>("venice");
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [chatDefaults, setChatDefaults] = useState<ChatDefaults>(() => loadChatDefaults());

  const activeProviderRoutes = PROVIDER_ROUTE_MAP[activeRouteProvider] ?? [];
  const activeRoute = activeProviderRoutes[activeRouteIndex] ?? activeProviderRoutes[0] ?? null;

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

  useEffect(() => {
    if (activeRouteIndex >= activeProviderRoutes.length) {
      setActiveRouteIndex(0);
    }
  }, [activeRouteIndex, activeProviderRoutes.length]);

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

  const handleSaveChatDefaults = useCallback(() => {
    saveChatDefaults(chatDefaults);
    notify("success", "Chat defaults saved");
  }, [chatDefaults, notify]);

  const commandList = Object.values(commands);
  const categories = [...new Set(commandList.map(c => c.category))].sort();
  const configSections = Object.entries(configSnapshot).filter(([, v]) => typeof v === "object" && v !== null);

  if (loading) {
    return (
      <div className="flex h-full w-full justify-center p-4 sm:p-6">
        <div className="w-full space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full justify-center overflow-auto p-3 sm:p-4">
      <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Settings</h2>
          <Badge variant="outline" className="border-emerald-500/40 text-[10px] uppercase text-emerald-400">wired</Badge>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mb-4 flex-wrap gap-1">
            <TabsTrigger value="general" className="text-xs sm:text-sm"><Monitor className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">General</span></TabsTrigger>
            <TabsTrigger value="localization" className="text-xs sm:text-sm"><Globe className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Localization</span></TabsTrigger>
            <TabsTrigger value="chat" className="text-xs sm:text-sm"><MessageSquare className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Chat</span></TabsTrigger>
            <TabsTrigger value="keys" className="text-xs sm:text-sm"><Key className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">API Keys</span></TabsTrigger>
            <TabsTrigger value="providers" className="text-xs sm:text-sm"><Layers className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Providers</span></TabsTrigger>
            <TabsTrigger value="commands" className="text-xs sm:text-sm"><Command className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Commands</span></TabsTrigger>
            <TabsTrigger value="surfaces" className="text-xs sm:text-sm"><Monitor className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Surfaces</span></TabsTrigger>
            <TabsTrigger value="flags" className="text-xs sm:text-sm"><ToggleRight className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Flags</span></TabsTrigger>
            <TabsTrigger value="theme" className="text-xs sm:text-sm"><Palette className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Theme</span></TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm"><Shield className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Security</span></TabsTrigger>
            <TabsTrigger value="about" className="text-xs sm:text-sm"><BookOpenCheck className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">About</span></TabsTrigger>
          </TabsList>

          {/* ── General ──────────────────────────────────────────── */}
          <TabsContent value="general" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <PreferencesCard title="Terminal Preferences" prefs={termPrefs} onChange={setTermPrefs} onSave={handleSaveTermPrefs} />
                <PreferencesCard title="Research Preferences" prefs={researchPrefs} onChange={setResearchPrefs} onSave={handleSaveResearchPrefs} />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Localization (vendor-inspired: chatgpt-ui i18n + settings ergonomics scaffold) ── */}
          <TabsContent value="localization" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <LocalizationSettingsCard />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Chat defaults (vendor-inspired: chatbot-ui workspace-settings + chatgpt-ui ModelParameters) ── */}
          <TabsContent value="chat" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" /> Chat Session Defaults</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">Configure defaults applied to every new chat session. Override per-session in the chat surface.</p>
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Default persona</p>
                        <Input className="h-9 text-xs" value={chatDefaults.persona} onChange={(e) => setChatDefaults((p) => ({ ...p, persona: e.target.value }))} placeholder="bitcore" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Default model</p>
                        <Input className="h-9 text-xs" value={chatDefaults.model} onChange={(e) => setChatDefaults((p) => ({ ...p, model: e.target.value }))} placeholder="qwen3-235b" />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Default temperature</p>
                        <Input type="number" step="0.1" min="0" max="1" className="h-9 text-xs" value={chatDefaults.temperature} onChange={(e) => setChatDefaults((p) => ({ ...p, temperature: Math.min(1, Math.max(0, Number(e.target.value) || 0.7)) }))} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Memory depth</p>
                        <Select value={chatDefaults.memoryDepth} onValueChange={(value) => setChatDefaults((p) => ({ ...p, memoryDepth: value as ChatDefaults["memoryDepth"] }))}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">short</SelectItem>
                            <SelectItem value="medium">medium</SelectItem>
                            <SelectItem value="long">long</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold">Memory enabled by default</p>
                        <p className="text-[10px] text-muted-foreground">New sessions start with memory recall active.</p>
                      </div>
                      <Switch checked={chatDefaults.memoryEnabled} onCheckedChange={(c) => setChatDefaults((p) => ({ ...p, memoryEnabled: c }))} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold">GitHub sync by default</p>
                        <p className="text-[10px] text-muted-foreground">Auto-commit conversation summaries on exit.</p>
                      </div>
                      <Switch checked={chatDefaults.githubSync} onCheckedChange={(c) => setChatDefaults((p) => ({ ...p, githubSync: c }))} />
                    </div>
                    <div className="flex justify-end pt-2"><Button size="sm" onClick={handleSaveChatDefaults}><Save className="mr-1 h-4 w-4" /> Save chat defaults</Button></div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── API Keys ─────────────────────────────────────────── */}
          <TabsContent value="keys" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
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
          <TabsContent value="providers" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4">
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

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Route className="h-4 w-4" /> Router Provider Routes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(PROVIDER_ROUTE_MAP) as ProviderRouteId[]).map((providerId) => {
                        const selected = providerId === activeRouteProvider;
                        return (
                          <Button
                            key={providerId}
                            type="button"
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            onClick={() => {
                              setActiveRouteProvider(providerId);
                              setActiveRouteIndex(0);
                            }}
                            className="capitalize"
                          >
                            {providerId}
                          </Button>
                        );
                      })}
                    </div>

                    <div className="grid gap-2">
                      {activeProviderRoutes.map((route, index) => {
                        const selected = index === activeRouteIndex;
                        return (
                          <button
                            key={`${route.path}-${route.method}-${index}`}
                            type="button"
                            onClick={() => setActiveRouteIndex(index)}
                            className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-left hover:border-primary/40"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Badge variant={selected ? "default" : "secondary"} className="h-5 text-[10px]">
                                {route.method}
                              </Badge>
                              <span className="truncate text-sm">{route.label}</span>
                            </div>
                            {("streaming" in route && route.streaming) ? <Badge variant="outline" className="text-[10px]">stream</Badge> : null}
                          </button>
                        );
                      })}
                    </div>

                    {activeRoute ? (
                      <div className="grid gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Selected route endpoint</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input readOnly value={activeRoute.base} aria-label="API base URL" />
                          <Input readOnly value={activeRoute.path} aria-label="API path" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {activeRoute.method} {("streaming" in activeRoute && activeRoute.streaming) ? "• Streaming enabled" : "• Non-streaming"}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Commands ──────────────────────────────────────────── */}
          <TabsContent value="commands" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <CommandRunnerCard commands={commands} />
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
          <TabsContent value="surfaces" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Surface Visibility</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="mb-3 text-xs text-muted-foreground">Toggle surfaces on/off. Persists in browser storage.</p>
                  {Object.entries(surfaceVis).sort(([a], [b]) => a.localeCompare(b)).map(([id, visible]) => (
                    <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-4 py-2.5">
                      <span className="text-sm font-medium">{id}</span>
                      <Switch checked={visible} onCheckedChange={() => toggleSurface(id)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── Flags ────────────────────────────────────────────── */}
          <TabsContent value="flags" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <Card>
                <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><ToggleRight className="h-4 w-4" /> Feature Flags ({flags.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {flags.map((flag) => (
                    <div key={flag.id} className="flex flex-wrap items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-2.5">
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
          <TabsContent value="theme" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
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
          <TabsContent value="security" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <Card>
                <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /> Security</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <ConfigSection title="security" data={(configSnapshot as Record<string, unknown>)?.security} />
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* ── About ─────────────────────────────────────────────── */}
          <TabsContent value="about" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
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
