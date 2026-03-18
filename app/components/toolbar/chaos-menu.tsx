"use client";

import { useState } from "react";

interface ChaosMenuProps {
  disabled?: boolean;
  onInjectChaos: (chaosType: string, target: string) => void;
  nodeIds: string[];
}

export default function ChaosMenu({ disabled, onInjectChaos, nodeIds }: ChaosMenuProps) {
  const [open, setOpen] = useState(false);

  const chaosActions = [
    { id: "kill-random", label: "Kill Random Node", description: "Crash a random non-client node" },
    { id: "spike-latency", label: "Spike Latency", description: "10x latency on a random node" },
    { id: "network-partition", label: "Network Partition", description: "Disconnect a random node" },
    { id: "increase-traffic", label: "Increase Traffic", description: "Double the request rate" },
  ];

  const handleAction = (chaosType: string) => {
    const nonClientNodes = nodeIds.filter((id) => !id.toLowerCase().startsWith("client"));
    const target = nonClientNodes.length > 0
      ? nonClientNodes[Math.floor(Math.random() * nonClientNodes.length)]
      : nodeIds[0] ?? "";
    if (target) onInjectChaos(chaosType, target);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={disabled}
        className="rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-40">
        Chaos
      </button>
      {open && !disabled && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-xl">
          {chaosActions.map((action) => (
            <button key={action.id} onClick={() => handleAction(action.id)}
              className="flex w-full flex-col rounded px-3 py-2 text-left hover:bg-zinc-700">
              <span className="text-xs font-medium text-zinc-200">{action.label}</span>
              <span className="text-[10px] text-zinc-500">{action.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
