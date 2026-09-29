import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function useRecords() {
  return useQuery({ queryKey: ["records"], queryFn: api.records });
}
