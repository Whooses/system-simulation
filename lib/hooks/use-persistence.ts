"use client";

import type { SimulationConfig } from "@/lib/engine/models";

const STORAGE_KEY = "sim-configs";

export function usePersistence() {
  const save = (config: SimulationConfig) => {
    const existing = list();
    const filtered = existing.filter((c) => c.name !== config.name);
    filtered.push(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  const list = (): SimulationConfig[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  };

  const load = (name: string): SimulationConfig | undefined => {
    return list().find((c) => c.name === name);
  };

  const remove = (name: string) => {
    const filtered = list().filter((c) => c.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  return { save, list, load, remove };
}
