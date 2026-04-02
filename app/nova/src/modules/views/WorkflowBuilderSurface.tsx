/**
 * Why: Core workflow studio that unifies canvas, IDE, and console for semantic ontology workflows.
 * What: Win95-styled tabs provide Canvas (build), IDE (code), and Console (commands) without page sprawl.
 * How: Shared workflow state powers all tabs; ontology nodes remain first-class draggable primitives in canvas.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getClusterByCode,
  ONTOLOGY_CLUSTERS,
  ONTOLOGY_NODE_TYPES,
  type OntologyNodeType,
} from "@/modules/workflow/semanticOntology";
import {
  buildWorkflowFromText,
  canConnectPorts,
  ensureNodePrimitives,
  getDefaultInputPort,
  getDefaultOutputPort,
  makeNodeFromType,
  NODE_H,
  NODE_W,
  type CanvasEdge,
  type CanvasPort,
  type CanvasNode,
} from "@/modules/workflow/workflowTypes";
import {
  getWorkspaceDefaultNodeCodes,
  getWorkspaceNodeTypes,
  type WorkflowWorkspaceKind,
} from "@/modules/workflow/workspaceCatalog";
import {
  buildJsonFromSchemaGraph,
  createSchemaGraphFromJson,
  isSchemaNode,
  schemaKindForNode,
  type SchemaNodeKind,
} from "@/modules/workflow/workflowSchemaGraph";
import { NodeEnhanceDialog } from "@/modules/workflow/NodeEnhanceDialog";
import { WorkflowEdgeDialog } from "@/modules/workflow/WorkflowEdgeDialog";
import { WorkflowNodeDialog } from "@/modules/workflow/WorkflowNodeDialog";
import { WorkflowCodePanel } from "@/modules/workflow/WorkflowCodePanel";
import { WorkflowConsolePanel } from "@/modules/workflow/WorkflowConsolePanel";
import {
  DEFAULT_RELATION_CONDITION,
  DEFAULT_RELATION_OPERATOR,
  getRelationOperatorMeta,
} from "@/modules/workflow/workflowRelations";
import {
  Braces,
  Download,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  TerminalSquare,
  Trash2,
  Wand2,
  Workflow,
} from "lucide-react";

/* ── Component ──────────────────────────────────────────────────────── */

export type WorkflowView = "canvas" | "ide" | "console";

export interface WorkflowBuilderSurfaceProps {
  readonly initialView?: WorkflowView;
  readonly lockView?: boolean;
  readonly workspaceKind?: WorkflowWorkspaceKind;
}

