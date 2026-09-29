import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../services/api";
import type { PipelineStage } from "../types/research";
import { Disclaimer } from "../components/Disclaimer";

export default function PipelinePage() {
  const q = useQuery({ queryKey: ["pipeline"], queryFn: api.pipeline });
  const [id, setId] = useState<string | null>(null);
  const stages: PipelineStage[] = q.data?.stages ?? [];
  const selected = stages.find((s) => s.id === id) ?? stages[0];
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Research pipeline</h2>
      <p className="text-slate-600">
        Click a stage for methods. This page documents process, not experimental accuracy.
      </p>
      <Disclaimer compact />
      {q.isError && <p className="text-sm text-red-800">Backend unavailable. Start the FastAPI server.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <ol className="space-y-1">
          {stages.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setId(s.id)}
                className={`w-full border px-3 py-2 text-left text-sm ${selected?.id === s.id ? "border-teal-800 bg-teal-50" : "border-slate-200 bg-white"}`}
              >
                {i + 1}. {s.title}
              </button>
            </li>
          ))}
        </ol>
        {selected && (
          <article className="md:col-span-2 space-y-3 border border-slate-200 bg-white p-5 text-sm">
            <h3 className="text-lg">{selected.title}</h3>
            <p><span className="font-semibold">What it does: </span>{selected.does}</p>
            <p><span className="font-semibold">Input: </span>{selected.input}</p>
            <p><span className="font-semibold">Output: </span>{selected.output}</p>
            <p><span className="font-semibold">Algorithm: </span>{selected.algorithm}</p>
            <p><span className="font-semibold">Why: </span>{selected.reason}</p>
            <p><span className="font-semibold">Limitations: </span>{selected.limitations}</p>
          </article>
        )}
      </div>
    </div>
  );
}
