"use client";

import { NODE_DEFINITIONS } from "@/lib/node-defaults";
import PaletteItem from "./PaletteItem";

/**
 * Sidebar palette listing all available node types grouped by category.
 * Each item is draggable — drop onto the canvas to create a new node.
 */
export default function NodePalette() {
  const categories = [...new Set(NODE_DEFINITIONS.map((d) => d.category))];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nodes</p>
      {categories.map((cat) => (
        <div key={cat} className="flex flex-col gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">{cat}</p>
          {NODE_DEFINITIONS.filter((d) => d.category === cat).map((def) => (
            <PaletteItem key={def.type} type={def.type} label={def.label} color={def.color} />
          ))}
        </div>
      ))}
    </div>
  );
}
