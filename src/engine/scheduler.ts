import type { TransitLine, RunEdge } from './types.js';

/**
 * Returns the cumulative travel time to reach stationIdx from the first stop.
 * stationIdx 0 → 0, stationIdx 1 → travelTimes[0], etc.
 */
export function getStationOffset(line: TransitLine, stationIdx: number): number {
  let offset = 0;
  for (let i = 0; i < stationIdx; i++) {
    offset += line.travelTimes[i];
  }
  return offset;
}

/**
 * Given a line, the index of the station on that line, and the time you arrive
 * at that station, returns the next departure time (minutes since midnight)
 * from that station, or null if no more trains run today.
 *
 * The line schedule is defined from the first stop. Trains depart the first
 * stop at firstDeparture, firstDeparture + headwayMin, ..., lastDeparture.
 * Each subsequent station is offset by getStationOffset.
 */
export function nextDeparture(
  line: TransitLine,
  stationIdx: number,
  arriveAt: number
): number | null {
  const offset = getStationOffset(line, stationIdx);

  // First and last departure times at this station
  const firstAtStation = line.firstDeparture + offset;
  const lastAtStation = line.lastDeparture + offset;

  if (arriveAt > lastAtStation) {
    return null;
  }

  if (arriveAt <= firstAtStation) {
    return firstAtStation;
  }

  // Find the earliest departure at or after arriveAt
  const elapsed = arriveAt - firstAtStation;
  const cyclesNeeded = Math.ceil(elapsed / line.headwayMin);
  const departure = firstAtStation + cyclesNeeded * line.headwayMin;

  if (departure > lastAtStation) {
    return null;
  }

  return departure;
}

/**
 * Returns the arrival time at the destination of a run edge.
 */
export function runArrival(departAt: number, edge: RunEdge): number {
  return departAt + edge.timeMin;
}

/**
 * Returns the cumulative travel time to reach stationIdx from the LAST stop,
 * traveling in reverse. stationIdx at last stop → 0, one before last → travelTimes[last-1], etc.
 */
export function getStationOffsetReverse(line: TransitLine, stationIdx: number): number {
  const lastIdx = line.stops.length - 1;
  let offset = 0;
  for (let i = lastIdx - 1; i >= stationIdx; i--) {
    offset += line.travelTimes[i];
  }
  return offset;
}

/**
 * Next reverse-direction departure at stationIdx.
 * The reverse train departs from the LAST stop at firstDeparture + headway intervals,
 * and arrives at intermediate stations with offsets calculated from the end.
 * Returns null if no more reverse trains today.
 */
export function nextDepartureReverse(
  line: TransitLine,
  stationIdx: number,
  arriveAt: number
): number | null {
  const offset = getStationOffsetReverse(line, stationIdx);

  const firstAtStation = line.firstDeparture + offset;
  const lastAtStation = line.lastDeparture + offset;

  if (arriveAt > lastAtStation) {
    return null;
  }

  if (arriveAt <= firstAtStation) {
    return firstAtStation;
  }

  const elapsed = arriveAt - firstAtStation;
  const cyclesNeeded = Math.ceil(elapsed / line.headwayMin);
  const departure = firstAtStation + cyclesNeeded * line.headwayMin;

  if (departure > lastAtStation) {
    return null;
  }

  return departure;
}
