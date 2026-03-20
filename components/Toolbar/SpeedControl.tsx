"use client";

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled?: boolean;
}

/** Available simulation speed multipliers. */
const SPEEDS = [0.1, 0.5, 1, 2, 5, 10, 20];

/** Dropdown to adjust the simulation speed multiplier (0.1x–20x). */
export default function SpeedControl({ speed, onSpeedChange, disabled }: SpeedControlProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500">Speed:</span>
      <select
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
        value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))} disabled={disabled}
      >
        {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
      </select>
    </div>
  );
}
