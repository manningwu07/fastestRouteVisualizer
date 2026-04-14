import type { TransitLine, LineSchedule, RunEdge } from './types.js';

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
 * Given a schedule, the offset of the station in that direction, and the time
 * you arrive at the station, returns the next departure time (minutes since midnight),
 * or null if no more trains run today.
 */
function nextDepartureFromSchedule(
  schedule: LineSchedule,
  stationOffset: number,
  arriveAt: number
): number | null {
  const firstAtStation = schedule.firstDeparture + stationOffset;
  const lastAtStation = schedule.lastDeparture + stationOffset;

  if (arriveAt > lastAtStation) {
    return null;
  }

  if (arriveAt <= firstAtStation) {
    return firstAtStation;
  }

  const elapsed = arriveAt - firstAtStation;
  const cyclesNeeded = Math.ceil(elapsed / schedule.headwayMin);
  const departure = firstAtStation + cyclesNeeded * schedule.headwayMin;

  if (departure > lastAtStation) {
    return null;
  }

  return departure;
}

/**
 * Given a line, the index of the station on that line, and the time you arrive
 * at that station, returns the next forward-direction departure time (minutes since midnight)
 * from that station, or null if no more trains run today.
 *
 * The line schedule is defined from the first stop. Trains depart the first
 * stop at forwardSchedule.firstDeparture, +headwayMin, ..., lastDeparture.
 * Each subsequent station is offset by getStationOffset.
 */
export function nextDeparture(
  line: TransitLine,
  stationIdx: number,
  arriveAt: number
): number | null {
  const offset = getStationOffset(line, stationIdx);
  return nextDepartureFromSchedule(line.forwardSchedule, offset, arriveAt);
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
  const reverseSegmentTimes = line.reverseTravelTimes ?? line.travelTimes;
  const lastIdx = line.stops.length - 1;
  let offset = 0;
  for (let i = lastIdx - 1; i >= stationIdx; i--) {
    offset += reverseSegmentTimes[i];
  }
  return offset;
}

/**
 * Next reverse-direction departure at stationIdx.
 * The reverse train departs from the LAST stop at reverseSchedule.firstDeparture + headway intervals,
 * and arrives at intermediate stations with offsets calculated from the end.
 * Returns null if no more reverse trains today.
 * If there is no reverseSchedule, falls back to forwardSchedule.
 */
export function nextDepartureReverse(
  line: TransitLine,
  stationIdx: number,
  arriveAt: number
): number | null {
  const schedule = line.reverseSchedule ?? line.forwardSchedule;
  const offset = getStationOffsetReverse(line, stationIdx);
  return nextDepartureFromSchedule(schedule, offset, arriveAt);
}
