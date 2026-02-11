/**
 * Why: Provide a rich theme selector dropdown with default-theme management.
 * What: ThemeSwitcher renders a dropdown with light/dark/retro options and per-option "set as default" actions.
 * How: Map THEME_OPTIONS to DropdownMenuItems with active/default indicators and nested option menus.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ThemeVariant } from "@/modules/layout/shellTypes";
import { Check, Monitor, Moon, MoreHorizontal, Sun, type LucideIcon } from "lucide-react";

/* ── Props ─────────────────────────────────────────────────────────── */

export interface ThemeSwitcherProps {
  readonly theme: ThemeVariant;
  readonly defaultTheme: ThemeVariant;
  readonly onThemeSelect: (theme: ThemeVariant) => void;
  readonly onThemeDefault: (theme: ThemeVariant) => void;
}

/* ── Theme option list ─────────────────────────────────────────────── */

const THEME_OPTIONS: Array<{ readonly id: ThemeVariant; readonly label: string; readonly icon: LucideIcon }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "retro", label: "Retro", icon: Monitor },
];

/* ── Component ─────────────────────────────────────────────────────── */

export function ThemeSwitcher({ theme, defaultTheme, onThemeSelect, onThemeDefault }: ThemeSwitcherProps) {
  const activeOption = THEME_OPTIONS.find((option) => option.id === theme) ?? THEME_OPTIONS[0];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Select theme" className="h-9 w-9">
              <activeOption.icon className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Select theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44 space-y-1">
        {THEME_OPTIONS.map((option) => {
          const isActive = theme === option.id;
          const isDefault = defaultTheme === option.id;
          return (
            <div key={option.id} role="none" className="flex items-center gap-1">
              <DropdownMenuItem
                onSelect={(event) => {
                  if (isActive) {
                    event.preventDefault();
                    return;
                  }
                  onThemeSelect(option.id);
                }}
                className={cn(
                  "flex flex-1 items-center gap-3",
                  isActive && "text-primary",
                  isDefault && !isActive && "text-foreground",
                )}
              >
                <option.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 text-sm font-medium">{option.label}</span>
                {isDefault ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                    Default
                  </Badge>
                ) : null}
                {isActive ? <Check className="h-4 w-4" /> : null}
              </DropdownMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={`Theme options for ${option.label}`}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-44">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onThemeDefault(option.id);
                    }}
                  >
                    Set as default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
