import { ACCENT, BAR, BAR_STRONG, PANEL, PreviewFrame } from "./frame";

const ROWS = [0, 1, 2, 3, 4] as const;
/** Intent-tag widths and score-bar widths of the five rows. */
const TAG_WIDTH = [44, 52, 40, 48, 36] as const;
const SCORE = [64, 24, 84, 40, 12] as const;
/** The row handed to a person. */
const HANDED = 2;

const rowY = (row: number) => 28 + row * 40;

/**
 * instagram-lead-agent: an inbox of five message rows (avatar and two text
 * bars), an intent tag on each, a score column of tabular bars, and one row
 * marked with the accent dot: handed to a person.
 */
export function InstagramPreview() {
  return (
    <PreviewFrame id="instagram-lead-agent">
      <rect x={16} y={16} width={240} height={218} rx={2} className={PANEL} />
      <rect x={272} y={16} width={112} height={218} rx={2} className={PANEL} />
      {ROWS.map((row) => {
        const y = rowY(row);
        return (
          <g key={row}>
            {row === HANDED ? (
              <rect
                x={20}
                y={y - 2}
                width={232}
                height={36}
                rx={2}
                className="fill-surface-3"
              />
            ) : null}
            <circle cx={52} cy={y + 16} r={10} className="fill-surface-3" />
            <rect
              x={72}
              y={y + 7}
              width={84 + (row % 2) * 24}
              height={6}
              rx={1}
              className={BAR_STRONG}
            />
            <rect
              x={72}
              y={y + 19}
              width={112 - (row % 3) * 16}
              height={6}
              rx={1}
              className={BAR}
            />
            <rect
              x={204}
              y={y + 8}
              width={TAG_WIDTH[row]}
              height={16}
              rx={8}
              fill="none"
              className="stroke-trace"
            />
            <rect x={284} y={y + 12} width={88} height={8} className={BAR} />
            <rect
              x={284}
              y={y + 12}
              width={SCORE[row]}
              height={8}
              className={row === HANDED ? "fill-trace" : BAR_STRONG}
            />
            {row < ROWS.length - 1 ? (
              <path
                d={`M24 ${String(y + 36)}H248`}
                fill="none"
                className="stroke-border-subtle"
              />
            ) : null}
          </g>
        );
      })}
      <circle cx={30} cy={rowY(HANDED) + 16} r={5} className={ACCENT} />
    </PreviewFrame>
  );
}
