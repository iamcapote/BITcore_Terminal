/**
 * Why: Lightweight node enhancement tool that modernizes semantic_flow's node modal.
 * What: Win95-style dialog with concise enhancement modes and zero provider clutter.
 * How: Applies deterministic content transformations so users can iterate quickly
 *      without adding extra settings pages or requiring model configuration.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wand2 } from "lucide-react";
import type { CanvasNode } from "@/modules/workflow/workflowTypes";

/* ── Props ──────────────────────────────────────────────────────────── */

interface NodeEnhanceDialogProps {
  readonly node: CanvasNode | null;
  readonly onApply: (content: string, notes: string) => void;
}

type EnhanceMode = "improve" | "expand" | "simplify" | "specify";

/* ── Helpers ────────────────────────────────────────────────────────── */

function transformContent(input: string, mode: EnhanceMode): string {
  const source = input.trim();
  if (!source) return "";

  switch (mode) {
    case "expand":
      return [
        source,
        "",
        "Context:",
        "- Define the system boundary and assumptions.",
        "",
        "Implementation:",
        "- Inputs:",
        "- Process:",
        "- Outputs:",
        "",
        "Validation:",
        "- Success criteria:",
        "- Failure handling:",
      ].join("\n");
    case "simplify":
      return source
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `- ${line.replace(/^[-*]\s*/, "")}`)
        .join("\n");
    case "specify":
      return [
        source,
        "",
        "Contract:",
        "- Inputs: explicit schema",
        "- Outputs: deterministic shape",
        "- Errors: typed and actionable",
        "- Time budget: soft 2s, hard 5s",
      ].join("\n");
    case "improve":
    default:
      return [
        source,
        "",
        "Refined guidance:",
        "- Keep this node single-purpose.",
        "- Define measurable completion criteria.",
        "- Document fallback behavior.",
      ].join("\n");
  }
}

/* ── Component ──────────────────────────────────────────────────────── */

export function NodeEnhanceDialog({ node, onApply }: NodeEnhanceDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EnhanceMode>("improve");
  const [draft, setDraft] = useState("");

  const source = node?.content?.trim() || node?.notes?.trim() || "";
  const preview = useMemo(() => transformContent(draft || source, mode), [draft, mode, source]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
        setDraft(source);
        setOpen(true);
      }} disabled={!node}>
        <Wand2 className="mr-1 h-3 w-3" /> Enhance
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0">
          <div style={{ background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff" }}>
            <div className="px-3 py-1.5" style={{ background: "linear-gradient(90deg, #000080, #1084d0)", color: "#fff", fontWeight: 700, fontSize: 12 }}>
              Node Enhancement
            </div>
            <div className="p-3">
              <DialogHeader className="mb-2">
                <DialogTitle className="text-sm">{node?.label ?? "Node"}</DialogTitle>
                <DialogDescription>
                  Improve clarity without adding extra configuration complexity.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold">Mode</label>
                  <Select value={mode} onValueChange={(value) => setMode(value as EnhanceMode)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="improve">Improve</SelectItem>
                      <SelectItem value="expand">Expand</SelectItem>
                      <SelectItem value="simplify">Simplify</SelectItem>
                      <SelectItem value="specify">Specify</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="text-[11px] font-semibold">Input</label>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={10}
                    className="text-xs"
                    placeholder="Type node content to enhance..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold">Enhanced Preview</label>
                  <Textarea
                    value={preview}
                    readOnly
                    rows={15}
                    className="text-xs"
                    style={{ background: "#fff" }}
                  />
                </div>
              </div>

              <DialogFooter className="mt-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const next = preview.trim();
                    onApply(next, next);
                    setOpen(false);
                  }}
                  disabled={!preview.trim()}
                >
                  Apply to Node
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
