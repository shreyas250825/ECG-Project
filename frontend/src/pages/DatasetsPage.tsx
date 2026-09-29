import { useQuery } from "@tanstack/react-query";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";
import type { ResearchRecord } from "../types/research";

export default function DatasetsPage() {
  const q = useQuery({ queryKey: ["records"], queryFn: api.records });
  const records: ResearchRecord[] = q.data?.records ?? [];
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Datasets / recordings</h2>
      <Disclaimer compact />
      <p className="text-sm text-slate-600">
        Identifiers are research record names only. No patient names, phone numbers, hospital IDs, Aadhaar, or medical record numbers are stored in this prototype.
      </p>
      {records.length === 0 && <p>No ECG data loaded. Start the API to seed the synthetic demonstration record.</p>}
      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Record", "Source", "Duration (s)", "fs (Hz)", "Leads", "Annotations", "Privacy"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.record_name}</td>
                <td className="px-3 py-2">{r.source_dataset}</td>
                <td className="px-3 py-2">{r.duration_seconds?.toFixed?.(0)}</td>
                <td className="px-3 py-2">{r.sampling_rate}</td>
                <td className="px-3 py-2">{r.lead_count ?? 1}</td>
                <td className="px-3 py-2">{r.has_annotations ? "yes" : "no"}</td>
                <td className="px-3 py-2">{r.privacy_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
