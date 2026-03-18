"use client";

import { PREDEFINED_SCENARIOS } from "@/lib/scenarios";
import type { Scenario } from "@/lib/engine/models";

interface ScenarioPickerProps {
  selected: Scenario | null;
  onSelect: (scenario: Scenario) => void;
  disabled?: boolean;
}

export default function ScenarioPicker({ selected, onSelect, disabled }: ScenarioPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500">Scenario:</span>
      <select
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
        value={selected?.id ?? ""} disabled={disabled}
        onChange={(e) => {
          const s = PREDEFINED_SCENARIOS.find((sc) => sc.id === e.target.value);
          if (s) onSelect(s);
        }}
      >
        <option value="">Select...</option>
        {PREDEFINED_SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}
