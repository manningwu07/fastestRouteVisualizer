import { describe, it, expect } from 'vitest';
import { nextDeparture, nextDepartureReverse, runArrival, getStationOffset, getStationOffsetReverse } from '../scheduler.js';
import { generateTransfers, getConnectionsBetween, computeStepTiming } from '../graph.js';
import type { TransitLine, RunEdge, GraphState } from '../types.js';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeLine(overrides: Partial<TransitLine> = {}): TransitLine {
  return {
    id: 'L1',
    color: '#ff0000',
    agency: 'AgencyA',
    stops: ['S1', 'S2', 'S3'],
    travelTimes: [5, 10],          // S1→S2: 5 min, S2→S3: 10 min
    forwardSchedule: {
      firstDeparture: 60,          // 01:00
      lastDeparture: 120,          // 02:00
      headwayMin: 20,
    },
    bidirectional: true,
    ...overrides,
  };
}

// ─── getStationOffset ─────────────────────────────────────────────────────────

describe('getStationOffset', () => {
  it('returns 0 for the first stop', () => {
    expect(getStationOffset(makeLine(), 0)).toBe(0);
  });

  it('returns travelTimes[0] for the second stop', () => {
    expect(getStationOffset(makeLine(), 1)).toBe(5);
  });

  it('returns sum of all preceding travel times for the last stop', () => {
    expect(getStationOffset(makeLine(), 2)).toBe(15);
  });
});

// ─── runArrival ───────────────────────────────────────────────────────────────

describe('runArrival', () => {
  it('returns departAt + edge.timeMin', () => {
    const edge: RunEdge = { id: 'R1', from: 'A', to: 'B', timeMin: 7, bidirectional: false };
    expect(runArrival(100, edge)).toBe(107);
  });

  it('handles zero travel time', () => {
    const edge: RunEdge = { id: 'R2', from: 'A', to: 'B', timeMin: 0, bidirectional: false };
    expect(runArrival(50, edge)).toBe(50);
  });
});

// ─── nextDeparture ────────────────────────────────────────────────────────────

describe('nextDeparture', () => {
  const line = makeLine();
  // forwardSchedule firstDeparture=60, headway=20, lastDeparture=120
  // Departures from first stop: 60, 80, 100, 120
  // At station index 1 (offset 5): 65, 85, 105, 125 → but lastDeparture+offset=125
  //   wait — lastAtStation for idx 1 = 120 + 5 = 125

  it('arrives before first departure → returns first departure', () => {
    // At station 0, arrive at t=50, first departure is 60
    expect(nextDeparture(line, 0, 50)).toBe(60);
  });

  it('arrives between departures → returns next one', () => {
    // At station 0, arrive at t=61; departures are 60,80,100,120 → next is 80
    expect(nextDeparture(line, 0, 61)).toBe(80);
  });

  it('arrives after last departure → returns null', () => {
    // At station 0, arrive at t=121; last departure was 120
    expect(nextDeparture(line, 0, 121)).toBe(null);
  });

  it('arrives exactly on a departure → returns that departure time', () => {
    // At station 0, arrive at t=80; departure at 80 exists
    expect(nextDeparture(line, 0, 80)).toBe(80);
  });

  it('correctly accounts for station offset', () => {
    // At station index 1 (offset 5): departures at 65, 85, 105, 125
    // Arrive at t=70 → next is 85
    expect(nextDeparture(line, 1, 70)).toBe(85);
  });

  it('returns null when arriving after last departure at offset station', () => {
    // lastAtStation for idx 1 = 120 + 5 = 125; arrive at 126
    expect(nextDeparture(line, 1, 126)).toBe(null);
  });
});

// ─── generateTransfers ───────────────────────────────────────────────────────

