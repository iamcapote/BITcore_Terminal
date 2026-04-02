/**
 * Why: Restore original Semantic Flow relation editing ergonomics with a dedicated edge modal.
 * What: Edits operator, condition, label, and weight for a selected workflow relation.
 * How: Uses shared relation metadata and emits a single edge patch on save.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import {
  WORKFLOW_TRANSITION_MODES,
  canConnectPorts,
  type CanvasEdge,
  type CanvasNode,
} from "@/modules/workflow/workflowTypes";
import {
  DEFAULT_RELATION_CONDITION,
  DEFAULT_RELATION_OPERATOR,
  RELATION_CONDITIONS,
  RELATION_OPERATORS,
  getRelationOperatorMeta,
  normalizeRelationOperatorToken,
} from "@/modules/workflow/workflowRelations";

interface WorkflowEdgeDialogProps {
  readonly edge: CanvasEdge | null;
  readonly nodes: CanvasNode[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onUpdate: (edgeId: string, patch: Partial<CanvasEdge>) => void;
}

export function WorkflowEdgeDialog({ edge, nodes, open, onClose, onUpdate }: WorkflowEdgeDialogProps): JSX.Element {
  const NONE_PORT = "__none__";
  const [operator, setOperator] = useState(DEFAULT_RELATION_OPERATOR);
  const [condition, setCondition] = useState(DEFAULT_RELATION_CONDITION);
  const [label, setLabel] = useState("");
  const [weight, setWeight] = useState("1");
  const [sourceHandle, setSourceHandle] = useState("");
  const [targetHandle, setTargetHandle] = useState("");
  const [transitionMode, setTransitionMode] = useState<typeof WORKFLOW_TRANSITION_MODES[number]>("always");
  const [transitionExpression, setTransitionExpression] = useState("");
  const [transitionChannel, setTransitionChannel] = useState("");
  const [portError, setPortError] = useState<string | null>(null);

  useEffect(() => {
    if (!edge) {
      return;
    }
    setOperator(edge.data?.operator || DEFAULT_RELATION_OPERATOR);
    setCondition(edge.data?.condition || DEFAULT_RELATION_CONDITION);
    setLabel(edge.data?.metadata?.label || "");
    setWeight(String(edge.data?.weight ?? 1));
    setSourceHandle(edge.sourceHandle || "");
    setTargetHandle(edge.targetHandle || "");
    setTransitionMode(edge.data?.transition?.mode || "always");
    setTransitionExpression(edge.data?.transition?.expression || "");
    setTransitionChannel(edge.data?.transition?.channel || "");
    setPortError(null);
  }, [edge]);

  const sourceNode = useMemo(() => (edge ? nodes.find((node) => node.id === edge.source) ?? null : null), [nodes, edge]);
  const targetNode = useMemo(() => (edge ? nodes.find((node) => node.id === edge.target) ?? null : null), [nodes, edge]);
  const sourcePortOptions = useMemo(() => {
    if (!sourceNode) return [];
    return sourceNode.ports?.outputs ?? [];
  }, [sourceNode]);
  const targetPortOptions = useMemo(() => {
    if (!targetNode) return [];
    return targetNode.ports?.inputs ?? [];
  }, [targetNode]);
  const selectedSourcePort = useMemo(() => sourcePortOptions.find((port) => port.id === sourceHandle) ?? null, [sourcePortOptions, sourceHandle]);
  const selectedTargetPort = useMemo(() => targetPortOptions.find((port) => port.id === targetHandle) ?? null, [targetPortOptions, targetHandle]);
  const portsCompatible = useMemo(() => {
    if (!selectedSourcePort || !selectedTargetPort) return true;
    return canConnectPorts(selectedSourcePort.type, selectedTargetPort.type);
  }, [selectedSourcePort, selectedTargetPort]);
  const operatorMeta = getRelationOperatorMeta(operator);

  const applyOperatorPreset = (value: string) => {
    setOperator(value);
  };

  const applyConditionPreset = (value: string) => {
    setCondition(value);
  };

  const handleSave = () => {
    if (!edge) {
      return;
    }
    const parsed = Number(weight);
    const nextWeight = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 1;
    const trimmedOperator = operator.trim();
    const trimmedCondition = condition.trim();
    const canonicalOperator = normalizeRelationOperatorToken(trimmedOperator || DEFAULT_RELATION_OPERATOR);
    if (!portsCompatible) {
      setPortError("Selected source/target ports are incompatible.");
      return;
    }
    onUpdate(edge.id, {
      sourceHandle: sourceHandle.trim() && sourceHandle !== NONE_PORT ? sourceHandle : undefined,
      targetHandle: targetHandle.trim() && targetHandle !== NONE_PORT ? targetHandle : undefined,
      data: {
        ...(edge.data || {}),
        operator: trimmedOperator || DEFAULT_RELATION_OPERATOR,
        condition: trimmedCondition || DEFAULT_RELATION_CONDITION,
        weight: nextWeight,
        metadata: {
          ...(edge.data?.metadata || {}),
          label: label.trim(),
        },
        transition: {
          mode: transitionMode,
          expression: transitionExpression.trim(),
          channel: transitionChannel.trim(),
        },
      },
      style: {
        ...(edge.style || {}),
        stroke: getRelationOperatorMeta(canonicalOperator).color,
      },
    });
    setPortError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-lg overflow-hidden p-0">
        <div className="max-h-[calc(100vh-1rem)] overflow-y-auto" style={{ background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff" }}>
          <div className="px-3 py-1.5" style={{ background: "linear-gradient(90deg, #000080, #1084d0)", color: "#fff", fontWeight: 700, fontSize: 12 }}>
            Relation Editor
          </div>
          <div className="p-3">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-sm">
                {(sourceNode?.label || edge?.source || "Source")} → {(targetNode?.label || edge?.target || "Target")}
              </DialogTitle>
              <DialogDescription>{operatorMeta.icon} {operatorMeta.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Operator</label>
                <Input
                  value={operator}
                  onChange={(event) => setOperator(event.target.value)}
                  className="h-8 text-xs"
                  placeholder="Type any operator (e.g., maps_to, validates, derives)"
                />
                <div className="flex flex-wrap gap-1">
                  {RELATION_OPERATORS.map((entry) => {
                    const selected = normalizeRelationOperatorToken(operator) === entry.value;
                    return (
                      <Button
                        key={entry.value}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        className="h-6 px-2 text-[10px]"
                        onClick={() => applyOperatorPreset(entry.value)}
                      >
                        {getRelationOperatorMeta(entry.value).icon} {entry.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Condition</label>
                <Input
                  value={condition}
                  onChange={(event) => setCondition(event.target.value)}
                  className="h-8 text-xs"
                  placeholder="Type any condition (e.g., when_valid, if_match)"
                />
                <div className="flex flex-wrap gap-1">
                  {RELATION_CONDITIONS.map((entry) => {
                    const selected = condition.trim().toLowerCase() === entry;
                    return (
                      <Button
                        key={entry}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        className="h-6 px-2 text-[10px]"
                        onClick={() => applyConditionPreset(entry)}
                      >
                        {entry}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Label override</label>
                <Input value={label} onChange={(event) => setLabel(event.target.value)} className="h-8 text-xs" placeholder="Optional relation label" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Weight (0-1)</label>
                <Input type="number" min="0" max="1" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Transition Mode</label>
                <Select value={transitionMode} onValueChange={(value) => setTransitionMode(value as typeof WORKFLOW_TRANSITION_MODES[number])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_TRANSITION_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Transition Expression</label>
                <Input
                  value={transitionExpression}
                  onChange={(event) => setTransitionExpression(event.target.value)}
                  className="h-8 text-xs"
                  placeholder={transitionMode === "when" || transitionMode === "whenNot" ? "state.score > 0.8" : "Optional"}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">State Channel</label>
                <Input value={transitionChannel} onChange={(event) => setTransitionChannel(event.target.value)} className="h-8 text-xs" placeholder="messages" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Source Port</label>
                <Select value={sourceHandle || NONE_PORT} onValueChange={(value) => { setSourceHandle(value); setPortError(null); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select output port" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_PORT}>Auto</SelectItem>
                    {sourcePortOptions.map((port) => (
                      <SelectItem key={port.id} value={port.id}>{port.label} · {port.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold">Target Port</label>
                <Select value={targetHandle || NONE_PORT} onValueChange={(value) => { setTargetHandle(value); setPortError(null); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select input port" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_PORT}>Auto</SelectItem>
                    {targetPortOptions.map((port) => (
                      <SelectItem key={port.id} value={port.id}>{port.label} · {port.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!portsCompatible ? (
                <p className="text-[10px] text-red-600">Port types are not compatible.</p>
              ) : null}
              {portError ? <p className="text-[10px] text-red-600">{portError}</p> : null}
            </div>

            <DialogFooter className="mt-3">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleSave}>Save Relation</Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
