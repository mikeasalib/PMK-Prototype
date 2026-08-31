import type { CSSProperties, ReactNode } from "react";

/**
 * Kaizen Labs primitives, light mode.
 *
 * The whole visual language is four moves — a hairline, a mono label, a square
 * edge, and one accent where something is actually wrong — so it is cheaper to
 * hold it in a handful of components than to spread the same inline styles
 * across fourteen screens. Everything here is presentational: no data, no
 * routing, no state.
 *
 * Geometry rules the screens rely on:
 *   frame hairline  #DBDBD9   a panel's outer border
 *   header rule     #161616   a panel's own header, and header/KPI separators
 *   row divider     #ECECEC   rows inside a panel
 *   radius          0         everywhere, no exceptions
 *   shadow          none
 */

export const KZ = {
  graphite: "#202020",
  ink: "#161616",
  white: "#FFFFFF",
  bone: "#DBDBD9",
  grey200: "#ECECEC",
  grey050: "#F6F7F7",
  grey400: "#B7B7B7",
  muted: "#7C7878",
  body: "#4B4B4B",
  monoDate: "#646464",
  blue: "#325AAC",
  blueTint: "#5F9FFF",
  coral: "#FB4938",
  amber: "#8A5A00",
  green: "#2E8540",
} as const;

/** Sidebar-only alphas on graphite. */
export const RAIL = {
  text: "rgba(255,255,255,0.82)",
  active: "#FFFFFF",
  dim: "rgba(255,255,255,0.4)",
  meta: "rgba(255,255,255,0.55)",
  rule: "rgba(255,255,255,0.14)",
  fill: "rgba(255,255,255,0.14)",
  hover: "rgba(255,255,255,0.07)",
  box: "rgba(255,255,255,0.2)",
  disclosure: "rgba(255,255,255,0.72)",
} as const;

/** Counts read as two digits. `04`, `11`, `00`. */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Health / severity / status → the one accent that applies.
 *
 * Green is reserved: on-track, resolved, done. Nothing else in this design is
 * green.
 */
export function toneFor(value: string | null | undefined): string {
  const v = (value ?? "").toLowerCase();
  if (/^(on track|green|resolved|complete|completed|done|closed|ok)$/.test(v)) return KZ.green;
  if (/^(blocked|critical|urgent|open|red|off track)$/.test(v)) return KZ.coral;
  if (/^(at risk|high|mitigating|amber|watch)$/.test(v)) return KZ.amber;
  if (/^(medium|in progress|active|blue)$/.test(v)) return KZ.blue;
  return KZ.muted;
}

/** The tag recipe: mono 10px uppercase, 1px border in its own colour. */
export function tagStyle(color: string): CSSProperties {
  return {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    lineHeight: 1.4,
    color,
    border: `1px solid ${color}`,
    padding: "2px 6px",
    whiteSpace: "nowrap",
  };
}

export function Tag({
  tone,
  children,
  style,
  title,
}: {
  tone: string;
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <span title={title} style={{ ...tagStyle(tone), ...style }}>
      {children}
    </span>
  );
}

/**
 * Eyebrow. Mono, uppercase, closed with a ` //` marker — the design's stand-in
 * for the icon the Kaizen system does not ship.
 */
export function Eyebrow({
  children,
  size = 11,
  tone = KZ.muted,
  style,
}: {
  children: ReactNode;
  size?: number;
  tone?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: size,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        color: tone,
        ...style,
      }}
    >
      {children} //
    </div>
  );
}

/** Mono meta line: dates, owners, IDs, provenance. */
export function Mono({
  children,
  size = 10.5,
  tone = KZ.muted,
  style,
  title,
}: {
  children: ReactNode;
  size?: number;
  tone?: string;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{ fontFamily: "var(--font-mono)", fontSize: size, color: tone, ...style }}
    >
      {children}
    </span>
  );
}

/**
 * The provenance / gap disclosure. Mono 10px in grey, sitting under whatever it
 * qualifies — the honesty rule the whole app is built on, given one shape so it
 * reads the same on every screen.
 */
