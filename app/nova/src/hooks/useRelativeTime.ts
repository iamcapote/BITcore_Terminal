import { useEffect, useState } from "react";

interface RelativeTimeOptions {
  readonly refreshMs?: number;
  readonly fallback?: string;
}

export function useRelativeTime(timestamp: number | null | undefined, options: RelativeTimeOptions = {}): string {
  const { refreshMs = 1000, fallback = "" } = options;
  const [label, setLabel] = useState(() => formatRelativeTime(timestamp, fallback));

  useEffect(() => {
    setLabel(formatRelativeTime(timestamp, fallback));
    if (timestamp == null || typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => {
      setLabel(formatRelativeTime(timestamp, fallback));
    }, Math.max(500, refreshMs));
    return () => window.clearInterval(interval);
  }, [timestamp, refreshMs, fallback]);

  return label;
}

function formatRelativeTime(timestamp: number | null | undefined, fallback: string): string {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return fallback;
  }
  const now = Date.now();
  const diff = now - timestamp;
  if (!Number.isFinite(diff) || diff < 0) {
    return fallback;
  }
  if (diff < 10_000) {
    return "just now";
  }
  if (diff < 60_000) {
    return `${Math.floor(diff / 1000)}s ago`;
  }
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }
  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}
