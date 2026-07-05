export type SourceType =
  | "slack"
  | "jira"
  | "meetings"
  | "support"
  | "code"
  | "directory";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  source_type: SourceType | string;
  sources: string[];
  val: number;
  // Mutated at runtime by react-force-graph for layout + our highlighting.
  x?: number;
  y?: number;
  __active?: boolean;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relationship: string;
  __active?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type InsightType =
  | "blind_spot"
  | "contradiction"
  | "hidden_expert"
  | "relevant";

export interface Contact {
  name: string;
  email: string;
  role?: string;
}

export interface Insight {
  context: string;
  insight_type: InsightType;
  insight: string;
  sources: string[];
  supporting: { source: string; text: string }[];
  // People to contact, extracted from the insight text (#6). Surfaced as
  // one-click mailto chips in the chat.
  contacts: Contact[];
  // Cognee session this interaction was remembered under (memory lifecycle).
  session_id: string;
  // True when the answer came from Cognee's recall() (auto-routed memory API).
  from_recall?: boolean;
}

export interface Preset {
  key: string;
  label: string;
  insight_type: InsightType;
}

export interface Stats {
  total_nodes: number;
  total_edges: number;
  cross_silo_bridges: number;
  sources: string[];
  insights_surfaced: number;
  contradictions_found: number;
  blind_spots_prevented: number;
}
