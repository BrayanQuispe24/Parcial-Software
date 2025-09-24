export interface diagramaCreate {
  name: string;
}

export interface diagramaResponse {
  id: string;
  name: string;
  version: number;
  updated_at: string;
  snapshot: Record<string, any>;
  wsUrl: string;
}
