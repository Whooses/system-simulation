"use client";

import SpeedControl from "./SpeedControl";
import ScenarioPicker from "./ScenarioPicker";
import ChaosMenu from "./ChaosMenu";
import SaveLoad from "./SaveLoad";
import type { Scenario, SimulationConfig } from "@/lib/engine/models";

// === Types ===

interface ToolbarProps {
  running: boolean;
  connected: boolean;
  speed: number;
  time: number;
  selectedScenario: Scenario | null;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onScenarioSelect: (scenario: Scenario) => void;
  onInjectChaos: (chaosType: string, target: string) => void;
  nodeIds: string[];
  onSave: (name: string) => void;
  onLoad: (config: SimulationConfig) => void;
}

/**
 * Header toolbar with simulation controls (Run/Pause/Stop), scenario picker,
 * speed control, chaos injection menu, save/load, clock, and connection indicator.
 */
export default function Toolbar({
  running, connected, speed, time, selectedScenario,
  onRun, onPause, onResume, onStop, onSpeedChange, onScenarioSelect,
  onInjectChaos, nodeIds, onSave, onLoad,
}: ToolbarProps) {
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h.toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        {!running ? (
          <button onClick={onRun} disabled={!connected || !selectedScenario}
            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-40">
            Run
          </button>
        ) : (
          <>
            <button onClick={speed === 0 ? onResume : onPause}
              className="rounded bg-yellow-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-yellow-500">
              {speed === 0 ? "Resume" : "Pause"}
            </button>
            <button onClick={onStop}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500">
              Stop
            </button>
          </>
        )}
      </div>

      <ScenarioPicker selected={selectedScenario} onSelect={onScenarioSelect} disabled={running} />
      <SpeedControl speed={speed} onSpeedChange={onSpeedChange} disabled={!running} />
      <ChaosMenu disabled={!running} onInjectChaos={onInjectChaos} nodeIds={nodeIds} />
      <SaveLoad onSave={onSave} onLoad={onLoad} disabled={running} />

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>{formatTime(time)}</span>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
      </div>
    </div>
  );
}
