"use client";

import { type DragEvent } from "react";
import { NodeType } from "@/lib/engine/models";

interface PaletteItemProps { type: NodeType; label: string; color: string; }

/**
 * A single draggable node type in the palette sidebar.
 * Sets the node type on the drag data transfer so the canvas
 * can create the correct node on drop.
 */
export default function PaletteItem({ type, label, color }: PaletteItemProps) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("application/reactflow-type", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="cursor-grab rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium transition-colors hover:border-zinc-500"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }} draggable onDragStart={onDragStart}>
      {label}
    </div>
  );
}
