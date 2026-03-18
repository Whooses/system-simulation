"use client";

import { useRef, useEffect } from "react";
import type { Transaction } from "@/lib/engine/models";

interface TransactionLogProps {
  transactions: Transaction[];
  onRowClick?: (transaction: Transaction) => void;
}

export default function TransactionLog({ transactions, onRowClick }: TransactionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transactions.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-zinc-800 px-3 py-1.5">
        <span className="text-xs font-semibold text-zinc-400">Transaction Log</span>
        <span className="text-[10px] text-zinc-600">{transactions.length} events</span>
      </div>
      <div className="grid grid-cols-[80px_100px_100px_60px_1fr_60px_50px] gap-2 border-b border-zinc-800 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        <span>Time</span><span>Source</span><span>Target</span><span>Proto</span><span>Message</span><span>Latency</span><span>Status</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {transactions.map((tx, i) => (
          <div key={tx.id + i}
            className="grid cursor-pointer grid-cols-[80px_100px_100px_60px_1fr_60px_50px] gap-2 border-b border-zinc-900 px-3 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800/50"
            onClick={() => onRowClick?.(tx)}>
            <span className="text-zinc-500">{String(tx.metadata?.timestamp ?? "—")}</span>
            <span>{String(tx.metadata?.source ?? "—")}</span>
            <span>{String(tx.metadata?.target ?? "—")}</span>
            <span>{tx.protocol}</span>
            <span className="truncate">{tx.message.method} {tx.message.path}</span>
            <span>{tx.result?.latency?.toFixed(1) ?? "—"}ms</span>
            <span className={tx.result?.status === "SUCCESS" ? "text-green-500" : "text-red-500"}>
              {tx.result?.statusCode ?? "..."}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
