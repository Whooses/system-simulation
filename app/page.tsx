import SimulationCanvas from "./components/canvas/simulation-canvas";

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h1 className="text-sm font-semibold">System Design Simulator</h1>
        <div className="flex items-center gap-2"></div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 border-r border-zinc-800 p-3">
          <p className="text-xs text-zinc-500">Node Palette</p>
        </aside>
        <main className="flex-1">
          <SimulationCanvas />
        </main>
      </div>
      <footer className="h-48 border-t border-zinc-800 p-3">
        <p className="text-xs text-zinc-500">Transaction Log</p>
      </footer>
    </div>
  );
}
