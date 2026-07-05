import type { InsightType } from "./types";

export const SOURCE_COLORS: Record<string, string> = {
  slack: "#38bdf8",
  jira: "#34d399",
  support: "#fbbf24",
  code: "#a78bfa",
  meetings: "#2dd4bf",
  directory: "#e879f9",
  unknown: "#94a3b8",
};

export const TYPE_ACCENT: Record<InsightType, string> = {
  blind_spot: "#fb7185",
  contradiction: "#fbbf24",
  hidden_expert: "#34d399",
  relevant: "#60a5fa",
};

export const TYPE_LABEL: Record<InsightType, string> = {
  blind_spot: "Blind Spot",
  contradiction: "Contradiction",
  hidden_expert: "Hidden Expert",
  relevant: "Relevant",
};

export const sourceColor = (s: string) => SOURCE_COLORS[s] ?? SOURCE_COLORS.unknown;
