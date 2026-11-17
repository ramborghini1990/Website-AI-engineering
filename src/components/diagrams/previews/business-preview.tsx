import { BAR, BAR_STRONG, PANEL, PreviewFrame } from "./frame";

const KEYS = Array.from({ length: 12 }, (_, key) => key);
/** Two series, five groups. Heights are drawing proportions, not data. */
const SERIES_1 = [60, 80, 50, 100, 70] as const;
const SERIES_2 = [40, 55, 35, 60, 50] as const;
const BASE = 150;
const STOCK = [0, 1, 2, 3] as const;

const barsPath = (heights: readonly number[], offset: number) =>
  heights
    .map(
      (height, group) =>
        `M${String(156 + group * 24 + offset)} ${String(BASE)}v-${String(height)}h8v${String(height)}z`,
    )
    .join("");

/**
 * business-management-app: inside a dashed "your browser" boundary, a till
 * keypad, a small bar chart (series 1 `fill-accent`, series 2 `fill-trace`, as
 * docs/DESIGN.md §2.1 says for data), a stock list and an orders strip. Each
 * series is ONE path, so the preview holds one accent element.
 */
export function BusinessPreview() {
  return (
    <PreviewFrame id="business-management-app">
      <rect
        x={8}
        y={8}
        width={384}
        height={234}
        rx={2}
        fill="none"
        strokeDasharray="6 4"
        className="stroke-border-strong"
      />

      {/* till */}
      <rect x={24} y={28} width={84} height={16} rx={2} className={PANEL} />
      <rect x={32} y={34} width={36} height={4} rx={1} className={BAR_STRONG} />
      {KEYS.map((key) => (
        <rect
          key={key}
          x={24 + (key % 3) * 30}
          y={52 + Math.floor(key / 3) * 30}
          width={24}
          height={24}
          rx={2}
          className="fill-surface-3"
        />
      ))}

      {/* chart */}
      <path
        d={`M148 ${String(BASE)}H280`}
        fill="none"
        className="stroke-border-strong"
      />
      <path d={barsPath(SERIES_1, 0)} className="preview-accent fill-accent" />
      <path d={barsPath(SERIES_2, 10)} className="fill-trace" />

      {/* stock */}
      {STOCK.map((row) => (
        <g key={row}>
          <rect
            x={296}
            y={28 + row * 30}
            width={14}
            height={14}
            rx={2}
            className="fill-surface-3"
          />
          <rect
            x={318}
            y={30 + row * 30}
            width={56 - row * 8}
            height={5}
            rx={1}
            className={BAR_STRONG}
          />
          <rect
            x={318}
            y={38 + row * 30}
            width={32}
            height={4}
            rx={1}
            className={BAR}
          />
        </g>
      ))}

      {/* orders strip */}
      <rect x={24} y={184} width={352} height={40} rx={2} className={PANEL} />
      {[0, 1, 2].map((step) => (
        <rect
          key={step}
          x={36 + step * 112}
          y={200}
          width={96}
          height={8}
          rx={1}
          className={step === 2 ? "fill-surface-3" : BAR_STRONG}
        />
      ))}
    </PreviewFrame>
  );
}
