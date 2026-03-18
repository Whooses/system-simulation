"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import { useNodesState, useEdgesState, addEdge, type Connection as RFConnection, type Node as RFNode } from "@xyflow/react";
import SimulationCanvas from "./components/canvas/simulation-canvas";
import NodePalette from "./components/palette/node-palette";
import Toolbar from "./components/toolbar/toolbar";
import TransactionLog from "./components/log/transaction-log";
import NodeConfigPanel from "./components/config/node-config-panel";
import { useSimulation } from "./hooks/use-simulation";
import { getNodeDefinition, NODE_DEFINITIONS } from "@/lib/node-defaults";
import { NodeType, type Scenario, type NodeConfig } from "@/lib/engine/models";

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { connected, state, connect, start, stop, pause, resume, setSpeed, send } = useSimulation();

  // Connect WS on mount
  useState(() => { connect(); });

  const onConnect = useCallback((connection: RFConnection) => {
    setEdges((eds) => addEdge({ ...connection, type: "animated" }, eds));
  }, [setEdges]);

  // Drag and drop from palette
  const onDragOver = useCallback((e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/reactflow-type") as NodeType;
    if (!type) return;

    const def = getNodeDefinition(type);
    if (!def) return;

    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    const position = { x: e.clientX - (bounds?.left ?? 0) - 70, y: e.clientY - (bounds?.top ?? 0) - 20 };

    const newNode: RFNode = {
      id: `${type}-${Date.now()}`,
      type: "simNode",
      position,
      data: { label: def.label, nodeType: type, config: def.defaultConfig },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // Node click for config panel
  const onNodeClick = useCallback((_: unknown, node: RFNode) => { setSelectedNodeId(node.id); }, []);

  // Run simulation
  const handleRun = useCallback(async () => {
    if (!selectedScenario || nodes.length === 0) return;

    const simNodes = nodes.map((n) => ({
      id: n.id, type: (n.data as any).nodeType as NodeType, label: (n.data as any).label as string,
      config: (n.data as any).config as NodeConfig,
      state: { queueDepth: 0, activeConnections: 0, health: "HEALTHY" as const, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
      position: n.position, connections: edges.filter((e) => e.source === n.id).map((e) => e.id),
    }));

    const simConnections = edges.map((e) => ({
      id: e.id, sourceNodeId: e.source, targetNodeId: e.target,
      protocol: "HTTP" as const, latency: { type: "constant" as const, value: 5 }, timeout: 5000,
    }));

    const res = await fetch("/api/simulation/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: simNodes, connections: simConnections, scenario: selectedScenario }),
    });
    const { simulationId } = await res.json();
    start(simulationId);
  }, [nodes, edges, selectedScenario, start]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h1 className="text-sm font-semibold">System Design Simulator</h1>
        <Toolbar running={state.running} connected={connected} speed={state.speed} time={state.time}
          selectedScenario={selectedScenario} onRun={handleRun} onPause={pause} onResume={resume}
          onStop={stop} onSpeedChange={setSpeed} onScenarioSelect={setSelectedScenario} />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 overflow-y-auto border-r border-zinc-800 p-3">
          <NodePalette />
        </aside>
        <main ref={reactFlowWrapper} className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <SimulationCanvas nodes={nodes} edges={edges} onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} />
        </main>
        {selectedNode && (
          <NodeConfigPanel nodeId={selectedNode.id} nodeType={(selectedNode.data as any).nodeType}
            config={(selectedNode.data as any).config} onClose={() => setSelectedNodeId(null)}
            onConfigChange={(id, config) => {
              setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, config: { ...(n.data as any).config, ...config } } } : n));
              if (state.running) send({ type: "UPDATE_CONFIG", data: { nodeId: id, config } });
            }} />
        )}
      </div>
      <footer className="h-48 border-t border-zinc-800">
        <TransactionLog transactions={state.transactions} />
      </footer>
    </div>
  );
}