describe('generateTransfers', () => {
  it('same agency transfer → 0 min', () => {
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', agency: 'AgencyA', stops: ['S1', 'S2', 'S3'] }),
        L2: makeLine({ id: 'L2', agency: 'AgencyA', stops: ['S2', 'S4'] }),
      },
      runEdges: [],
      transfers: [],
    };
    const transfers = generateTransfers(state);
    expect(transfers.length).toBe(2); // both directions
    expect(transfers.every((t) => t.transferMin === 0)).toBe(true);
    expect(transfers.every((t) => t.stationId === 'S2')).toBe(true);
  });

  it('cross-agency transfer → 1 min', () => {
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', agency: 'AgencyA', stops: ['S1', 'S2'] }),
        L2: makeLine({ id: 'L2', agency: 'AgencyB', stops: ['S2', 'S3'] }),
      },
      runEdges: [],
      transfers: [],
    };
    const transfers = generateTransfers(state);
    expect(transfers.length).toBe(2);
    expect(transfers.every((t) => t.transferMin === 1)).toBe(true);
  });

  it('no shared stations → empty array', () => {
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', stops: ['S1', 'S2'] }),
        L2: makeLine({ id: 'L2', stops: ['S3', 'S4'] }),
      },
      runEdges: [],
      transfers: [],
    };
    expect(generateTransfers(state)).toEqual([]);
  });

  it('station agencies override: both lines in station agencies → 0 min', () => {
    const state: GraphState = {
      stations: {
        S2: { id: 'S2', name: 'S2', x: 0, y: 0, agencies: ['AgencyA', 'AgencyB'] },
      },
      lines: {
        L1: makeLine({ id: 'L1', agency: 'AgencyA', stops: ['S1', 'S2'] }),
        L2: makeLine({ id: 'L2', agency: 'AgencyB', stops: ['S2', 'S3'] }),
      },
      runEdges: [],
      transfers: [],
    };
    const transfers = generateTransfers(state);
    expect(transfers.length).toBe(2);
    expect(transfers.every((t) => t.transferMin === 0)).toBe(true);
  });

  it('station agencies override: only one line in station agencies → 1 min', () => {
    const state: GraphState = {
      stations: {
        S2: { id: 'S2', name: 'S2', x: 0, y: 0, agencies: ['AgencyA'] },
      },
      lines: {
        L1: makeLine({ id: 'L1', agency: 'AgencyA', stops: ['S1', 'S2'] }),
        L2: makeLine({ id: 'L2', agency: 'AgencyB', stops: ['S2', 'S3'] }),
      },
      runEdges: [],
      transfers: [],
    };
    const transfers = generateTransfers(state);
    expect(transfers.length).toBe(2);
    expect(transfers.every((t) => t.transferMin === 1)).toBe(true);
  });
});

// ─── getConnectionsBetween ───────────────────────────────────────────────────

describe('getConnectionsBetween', () => {
  it('finds a line connection', () => {
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', stops: ['S1', 'S2', 'S3'] }),
      },
      runEdges: [],
      transfers: [],
    };
    const conns = getConnectionsBetween(state, 'S1', 'S3');
    expect(conns).toHaveLength(1);
    expect(conns[0]).toMatchObject({ type: 'line', lineId: 'L1', fromIdx: 0, toIdx: 2 });
  });

  it('does not find reversed line connection on a unidirectional line', () => {
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', stops: ['S1', 'S2', 'S3'], bidirectional: false }),
      },
      runEdges: [],
      transfers: [],
    };
    // S3 → S1 is not valid on a unidirectional line
    const conns = getConnectionsBetween(state, 'S3', 'S1');
    expect(conns).toHaveLength(0);
  });

  it('finds a run edge (unidirectional)', () => {
    const edge: RunEdge = { id: 'R1', from: 'S1', to: 'S2', timeMin: 3, bidirectional: false };
    const state: GraphState = {
      stations: {},
      lines: {},
      runEdges: [edge],
      transfers: [],
    };
    expect(getConnectionsBetween(state, 'S1', 'S2')).toHaveLength(1);
    expect(getConnectionsBetween(state, 'S2', 'S1')).toHaveLength(0);
  });

  it('finds a bidirectional run edge in both directions', () => {
    const edge: RunEdge = { id: 'R1', from: 'S1', to: 'S2', timeMin: 3, bidirectional: true };
    const state: GraphState = {
      stations: {},
      lines: {},
      runEdges: [edge],
      transfers: [],
    };
    expect(getConnectionsBetween(state, 'S1', 'S2')).toHaveLength(1);
    expect(getConnectionsBetween(state, 'S2', 'S1')).toHaveLength(1);
  });
});

