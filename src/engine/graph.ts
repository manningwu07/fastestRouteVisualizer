import type { GraphState, Transfer, RunEdge, RouteStep } from './types.js';
import { nextDeparture, nextDepartureReverse, runArrival, getStationOffset, getStationOffsetReverse } from './scheduler.js';

type LineConnection = {
  type: 'line';
  lineId: string;
  fromIdx: number;
  toIdx: number;
  direction: 'forward' | 'reverse';
};

type RunConnection = {
  type: 'run';
  edge: RunEdge;
};

export type Connection = LineConnection | RunConnection;

/**
 * For every pair of lines that share a station, generate a Transfer entry.
 * Default 0 min if same agency, 1 min if different agency.
 * For stations with agencies[], a transfer is "same agency" (0 min) if the two lines
 * share ANY agency in common with the station's agencies list.
 * Generates transfers in both directions (A→B and B→A).
 */
export function generateTransfers(state: GraphState): Transfer[] {
  const transfers: Transfer[] = [];
  const lineIds = Object.keys(state.lines);

  for (let i = 0; i < lineIds.length; i++) {
    for (let j = i + 1; j < lineIds.length; j++) {
      const lineA = state.lines[lineIds[i]];
      const lineB = state.lines[lineIds[j]];
      const stopsA = new Set(lineA.stops);

      for (const stop of lineB.stops) {
        if (stopsA.has(stop)) {
          let transferMin: number;
          const station = state.stations[stop];
          if (station && station.agencies && station.agencies.length > 0) {
            // Same agency if either line's agency is in the station's agencies list
            // AND both lines share an agency listed at this station
            const stationAgencySet = new Set(station.agencies);
            const aInStation = stationAgencySet.has(lineA.agency);
            const bInStation = stationAgencySet.has(lineB.agency);
            // "same agency" means both lines operate under a common agency at this station
            transferMin = (aInStation && bInStation) ? 0 : 1;
          } else {
            // No station agencies defined: fall back to line agency comparison
            transferMin = lineA.agency === lineB.agency ? 0 : 1;
          }

          transfers.push({
            stationId: stop,
            fromLineId: lineA.id,
            toLineId: lineB.id,
            transferMin,
          });

          transfers.push({
            stationId: stop,
            fromLineId: lineB.id,
            toLineId: lineA.id,
            transferMin,
          });
        }
      }
    }
  }

  return transfers;
}

/**
 * Find all ways to travel directly from fromStationId to toStationId.
 * Includes lines where both stations appear in order, and run edges.
 */
export function getConnectionsBetween(
  state: GraphState,
  fromStationId: string,
  toStationId: string
): Connection[] {
  const connections: Connection[] = [];

  // Check each transit line
  for (const line of Object.values(state.lines)) {
    const fromIdx = line.stops.indexOf(fromStationId);
    const toIdx = line.stops.indexOf(toStationId);

    if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
      // Forward direction: fromStation appears before toStation
      connections.push({
        type: 'line',
        lineId: line.id,
        fromIdx,
        toIdx,
        direction: 'forward',
      });
    } else if (line.bidirectional && fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
      // Reverse direction: toStation appears before fromStation in the stops array,
      // but the line is bidirectional so we can travel it in reverse
      connections.push({
        type: 'line',
        lineId: line.id,
        fromIdx,
        toIdx,
        direction: 'reverse',
      });
    }
  }

  // Check run edges
  for (const edge of state.runEdges) {
    if (edge.from === fromStationId && edge.to === toStationId) {
      connections.push({ type: 'run', edge });
    } else if (
      edge.bidirectional &&
      edge.from === toStationId &&
      edge.to === fromStationId
    ) {
      // Create a flipped virtual edge
      connections.push({
        type: 'run',
        edge: {
          ...edge,
          from: fromStationId,
          to: toStationId,
        },
      });
    }
  }

  return connections;
}

/**
 * Given a connection choice, compute the full RouteStep.
 * currentTime is when we arrive at fromStationId.
 * previousLineId is the line we came in on (null if first step), used to
 * determine transfer time when switching lines.
 */
export function computeStepTiming(
  state: GraphState,
  currentTime: number,
  fromStationId: string,
  toStationId: string,
  connection: Connection,
  previousLineId: string | null
): RouteStep {
  if (connection.type === 'run') {
    const edge = connection.edge;
    const arriveAt = currentTime;
    const waitTime = 0;
    const departAt = currentTime;
    const travelTime = edge.timeMin;

    return {
      stationId: fromStationId,
      lineId: null,
      arriveAt,
      waitTime,
      departAt,
      travelTime,
      cumulativeMin: currentTime + travelTime,
    };
  }

  // Line connection
  const { lineId, fromIdx, toIdx, direction } = connection;
  const line = state.lines[lineId];

  // Determine transfer time
  let transferMin = 0;
  if (previousLineId !== null && previousLineId !== lineId) {
    // Look up an explicit transfer record first
    const transferRecord = state.transfers.find(
      (t) =>
        t.stationId === fromStationId &&
        t.fromLineId === previousLineId &&
        t.toLineId === lineId
    );

    if (transferRecord) {
      transferMin = transferRecord.transferMin;
    } else {
      // Fall back: same agency = 0, cross-agency = 1
      const prevLine = state.lines[previousLineId];
      transferMin = prevLine && prevLine.agency === line.agency ? 0 : 1;
    }
  }

  const effectiveArrival = currentTime + transferMin;

  let dep: number | null;
  let travelTime = 0;

  if (direction === 'reverse') {
    // Reverse travel: fromIdx > toIdx in the stops array
    dep = nextDepartureReverse(line, fromIdx, effectiveArrival);
    if (dep === null) {
      throw new Error(
        `No more reverse departures on line ${lineId} from station index ${fromIdx} after time ${effectiveArrival}`
      );
    }
    // Travel time is the sum of travelTimes between toIdx and fromIdx (same segments, reversed)
    const reverseSegmentTimes = line.reverseTravelTimes ?? line.travelTimes;
    for (let i = toIdx; i < fromIdx; i++) {
      travelTime += reverseSegmentTimes[i];
    }
  } else {
    // Forward travel: fromIdx < toIdx
    dep = nextDeparture(line, fromIdx, effectiveArrival);
    if (dep === null) {
      throw new Error(
        `No more departures on line ${lineId} from station index ${fromIdx} after time ${effectiveArrival}`
      );
    }
    for (let i = fromIdx; i < toIdx; i++) {
      travelTime += line.travelTimes[i];
    }
  }

  const waitTime = dep - currentTime; // includes transfer time in wait
  const departAt = dep;
  const arrivalAtNext = departAt + travelTime;

  return {
    stationId: fromStationId,
    lineId,
    arriveAt: currentTime,
    waitTime,
    departAt,
    travelTime,
    cumulativeMin: arrivalAtNext,
  };
}
