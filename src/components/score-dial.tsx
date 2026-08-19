export function ScoreDial({
  score,
  label = "Score",
  size = 176,
}: {
  score: number;
  label?: string;
  size?: number;
}) {
  const s = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const rot = s * 3.6;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 200 200" aria-label={`${label} ${Math.round(s)}`}>
        <defs>
          <linearGradient id="scoreSweep" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e06868" />
            <stop offset="50%" stopColor="#d4a05a" />
            <stop offset="100%" stopColor="#3fbf8f" />
          </linearGradient>
        </defs>
        <foreignObject x="0" y="0" width="200" height="200">
          <div
            style={{
              width: 200,
              height: 200,
              background:
                "conic-gradient(from -90deg, #e06868 0%, #d4a05a 45%, #3fbf8f 100%)",
              WebkitMask:
                "radial-gradient(farthest-side, transparent 72%, #000 73%)",
              mask: "radial-gradient(farthest-side, transparent 72%, #000 73%)",
            }}
          />
        </foreignObject>
        <g transform={`rotate(${rot} 100 100)`}>
          <polygon points="100,8 90,30 110,30" fill="#ffffff" />
        </g>
        <text
          x="100"
          y="108"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="IBM Plex Mono, ui-monospace, monospace"
          fontSize="52"
          fontWeight="500"
        >
          {Math.round(s)}
        </text>
      </svg>
      <p className="-mt-2 text-[10px] tracking-[0.18em] text-subtle uppercase">{label}</p>
    </div>
  );
}
