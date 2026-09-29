const API = "/api";

async function parse(res: Response) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || res.statusText);
  }
  return data;
}

export const api = {
  health: () => fetch(`${API}/health`).then(parse),
  system: () => fetch(`${API}/system/status`).then(parse),
  hardware: () => fetch(`${API}/hardware/status`).then(parse),
  hardwareInit: () => fetch(`${API}/hardware/initialize`, { method: "POST" }).then(parse),
  hardwareMode: (mode: string) =>
    fetch(`${API}/hardware/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).then(parse),
  hardwareBench: () => fetch(`${API}/hardware/benchmark`, { method: "POST" }).then(parse),
  pipeline: () => fetch(`${API}/pipeline`).then(parse),
  records: () => fetch(`${API}/records`).then(parse),
  record: (id: string) => fetch(`${API}/records/${id}`).then(parse),
  process: (record_id: string) =>
    fetch(`${API}/processing/run?record_id=${encodeURIComponent(record_id)}`, { method: "POST" }).then(parse),
  baseline: (body: object) =>
    fetch(`${API}/baseline/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse),
  twin: (body: object) =>
    fetch(`${API}/digital-twin/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse),
  train: (body: object) =>
    fetch(`${API}/model/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse),
  forecast: (body: object) =>
    fetch(`${API}/forecast/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse),
  evaluation: () => fetch(`${API}/evaluation`).then(parse),
  results: (id: string) => fetch(`${API}/results/${id}`).then(parse),
  modelRuns: () => fetch(`${API}/model/runs`).then(parse),
  scope: () => fetch(`${API}/scope`).then(parse),
  upload: async (file: File, sampling_rate: number, signal_column: string, time_column: string, lead: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sampling_rate", String(sampling_rate));
    fd.append("signal_column", signal_column);
    if (time_column) fd.append("time_column", time_column);
    fd.append("lead", lead);
    return parse(await fetch(`${API}/ecg/upload`, { method: "POST", body: fd }));
  },
};
