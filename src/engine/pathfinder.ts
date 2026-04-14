import type { GraphState, RouteStep } from './types.js';
import type { Connection } from './graph.js';
import { computeStepTiming } from './graph.js';

interface OutgoingConnection {
  toStationId: string;
  connection: Connection;
}

interface SegmentResult {
  steps: RouteStep[];
  arrivalTime: number;
  finalLineId: string | null;
}

export interface RouteSolveResult {
  steps: RouteStep[];
  startTime: number;
  totalMin: number;
}

export interface StartTimeSearchWindow {
  startMin: number;
  endMin: number;
}

function stateKey(stationId: string, previousLineId: string | null): string {
  return `${stationId}::${previousLineId ?? 'run'}`;
}

function collectOutgoingConnections(state: GraphState, fromStationId: string): OutgoingConnection[] {
  const outgoing: OutgoingConnection[] = [];

  for (const line of Object.values(state.lines)) {
    const fromIdx = line.stops.indexOf(fromStationId);
    if (fromIdx === -1) continue;

    for (let toIdx = fromIdx + 1; toIdx < line.stops.length; toIdx++) {
      outgoing.push({
        toStationId: line.stops[toIdx],
        connection: {
          type: 'line',
          lineId: line.id,
          fromIdx,
          toIdx,
          direction: 'forward',
        },
      });
    }

    if (line.bidirectional) {
      for (let toIdx = 0; toIdx < fromIdx; toIdx++) {
        outgoing.push({
          toStationId: line.stops[toIdx],
          connection: {
            type: 'line',
            lineId: line.id,
            fromIdx,
            toIdx,
            direction: 'reverse',
          },
        });
      }
    }
  }

  for (const edge of state.runEdges) {
    if (edge.from === fromStationId) {
      outgoing.push({
        toStationId: edge.to,
        connection: { type: 'run', edge },
      });
    }

    if (edge.bidirectional && edge.to === fromStationId) {
      outgoing.push({
        toStationId: edge.from,
        connection: {
          type: 'run',
          edge: {
            ...edge,
            from: fromStationId,
            to: edge.from,
          },
        },
      });
    }
  }

  return outgoing;
}

export function findEarliestSegment(
  state: GraphState,
  fromStationId: string,
  toStationId: string,
  departureTime: number,
  previousLineId: string | null
): SegmentResult | null {
  if (fromStationId === toStationId) {
    return {
      steps: [],
      arrivalTime: departureTime,
      finalLineId: previousLineId,
    };
  }

  const queue: Array<{ stationId: string; prevLineId: string | null; time: number }> = [
    { stationId: fromStationId, prevLineId: previousLineId, time: departureTime },
  ];

  const bestTime = new Map<string, number>();
  const predecessor = new Map<string, { prevKey: string; step: RouteStep }>();
  const originKey = stateKey(fromStationId, previousLineId);
  bestTime.set(originKey, departureTime);

  let finalState: { stationId: string; prevLineId: string | null; time: number } | null = null;

  while (queue.length > 0) {
    queue.sort((a, b) => a.time - b.time);
    const current = queue.shift()!;
    const currentKey = stateKey(current.stationId, current.prevLineId);

    if (bestTime.get(currentKey) !== current.time) continue;

    if (current.stationId === toStationId) {
      finalState = current;
      break;
    }

    const outgoing = collectOutgoingConnections(state, current.stationId);
    for (const edge of outgoing) {
      try {
        const step = computeStepTiming(
          state,
          current.time,
          current.stationId,
          edge.toStationId,
          edge.connection,
          current.prevLineId
        );

        const nextLineId = step.lineId;
        const nextKey = stateKey(step.stationId, nextLineId);
        const nextTime = step.cumulativeMin;
        const knownBest = bestTime.get(nextKey);

        if (knownBest === undefined || nextTime < knownBest) {
          bestTime.set(nextKey, nextTime);
          predecessor.set(nextKey, { prevKey: currentKey, step });
          queue.push({ stationId: step.stationId, prevLineId: nextLineId, time: nextTime });
        }
      } catch {
        // No valid departure for this edge at this time.
      }
    }
  }

  if (!finalState) return null;

  const resultSteps: RouteStep[] = [];
  let cursorKey = stateKey(finalState.stationId, finalState.prevLineId);
  while (cursorKey !== originKey) {
    const prev = predecessor.get(cursorKey);
    if (!prev) return null;
    resultSteps.push(prev.step);
    cursorKey = prev.prevKey;
  }

  resultSteps.reverse();

  return {
    steps: resultSteps,
    arrivalTime: finalState.time,
    finalLineId: finalState.prevLineId,
  };
}

function buildRouteForWaypointsAtStartTime(
  state: GraphState,
  waypoints: string[],
  startTime: number
): RouteStep[] | null {
  if (waypoints.length === 0) return null;

  const route: RouteStep[] = [{
    stationId: waypoints[0],
    lineId: null,
    arriveAt: startTime,
    waitTime: 0,
    departAt: startTime,
    travelTime: 0,
    cumulativeMin: startTime,
  }];

  let currentTime = startTime;
  let previousLineId: string | null = null;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const segment = findEarliestSegment(
      state,
      waypoints[i],
      waypoints[i + 1],
      currentTime,
      previousLineId
    );

    if (!segment) return null;

    route.push(...segment.steps);
    currentTime = segment.arrivalTime;
    previousLineId = segment.finalLineId;
  }

  return route;
}

export function solveFastestRouteForOrderedWaypoints(
  state: GraphState,
  waypoints: string[],
  window?: StartTimeSearchWindow
): RouteSolveResult | null {
  if (waypoints.length < 2) return null;

  const searchStart = Math.max(0, Math.min(24 * 60 - 1, window?.startMin ?? 0));
  const searchEnd = Math.max(0, Math.min(24 * 60 - 1, window?.endMin ?? 24 * 60 - 1));
  if (searchStart > searchEnd) return null;

  let best: RouteSolveResult | null = null;

  for (let startTime = searchStart; startTime <= searchEnd; startTime++) {
    const steps = buildRouteForWaypointsAtStartTime(state, waypoints, startTime);
    if (!steps) continue;

    const endTime = steps[steps.length - 1].cumulativeMin;
    const totalMin = endTime - startTime;

    if (
      !best
      || totalMin < best.totalMin
      || (totalMin === best.totalMin && startTime < best.startTime)
    ) {
      best = { steps, startTime, totalMin };
    }
  }

  return best;
}