// ─── computeStepTiming ───────────────────────────────────────────────────────

describe('computeStepTiming', () => {
  const lineL1: TransitLine = {
    id: 'L1',
    color: '#f00',
    agency: 'AgencyA',
    stops: ['S1', 'S2', 'S3'],
    travelTimes: [5, 10],
    forwardSchedule: {
      firstDeparture: 60,
      lastDeparture: 180,
      headwayMin: 20,
    },
    bidirectional: true,
  };

  const lineL2: TransitLine = {
    id: 'L2',
    color: '#00f',
    agency: 'AgencyB',
    stops: ['S2', 'S4'],
    travelTimes: [8],
    forwardSchedule: {
      firstDeparture: 60,
      lastDeparture: 180,
      headwayMin: 20,
    },
    bidirectional: true,
  };

  const baseState: GraphState = {
    stations: {},
    lines: { L1: lineL1, L2: lineL2 },
    runEdges: [],
    transfers: generateTransfers({
      stations: {},
      lines: { L1: lineL1, L2: lineL2 },
      runEdges: [],
      transfers: [],
    }),
  };

  it('no transfer when staying on the same line', () => {
    const step = computeStepTiming(
      baseState,
      60,       // arrive at S1 at t=60
      'S1',
      'S2',
      { type: 'line', lineId: 'L1', fromIdx: 0, toIdx: 1, direction: 'forward' },
      'L1'      // already on L1
    );
    // No transfer penalty; first departure at S1 is 60 → depart at 60
    expect(step.waitTime).toBe(0);
    expect(step.departAt).toBe(60);
    expect(step.travelTime).toBe(5);
    expect(step.cumulativeMin).toBe(65);
  });

  it('includes cross-agency transfer time when switching lines', () => {
    // Arrive at S2 at t=65 (coming off L1), switch to L2 (AgencyB → 1 min penalty)
    // Effective arrival for L2 scheduling = 65 + 1 = 66
    // L2 departs S2 (idx 0, offset 0) at 60, 80, 100...
    // First departure >= 66 is 80
    const step = computeStepTiming(
      baseState,
      65,
      'S2',
      'S4',
      { type: 'line', lineId: 'L2', fromIdx: 0, toIdx: 1, direction: 'forward' },
      'L1'
    );
    expect(step.departAt).toBe(80);
    expect(step.waitTime).toBe(15);  // 80 - 65 = 15 (includes 1 min transfer)
    expect(step.travelTime).toBe(8);
    expect(step.cumulativeMin).toBe(88);
  });

  it('no transfer penalty when previousLineId is null (first step)', () => {
    const step = computeStepTiming(
      baseState,
      65,
      'S2',
      'S4',
      { type: 'line', lineId: 'L2', fromIdx: 0, toIdx: 1, direction: 'forward' },
      null
    );
    // No transfer; first L2 departure >= 65 is 80
    expect(step.departAt).toBe(80);
    expect(step.waitTime).toBe(15);
  });

  it('run edge step has zero wait time', () => {
    const edge: RunEdge = { id: 'R1', from: 'S1', to: 'S2', timeMin: 6, bidirectional: false };
    const stateWithRun: GraphState = { ...baseState, runEdges: [edge] };
    const step = computeStepTiming(
      stateWithRun,
      70,
      'S1',
      'S2',
      { type: 'run', edge },
      null
    );
    expect(step.lineId).toBeNull();
    expect(step.waitTime).toBe(0);
    expect(step.departAt).toBe(70);
    expect(step.travelTime).toBe(6);
    expect(step.cumulativeMin).toBe(76);
  });
});

// ─── Integration test ────────────────────────────────────────────────────────

