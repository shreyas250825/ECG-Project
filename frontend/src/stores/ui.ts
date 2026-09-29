import { create } from "zustand";

type UIState = {
  cardiologistMode: boolean;
  demoMode: boolean;
  setCardiologistMode: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
};

export const useUI = create<UIState>((set) => ({
  cardiologistMode: false,
  demoMode: true,
  setCardiologistMode: (cardiologistMode) => set({ cardiologistMode }),
  setDemoMode: (demoMode) => set({ demoMode }),
}));