export function WorkflowBuilderSurface({
  initialView = "canvas",
  lockView = false,
  workspaceKind = "workflows",
}: WorkflowBuilderSurfaceProps = {}): JSX.Element {
  const workspaceNodeTypes = useMemo(() => getWorkspaceNodeTypes(workspaceKind), [workspaceKind]);

  const [viewTab, setViewTab] = useState<WorkflowView>(initialView);
  const [canvasWorkspaceMode, setCanvasWorkspaceMode] = useState<"canvas" | "ide">("canvas");
  const [nodes, setNodes] = useState<CanvasNode[]>(() => {
    const defaults = getWorkspaceDefaultNodeCodes(workspaceKind);
    const catalog = getWorkspaceNodeTypes(workspaceKind);
    return defaults
      .map((code) => catalog.find((n) => n.code === code))
      .filter((nt): nt is OntologyNodeType => Boolean(nt))
      .map((nt, i) => makeNodeFromType(nt, i));
  });

  const [edges, setEdges] = useState<CanvasEdge[]>(() =>
    nodes.length >= 2
      ? [
          { id: "edge-init-1", source: nodes[0]?.id ?? "", target: nodes[1]?.id ?? "" },
          ...(nodes.length >= 3
            ? [{ id: "edge-init-2", source: nodes[1]?.id ?? "", target: nodes[2]?.id ?? "" }]
            : []),
        ]
      : [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null);
  const [activePaletteCluster, setActivePaletteCluster] = useState("all");
  const [paletteQuery, setPaletteQuery] = useState("");
  const [openPaletteSections, setOpenPaletteSections] = useState<string[]>([]);
  const [paletteCompact, setPaletteCompact] = useState(false);
  const [inspectorCompact, setInspectorCompact] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [connectSource, setConnectSource] = useState<{ nodeId: string; portId: string; portType: CanvasPort["type"]; label: string } | null>(null);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const [nodeModalId, setNodeModalId] = useState<string | null>(null);
  const [edgeModalId, setEdgeModalId] = useState<string | null>(null);

  const dragRef = useRef<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedNode = selectedId ? nodeMap.get(selectedId) ?? null : null;
  const modalNode = useMemo(() => (nodeModalId ? nodeMap.get(nodeModalId) ?? null : null), [nodeMap, nodeModalId]);
  const selectedEdge = useMemo(
    () => (edgeModalId ? edges.find((edge) => edge.id === edgeModalId) ?? null : null),
    [edges, edgeModalId],
  );

  const nodeTemplates = useMemo(
    () =>
      workspaceNodeTypes.map((nt) => {
        const cl = getClusterByCode(nt.cluster);
        return { ...nt, color: cl?.color ?? "#808080", clusterName: cl?.name ?? nt.cluster };
      }),
    [workspaceNodeTypes],
  );

  const availablePaletteClusters = useMemo(() => {
    const templateClusterCodes = new Set(nodeTemplates.map((template) => template.cluster));
    const knownClusters = ONTOLOGY_CLUSTERS.filter((cluster) => templateClusterCodes.has(cluster.code));
    const knownCodes = new Set(knownClusters.map((cluster) => cluster.code));
    const unknownClusters = [...templateClusterCodes]
      .filter((code) => !knownCodes.has(code))
      .map((code) => ({
        code,
        name: code,
        icon: "🧩",
        description: "",
        color: "#808080",
      }));
    return [...knownClusters, ...unknownClusters];
  }, [nodeTemplates]);

  const filteredTemplates = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    return nodeTemplates.filter((t) => {
      if (activePaletteCluster !== "all" && t.cluster !== activePaletteCluster) return false;
      if (!q) return true;
      return `${t.label} ${t.cluster} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(q);
    });
  }, [activePaletteCluster, nodeTemplates, paletteQuery]);

  const groupedTemplates = useMemo(() => {
    const grouped = new Map<string, typeof filteredTemplates>();
    for (const template of filteredTemplates) {
      const current = grouped.get(template.cluster) ?? [];
      current.push(template);
      grouped.set(template.cluster, current);
    }
    /* Use availablePaletteClusters (derived from nodeTemplates) so utility and
       custom clusters that aren't in the vendor catalog still render. */
    return availablePaletteClusters
      .map((cluster) => ({
        cluster,
        templates: grouped.get(cluster.code) ?? [],
      }))
      .filter((entry) => entry.templates.length > 0);
  }, [availablePaletteClusters, filteredTemplates]);

  const workspaceLabels = useMemo(() => {
    if (workspaceKind === "schema") {
      return {
        stageHint: "schema canvas is core",
        paletteTitle: "Schema Palette",
        canvasTitle: "Schema Canvas",
        headerGradient: "linear-gradient(90deg, #0f3d8f, #1d7eea)",
        viewCaption: {
          canvas: "Visual schema design",
          ide: "Schema code editing",
        },
      };
    }
    return {
      stageHint: "workflow canvas is core",
      paletteTitle: "Agent Workflow Palette",
      canvasTitle: "Operational Workflow Canvas",
      headerGradient: "linear-gradient(90deg, #1f4f2c, #18a54f)",
      viewCaption: {
        canvas: "Visual agent-graph orchestration",
        ide: "Workflow graph code editing",
      },
    };
  }, [workspaceKind]);

  const showRunConsole = workspaceKind === "workflows";

  const canvasHeight = useMemo(
    () => Math.max(500, 180 + Math.ceil(nodes.length / 3) * 160),
    [nodes.length],
  );

  const applyWorkflow = useCallback((nextNodes: CanvasNode[], nextEdges: CanvasEdge[]) => {
    const normalizedNodes = nextNodes.map((node) => ensureNodePrimitives(node));
    setNodes(normalizedNodes);
    setEdges(nextEdges);
    setSelectedId((prev) => {
      if (prev && normalizedNodes.some((n) => n.id === prev)) return prev;
      return normalizedNodes[0]?.id ?? null;
    });
    setConnectSource(null);
    setConnectNotice(null);
  }, []);

  const addNodeFromType = useCallback((nt: OntologyNodeType) => {
    setNodes((prev) => {
      const node = ensureNodePrimitives(makeNodeFromType(nt, prev.length));
      setSelectedId(node.id);
      return [...prev, node];
    });
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    setNodeModalId((prev) => (prev === id ? null : prev));
    setEdgeModalId(null);
  }, []);

  const duplicateNode = useCallback((id: string) => {
    const node = nodeMap.get(id);
    if (!node) return;
    const duplicate: CanvasNode = ensureNodePrimitives({
      ...node,
      id: `node-${Date.now()}`,
      x: node.x + 24,
      y: node.y + 24,
      label: `${node.label} Copy`,
    });
    setNodes((prev) => [...prev, duplicate]);
    setSelectedId(duplicate.id);
  }, [nodeMap]);

  const updateNode = useCallback((id: string, patch: Partial<Pick<CanvasNode, "label" | "notes" | "content">>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? ensureNodePrimitives({ ...n, ...patch }) : n)));
  }, []);

  const updateSchemaNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? ensureNodePrimitives({ ...n, ...patch }) : n)));
  }, []);

  const addEdge = useCallback((
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string,
    sourcePortType?: CanvasPort["type"],
    targetPortType?: CanvasPort["type"],
  ) => {
    if (source === target) return;
    if (sourcePortType && targetPortType && !canConnectPorts(sourcePortType, targetPortType)) {
      setConnectNotice(`Cannot connect ${sourcePortType} → ${targetPortType}`);
      return;
    }
    setEdges((prev) => {
      if (prev.some((e) => e.source === source && e.target === target && e.sourceHandle === sourceHandle && e.targetHandle === targetHandle)) return prev;
      return [
        ...prev,
        {
          id: `edge-${Date.now()}`,
          source,
          target,
          sourceHandle,
          targetHandle,
          data: {
            operator: DEFAULT_RELATION_OPERATOR,
            condition: DEFAULT_RELATION_CONDITION,
            weight: 1,
            metadata: { label: "" },
          },
        },
      ];
    });
    setConnectNotice(null);
  }, []);

  const beginConnectFromNode = useCallback((node: CanvasNode, port?: CanvasPort) => {
    const outputPort = port ?? getDefaultOutputPort(node);
    setConnectSource({
      nodeId: node.id,
      portId: outputPort.id,
      portType: outputPort.type,
      label: outputPort.label,
    });
    setConnectNotice(null);
  }, []);

  const removeEdge = useCallback((id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    setEdgeModalId((prev) => (prev === id ? null : prev));
  }, []);

  const updateEdge = useCallback((id: string, patch: Partial<CanvasEdge>) => {
    setEdges((prev) => prev.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)));
  }, []);

  const addSchemaChild = useCallback((parentId: string, childKind: SchemaNodeKind) => {
    const parent = nodeMap.get(parentId);
    if (!parent) return;
    const siblings = edges.filter((edge) => edge.source === parentId).length;
    const nodeTypeCode = childKind === "object" ? "JSON-OBJECT" : childKind === "array" ? "JSON-ARRAY" : "JSON-KEYVALUE";
    const nodeType = [...workspaceNodeTypes, ...getWorkspaceNodeTypes("schema"), ...ONTOLOGY_NODE_TYPES].find((entry) => entry.code === nodeTypeCode);
    if (!nodeType) return;
    const child = makeNodeFromType(nodeType, nodes.length + siblings + 1);
    const nextKey = childKind === "keyvalue" ? `key_${siblings + 1}` : `${childKind}_${siblings + 1}`;
    const x = parent.x + NODE_W + 140;
    const y = parent.y + siblings * (NODE_H + 30);
    const nextNode: CanvasNode = ensureNodePrimitives({
      ...child,
      x,
      y,
      schemaKey: nextKey,
      label: childKind === "keyvalue" ? "Key-Value" : nextKey,
      content: childKind === "keyvalue" ? "value" : child.content,
      schemaValue: childKind === "keyvalue" ? "value" : child.schemaValue,
    });

    setNodes((prev) => [...prev, nextNode]);
    setEdges((prev) => [
      ...prev,
      {
        id: `edge-${parentId}-${nextNode.id}`,
        source: parentId,
        target: nextNode.id,
        data: {
          operator: "contains",
          condition: "always",
          weight: 1,
          metadata: { label: nextKey },
        },
      },
    ]);
    setSelectedId(nextNode.id);
  }, [edges, nodeMap, nodes.length, workspaceNodeTypes]);

  const handleGenerate = useCallback(() => {
    const result = buildWorkflowFromText(textInput);
    applyWorkflow(result.nodes, result.edges);
  }, [applyWorkflow, textInput]);

  const handleExport = useCallback(() => {
    const data = { nodes, edges, metadata: { exportedAt: new Date().toISOString() } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const handleExportSchema = useCallback(() => {
    const schemaJson = buildJsonFromSchemaGraph(nodes, edges);
    const blob = new Blob([JSON.stringify(schemaJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const handleImportSchemaFromText = useCallback(() => {
    const raw = textInput.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const graph = createSchemaGraphFromJson(parsed);
      applyWorkflow(graph.nodes, graph.edges);
      setTextInput("");
    } catch {
      // Keep UX minimal in-canvas; parse feedback remains in IDE panel.
    }
  }, [applyWorkflow, textInput]);

  const onNodeMouseDown = useCallback((e: ReactMouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedId(nodeId);
    dragRef.current = { nodeId, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragRef.current!.nodeId
            ? { ...n, x: Math.max(0, dragRef.current!.origX + dx), y: Math.max(0, dragRef.current!.origY + dy) }
            : n,
        ),
      );
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [nodes]);

  useEffect(() => {
    setViewTab(initialView);
  }, [initialView]);

  useEffect(() => {
    setEdgeModalId((prev) => {
      if (!prev) return prev;
      return edges.some((edge) => edge.id === prev) ? prev : null;
    });
  }, [edges]);

  useEffect(() => {
    if (activePaletteCluster !== "all" && !availablePaletteClusters.some((cluster) => cluster.code === activePaletteCluster)) {
      setActivePaletteCluster("all");
    }
  }, [activePaletteCluster, availablePaletteClusters]);

  useEffect(() => {
    if (activePaletteCluster !== "all") {
      setOpenPaletteSections([activePaletteCluster]);
      return;
    }
    if (paletteQuery.trim()) {
      setOpenPaletteSections(groupedTemplates.map((entry) => entry.cluster.code));
    }
  }, [activePaletteCluster, groupedTemplates, paletteQuery]);

  const palettePanelClassName = paletteCompact
    ? "max-h-12 xl:max-h-none xl:w-[56px]"
    : "max-h-[52vh] xl:max-h-none xl:w-[260px]";

  const inspectorPanelClassName = inspectorCompact
    ? "xl:w-[56px]"
    : "xl:w-[300px]";

  return (
    <Tabs value={viewTab} onValueChange={(value) => setViewTab((value as WorkflowView) ?? "canvas")} className="flex h-full min-h-0 w-full flex-col gap-0">
      {!lockView && (
        <div className="flex items-center gap-2 border-b px-2 py-1" style={{ background: "#C0C0C0", borderColor: "#808080" }}>
          <TabsList className="h-7 bg-transparent p-0">
            <TabsTrigger value="canvas" className="h-6 px-3 text-xs">
              <Workflow className="mr-1 h-3.5 w-3.5" /> Canvas
            </TabsTrigger>
            <TabsTrigger value="ide" className="h-6 px-3 text-xs">
              <Braces className="mr-1 h-3.5 w-3.5" /> IDE
            </TabsTrigger>
            {showRunConsole ? (
              <TabsTrigger value="console" className="h-6 px-3 text-xs">
                <TerminalSquare className="mr-1 h-3.5 w-3.5" /> Run Log
              </TabsTrigger>
            ) : null}
          </TabsList>
          <span className="ml-auto text-[10px]" style={{ color: "#000080" }}>
            {workspaceLabels.stageHint} · {nodes.length} nodes · {edges.length} edges
          </span>
        </div>
      )}

      <TabsContent value="canvas" className="mt-0 min-h-0 flex-1">
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="flex items-center gap-2 border-b px-2 py-1" style={{ background: "#D6D6D6", borderColor: "#808080" }}>
            <span className="text-[10px] font-semibold" style={{ color: "#000080" }}>Workspace View</span>
            <Button
              type="button"
              size="sm"
              variant={canvasWorkspaceMode === "canvas" ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={() => setCanvasWorkspaceMode("canvas")}
            >
              Canvas
            </Button>
            <Button
              type="button"
              size="sm"
              variant={canvasWorkspaceMode === "ide" ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={() => setCanvasWorkspaceMode("ide")}
            >
              IDE
            </Button>
            <span className="ml-auto text-[10px]" style={{ color: "#444" }}>
              {canvasWorkspaceMode === "canvas" ? workspaceLabels.viewCaption.canvas : workspaceLabels.viewCaption.ide}
            </span>
          </div>

          {canvasWorkspaceMode === "canvas" ? (
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col gap-0 overflow-x-auto p-0 xl:flex-row">
      {/* Left: Ontology Node Palette */}
      <div className={`flex min-h-0 w-full shrink-0 flex-col border-b border-border xl:border-b-0 xl:border-r ${palettePanelClassName}`} style={{ background: "#C0C0C0" }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: workspaceLabels.headerGradient, color: "#fff", fontWeight: 700, fontSize: 12 }}>
          <Workflow className="h-3.5 w-3.5" />
          {!paletteCompact ? <span>{workspaceLabels.paletteTitle}</span> : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-6 px-2 text-[10px]"
            style={{ color: "#fff" }}
            onClick={() => setPaletteCompact((prev) => !prev)}
            title={paletteCompact ? "Expand palette" : "Compact palette"}
          >
            {paletteCompact ? <PanelLeftOpen className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
          </Button>
        </div>
        {!paletteCompact ? (
          <>
            <div className="space-y-1 p-2">
              <Input value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} placeholder="Search nodes…" className="h-7 text-xs" />
              <Select value={activePaletteCluster} onValueChange={setActivePaletteCluster}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Cluster" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clusters</SelectItem>
                  {availablePaletteClusters.map((c) => (<SelectItem key={c.code} value={c.code}>{c.icon} {c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="min-h-0 flex-1 p-2">
              <Accordion type="multiple" value={openPaletteSections} onValueChange={setOpenPaletteSections} className="space-y-1">
                {groupedTemplates.map(({ cluster, templates }) => (
                  <AccordionItem key={cluster.code} value={cluster.code} className="border border-[#808080] bg-[#C0C0C0] px-2">
                    <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                      <span className="flex min-w-0 w-full items-center gap-1.5 text-left">
                        <span>{cluster.icon}</span>
                        <span className="min-w-0 break-words leading-tight">{cluster.name}</span>
                        <span className="ml-auto text-[10px] font-normal opacity-70">{templates.length}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2 pt-1">
                      <div className="space-y-1">
                        {templates.map((template) => (
                          <button
                            key={template.code}
                            type="button"
                            onClick={() => addNodeFromType(template)}
                            className="flex w-full flex-col items-start border-2 px-2 py-1.5 text-left text-xs"
                            style={{ background: "#C0C0C0", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer" }}
                          >
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span>{template.icon}</span><span>{template.label}</span>
                              <span className="ml-auto h-2 w-2" style={{ background: template.color }} />
                            </span>
                            <span className="mt-0.5 text-[10px] opacity-70">{template.description}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
            <Separator />
            <div className="p-2">
              <Tabs defaultValue="text" className="min-h-0">
                <TabsList className="grid w-full grid-cols-2 h-7">
                  <TabsTrigger value="text" className="text-xs h-6">Text → Flow</TabsTrigger>
                  <TabsTrigger value="stats" className="text-xs h-6">Stats</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="space-y-1 pt-1">
                  <Textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={4} placeholder="Describe steps or paste JSON to import schema graph." className="text-xs" />
                  <div className="grid grid-cols-1 gap-1">
                    <Button type="button" size="sm" className="w-full h-7 text-xs" onClick={handleGenerate}>
                      <Wand2 className="mr-1 h-3 w-3" /> Generate
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="w-full h-7 text-xs" onClick={handleImportSchemaFromText}>
                      Import JSON → Schema
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="stats" className="space-y-1 pt-1 text-xs">
                  <p>{nodes.length} nodes · {edges.length} edges</p>
                  <p>{new Set(nodes.map((n) => n.cluster)).size} clusters</p>
                  <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] w-full mt-1" onClick={handleExport}>
                    <Download className="mr-1 h-3 w-3" /> Export JSON
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] w-full mt-1" onClick={handleExportSchema}>
                    <Download className="mr-1 h-3 w-3" /> Export Schema JSON
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : null}
      </div>

      {/* Center: Canvas */}
      <div className="min-h-[340px] min-w-[640px] flex-1 flex flex-col xl:min-h-0">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ background: "#C0C0C0", borderColor: "#808080" }}>
          <GitBranch className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">{workspaceLabels.canvasTitle}</span>
          {connectSource && (
            <span className="text-[10px] font-semibold" style={{ color: "#000080" }}>
              Click target node to connect from &quot;{nodeMap.get(connectSource.nodeId)?.label}&quot; · {connectSource.label}
            </span>
          )}
          {connectNotice ? (
            <span className="text-[10px] font-semibold" style={{ color: "#b91c1c" }}>
              {connectNotice}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => setPaletteCompact((prev) => !prev)}
              title={paletteCompact ? "Expand palette" : "Compact palette"}
            >
              {paletteCompact ? <PanelLeftOpen className="mr-1 h-3 w-3" /> : <PanelLeftClose className="mr-1 h-3 w-3" />}
              Palette
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => setInspectorCompact((prev) => !prev)}
              title={inspectorCompact ? "Expand inspector" : "Compact inspector"}
            >
              {inspectorCompact ? <PanelRightOpen className="mr-1 h-3 w-3" /> : <PanelRightClose className="mr-1 h-3 w-3" />}
              Inspector
            </Button>
            <span className="text-[10px] opacity-60">{nodes.length} nodes · {edges.length} edges</span>
          </div>
        </div>
        <div
          className="retro-grid-panel relative flex-1 overflow-auto"
          onClick={() => { setSelectedId(null); setConnectSource(null); }}
          style={{ cursor: connectSource ? "crosshair" : "default" }}
        >
          <svg className="pointer-events-none absolute inset-0" style={{ width: "100%", height: canvasHeight, minHeight: "100%" }}>
            {edges.map((edge) => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;
              const opMeta = getRelationOperatorMeta(edge.data?.operator);
              const x1 = src.x + NODE_W;
              const y1 = src.y + NODE_H / 2;
              const x2 = tgt.x;
              const y2 = tgt.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <g key={edge.id}>
                  <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none" stroke={edge.style?.stroke || opMeta.color} strokeWidth={2} />
                  <circle cx={x2} cy={y2} r={4} fill={edge.style?.stroke || opMeta.color} />
                </g>
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-0">
            {edges.map((edge) => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;
              const opMeta = getRelationOperatorMeta(edge.data?.operator);
              const mx = (src.x + NODE_W + tgt.x) / 2;
              const my = (src.y + NODE_H / 2 + tgt.y + NODE_H / 2) / 2;
              const edgeLabel = edge.data?.metadata?.label?.trim() || opMeta.label;
              return (
                <button
                  key={`label-${edge.id}`}
                  type="button"
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    left: mx,
                    top: my,
                    background: "#C0C0C0",
                    color: "#000",
                    border: "1px solid #808080",
                    boxShadow: "inset -1px -1px 0 #fff, inset 1px 1px 0 #000",
                  }}
                  title={opMeta.description}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEdgeModalId(edge.id);
                  }}
                >
                  {opMeta.icon} {edgeLabel}
                </button>
              );
            })}
          </div>

          {nodes.map((node) => {
            const isSelected = node.id === selectedId;
            const schemaKind = schemaKindForNode(node);
            const isSchema = isSchemaNode(node);
            return (
              <div
                key={node.id}
                className="absolute select-none"
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  minHeight: NODE_H,
                  background: "#C0C0C0",
                  border: "2px solid",
                  borderColor: isSelected ? "#FF69B4" : "#fff #404040 #404040 #fff",
                  boxShadow: isSelected ? "0 0 0 2px #FF69B4, 2px 2px 4px rgba(0,0,0,0.3)" : "2px 2px 4px rgba(0,0,0,0.3)",
                  cursor: connectSource ? "pointer" : "move",
                  zIndex: isSelected ? 10 : 1,
                }}
                onMouseDown={(e) => {
                  if (connectSource) {
                    e.stopPropagation();
                    const targetPort = getDefaultInputPort(node);
                    addEdge(connectSource.nodeId, node.id, connectSource.portId, targetPort.id, connectSource.portType, targetPort.type);
                    setConnectSource(null);
                    return;
                  }
                  onNodeMouseDown(e, node.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setNodeModalId(node.id);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5"
                  style={{ background: "linear-gradient(90deg, #000080 0%, #0000FF 100%)", color: "#fff", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #404040" }}
                >
                  <span>{node.icon}</span>
                  <span className="flex-1 break-words leading-tight">{node.label}</span>
                  <span className="h-2 w-2" style={{ background: node.color, border: "1px solid #fff" }} />
                  <button
                    type="button"
                    className="h-3.5 w-3.5 flex items-center justify-center text-[8px]"
                    style={{ background: "#C0C0C0", border: "1px solid", borderColor: "#fff #404040 #404040 #fff", color: "#000", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); beginConnectFromNode(node); }}
                    title="Connect to another node"
                  >→</button>
                </div>
                <div className="p-1.5" style={{ background: "#E8E8E8", fontSize: 10, minHeight: 50 }}>
                  {isSchema ? (
                    <div className="space-y-1">
                      {schemaKind === "keyvalue" ? (
                        <>
                          <p className="text-[10px]" style={{ color: "#334155" }}><span className="font-semibold">Key:</span> {node.schemaKey || "key"}</p>
                          <p className="text-[10px]" style={{ color: "#334155" }}><span className="font-semibold">Value:</span> {node.schemaValue || ""} <span className="opacity-70">({node.schemaValueType || "string"})</span></p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px]" style={{ color: "#334155" }}><span className="font-semibold">Name:</span> {node.schemaKey || node.label}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 w-full text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              addSchemaChild(node.id, "keyvalue");
                            }}
                          >
                            + {schemaKind === "array" ? "Add Item" : "Add Key-Value"}
                          </Button>
                        </>
                      )}
                      <p className="italic text-[10px]" style={{ color: "#64748b" }}>{node.notes || "Schema node"}</p>
                    </div>
                  ) : (
                    <>
                      {node.notes ? (
                        <p className="line-clamp-2 leading-tight" style={{ color: "#111827" }}>{node.notes}</p>
                      ) : (
                        <p className="italic" style={{ color: "#808080" }}>No description</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="px-1" style={{ background: "#E0E0E0", border: "1px inset #C0C0C0", fontSize: 9, color: "#000080" }}>{node.cluster}</span>
                        <span className="px-1" style={{ background: "#E0E0E0", border: "1px inset #C0C0C0", fontSize: 9, color: "#000080" }}>{node.ontologyCode}</span>
                      </div>
                    </>
                  )}
                  <div className="mt-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] font-semibold" style={{ color: "#334155" }}>IN</span>
                      {(node.ports?.inputs ?? []).map((port) => (
                        <span
                          key={`${node.id}-in-${port.id}`}
                          className="px-1"
                          style={{ background: "#DBEAFE", border: "1px solid #93c5fd", fontSize: 9, color: "#1e3a8a" }}
                          title={`${port.type} • ${port.id}`}
                        >
                          {port.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] font-semibold" style={{ color: "#14532d" }}>OUT</span>
                      {(node.ports?.outputs ?? []).map((port) => (
                        <button
                          key={`${node.id}-out-${port.id}`}
                          type="button"
                          className="px-1 text-[9px]"
                          style={{ background: "#DCFCE7", border: "1px solid #86efac", color: "#14532d", cursor: "pointer" }}
                          title={`${port.type} • ${port.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            beginConnectFromNode(node, port);
                          }}
                        >
                          {port.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Inspector */}
      <div className={`min-h-0 w-full shrink-0 border-t border-border xl:border-l xl:border-t-0 ${inspectorPanelClassName}`} style={{ background: "#C0C0C0" }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: workspaceLabels.headerGradient, color: "#fff", fontWeight: 700, fontSize: 12 }}>
          {!inspectorCompact ? <span>Inspector</span> : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-6 px-2 text-[10px]"
            style={{ color: "#fff" }}
            onClick={() => setInspectorCompact((prev) => !prev)}
            title={inspectorCompact ? "Expand inspector" : "Compact inspector"}
          >
            {inspectorCompact ? <PanelRightOpen className="h-3 w-3" /> : <PanelRightClose className="h-3 w-3" />}
          </Button>
        </div>
        {!inspectorCompact ? (
        <ScrollArea className="flex-1 p-2">
          {selectedNode ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold" style={{ color: "#000080" }}>Label</label>
                <Input value={selectedNode.label} onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold" style={{ color: "#000080" }}>Description</label>
                <Textarea value={selectedNode.notes} onChange={(e) => updateNode(selectedNode.id, { notes: e.target.value })} rows={3} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold" style={{ color: "#000080" }}>Content</label>
                <Textarea value={selectedNode.content} onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })} rows={4} placeholder="Node content, prompt text, or instructions…" className="text-xs" />
              </div>
              <NodeEnhanceDialog
                node={selectedNode}
                onApply={(content, notes) => updateNode(selectedNode.id, { content, notes })}
              />
              <Separator />
              <div className="space-y-1 text-xs">
                <p className="break-words"><span className="font-semibold">Cluster:</span> {selectedNode.cluster}</p>
                <p className="break-words"><span className="font-semibold">Type:</span> {selectedNode.ontologyCode}</p>
                <p><span className="font-semibold">Language:</span> {selectedNode.language || "markdown"}</p>
                <p><span className="font-semibold">Executable:</span> {selectedNode.config?.isExecutable === false ? "false" : "true"}</p>
                <p><span className="font-semibold">Requires Input:</span> {selectedNode.config?.requiresInput ? "true" : "false"}</p>
                <p><span className="font-semibold">Ports:</span> in {selectedNode.ports?.inputs?.length ?? 0} · out {selectedNode.ports?.outputs?.length ?? 0}</p>
                <p><span className="font-semibold">Fields:</span> {selectedNode.fields?.length ?? 0}</p>
                <p><span className="font-semibold">Color: </span><span className="inline-block h-3 w-3 align-middle" style={{ background: selectedNode.color }} /></p>
              </div>
              <Separator />
              <div className="space-y-1">
                <label className="text-[10px] font-semibold" style={{ color: "#000080" }}>Edges</label>
                {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).map((edge) => {
                  const other = edge.source === selectedNode.id ? edge.target : edge.source;
                  const otherNode = nodeMap.get(other);
                  const dir = edge.source === selectedNode.id ? "→" : "←";
                  const operator = edge.data?.operator || DEFAULT_RELATION_OPERATOR;
                  const customLabel = edge.data?.metadata?.label?.trim();
                  const handleInfo = [edge.sourceHandle, edge.targetHandle].filter(Boolean).join(" → ");
                  return (
                    <div key={edge.id} className="flex items-center justify-between gap-1 text-xs">
                      <button
                        type="button"
                        className="flex-1 break-words text-left px-1"
                        style={{
                          background: edgeModalId === edge.id ? "#000080" : "#E0E0E0",
                          color: edgeModalId === edge.id ? "#fff" : "#000",
                          border: "1px solid #808080",
                          cursor: "pointer",
                        }}
                        onClick={() => setEdgeModalId(edge.id)}
                        title={customLabel ? `${operator} • ${customLabel}` : operator}
                      >
                        {dir} {otherNode?.label ?? other} • {customLabel || operator}{handleInfo ? ` • ${handleInfo}` : ""}
                      </button>
                      <button type="button" className="text-[10px] px-1" style={{ background: "#C0C0C0", border: "1px solid #808080", cursor: "pointer" }} onClick={() => removeEdge(edge.id)}>×</button>
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setNodeModalId(selectedNode.id)}>
                Open Node Settings
              </Button>
              <Separator />
              <Button type="button" variant="destructive" size="sm" className="w-full h-7 text-xs" onClick={() => deleteNode(selectedNode.id)}>
                <Trash2 className="mr-1 h-3 w-3" /> Remove Node
              </Button>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-xs" style={{ color: "#808080" }}>Select a node to inspect</div>
          )}
        </ScrollArea>
        ) : (
          <div className="flex h-20 items-center justify-center text-[10px]" style={{ color: "#1f2937" }}>
            {selectedNode ? selectedNode.icon : "ℹ️"}
          </div>
        )}
      </div>

      <Button type="button" size="sm" className="fixed bottom-20 right-4 z-10 h-8 text-xs lg:hidden" onClick={() => addNodeFromType(filteredTemplates[0] ?? workspaceNodeTypes[0])}>
        <Plus className="mr-1 h-3 w-3" /> Add Node
      </Button>
        </div>
          ) : (
            <div className="min-h-0 flex-1">
              <WorkflowCodePanel
                nodes={nodes}
                edges={edges}
                selectedId={selectedId}
                workspaceKind={workspaceKind}
                onUpdate={applyWorkflow}
                onSelectNode={setSelectedId}
              />
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="ide" className="mt-0 min-h-0 flex-1">
        <WorkflowCodePanel
          nodes={nodes}
          edges={edges}
          selectedId={selectedId}
          workspaceKind={workspaceKind}
          onUpdate={applyWorkflow}
          onSelectNode={setSelectedId}
        />
      </TabsContent>

      {showRunConsole ? (
        <TabsContent value="console" className="mt-0 min-h-0 flex-1">
          <WorkflowConsolePanel
            nodes={nodes}
            edges={edges}
            onSelectNode={(id) => {
              setSelectedId(id);
              if (id && !lockView) setViewTab("canvas");
            }}
          />
        </TabsContent>
      ) : null}

      <WorkflowNodeDialog
        node={modalNode}
        nodes={nodes}
        edges={edges}
        open={Boolean(modalNode)}
        onClose={() => setNodeModalId(null)}
        onUpdate={updateSchemaNode}
        onDuplicate={duplicateNode}
        onDelete={deleteNode}
        onOpenEdge={(edgeId) => {
          setEdgeModalId(edgeId);
          setNodeModalId(null);
        }}
        onCreateChild={addSchemaChild}
      />

      <WorkflowEdgeDialog
        edge={selectedEdge}
        nodes={nodes}
        open={Boolean(selectedEdge)}
        onClose={() => setEdgeModalId(null)}
        onUpdate={updateEdge}
      />
    </Tabs>
  );
}