describe('Integration: 2-line system with transfer', () => {
  /**
   * Network:
   *   Line RED (AgencyA): A → B → C  (travelTimes: [4, 6])
   *     first: 8:00 (480), last: 10:00 (600), headway: 30
   *   Line BLUE (AgencyB): B → D     (travelTimes: [7])
   *     first: 8:05 (485), last: 10:05 (605), headway: 30
   *
   * Journey: A → B (RED) → D (BLUE)
   *   Start at A at t=480.
   *   RED departs A at 480 (first). Arrive B at 480+4=484.
   *   Transfer at B: cross-agency = 1 min → effective time for BLUE = 485.
   *   BLUE departs B at: first at B = 485 + 0 = 485 (offset 0).
   *   485 >= 485 → departs 485. Arrive D at 485+7=492.
   *   Total: 492 - 480 = 12 min.
   */

  const lineRed: TransitLine = {
    id: 'RED',
    color: '#e00',
    agency: 'AgencyA',
    stops: ['A', 'B', 'C'],
    travelTimes: [4, 6],
    forwardSchedule: {
      firstDeparture: 480,
      lastDeparture: 600,
      headwayMin: 30,
    },
    bidirectional: true,
  };

  const lineBlue: TransitLine = {
    id: 'BLUE',
    color: '#00e',
    agency: 'AgencyB',
    stops: ['B', 'D'],
    travelTimes: [7],
    forwardSchedule: {
      firstDeparture: 485,
      lastDeparture: 605,
      headwayMin: 30,
    },
    bidirectional: true,
  };

  const state: GraphState = {
    stations: {
      A: { id: 'A', name: 'Station A', x: 0, y: 0, agencies: [] },
      B: { id: 'B', name: 'Station B', x: 1, y: 0, agencies: [] },
      C: { id: 'C', name: 'Station C', x: 2, y: 0, agencies: [] },
      D: { id: 'D', name: 'Station D', x: 1, y: 1, agencies: [] },
    },
    lines: { RED: lineRed, BLUE: lineBlue },
    runEdges: [],
    transfers: generateTransfers({
      stations: {},
      lines: { RED: lineRed, BLUE: lineBlue },
      runEdges: [],
      transfers: [],
    }),
  };

  it('computes step 1: A → B on RED', () => {
    const step = computeStepTiming(
      state,
      480,
      'A',
      'B',
      { type: 'line', lineId: 'RED', fromIdx: 0, toIdx: 1, direction: 'forward' },
      null
    );
    expect(step.departAt).toBe(480);
    expect(step.travelTime).toBe(4);
    expect(step.cumulativeMin).toBe(484);
  });

  it('computes step 2: B → D on BLUE with cross-agency transfer', () => {
    const step = computeStepTiming(
      state,
      484,       // arrive B at 484
      'B',
      'D',
      { type: 'line', lineId: 'BLUE', fromIdx: 0, toIdx: 1, direction: 'forward' },
      'RED'      // came from RED (AgencyA)
    );
    // Transfer = 1 min → effective arrival for scheduling = 485
    // BLUE first at B = 485 → 485 >= 485 → departs 485
    expect(step.departAt).toBe(485);
    expect(step.travelTime).toBe(7);
    expect(step.cumulativeMin).toBe(492);
  });

  it('verifies total journey time is 12 minutes', () => {
    const step1 = computeStepTiming(
      state, 480, 'A', 'B',
      { type: 'line', lineId: 'RED', fromIdx: 0, toIdx: 1, direction: 'forward' },
      null
    );
    const step2 = computeStepTiming(
      state, step1.cumulativeMin, 'B', 'D',
      { type: 'line', lineId: 'BLUE', fromIdx: 0, toIdx: 1, direction: 'forward' },
      'RED'
    );
    expect(step2.cumulativeMin - 480).toBe(12);
  });

  it('generateTransfers produces cross-agency entries for shared station B', () => {
    const transfers = state.transfers;
    const atB = transfers.filter((t) => t.stationId === 'B');
    expect(atB.length).toBe(2);
    expect(atB.every((t) => t.transferMin === 1)).toBe(true);
  });

  it('getConnectionsBetween finds RED for A→B', () => {
    const conns = getConnectionsBetween(state, 'A', 'B');
    expect(conns).toHaveLength(1);
    expect(conns[0]).toMatchObject({ type: 'line', lineId: 'RED' });
  });

  it('getConnectionsBetween finds BLUE for B→D', () => {
    const conns = getConnectionsBetween(state, 'B', 'D');
    expect(conns).toHaveLength(1);
    expect(conns[0]).toMatchObject({ type: 'line', lineId: 'BLUE' });
  });
});

