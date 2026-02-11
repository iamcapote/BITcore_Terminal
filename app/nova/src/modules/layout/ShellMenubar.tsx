/**
 * Why: Render the full Nova menubar with File, Edit, View (theme + layout), and domain menus.
 * What: ShellMenubar composes pre-view menus, the dynamic View menu, and post-view menus.
 * How: Iterate MenuDescriptor arrays via ShellMenu; render View inline with theme/layout sub-menus.
 */

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { PRE_VIEW_MENUS, POST_VIEW_MENUS } from "@/modules/layout/shellMenuData";
import { LAYOUT_DIMENSIONS, type MenuDescriptor, type ThemeVariant } from "@/modules/layout/shellTypes";
import type { LayoutPreset } from "@/stores/uiStore";

/* ── Props ─────────────────────────────────────────────────────────── */

interface ShellMenubarProps {
  readonly theme: ThemeVariant;
  readonly layoutPreset: LayoutPreset;
  readonly onThemeSelect: (theme: ThemeVariant) => void;
  readonly onLayoutPresetChange: (preset: LayoutPreset) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function ShellMenubar({ theme, layoutPreset, onThemeSelect, onLayoutPresetChange }: ShellMenubarProps) {
  return (
    <Menubar className="border-none bg-transparent p-0">
      {PRE_VIEW_MENUS.map((menu) => (
        <ShellMenu key={menu.label} descriptor={menu} />
      ))}
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>Theme</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarCheckboxItem checked={theme === "dark"} onCheckedChange={() => onThemeSelect("dark")}>
                Dark
              </MenubarCheckboxItem>
              <MenubarCheckboxItem checked={theme === "light"} onCheckedChange={() => onThemeSelect("light")}>
                Light
              </MenubarCheckboxItem>
              <MenubarCheckboxItem checked={theme === "retro"} onCheckedChange={() => onThemeSelect("retro")}>
                Retro
              </MenubarCheckboxItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Layout Preset</MenubarSubTrigger>
            <MenubarSubContent>
              {(Object.keys(LAYOUT_DIMENSIONS) as LayoutPreset[]).map((preset) => (
                <MenubarCheckboxItem
                  key={preset}
                  checked={layoutPreset === preset}
                  onCheckedChange={() => onLayoutPresetChange(preset)}
                >
                  {presetLabel(preset)}
                </MenubarCheckboxItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem>Toggle Status Bar</MenubarItem>
          <MenubarItem>Enter Focus Mode</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      {POST_VIEW_MENUS.map((menu) => (
        <ShellMenu key={menu.label} descriptor={menu} />
      ))}
    </Menubar>
  );
}

/* ── Generic menu renderer ─────────────────────────────────────────── */

function ShellMenu({ descriptor }: { readonly descriptor: MenuDescriptor }) {
  return (
    <MenubarMenu>
      <MenubarTrigger>{descriptor.label}</MenubarTrigger>
      <MenubarContent>
        {descriptor.items.map((item, index) => {
          if (item.type === "separator") return <MenubarSeparator key={`${descriptor.label}-sep-${index}`} />;
          return (
            <MenubarItem key={`${descriptor.label}-item-${index}`} className="flex items-center justify-between gap-4">
              <span>{item.label}</span>
            </MenubarItem>
          );
        })}
      </MenubarContent>
    </MenubarMenu>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function presetLabel(preset: LayoutPreset): string {
  switch (preset) {
    case "studio":
      return "Studio";
    case "analysis":
      return "Analysis";
    case "focus":
      return "Focus";
    default:
      return preset;
  }
}
