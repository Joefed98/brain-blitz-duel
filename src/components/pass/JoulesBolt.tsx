/** The Joules bolt mark (electric lime, `--jz-joules`): decorative, the figure beside it says the number. */
export function JoulesBolt({ size = 16 }: { size?: number }) {
  return (
    <svg className="joules-bolt" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13.2 4.8 7.6 13h4l-1 6.2 5.8-8.4h-4.1z" fill="currentColor" />
    </svg>
  );
}