// ─── getStationOffsetReverse ──────────────────────────────────────────────────

describe('getStationOffsetReverse', () => {
  // Line: S1 → S2 → S3, travelTimes: [5, 10]
  // Reverse train departs from S3 (last stop).
  // S3 (idx 2) → offset 0
  // S2 (idx 1) → offset travelTimes[1] = 10
  // S1 (idx 0) → offset travelTimes[1] + travelTimes[0] = 15

  it('returns 0 for the last stop (reverse origin)', () => {
    expect(getStationOffsetReverse(makeLine(), 2)).toBe(0);
  });

  it('returns travelTimes[last-1] for the second-to-last stop', () => {
    expect(getStationOffsetReverse(makeLine(), 1)).toBe(10);
  });

  it('returns sum of all travel times for the first stop', () => {
    expect(getStationOffsetReverse(makeLine(), 0)).toBe(15);
  });
});

// ─── nextDepartureReverse ─────────────────────────────────────────────────────

describe('nextDepartureReverse', () => {
  // Line: forwardSchedule firstDeparture=60, headway=20, lastDeparture=120
  // (no reverseSchedule, so falls back to forwardSchedule)
  // Reverse train departs from LAST stop (idx 2, offset 0) at 60, 80, 100, 120.
  // At idx 1 (offset 10): departs at 70, 90, 110, 130
  // At idx 0 (offset 15): departs at 75, 95, 115, 135

  it('arrives before first reverse departure at last stop → returns first departure', () => {
    expect(nextDepartureReverse(makeLine(), 2, 50)).toBe(60);
  });

  it('arrives between reverse departures at last stop → returns next one', () => {
    expect(nextDepartureReverse(makeLine(), 2, 61)).toBe(80);
  });

  it('arrives after last reverse departure at last stop → returns null', () => {
    expect(nextDepartureReverse(makeLine(), 2, 121)).toBe(null);
  });

  it('correctly accounts for reverse offset at an intermediate stop', () => {
    // At idx 1 (offset 10): first departure = 60 + 10 = 70, then 90, 110, 130
    // Arrive at t=75 → next is 90
    expect(nextDepartureReverse(makeLine(), 1, 75)).toBe(90);
  });

  it('returns null when arriving after last reverse departure at an intermediate stop', () => {
    // At idx 1 last departure = 120 + 10 = 130; arrive at 131
    expect(nextDepartureReverse(makeLine(), 1, 131)).toBe(null);
  });

  it('uses reverseSchedule when provided', () => {
    const lineWithReverse = makeLine({
      reverseSchedule: {
        firstDeparture: 200,
        lastDeparture: 300,
        headwayMin: 30,
      },
    });
    // Reverse departs last stop (idx 2, offset 0) at 200, 230, 260, 290
    expect(nextDepartureReverse(lineWithReverse, 2, 190)).toBe(200);
    expect(nextDepartureReverse(lineWithReverse, 2, 201)).toBe(230);
    expect(nextDepartureReverse(lineWithReverse, 2, 291)).toBe(null);
  });
});

// ─── Bidirectionality: getConnectionsBetween ─────────────────────────────────

