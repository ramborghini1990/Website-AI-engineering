import { ACCENT, BAR, BAR_STRONG, PANEL, PreviewFrame } from "./frame";

const DRAFT_LINES = [0, 1, 2, 3, 4, 5] as const;
const SCHEDULED = [0, 1, 2] as const;

/** An arrow head pointing right at (x, y). */
const head = (x: number, y: number) =>
  `M${String(x - 5)} ${String(y - 4)}L${String(x)} ${String(y)}L${String(x - 5)} ${String(y + 4)}`;

/**
 * linkedin-assisted-outreach: a prospect card (bars and a fit meter), a draft
 * panel, the approval gate (an outlined button with the one accent dot) and the
 * scheduled list with a success check on each row.
 */
export function LinkedinPreview() {
  return (
    <PreviewFrame id="linkedin-assisted-outreach">
      {/* prospect */}
      <rect x={16} y={40} width={104} height={170} rx={2} className={PANEL} />
      <circle cx={44} cy={70} r={14} className="fill-surface-3" />
      <rect x={66} y={62} width={44} height={6} rx={1} className={BAR_STRONG} />
      <rect x={66} y={74} width={32} height={6} rx={1} className={BAR} />
      <rect x={28} y={102} width={80} height={6} rx={1} className={BAR} />
      <rect x={28} y={116} width={64} height={6} rx={1} className={BAR} />
      <rect x={28} y={130} width={72} height={6} rx={1} className={BAR} />
      <rect x={28} y={166} width={80} height={8} className={BAR} />
      <rect x={28} y={166} width={52} height={8} className="fill-trace" />
      <rect
        x={28}
        y={184}
        width={36}
        height={6}
        rx={1}
        className={BAR_STRONG}
      />

      {/* draft */}
      <rect x={136} y={40} width={104} height={170} rx={2} className={PANEL} />
      <rect
        x={148}
        y={54}
        width={48}
        height={6}
        rx={1}
        className={BAR_STRONG}
      />
      {DRAFT_LINES.map((line) => (
        <rect
          key={line}
          x={148}
          y={76 + line * 16}
          width={line === DRAFT_LINES.length - 1 ? 44 : 80}
          height={6}
          rx={1}
          className={BAR}
        />
      ))}

      {/* flow: prospect -> draft -> gate -> scheduled */}
      <path
        d={`M120 60H136${head(136, 60)}M240 60H256${head(256, 60)}M320 80V104M316 99L320 104L324 99`}
        fill="none"
        className="stroke-text-muted"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />

      {/* approval gate */}
      <rect
        x={256}
        y={40}
        width={128}
        height={40}
        rx={2}
        fill="none"
        className="stroke-border-strong"
        strokeWidth={1.5}
      />
      <circle cx={276} cy={60} r={6} className={ACCENT} />
      <rect
        x={292}
        y={56}
        width={72}
        height={8}
        rx={1}
        className={BAR_STRONG}
      />

      {/* scheduled */}
      <rect x={256} y={104} width={128} height={106} rx={2} className={PANEL} />
      {SCHEDULED.map((row) => (
        <g key={row}>
          <path
            d={`M270 ${String(130 + row * 28)}l3-3 4 4 8-8 3 3-11 11z`}
            className="fill-success"
          />
          <rect
            x={296}
            y={124 + row * 28}
            width={72 - row * 12}
            height={8}
            rx={1}
            className={BAR}
          />
        </g>
      ))}
    </PreviewFrame>
  );
}
