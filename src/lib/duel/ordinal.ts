/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(position: number): string {
  const n = Math.max(1, Math.round(position));
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