describe('getConnectionsBetween bidirectionality', () => {
  it('finds reverse connection on a bidirectional line', () => {
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', stops: ['S1', 'S2', 'S3'], bidirectional: true }),
      },
      runEdges: [],
      transfers: [],
    };
    const conns = getConnectionsBetween(state, 'S3', 'S1');
    expect(conns).toHaveLength(1);
    expect(conns[0]).toMatchObject({
      type: 'line',
      lineId: 'L1',
      fromIdx: 2,
      toIdx: 0,
      direction: 'reverse',
    });
  });

  it('does NOT find reverse connection on a unidirectional line', () => {
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', stops: ['S1', 'S2', 'S3'], bidirectional: false }),
      },
      runEdges: [],
      transfers: [],
    };
    const conns = getConnectionsBetween(state, 'S3', 'S1');
    expect(conns).toHaveLength(0);
  });

  it('finds both forward and reverse as separate connections when stations are both present', () => {
    // S1→S3 should be 'forward'; S3→S1 should be 'reverse'
    const state: GraphState = {
      stations: {},
      lines: {
        L1: makeLine({ id: 'L1', stops: ['S1', 'S2', 'S3'], bidirectional: true }),
      },
      runEdges: [],
      transfers: [],
    };
    const fwd = getConnectionsBetween(state, 'S1', 'S3');
    expect(fwd).toHaveLength(1);
    expect(fwd[0]).toMatchObject({ direction: 'forward', fromIdx: 0, toIdx: 2 });

    const rev = getConnectionsBetween(state, 'S3', 'S1');
    expect(rev).toHaveLength(1);
    expect(rev[0]).toMatchObject({ direction: 'reverse', fromIdx: 2, toIdx: 0 });
  });
});

// ─── computeStepTiming reverse direction ─────────────────────────────────────

describe('computeStepTiming reverse direction', () => {
  // Line L1: S1 → S2 → S3, travelTimes: [5, 10]
  // forwardSchedule: firstDeparture: 60, lastDeparture: 180, headway: 20, bidirectional: true
  // No reverseSchedule → falls back to forwardSchedule
  // Reverse train departs S3 at 60, 80, 100, ..., 180.
  // At S2 (idx 1, reverseOffset=10): departs at 70, 90, 110, ..., 190.
  // At S1 (idx 0, reverseOffset=15): departs at 75, 95, 115, ..., 195.

  const lineL1: TransitLine = {
    id: 'L1',
    color: '#f00',
    agency: 'AgencyA',
    stops: ['S1', 'S2', 'S3'],
    travelTimes: [5, 10],
    forwardSchedule: {
      firstDeparture: 60,
      lastDeparture: 180,
      headwayMin: 20,
    },
    bidirectional: true,
  };

  const state: GraphState = {
    stations: {},
    lines: { L1: lineL1 },
    runEdges: [],
    transfers: [],
  };

  it('computes S3 → S2 reverse travel correctly', () => {
    // Arrive at S3 (fromIdx=2) at t=60. Reverse departs S3 at 60. Travel S3→S2 = travelTimes[1] = 10.
    const step = computeStepTiming(
      state,
      60,
      'S3',
      'S2',
      { type: 'line', lineId: 'L1', fromIdx: 2, toIdx: 1, direction: 'reverse' },
      null
    );
    expect(step.departAt).toBe(60);
    expect(step.waitTime).toBe(0);
    expect(step.travelTime).toBe(10);
    expect(step.cumulativeMin).toBe(70);
  });

  it('computes S3 → S1 reverse travel correctly', () => {
    // Arrive at S3 (fromIdx=2) at t=65. Next reverse departure at S3 is 80. Travel S3→S1 = 10+5 = 15.
    const step = computeStepTiming(
      state,
      65,
      'S3',
      'S1',
      { type: 'line', lineId: 'L1', fromIdx: 2, toIdx: 0, direction: 'reverse' },
      null
    );
    expect(step.departAt).toBe(80);
    expect(step.waitTime).toBe(15);
    expect(step.travelTime).toBe(15);
    expect(step.cumulativeMin).toBe(95);
  });

  it('computes S2 → S1 reverse travel correctly', () => {
    // Arrive at S2 (fromIdx=1) at t=70. Reverse departs S2 at 70 (reverseOffset=10, first=70). Travel S2→S1 = 5.
    const step = computeStepTiming(
      state,
      70,
      'S2',
      'S1',
      { type: 'line', lineId: 'L1', fromIdx: 1, toIdx: 0, direction: 'reverse' },
      null
    );
    expect(step.departAt).toBe(70);
    expect(step.waitTime).toBe(0);
    expect(step.travelTime).toBe(5);
    expect(step.cumulativeMin).toBe(75);
  });
});
