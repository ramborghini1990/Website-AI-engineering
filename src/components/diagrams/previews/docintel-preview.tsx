import { ACCENT, BAR, BAR_STRONG, PANEL, PreviewFrame } from "./frame";

/** Text-bar widths down the page. */
const LINES = [120, 96, 128, 84, 112, 100, 124, 76] as const;
/** The three fields read from the page: line index, bar width and row in the field list. */
const FIELDS = [
  { y: 61, w: 100, row: 0 },
  { y: 101, w: 76, row: 1 },
  { y: 141, w: 120, row: 2 },
] as const;
/** The field that is flagged "doubtful": read, but a person must look. */
const DOUBTFUL = 2;

const listY = (row: number) => 56 + row * 40;

/**
 * document-intelligence-demo: a document page of text bars with three field
 * highlight boxes, traces to a list of fields, and one field flagged as
 * doubtful (warning stroke, dashed, with a triangle glyph, never colour alone)
 * next to the accent dot.
 */
export function DocintelPreview() {
  return (
    <PreviewFrame id="document-intelligence-demo">
      <rect x={16} y={16} width={168} height={218} rx={2} className={PANEL} />
      <rect x={28} y={28} width={64} height={8} rx={1} className={BAR_STRONG} />
      {LINES.map((width, line) => (
        <rect
          key={line}
          x={28}
          y={48 + line * 20}
          width={width}
          height={6}
          rx={1}
          className={BAR}
        />
      ))}

      {FIELDS.map(({ y, w, row }) => (
        <g key={row}>
          <rect
            x={26}
            y={y}
            width={w}
            height={14}
            rx={2}
            fill="none"
            className="stroke-trace"
            strokeWidth={1.5}
          />
          <path
            d={`M${String(26 + w)} ${String(y + 7)}H${String(
              row === 1 ? 220 : 236,
            )}V${String(listY(row) + 12)}H256`}
            fill="none"
            className="stroke-trace"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={256}
            y={listY(row)}
            width={128}
            height={24}
            rx={2}
            fill="none"
            strokeWidth={row === DOUBTFUL ? 1.5 : 1}
            strokeDasharray={row === DOUBTFUL ? "4 3" : undefined}
            className={
              row === DOUBTFUL ? "stroke-warning" : "stroke-border-strong"
            }
          />
          <rect
            x={264}
            y={listY(row) + 6}
            width={36}
            height={5}
            rx={1}
            className={BAR_STRONG}
          />
          <rect
            x={264}
            y={listY(row) + 15}
            width={row === DOUBTFUL ? 52 : 72}
            height={5}
            rx={1}
            className={BAR}
          />
        </g>
      ))}

      {/* the doubtful field: a warning triangle and the person marker */}
      <path
        d={`M366 ${String(listY(DOUBTFUL) + 17)}L372 ${String(listY(DOUBTFUL) + 6)}L378 ${String(listY(DOUBTFUL) + 17)}ZM372 ${String(listY(DOUBTFUL) + 10)}V${String(listY(DOUBTFUL) + 13)}`}
        fill="none"
        className="stroke-warning"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={246} cy={listY(DOUBTFUL) + 12} r={4} className={ACCENT} />
    </PreviewFrame>
  );
}
