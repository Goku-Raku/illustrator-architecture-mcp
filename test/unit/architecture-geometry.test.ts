import { describe, expect, it } from 'vitest';
import { cubicEndpointNeighbor, cubicRoute, markerPath, sectorPath, type Point } from '../../src/tools/architecture/geometry.js';

describe('architecture cubic diagram geometry', () => {
  it('preserves independently editable incoming/outgoing handles at each join', () => {
    const nodes = cubicRoute([0, 0], [
      { control1: [10, 0], control2: [20, 10], end: [20, 20] },
      { control1: [30, 20], control2: [40, 30], end: [40, 40] },
    ]);
    expect(nodes).toEqual([
      { anchor: [0, 0], left: [0, 0], right: [10, 0] },
      { anchor: [20, 20], left: [20, 10], right: [30, 20] },
      { anchor: [40, 40], left: [40, 30], right: [40, 40] },
    ]);
  });

  it('finds limiting endpoint tangents when first or second derivatives collapse', () => {
    expect(cubicEndpointNeighbor([0, 0], { control1: [0, 0], control2: [0, 20], end: [10, 10] }, 'start')).toEqual([0, 20]);
    expect(cubicEndpointNeighbor([0, 0], { control1: [0, 0], control2: [0, 0], end: [10, 10] }, 'start')).toEqual([10, 10]);
    expect(cubicEndpointNeighbor([0, 0], { control1: [20, 0], control2: [10, 10], end: [10, 10] }, 'end')).toEqual([20, 0]);
    expect(cubicEndpointNeighbor([0, 0], { control1: [10, 10], control2: [10, 10], end: [10, 10] }, 'end')).toEqual([0, 0]);
    const constant = { control1: [0, 0] as Point, control2: [0, 0] as Point, end: [0, 0] as Point };
    expect(() => cubicRoute([0, 0], [constant])).toThrow('zero-length');
    expect(() => cubicEndpointNeighbor([0, 0], constant, 'end')).toThrow('zero-length');
  });

  it('allows a curved closed loop with distinct control points', () => {
    expect(cubicRoute([0, 0], [{ control1: [10, 0], control2: [0, 10], end: [0, 0] }])).toHaveLength(2);
  });

  it('creates a seam-free disk with four connected cubic spans and bounded radial error', () => {
    const nodes = sectorPath([10, 20], 50, 0, 360);
    expect(nodes).toHaveLength(4);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i], b = nodes[(i + 1) % nodes.length];
      for (const t of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
        const u = 1 - t;
        const p = [0, 1].map((axis) => u ** 3 * a.anchor[axis] + 3 * u ** 2 * t * a.right[axis] + 3 * u * t ** 2 * b.left[axis] + t ** 3 * b.anchor[axis]);
        expect(Math.abs(Math.hypot(p[0] - 10, p[1] - 20) - 50)).toBeLessThan(50 * 0.0003);
      }
      const incoming = [a.anchor[0] - a.left[0], a.anchor[1] - a.left[1]];
      const outgoing = [a.right[0] - a.anchor[0], a.right[1] - a.anchor[1]];
      expect(incoming[0] * outgoing[1] - incoming[1] * outgoing[0]).toBeCloseTo(0, 8);
    }
    expect(sectorPath([10, 20], 50, 0, -360)).toHaveLength(4);
  });

  it('uses signed sweeps and straight radial edges, with explicit zero crossing', () => {
    const clockwise = sectorPath([0, 0], 10, 0, 90);
    expect(clockwise).toHaveLength(3);
    expect(clockwise[0]).toEqual({ anchor: [0, 0], left: [0, 0], right: [0, 0] });
    expect(clockwise[1].anchor).toEqual([10, 0]);
    expect(clockwise[1].left).toEqual(clockwise[1].anchor);
    expect(clockwise[2].anchor[0]).toBeCloseTo(0);
    expect(clockwise[2].anchor[1]).toBeCloseTo(10);
    expect(clockwise[2].right).toEqual(clockwise[2].anchor);
    expect(sectorPath([0, 0], 10, 0, -90)[2].anchor[1]).toBeCloseTo(-10);
    expect(sectorPath([0, 0], 10, 350, 370)).toHaveLength(3);
    expect(sectorPath([0, 0], 10, 350, 10)).toHaveLength(6); // Explicit -340 degree sweep.
    for (const end of [0, 361, -361]) expect(() => sectorPath([0, 0], 10, 0, end)).toThrow('sweep');
  });

  it('builds rotated marker symbols as one native closed path each', () => {
    expect(markerPath([0, 0], 12, 'circle')).toHaveLength(4);
    expect(markerPath([0, 0], 12, 'cross')).toHaveLength(12);
    expect(markerPath([0, 0], 12, 'diamond').map((p) => p.anchor)).toEqual([[0, -6], [6, 0], [0, 6], [-6, 0]]);
    const tip = markerPath([20, 30], 12, 'triangle', 90)[0].anchor;
    expect(tip[0]).toBeCloseTo(26);
    expect(tip[1]).toBeCloseTo(30);
  });
});
