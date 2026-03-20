"use client";

import { useState } from "react";
import { usePersistence } from "@/lib/hooks/use-persistence";
import type { SimulationConfig } from "@/lib/engine/models";

interface SaveLoadProps {
  onSave: (name: string) => void;
  onLoad: (config: SimulationConfig) => void;
  disabled?: boolean;
}

export default function SaveLoad({ onSave, onLoad, disabled }: SaveLoadProps) {
  const { list, load } = usePersistence();
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    if (name.trim()) { onSave(name.trim()); setShowSave(false); setName(""); }
  };

  const handleLoad = (configName: string) => {
    const config = load(configName);
    if (config) { onLoad(config); setShowLoad(false); }
  };

  const configs = list();

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <button onClick={() => { setShowSave(!showSave); setShowLoad(false); }} disabled={disabled}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40">
          Save
        </button>
        {showSave && (
          <div className="absolute left-0 top-full z-50 mt-1 flex w-48 gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-2 shadow-xl">
            <input type="text" placeholder="Config name..." value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300" />
            <button onClick={handleSave} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">OK</button>
          </div>
        )}
      </div>
      <div className="relative">
        <button onClick={() => { setShowLoad(!showLoad); setShowSave(false); }} disabled={disabled}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40">
          Load
        </button>
        {showLoad && configs.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-xl">
            {configs.map((c) => (
              <button key={c.name} onClick={() => handleLoad(c.name)}
                className="flex w-full rounded px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700">
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
