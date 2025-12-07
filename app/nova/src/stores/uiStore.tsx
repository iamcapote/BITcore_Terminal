import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";

export type ThemeMode = "dark" | "light";
export type LayoutPreset = "studio" | "analysis" | "focus";
export type DensityPreset = "cozy" | "comfortable" | "compact";

interface UiStoreState {
  readonly theme: ThemeMode;
  readonly layoutPreset: LayoutPreset;
  readonly density: DensityPreset;
  readonly showStatusBar: boolean;
  setTheme: (theme: ThemeMode) => void;
  setLayoutPreset: (preset: LayoutPreset) => void;
  setDensity: (density: DensityPreset) => void;
  toggleStatusBar: (value?: boolean) => void;
}

const UiContext = createContext<UiStoreState | undefined>(undefined);

export function UiProvider({ children }: PropsWithChildren): JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("studio");
  const [density, setDensity] = useState<DensityPreset>("comfortable");
  const [showStatusBar, setShowStatusBar] = useState(true);

  const toggleStatusBar = useCallback((value?: boolean) => {
    setShowStatusBar((prev) => (typeof value === "boolean" ? value : !prev));
  }, []);

  const value = useMemo<UiStoreState>(
    () => ({ theme, layoutPreset, density, showStatusBar, setTheme, setLayoutPreset, setDensity, toggleStatusBar }),
    [theme, layoutPreset, density, showStatusBar, toggleStatusBar],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUiStore(): UiStoreState {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error("useUiStore must be used within a UiProvider");
  }
  return context;
}
