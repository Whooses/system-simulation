"use client";

import type { SimulationConfig } from "@/lib/engine/models";

const STORAGE_KEY = "sim-configs";

/**
 * Hook for persisting simulation configurations to localStorage.
 *
 * Provides CRUD operations over named {@link SimulationConfig} entries.
 * Saves are upserted by name (existing configs with the same name are replaced).
 */
export function usePersistence() {
  /** Save or overwrite a simulation config by name. */
  const save = (config: SimulationConfig) => {
    const existing = list();
    const filtered = existing.filter((c) => c.name !== config.name);
    filtered.push(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  /** List all saved simulation configs. */
  const list = (): SimulationConfig[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  };

  /** Load a single config by name. */
  const load = (name: string): SimulationConfig | undefined => {
    return list().find((c) => c.name === name);
  };

  /** Delete a saved config by name. */
  const remove = (name: string) => {
    const filtered = list().filter((c) => c.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  return { save, list, load, remove };
}
