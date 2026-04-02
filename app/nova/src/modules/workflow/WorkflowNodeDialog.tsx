/**
 * Why: Bring back original node settings UX where full node editing happens in a dedicated modal.
 * What: Edits node label/notes/content and lists connected relations with quick edge-editor actions.
 * How: Tracks local draft state and emits one update payload plus optional duplicate/delete actions.
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import {
  CANVAS_FIELD_TYPES,
  CANVAS_PORT_TYPES,
  CORE_CANVAS_FIELD_NAMES,
  normalizeCanvasField,
  normalizeCanvasPort,
  WORKFLOW_NODE_ROLES,
  type CanvasEdge,
  type CanvasField,
  type CanvasNode,
  type CanvasPort,
  type WorkflowNodeRole,
} from "@/modules/workflow/workflowTypes";
import { getRelationOperatorMeta } from "@/modules/workflow/workflowRelations";
import { isSchemaNode, schemaKindForNode, type SchemaNodeKind } from "@/modules/workflow/workflowSchemaGraph";

interface WorkflowNodeDialogProps {
  readonly node: CanvasNode | null;
  readonly nodes: CanvasNode[];
  readonly edges: CanvasEdge[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onUpdate: (nodeId: string, patch: Partial<CanvasNode>) => void;
  readonly onDuplicate: (nodeId: string) => void;
  readonly onDelete: (nodeId: string) => void;
  readonly onOpenEdge: (edgeId: string) => void;
  readonly onCreateChild: (nodeId: string, kind: SchemaNodeKind) => void;
}

interface EditableFieldDraft {
  readonly id: string;
  name: string;
  type: CanvasField["type"];
  value: string;
  optionsText: string;
}

interface EditablePortDraft {
  readonly id: string;
  portId: string;
  type: CanvasPort["type"];
  label: string;
}

function makeFieldDraft(field: CanvasField, index: number): EditableFieldDraft {
  return {
    id: `field-${index}-${Date.now()}`,
    name: field.name,
    type: field.type,
    value: typeof field.value === "string" ? field.value : JSON.stringify(field.value),
    optionsText: Array.isArray(field.options) ? field.options.join(", ") : "",
  };
}

function makePortDraft(port: CanvasPort, index: number): EditablePortDraft {
  return {
    id: `port-${index}-${Date.now()}`,
    portId: port.id,
    type: port.type,
    label: port.label,
  };
}

export function WorkflowNodeDialog({
  node,
  nodes,
  edges,
  open,
  onClose,
  onUpdate,
  onDuplicate,
  onDelete,
  onOpenEdge,
  onCreateChild,
}: WorkflowNodeDialogProps): JSX.Element {
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [content, setContent] = useState("");
  const [schemaKey, setSchemaKey] = useState("");
  const [schemaValueType, setSchemaValueType] = useState<"string" | "number" | "boolean" | "null">("string");
  const [schemaValue, setSchemaValue] = useState("");
  const [language, setLanguage] = useState<"markdown" | "json" | "yaml" | "xml">("markdown");
  const [customFields, setCustomFields] = useState<EditableFieldDraft[]>([]);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [isExecutable, setIsExecutable] = useState<"true" | "false">("true");
  const [requiresInput, setRequiresInput] = useState<"true" | "false">("false");
  const [maxInputs, setMaxInputs] = useState("");
  const [maxOutputs, setMaxOutputs] = useState("");
  const [inputPorts, setInputPorts] = useState<EditablePortDraft[]>([]);
  const [outputPorts, setOutputPorts] = useState<EditablePortDraft[]>([]);
  const [portsError, setPortsError] = useState<string | null>(null);
  const [workflowRole, setWorkflowRole] = useState<WorkflowNodeRole | "none">("none");
  const [stateInputsText, setStateInputsText] = useState("");
  const [stateOutputsText, setStateOutputsText] = useState("");

  useEffect(() => {
    if (!node) {
      return;
    }
    setLabel(node.label);
    setNotes(node.notes);
    setContent(node.content);
    setSchemaKey(node.schemaKey || node.label || "");
    setSchemaValueType(node.schemaValueType || "string");
    setSchemaValue(node.schemaValue || node.content || "");
    setLanguage(node.language || "markdown");
    const baseFields = (node.fields || [])
      .filter((field) => !CORE_CANVAS_FIELD_NAMES.includes(field.name as typeof CORE_CANVAS_FIELD_NAMES[number]));
    setCustomFields(baseFields.map((field, index) => makeFieldDraft(field, index)));
    setFieldsError(null);
    setIsExecutable(node.config?.isExecutable === false ? "false" : "true");
    setRequiresInput(node.config?.requiresInput ? "true" : "false");
    setMaxInputs(node.config?.maxInputs == null ? "" : String(node.config.maxInputs));
    setMaxOutputs(node.config?.maxOutputs == null ? "" : String(node.config.maxOutputs));
    setInputPorts((node.ports?.inputs || []).map((port, index) => makePortDraft(port, index)));
    setOutputPorts((node.ports?.outputs || []).map((port, index) => makePortDraft(port, index)));
    setPortsError(null);
    setWorkflowRole(node.workflowRole || "none");
    setStateInputsText((node.stateInputs || []).join(", "));
    setStateOutputsText((node.stateOutputs || []).join(", "));
  }, [node]);

  const schemaNode = useMemo(() => (node ? isSchemaNode(node) : false), [node]);
  const schemaKind = useMemo(() => (node ? schemaKindForNode(node) : null), [node]);

  const inbound = useMemo(
    () => (node ? edges.filter((edge) => edge.target === node.id) : []),
    [edges, node],
  );
  const outbound = useMemo(
    () => (node ? edges.filter((edge) => edge.source === node.id) : []),
    [edges, node],
  );
  const nodeMap = useMemo(() => new Map(nodes.map((entry) => [entry.id, entry])), [nodes]);

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        id: `field-new-${Date.now()}-${prev.length}`,
        name: "",
        type: "text",
        value: "",
        optionsText: "",
      },
    ]);
  };

  const updateCustomField = (id: string, patch: Partial<EditableFieldDraft>) => {
    setCustomFields((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((entry) => entry.id !== id));
  };

  const addPort = (kind: "input" | "output") => {
    const draft: EditablePortDraft = {
      id: `port-new-${kind}-${Date.now()}`,
      portId: `${kind}-${Date.now()}`,
      type: kind,
      label: kind === "input" ? "Input" : "Output",
    };
    if (kind === "input") {
      setInputPorts((prev) => [...prev, draft]);
      return;
    }
    setOutputPorts((prev) => [...prev, draft]);
  };

  const updatePort = (kind: "input" | "output", id: string, patch: Partial<EditablePortDraft>) => {
    const updater = (prev: EditablePortDraft[]) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
    if (kind === "input") {
      setInputPorts(updater);
      return;
    }
    setOutputPorts(updater);
  };

  const removePort = (kind: "input" | "output", id: string) => {
    const updater = (prev: EditablePortDraft[]) => prev.filter((entry) => entry.id !== id);
    if (kind === "input") {
      setInputPorts(updater);
      return;
    }
    setOutputPorts(updater);
  };

  const handleSave = () => {
    if (!node) {
      return;
    }
    const parsedFields: CanvasField[] = [];
    for (const [index, entry] of customFields.entries()) {
      const options = entry.optionsText
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      const normalized = normalizeCanvasField({
        name: entry.name,
        type: entry.type,
        value: entry.value,
        options,
      });
      if (!normalized) {
        setFieldsError(`Field[${index + 1}] is invalid or reserved.`);
        return;
      }
      parsedFields.push(normalized);
    }
    setFieldsError(null);

    const parsedInputPorts: CanvasPort[] = [];
    for (const [index, entry] of inputPorts.entries()) {
      const normalized = normalizeCanvasPort({
        id: entry.portId,
        type: entry.type,
        label: entry.label,
      }, "input");
      if (!normalized) {
        setPortsError(`Input port ${index + 1} is invalid.`);
        return;
      }
      parsedInputPorts.push(normalized);
    }

    const parsedOutputPorts: CanvasPort[] = [];
    for (const [index, entry] of outputPorts.entries()) {
      const normalized = normalizeCanvasPort({
        id: entry.portId,
        type: entry.type,
        label: entry.label,
      }, "output");
      if (!normalized) {
        setPortsError(`Output port ${index + 1} is invalid.`);
        return;
      }
      parsedOutputPorts.push(normalized);
    }
    setPortsError(null);

    const parsedMaxInputs = maxInputs.trim().length > 0 ? Number(maxInputs) : null;
    const parsedMaxOutputs = maxOutputs.trim().length > 0 ? Number(maxOutputs) : null;
    const parseChannels = (value: string): string[] => value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    onUpdate(node.id, {
      label: label.trim() || node.label,
      notes,
      content,
      language,
      fields: parsedFields,
      config: {
        ...(node.config || {}),
        isExecutable: isExecutable === "true",
        requiresInput: requiresInput === "true",
        maxInputs: Number.isFinite(parsedMaxInputs as number) ? Math.max(0, parsedMaxInputs as number) : null,
        maxOutputs: Number.isFinite(parsedMaxOutputs as number) ? Math.max(0, parsedMaxOutputs as number) : null,
      },
      ports: {
        inputs: parsedInputPorts,
        outputs: parsedOutputPorts,
      },
      workflowRole: workflowRole === "none" ? undefined : workflowRole,
      stateInputs: parseChannels(stateInputsText),
      stateOutputs: parseChannels(stateOutputsText),
      ...(schemaNode
        ? {
            schemaKey: schemaKey.trim() || node.schemaKey || node.label,
            schemaValueType,
            schemaValue,
          }
        : {}),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden p-0">
        <div className="max-h-[calc(100vh-1rem)] overflow-y-auto" style={{ background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff" }}>
          <div className="px-3 py-1.5" style={{ background: "linear-gradient(90deg, #000080, #1084d0)", color: "#fff", fontWeight: 700, fontSize: 12 }}>
            Node Settings
          </div>
          <div className="p-3">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-sm">{node?.icon} {node?.label || "Node"}</DialogTitle>
              <DialogDescription>Edit node details and connected relations from one place.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold">Label</label>
                  <Input value={label} onChange={(event) => setLabel(event.target.value)} className="h-8 text-xs" />
                </div>
                {schemaNode ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold">Schema Key / Name</label>
                    <Input value={schemaKey} onChange={(event) => setSchemaKey(event.target.value)} className="h-8 text-xs" placeholder="settings" />
                  </div>
                ) : null}
                {schemaNode && schemaKind === "keyvalue" ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold">Value</label>
                      <Input value={schemaValue} onChange={(event) => setSchemaValue(event.target.value)} className="h-8 text-xs" placeholder="value" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold">Value Type</label>
                      <Select value={schemaValueType} onValueChange={(value) => setSchemaValueType(value as "string" | "number" | "boolean" | "null")}> 
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="null">Null</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold">Description</label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} className="text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold">Content</label>
                  <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={8} className="text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold">Language</label>
                  <Select value={language} onValueChange={(value) => setLanguage(value as "markdown" | "json" | "yaml" | "xml")}> 
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="yaml">YAML</SelectItem>
                      <SelectItem value="xml">XML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold">Custom Fields</label>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={addCustomField}>+ Field</Button>
                  </div>
                  <div className="space-y-2 rounded border border-border/60 bg-background/60 p-2">
                    {customFields.length === 0 ? <p className="text-[10px] text-muted-foreground">No custom fields yet.</p> : null}
                    {customFields.map((entry) => (
                      <div key={entry.id} className="space-y-1 rounded border border-border/60 bg-background p-2">
                        <div className="grid grid-cols-[1fr_120px_auto] gap-2">
                          <Input
                            value={entry.name}
                            onChange={(event) => updateCustomField(entry.id, { name: event.target.value })}
                            className="h-7 text-xs"
                            placeholder="field_name"
                          />
                          <Select value={entry.type} onValueChange={(value) => updateCustomField(entry.id, { type: value as CanvasField["type"] })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CANVAS_FIELD_TYPES.map((fieldType) => (
                                <SelectItem key={fieldType} value={fieldType}>{fieldType}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => removeCustomField(entry.id)}>Remove</Button>
                        </div>
                        <Input
                          value={entry.value}
                          onChange={(event) => updateCustomField(entry.id, { value: event.target.value })}
                          className="h-7 text-xs"
                          placeholder="value"
                        />
                        {(entry.type === "enum" || entry.type === "multiEnum") ? (
                          <Input
                            value={entry.optionsText}
                            onChange={(event) => updateCustomField(entry.id, { optionsText: event.target.value })}
                            className="h-7 text-xs"
                            placeholder="options: low, medium, high"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {fieldsError ? <p className="text-[10px] text-red-600">{fieldsError}</p> : null}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold">Input Ports</label>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => addPort("input")}>+ Input</Button>
                  </div>
                  <div className="space-y-2 rounded border border-border/60 bg-background/60 p-2">
                    {inputPorts.length === 0 ? <p className="text-[10px] text-muted-foreground">No input ports.</p> : null}
                    {inputPorts.map((port) => (
                      <div key={port.id} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2 rounded border border-border/60 bg-background p-2">
                        <Input
                          value={port.portId}
                          onChange={(event) => updatePort("input", port.id, { portId: event.target.value })}
                          className="h-7 text-xs"
                          placeholder="in-main"
                        />
                        <Select value={port.type} onValueChange={(value) => updatePort("input", port.id, { type: value as CanvasPort["type"] })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CANVAS_PORT_TYPES.map((portType) => (
                              <SelectItem key={portType} value={portType}>{portType}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={port.label}
                          onChange={(event) => updatePort("input", port.id, { label: event.target.value })}
                          className="h-7 text-xs"
                          placeholder="Input"
                        />
                        <Button type="button" size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => removePort("input", port.id)}>×</Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold">Output Ports</label>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => addPort("output")}>+ Output</Button>
                  </div>
                  <div className="space-y-2 rounded border border-border/60 bg-background/60 p-2">
                    {outputPorts.length === 0 ? <p className="text-[10px] text-muted-foreground">No output ports.</p> : null}
                    {outputPorts.map((port) => (
                      <div key={port.id} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2 rounded border border-border/60 bg-background p-2">
                        <Input
                          value={port.portId}
                          onChange={(event) => updatePort("output", port.id, { portId: event.target.value })}
                          className="h-7 text-xs"
                          placeholder="out-main"
                        />
                        <Select value={port.type} onValueChange={(value) => updatePort("output", port.id, { type: value as CanvasPort["type"] })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CANVAS_PORT_TYPES.map((portType) => (
                              <SelectItem key={portType} value={portType}>{portType}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={port.label}
                          onChange={(event) => updatePort("output", port.id, { label: event.target.value })}
                          className="h-7 text-xs"
                          placeholder="Output"
                        />
                        <Button type="button" size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => removePort("output", port.id)}>×</Button>
                      </div>
                    ))}
                  </div>
                  {portsError ? <p className="text-[10px] text-red-600">{portsError}</p> : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded border border-border/60 bg-background/70 p-2 text-xs">
                  <p><span className="font-semibold">Cluster:</span> {node?.cluster || "-"}</p>
                  <p><span className="font-semibold">Type:</span> {node?.ontologyCode || "-"}</p>
                </div>
                <div className="rounded border border-border/60 bg-background/70 p-2 space-y-2">
                  <p className="text-[11px] font-semibold">Execution Config</p>
                  <div className="space-y-1">
                    <label className="text-[10px]">Workflow Role</label>
                    <Select value={workflowRole} onValueChange={(value) => setWorkflowRole(value as WorkflowNodeRole | "none")}> 
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">none</SelectItem>
                        {WORKFLOW_NODE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px]">Executable</label>
                    <Select value={isExecutable} onValueChange={(value) => setIsExecutable(value as "true" | "false")}> 
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px]">Requires Input</label>
                    <Select value={requiresInput} onValueChange={(value) => setRequiresInput(value as "true" | "false")}> 
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">false</SelectItem>
                        <SelectItem value="true">true</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px]">Max Inputs</label>
                      <Input value={maxInputs} onChange={(event) => setMaxInputs(event.target.value)} className="h-7 text-xs" placeholder="unlimited" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px]">Max Outputs</label>
                      <Input value={maxOutputs} onChange={(event) => setMaxOutputs(event.target.value)} className="h-7 text-xs" placeholder="unlimited" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px]">State Inputs (csv)</label>
                    <Input value={stateInputsText} onChange={(event) => setStateInputsText(event.target.value)} className="h-7 text-xs" placeholder="messages, memory" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px]">State Outputs (csv)</label>
                    <Input value={stateOutputsText} onChange={(event) => setStateOutputsText(event.target.value)} className="h-7 text-xs" placeholder="messages" />
                  </div>
                </div>
                {schemaNode && (schemaKind === "object" || schemaKind === "array") ? (
                  <div className="rounded border border-border/60 bg-background/70 p-2">
                    <p className="text-[11px] font-semibold">Schema Actions</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => node && onCreateChild(node.id, "keyvalue")}>+ Add Key-Value</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => node && onCreateChild(node.id, "object")}>+ Add Object</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => node && onCreateChild(node.id, "array")}>+ Add Array</Button>
                    </div>
                  </div>
                ) : null}
                <div className="rounded border border-border/60 bg-background/70 p-2">
                  <p className="text-[11px] font-semibold">Inbound ({inbound.length})</p>
                  <ScrollArea className="mt-1 h-24">
                    <div className="space-y-1">
                      {inbound.length === 0 ? <p className="text-[11px] text-muted-foreground">None</p> : null}
                      {inbound.map((edge) => {
                        const source = nodeMap.get(edge.source);
                        const meta = getRelationOperatorMeta(edge.data?.operator);
                        return (
                          <button
                            key={edge.id}
                            type="button"
                            onClick={() => onOpenEdge(edge.id)}
                            className="w-full rounded border border-border/60 bg-background px-2 py-1 text-left text-[11px] hover:border-primary/40"
                            title={meta.description}
                          >
                            {source?.label || edge.source} → {node?.label || edge.target} • {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
                <div className="rounded border border-border/60 bg-background/70 p-2">
                  <p className="text-[11px] font-semibold">Outbound ({outbound.length})</p>
                  <ScrollArea className="mt-1 h-24">
                    <div className="space-y-1">
                      {outbound.length === 0 ? <p className="text-[11px] text-muted-foreground">None</p> : null}
                      {outbound.map((edge) => {
                        const target = nodeMap.get(edge.target);
                        const meta = getRelationOperatorMeta(edge.data?.operator);
                        return (
                          <button
                            key={edge.id}
                            type="button"
                            onClick={() => onOpenEdge(edge.id)}
                            className="w-full rounded border border-border/60 bg-background px-2 py-1 text-left text-[11px] hover:border-primary/40"
                            title={meta.description}
                          >
                            {node?.label || edge.source} → {target?.label || edge.target} • {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => node && onDuplicate(node.id)}>Duplicate</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => node && onDelete(node.id)}>Delete</Button>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleSave}>Save Node</Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
