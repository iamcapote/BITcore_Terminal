/**
 * Why: Declare the static menu structures for the Nova shell menubar.
 * What: Pre-View and Post-View menu descriptors rendered by ShellMenubar.
 * How: Export readonly arrays of MenuDescriptor consumed by the menubar component.
 */

import type { MenuDescriptor } from "@/modules/layout/shellTypes";

export const PRE_VIEW_MENUS: readonly MenuDescriptor[] = [
  {
    label: "File",
    items: [
      { type: "item", label: "New File" },
      { type: "item", label: "New Workspace" },
      { type: "item", label: "Open…" },
      { type: "separator" },
      { type: "item", label: "Save" },
      { type: "item", label: "Save All" },
      { type: "item", label: "Export Session…" },
    ],
  },
  {
    label: "Edit",
    items: [
      { type: "item", label: "Undo" },
      { type: "item", label: "Redo" },
      { type: "separator" },
      { type: "item", label: "Find" },
      { type: "item", label: "Replace" },
    ],
  },
];

export const POST_VIEW_MENUS: readonly MenuDescriptor[] = [
  {
    label: "Go",
    items: [
      { type: "item", label: "File…" },
      { type: "item", label: "Symbol…" },
      { type: "item", label: "Definition" },
    ],
  },
  {
    label: "Run",
    items: [
      { type: "item", label: "Start" },
      { type: "item", label: "Pause" },
      { type: "item", label: "Stop" },
    ],
  },
  {
    label: "AI",
    items: [
      { type: "item", label: "Open Chat" },
      { type: "item", label: "Suggest Refactor" },
      { type: "item", label: "Planner" },
      { type: "item", label: "MCP Servers" },
      { type: "item", label: "Instruments" },
    ],
  },
  {
    label: "Data",
    items: [
      { type: "item", label: "Vector Stores" },
      { type: "item", label: "Databases" },
      { type: "item", label: "Pipelines" },
    ],
  },
  {
    label: "Tools",
    items: [
      { type: "item", label: "Task Runner" },
      { type: "item", label: "Terminal Profiles" },
      { type: "item", label: "Extensions" },
    ],
  },
  {
    label: "Micro",
    items: [
      { type: "item", label: "Launch Micro Workspace" },
      { type: "item", label: "Show Micro Logs" },
      { type: "item", label: "Reset Micro Session" },
    ],
  },
  {
    label: "Computer",
    items: [
      { type: "item", label: "Open Tool Controls…" },
      { type: "item", label: "Review Guardrails" },
      { type: "item", label: "Audit Logs" },
    ],
  },
  {
    label: "Window",
    items: [
      { type: "item", label: "Toggle Dock" },
      { type: "item", label: "Toggle Wing" },
      { type: "item", label: "Zen Mode" },
    ],
  },
  {
    label: "Help",
    items: [
      { type: "item", label: "Documentation" },
      { type: "item", label: "Keyboard Shortcuts" },
      { type: "item", label: "Report Issue…" },
    ],
  },
];