export function Disclosure({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        marginTop: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        lineHeight: 1.5,
        color: KZ.muted,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A framed prose box — the screen-level disclosure at the top of a page. */
export function NoteBox({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        border: `1px solid ${KZ.bone}`,
        padding: "16px 18px",
        fontSize: 12.5,
        lineHeight: 1.55,
        color: KZ.body,
        maxWidth: 900,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Page body padding, per the handoff: 28px 40px 60px. */
export function PageBody({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)", ...style }}
    >
      {children}
    </div>
  );
}

/** A hairline panel. `tint` is the one grey fill in the design. */
export function Panel({
  children,
  tint,
  compact,
  style,
}: {
  children: ReactNode;
  tint?: boolean;
  compact?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        border: `1px solid ${KZ.bone}`,
        background: tint ? KZ.grey050 : KZ.white,
        padding: compact ? "20px 24px" : "24px 28px",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/**
 * A panel's own header: mono label left, count or note right, closed by a rule.
 * `strong` switches the rule to ink, which is what the section headers on the
 * flat-row screens (Team tasks) use.
 */
export function PanelHead({
  label,
  right,
  rightTone,
  strong,
  style,
}: {
  label: ReactNode;
  right?: ReactNode;
  rightTone?: string;
  strong?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        borderBottom: `1px solid ${strong ? KZ.ink : KZ.bone}`,
        paddingBottom: 10,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          color: KZ.ink,
        }}
      >
        {label}
      </span>
      {right !== undefined && right !== null ? (
        <Mono size={11} tone={rightTone ?? KZ.muted}>
          {right}
        </Mono>
      ) : null}
    </div>
  );
}

/** Rows inside a panel are separated by #ECECEC, never framed. */
export function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <li
      style={{
        padding: "14px 0",
        borderBottom: `1px solid ${KZ.grey200}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...style,
      }}
    >
      {children}
    </li>
  );
}

export function List({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <ul style={{ listStyle: "none", margin: 0, padding: 0, ...style }}>{children}</ul>;
}

/** A 6×6 hairline square. The design's bullet, and its status swatch. */
export function Square({
  tone,
  filled,
  size = 6,
  style,
  title,
}: {
  tone?: string;
  filled?: boolean;
  size?: number;
  style?: CSSProperties;
  title?: string;
}) {
  const color = tone ?? KZ.ink;
  return (
    <span
      aria-hidden
      title={title}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: "inline-block",
        background: filled ? color : "transparent",
        border: filled ? "none" : `1px solid ${color}`,
        ...style,
      }}
    />
  );
}

/**
 * Button. Two variants, both square, both mono — the Kaizen system's own
 * shapes. Hover is opacity, never a colour change.
 */
export function Button({
  children,
  variant = "outline",
  onClick,
  type = "button",
  disabled,
  title,
  style,
}: {
  children: ReactNode;
  variant?: "outline" | "solid";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  const solid = variant === "solid";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="kz-transition kz-hover-fade"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "11px 14px",
        border: `1px solid ${KZ.ink}`,
        borderRadius: 0,
        background: solid ? KZ.ink : KZ.white,
        color: solid ? KZ.white : KZ.ink,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * A filter chip. Active fills in the chip's own colour — the workstream's on
 * Sprint board, ink on a plain filter.
 */
export function Chip({
  label,
  active,
  tone,
  onClick,
  title,
}: {
  label: ReactNode;
  active: boolean;
  tone?: string;
  onClick: () => void;
  title?: string;
}) {
  const color = tone ?? KZ.ink;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="kz-transition"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        padding: "6px 10px",
        borderRadius: 0,
        cursor: "pointer",
        border: `1px solid ${active ? color : KZ.bone}`,
        background: active ? color : KZ.white,
        color: active ? KZ.white : KZ.ink,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export interface Kpi {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  title?: string;
}

/**
 * Full-bleed KPI strip: four cells, ink dividers between them and an ink rule
 * underneath. Values are the one place this design goes large — 46px.
 */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div
      className="kz-kpi"
      // Column count and the dividers live in CSS (.kz-kpi), which is what lets
      // the strip fold to two columns on a narrow viewport without leaving a
      // divider hanging at the right edge.
      style={{ ["--kz-kpi-cols" as string]: String(Math.min(items.length, 4)) }}
    >
      {items.map((k) => (
        <div
          key={k.label}
          title={k.title}
          style={{
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              color: KZ.muted,
            }}
          >
            {k.label}
          </div>
          <div
            style={{
              fontSize: 46,
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: k.danger ? KZ.coral : KZ.ink,
            }}
          >
            {k.value}
          </div>
          {k.sub ? (
            <Mono size={10.5} tone={KZ.monoDate}>
              {k.sub}
            </Mono>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Section title inside a panel. */
export function SectionTitle({
  children,
  size = 18,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 500,
        letterSpacing: size >= 24 ? "-0.03em" : "-0.02em",
        lineHeight: 1.15,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** A bulleted line: 6×6 hairline square, then text. */
export function Bullet({
  children,
  tone,
  mono,
}: {
  children: ReactNode;
  tone?: string;
  mono?: boolean;
}) {
  return (
    <li
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: mono ? 11.5 : 13,
        lineHeight: 1.45,
        color: mono ? KZ.ink : KZ.body,
      }}
    >
      <Square tone={tone ?? KZ.ink} style={{ marginTop: 6 }} />
      <span>{children}</span>
    </li>
  );
}

/**
 * A progress track. 6px, #ECECEC ground, blue fill — the only bar in the
 * design, used for the phase's day count.
 */
export function Track({ pct, tone }: { pct: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ height: 6, background: KZ.grey200 }}>
      <div style={{ width: `${clamped}%`, height: 6, background: tone ?? KZ.blue }} />
    </div>
  );
}

/** An 18px square checkbox. Done is green fill and a white check. */
export function CheckSquare({
  done,
  onClick,
  label,
}: {
  done: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={done}
      aria-label={label}
      className="kz-transition"
      style={{
        width: 18,
        height: 18,
        flex: "0 0 18px",
        marginTop: 2,
        padding: 0,
        borderRadius: 0,
        cursor: "pointer",
        border: `1px solid ${done ? KZ.green : KZ.grey400}`,
        background: done ? KZ.green : KZ.white,
        color: KZ.white,
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      {done ? "✓" : ""}
    </button>
  );
}

/** Strike-through and drop to grey once a follow-up is checked. */
export function doneTextStyle(done: boolean): CSSProperties {
  return {
    fontSize: 14,
    lineHeight: 1.4,
    color: done ? KZ.muted : KZ.ink,
    textDecoration: done ? "line-through" : "none",
  };
}

/** A table inside its own hairline frame, scrolling horizontally when narrow. */
export function TableFrame({
  children,
  minWidth = 900,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div style={{ border: `1px solid ${KZ.bone}`, overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12.5,
          minWidth,
        }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 400,
        textTransform: "uppercase",
        color: KZ.muted,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  style,
  title,
  colSpan,
}: {
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} title={title} style={{ padding: "13px 14px", ...style }}>
      {children}
    </td>
  );
}

/** An empty state, framed in the disabled hairline rather than the panel one. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${KZ.grey400}`,
        padding: 40,
        textAlign: "center",
        maxWidth: 720,
        fontSize: 14,
        lineHeight: 1.55,
        color: KZ.body,
      }}
    >
      {children}
    </div>
  );
}
