/**
 * Integer trigonometry for the arcade sims. Angles are 65536 units per turn;
 * sine/cosine return values scaled by 16384. The quarter-wave table is literal
 * integers, so no float maths runs inside a sim.
 */

export const ANG_FULL = 65536;
export const ANG_QUARTER = 16384;
export const TRIG_ONE = 16384;
/** Angle units per radian (65536 ÷ 2π), for converting angular speeds. */
export const ANG_PER_RAD = 10430;

const Q: readonly number[] = [0,101,201,302,402,503,603,704,804,904,1005,1105,1205,1306,1406,1506,1606,1706,1806,1906,2006,2105,2205,2305,2404,2503,2603,2702,2801,2900,2999,3098,3196,3295,3393,3492,3590,3688,3786,3883,3981,4078,4176,4273,4370,4467,4563,4660,4756,4852,4948,5044,5139,5235,5330,5425,5520,5614,5708,5803,5897,5990,6084,6177,6270,6363,6455,6547,6639,6731,6823,6914,7005,7096,7186,7276,7366,7456,7545,7635,7723,7812,7900,7988,8076,8163,8250,8337,8423,8509,8595,8680,8765,8850,8935,9019,9102,9186,9269,9352,9434,9516,9598,9679,9760,9841,9921,10001,10080,10159,10238,10316,10394,10471,10549,10625,10702,10778,10853,10928,11003,11077,11151,11224,11297,11370,11442,11514,11585,11656,11727,11797,11866,11935,12004,12072,12140,12207,12274,12340,12406,12472,12537,12601,12665,12729,12792,12854,12916,12978,13039,13100,13160,13219,13279,13337,13395,13453,13510,13567,13623,13678,13733,13788,13842,13896,13949,14001,14053,14104,14155,14206,14256,14305,14354,14402,14449,14497,14543,14589,14635,14680,14724,14768,14811,14854,14896,14937,14978,15019,15059,15098,15137,15175,15213,15250,15286,15322,15357,15392,15426,15460,15493,15525,15557,15588,15619,15649,15679,15707,15736,15763,15791,15817,15843,15868,15893,15917,15941,15964,15986,16008,16029,16049,16069,16088,16107,16125,16143,16160,16176,16192,16207,16221,16235,16248,16261,16273,16284,16295,16305,16315,16324,16332,16340,16347,16353,16359,16364,16369,16373,16376,16379,16381,16383,16384,16384];

function quarter(u: number): number {
  const i = u >> 6;
  if (i >= 256) return Q[256]!;
  return Q[i]! + (((Q[i + 1]! - Q[i]!) * (u & 63)) >> 6);
}

export function isin(angle: number): number {
  const t = angle & 65535;
  const u = t & 16383;
  switch (t >> 14) {
    case 0:
      return quarter(u);
    case 1:
      return quarter(16384 - u);
    case 2:
      return -quarter(u);
    default:
      return -quarter(16384 - u);
  }
}

export function icos(angle: number): number {
  return isin(angle + ANG_QUARTER);
}

/** The angle whose cosine is along x and sine along y (both integers). */
export function iatan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  let best = 0;
  let bestDot = -Infinity;
  for (let a = 0; a < ANG_FULL; a += 1024) {
    const dot = x * icos(a) + y * isin(a);
    if (dot > bestDot) {
      bestDot = dot;
      best = a;
    }
  }
  let lo = best - 1024;
  let hi = best + 1024;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    // Positive cross: the target lies further round.
    if (y * icos(mid) - x * isin(mid) > 0) lo = mid;
    else hi = mid;
  }
  return lo & 65535;
}

/** floor(sqrt(n)) for a non-negative safe integer. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = n;
  let y = Math.trunc((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.trunc((x + Math.trunc(n / x)) / 2);
  }
  return x;
}
