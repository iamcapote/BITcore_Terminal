/**
 * Why: Agents need autonomous browser access to research, verify, and interact with the web.
 * What: Embedded browser surface with URL bar, navigation controls, and session management.
 * How: Renders an iframe-based browser with address bar; future: proxy through backend Puppeteer/Playwright.
 */

import { FormEvent, useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Chrome,
  ExternalLink,
  Globe,
  Home,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";

/* ── Constants ─────────────────────────────────────────────────────── */

const DEFAULT_HOME = "https://duckduckgo.com";
const HISTORY_LIMIT = 50;

interface HistoryEntry {
  url: string;
  title: string;
  ts: number;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function BrowserSurface(): JSX.Element {
  const [url, setUrl] = useState(DEFAULT_HOME);
  const [addressBar, setAddressBar] = useState(DEFAULT_HOME);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const navigate = useCallback((target: string) => {
    let resolved = target.trim();
    if (!resolved) return;
    if (!/^https?:\/\//i.test(resolved)) {
      resolved = resolved.includes(".") ? `https://${resolved}` : `https://duckduckgo.com/?q=${encodeURIComponent(resolved)}`;
    }
    setUrl(resolved);
    setAddressBar(resolved);
    setLoading(true);
    setHistory((prev) => {
      const next = [...prev, { url: resolved, title: resolved, ts: Date.now() }];
      return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next;
    });
    setHistoryIndex((prev) => prev + 1);
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    navigate(addressBar);
  }, [addressBar, navigate]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    if (prev) {
      setHistoryIndex((i) => i - 1);
      setUrl(prev.url);
      setAddressBar(prev.url);
      setLoading(true);
    }
  }, [history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    if (next) {
      setHistoryIndex((i) => i + 1);
      setUrl(next.url);
      setAddressBar(next.url);
      setLoading(true);
    }
  }, [history, historyIndex]);

  const refresh = useCallback(() => {
    if (iframeRef.current) {
      setLoading(true);
      iframeRef.current.src = url;
    }
  }, [url]);

  const goHome = useCallback(() => navigate(DEFAULT_HOME), [navigate]);

  const openExternal = useCallback(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  const isSecure = url.startsWith("https://");

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden">
      {/* ── Navigation bar ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-muted/20 px-2 py-2 sm:px-3">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={goBack} disabled={historyIndex <= 0} aria-label="Back">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={goForward} disabled={historyIndex >= history.length - 1} aria-label="Forward">
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={refresh} aria-label="Refresh">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 hidden sm:flex" onClick={goHome} aria-label="Home">
          <Home className="h-3.5 w-3.5" />
        </Button>

        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-1.5">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
              {isSecure ? <Lock className="h-3 w-3 text-emerald-400" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
            </div>
            <Input
              value={addressBar}
              onChange={(e) => setAddressBar(e.target.value)}
              className="h-8 pl-8 pr-2 font-mono text-xs"
              placeholder="Enter URL or search..."
              spellCheck={false}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="h-8 shrink-0 text-xs">Go</Button>
        </form>

        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openExternal} aria-label="Open externally">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowHistory((p) => !p)} aria-label="History">
          <Chrome className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Content area ─────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* History sidebar */}
        {showHistory && (
          <div className="absolute inset-y-0 left-0 z-10 w-56 shrink-0 border-r border-border/60 bg-muted/95 backdrop-blur sm:relative sm:w-64 sm:bg-muted/10 sm:backdrop-blur-none">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground">History</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowHistory(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Separator />
            <ScrollArea className="h-full">
              {history.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-0.5 p-1">
                  {[...history].reverse().map((entry, i) => (
                    <button
                      key={`${entry.ts}-${i}`}
                      onClick={() => navigate(entry.url)}
                      className="w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/40"
                      type="button"
                    >
                      <div className="truncate font-medium">{entry.title}</div>
                      <div className="truncate text-muted-foreground">{entry.url}</div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* iframe browser */}
        <div className="flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            src={url}
            title="Agent Browser"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground">
        {isSecure ? <Shield className="h-3 w-3 text-emerald-400" /> : <Globe className="h-3 w-3" />}
        <span className="min-w-0 flex-1 truncate">{url}</span>
        <Badge variant="outline" className="ml-auto text-[9px]">sandbox</Badge>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </div>
    </div>
  );
}
