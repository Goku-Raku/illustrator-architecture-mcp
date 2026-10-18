/** Native Illustrator path geometry in artboard-web points (Y downward).
 * Arc spans use the conventional cubic circular-arc approximation, at most 90
 * degrees per span. This is drawing geometry, never a visibility/GIS solver. */
export type Point = [number, number];
export type BezierNode = { anchor: Point; left: Point; right: Point };
export type CubicSegment = { control1: Point; control2: Point; end: Point };

const EPS = 1e-8;
const same = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS;
const node = (anchor: Point): BezierNode => ({ anchor, left: [...anchor], right: [...anchor] });

export function cubicRoute(start: Point, segments: CubicSegment[]): BezierNode[] {
  const nodes = [node(start)];
  for (const segment of segments) {
    const previous = nodes[nodes.length - 1];
    if ([segment.control1, segment.control2, segment.end].every((p) => same(previous.anchor, p))) {
      throw new Error('Smooth route contains a zero-length cubic segment.');
    }
    previous.right = segment.control1;
    const end = node(segment.end);
    end.left = segment.control2;
    nodes.push(end);
  }
  return nodes;
}

/** A collapsed first derivative uses the first nonzero higher derivative.
 * The returned point is inside the endpoint direction, suitable for an outward
 * arrow tip. Testing the control polygon in order preserves the limiting tangent. */
export function cubicEndpointNeighbor(start: Point, segment: CubicSegment, endpoint: 'start' | 'end'): Point {
  const tip = endpoint === 'start' ? start : segment.end;
  const candidates = endpoint === 'start'
    ? [segment.control1, segment.control2, segment.end]
    : [segment.control2, segment.control1, start];
  const neighbor = candidates.find((p) => !same(p, tip));
  if (!neighbor) throw new Error('Cannot orient an arrow on a zero-length cubic segment.');
  return neighbor;
}

function arc(center: Point, radius: number, startDegrees: number, sweepDegrees: number): BezierNode[] {
  const spanCount = Math.ceil(Math.abs(sweepDegrees) / 90);
  const delta = sweepDegrees * Math.PI / 180 / spanCount;
  const at = (angle: number): Point => [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  const firstAngle = startDegrees * Math.PI / 180;
  const nodes = [node(at(firstAngle))];
  for (let i = 0; i < spanCount; i++) {
    const a = firstAngle + i * delta, b = firstAngle + (i + 1) * delta;
    const k = 4 / 3 * Math.tan(delta / 4) * radius;
    const previous = nodes[nodes.length - 1];
    previous.right = [previous.anchor[0] - k * Math.sin(a), previous.anchor[1] + k * Math.cos(a)];
    const end = node(at(b));
    end.left = [end.anchor[0] + k * Math.sin(b), end.anchor[1] - k * Math.cos(b)];
    nodes.push(end);
  }
  return nodes;
}

export function sectorPath(center: Point, radius: number, startDegrees: number, endDegrees: number): BezierNode[] {
  const sweep = endDegrees - startDegrees;
  if (Math.abs(sweep) < 1e-6 || Math.abs(sweep) > 360) throw new Error('Sector sweep must have magnitude from 0.000001 to 360 degrees. Use signed end_degrees - start_degrees; no implicit wrapping.');
  const nodes = arc(center, radius, startDegrees, sweep);
  // A full disk must not retain a radial seam or duplicate closing anchor.
  if (Math.abs(sweep) === 360) {
    const last = nodes.pop()!;
    nodes[0].left = last.left;
    return nodes;
  }
  return [node(center), ...nodes];
}

export function markerPath(center: Point, size: number, shape: 'circle' | 'square' | 'diamond' | 'triangle' | 'cross', rotationDegrees = 0): BezierNode[] {
  if (shape === 'circle') return sectorPath(center, size / 2, rotationDegrees, rotationDegrees + 360);
  const r = size / 2;
  let points: Point[];
  if (shape === 'square') points = [[-r, -r], [r, -r], [r, r], [-r, r]];
  else if (shape === 'diamond') points = [[0, -r], [r, 0], [0, r], [-r, 0]];
  else if (shape === 'triangle') points = [[0, -r], [r, r], [-r, r]];
  else {
    const t = r / 3;
    points = [[-t, -r], [t, -r], [t, -t], [r, -t], [r, t], [t, t], [t, r], [-t, r], [-t, t], [-r, t], [-r, -t], [-t, -t]];
  }
  const radians = rotationDegrees * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return points.map(([x, y]) => node([center[0] + x * c - y * s, center[1] + x * s + y * c]));
}
