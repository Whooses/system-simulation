"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNodesState, useEdgesState, type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import { useSimulation } from "@/lib/hooks/use-simulation";
import { buildTopology } from "@/lib/build-topology";
import { type NodeData } from "@/components/Canvas/Canvas.types";
import { type Scenario, type NodeConfig, type SimulationConfig } from "@/lib/engine/models";
import Canvas from "@/components/Canvas";
import NodePalette from "@/components/Palette";
import Toolbar from "@/components/Toolbar";
import TransactionLog from "@/components/TransactionLog";
import NodeConfigPanel from "@/components/ConfigPanel";

/**
 * Top-level orchestration component — owns all shared state and
 * composes the full simulator UI: toolbar, palette, canvas, config panel, and log.
 *
 * Responsible for:
 * - WebSocket connection lifecycle
 * - Building topology from canvas nodes/edges and initiating simulation runs
 * - Routing config changes and chaos injection to the WS server
 */
export default function SimulatorLayout() {
  // === State ===

  const { connected, state, connect, disconnect, start, stop, pause, resume, setSpeed, send } = useSimulation();
  const [nodes, setNodes, onNodesChange] = useNodesState([] as RFNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as RFEdge[]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // === WebSocket Lifecycle ===

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // === Simulation Control ===

  /** Build topology from canvas state, POST to create endpoint, then start via WS. */
  const handleRun = useCallback(async () => {
    if (!selectedScenario || nodes.length === 0) return;

    const topology = buildTopology(nodes, edges);
    const res = await fetch("/api/simulation/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...topology, scenario: selectedScenario }),
    });

    const { simulationId } = await res.json();
    start(simulationId);
  }, [nodes, edges, selectedScenario, start]);

  // === Config & Chaos ===

  /** Update a node's config locally and, if running, push the change to the server. */
  const handleConfigChange = useCallback((id: string, config: Partial<NodeConfig>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const data = n.data as NodeData;
        return { ...n, data: { ...data, config: { ...data.config, ...config } } };
      })
    );
    if (state.running) send({ type: "UPDATE_CONFIG", data: { nodeId: id, config } });
  }, [setNodes, state.running, send]);

  const handleInjectChaos = useCallback((chaosType: string, target: string) => {
    send({ type: "INJECT_CHAOS", data: { chaosType, target } });
  }, [send]);

  const handleSave = useCallback((_name: string) => {
    // SaveLoad component handles persistence internally via usePersistence
  }, []);

  const handleLoad = useCallback((_config: SimulationConfig) => {
    // Future: restore canvas state from config
  }, []);

  const handleNodeSelect = useCallback((node: RFNode | undefined) => {
    setSelectedNodeId(node?.id ?? null);
  }, []);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);

  // === Layout ===

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h1 className="text-sm font-semibold">System Design Simulator</h1>
        <Toolbar
          running={state.running}
          connected={connected}
          speed={state.speed}
          time={state.time}
          selectedScenario={selectedScenario}
          onRun={handleRun}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          onSpeedChange={setSpeed}
          onScenarioSelect={setSelectedScenario}
          onInjectChaos={handleInjectChaos}
          nodeIds={nodeIds}
          onSave={handleSave}
          onLoad={handleLoad}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 overflow-y-auto border-r border-zinc-800 p-3">
          <NodePalette />
        </aside>

        <Canvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodeSelect={handleNodeSelect}
        />

        {selectedNode && (
          <NodeConfigPanel
            nodeId={selectedNode.id}
            nodeType={(selectedNode.data as NodeData).nodeType}
            config={(selectedNode.data as NodeData).config}
            onClose={() => setSelectedNodeId(null)}
            onConfigChange={handleConfigChange}
          />
        )}
      </div>

      <footer className="h-48 border-t border-zinc-800">
        <TransactionLog transactions={state.transactions} />
      </footer>
    </div>
  );
}
