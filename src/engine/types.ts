export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  agencies: string[];  // supports multiple agencies per station
}

export interface LineSchedule {
  firstDeparture: number;  // minutes since midnight, departure from FIRST stop in this direction
  lastDeparture: number;
  headwayMin: number;
}

export interface TransitLine {
  id: string;
  color: string;
  agency: string;
  stops: string[];              // ordered station IDs (forward direction)
  travelTimes: number[];        // minutes between consecutive stops (length = stops.length - 1)
  reverseTravelTimes?: number[]; // optional reverse-direction segment times, aligned to forward segment indices
  forwardSchedule: LineSchedule;
  reverseSchedule?: LineSchedule; // only if bidirectional
  bidirectional: boolean;
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
