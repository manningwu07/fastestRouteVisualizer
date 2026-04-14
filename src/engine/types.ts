export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  agency?: string;
}

export interface TransitLine {
  id: string;
  color: string;
  agency: string;
  stops: string[];         // ordered station IDs
  travelTimes: number[];   // minutes between consecutive stops (length = stops.length - 1)
  firstDeparture: number;  // minutes since midnight from first stop
  lastDeparture: number;
  headwayMin: number;      // frequency
  bidirectional: boolean;  // default true; if true, trains run in reverse direction too
}

export interface RunEdge {
  id: string;
  from: string;
  to: string;
  timeMin: number;
  bidirectional: boolean;
}

export interface Transfer {
  stationId: string;
  fromLineId: string;
  toLineId: string;
  transferMin: number;     // default: 0 same agency, 1 cross-agency
}

export interface RouteStep {
  stationId: string;
  lineId: string | null;   // null = run segment
  arriveAt: number;        // minutes since midnight
  waitTime: number;
  departAt: number;
  travelTime: number;      // to NEXT step
  cumulativeMin: number;
}

export interface Route {
  startTime: number;
  steps: RouteStep[];
  totalMin: number;
}

export interface GraphState {
  stations: Record<string, Station>;
  lines: Record<string, TransitLine>;
  runEdges: RunEdge[];
  transfers: Transfer[];
}
