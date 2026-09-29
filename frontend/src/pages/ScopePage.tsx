import { useQuery } from "@tanstack/react-query";
import { Disclaimer } from "../components/Disclaimer";
import { api } from "../services/api";

export default function ScopePage() {
  const q = useQuery({ queryKey: ["scope"], queryFn: api.scope });
  const rows = q.data?.rows ?? [];
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">What can we predict?</h2>
      <Disclaimer compact />
      <table className="w-full border bg-white text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2">Entity</th>
            <th className="px-3 py-2">Role in this prototype</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: { entity: string; role: string }) => (
            <tr key={r.entity} className="border-t">
              <td className="px-3 py-2">{r.entity}</td>
              <td className="px-3 py-2">{r.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="max-w-3xl text-sm text-slate-700">{q.data?.note}</p>
    </div>
  );
}
