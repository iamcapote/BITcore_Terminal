/**
 * Why: Establish a reusable localization scaffold for Nova settings and future i18n rollout.
 * What: Stores UI locale, data locale, timezone, and hour-cycle preferences with formatting helpers.
 * How: Uses React context with localStorage persistence and safe normalization at load/update boundaries.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const SUPPORTED_LOCALES = ["en-US", "es-ES", "fr-FR", "de-DE", "pt-BR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type HourCycleMode = "h12" | "h24";

export interface LocalizationSnapshot {
  readonly uiLocale: SupportedLocale;
  readonly dataLocale: SupportedLocale;
  readonly timeZone: string;
  readonly hourCycle: HourCycleMode;
}

interface LocalizationContextValue {
  readonly snapshot: LocalizationSnapshot;
  readonly updateSnapshot: (patch: Partial<LocalizationSnapshot>) => void;
  readonly resetSnapshot: () => void;
  readonly formatDateTime: (value: Date | number | string) => string;
  readonly formatNumber: (value: number) => string;
}

const STORAGE_KEY = "nova.settings.localization.v1";

const DEFAULT_TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

const DEFAULT_SNAPSHOT: LocalizationSnapshot = {
  uiLocale: "en-US",
  dataLocale: "en-US",
  timeZone: DEFAULT_TIME_ZONE,
  hourCycle: "h12",
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeSnapshot(raw: unknown): LocalizationSnapshot {
  const input = raw && typeof raw === "object" ? (raw as Partial<LocalizationSnapshot>) : null;
  const uiLocale = isSupportedLocale(input?.uiLocale) ? input.uiLocale : DEFAULT_SNAPSHOT.uiLocale;
  const dataLocale = isSupportedLocale(input?.dataLocale) ? input.dataLocale : uiLocale;
  const timeZone = isValidTimeZone(input?.timeZone) ? input.timeZone : DEFAULT_SNAPSHOT.timeZone;
  const hourCycle: HourCycleMode = input?.hourCycle === "h24" ? "h24" : "h12";
  return {
    uiLocale,
    dataLocale,
    timeZone,
    hourCycle,
  };
}

function loadSnapshot(): LocalizationSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SNAPSHOT;
    }
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

function persistSnapshot(snapshot: LocalizationSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function LocalizationProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [snapshot, setSnapshot] = useState<LocalizationSnapshot>(() => loadSnapshot());

  useEffect(() => {
    persistSnapshot(snapshot);
    const lang = snapshot.uiLocale.split("-")[0] ?? "en";
    document.documentElement.lang = lang;
  }, [snapshot]);

  const value = useMemo<LocalizationContextValue>(() => {
    return {
      snapshot,
      updateSnapshot: (patch) => {
        setSnapshot((current) => normalizeSnapshot({ ...current, ...patch }));
      },
      resetSnapshot: () => setSnapshot(DEFAULT_SNAPSHOT),
      formatDateTime: (valueInput) => {
        const date = valueInput instanceof Date ? valueInput : new Date(valueInput);
        if (Number.isNaN(date.getTime())) {
          return "Invalid date";
        }
        const hour12 = snapshot.hourCycle === "h12";
        return new Intl.DateTimeFormat(snapshot.dataLocale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: snapshot.timeZone,
          hour12,
        }).format(date);
      },
      formatNumber: (valueInput) => {
        if (!Number.isFinite(valueInput)) {
          return "0";
        }
        return new Intl.NumberFormat(snapshot.dataLocale).format(valueInput);
      },
    };
  }, [snapshot]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useLocalization must be used within LocalizationProvider");
  }
  return context;
}

export const LOCALIZATION_DEFAULTS = DEFAULT_SNAPSHOT;
