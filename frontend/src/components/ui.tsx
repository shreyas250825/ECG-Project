import React, { useState } from "react";

/* ── Inline SVG icon ─────────────────────────────────────────────────── */
export function Icon({
  d,
  size = 16,
  className,
  style,
}: {
  d: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d={d} />
    </svg>
  );
}

/* ── Page header ─────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
      }}
    >
      <div>
        {badge && <div style={{ marginBottom: "0.375rem" }}>{badge}</div>}
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  sub,
  accent,
  dark,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  dark?: boolean;
}) {
  const bg = dark ? "var(--color-navy-mid)" : "var(--color-surface)";
  const labelColor = dark ? "rgba(255,255,255,0.45)" : "var(--color-muted)";
  const valueColor = dark ? "#fff" : "var(--color-ink)";
  const subColor = dark ? "rgba(255,255,255,0.3)" : "var(--color-muted)";

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "var(--color-line)"}`,
        borderRadius: "0.75rem",
        padding: "1rem 1.125rem",
      }}
    >
      <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: labelColor, margin: 0 }}>
        {label}
      </p>
      <p
        style={{
          fontSize: "1.375rem",
          fontWeight: 700,
          color: accent ?? valueColor,
          margin: "0.25rem 0 0",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: "0.6875rem", color: subColor, marginTop: "0.125rem" }}>{sub}</p>
      )}
    </div>
  );
}

/* ── Metric row (small) ──────────────────────────────────────────────── */
export function MetricRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "0.5rem 0",
        borderBottom: "1px solid var(--color-line)",
        gap: "0.5rem",
      }}
    >
      <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)", flexShrink: 0 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-ink)" }}>{value}</span>
        {note && (
          <span style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginLeft: "0.375rem" }}>{note}</span>
        )}
      </div>
    </div>
  );
}

/* ── Section card ────────────────────────────────────────────────────── */
export function SectionCard({
  title,
  subtitle,
  children,
  action,
  noPad,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="card">
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.5rem",
            marginBottom: noPad ? "0" : "1rem",
          }}
        >
          <div>
            {title && (
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.125rem" }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Collapsible ─────────────────────────────────────────────────────── */
export function Collapsible({
  trigger,
  children,
  defaultOpen = false,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div
        className="collapse-trigger"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: "pointer" }}
      >
        {trigger}
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          style={{
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--color-muted)",
            flexShrink: 0,
          }}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && <div style={{ marginTop: "0.75rem" }}>{children}</div>}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--color-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "0.875rem",
            color: "var(--color-muted)",
          }}
        >
          <Icon d={icon} size={22} />
        </div>
      )}
      <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
        {title}
      </p>
      {body && (
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.375rem", maxWidth: 320 }}>
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: "1rem" }}>{action}</div>}
    </div>
  );
}

/* ── Loading spinner ─────────────────────────────────────────────────── */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ animation: "spin 0.8s linear infinite", color: "var(--color-teal)" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" strokeOpacity={0.2} />
      <path d="M21 12a9 9 0 00-9-9" />
    </svg>
  );
}

/* ── Error box ───────────────────────────────────────────────────────── */
export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "#FEF2F2",
        border: "1px solid #FECACA",
        borderRadius: "0.5rem",
        padding: "0.625rem 0.875rem",
        fontSize: "0.8125rem",
        color: "#B91C1C",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.5rem",
      }}
    >
      <span style={{ flexShrink: 0, marginTop: "0.0625rem" }}>⚠</span>
      {message}
    </div>
  );
}

/* ── Success box ─────────────────────────────────────────────────────── */
export function SuccessBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "#F0FDF4",
        border: "1px solid #BBF7D0",
        borderRadius: "0.5rem",
        padding: "0.625rem 0.875rem",
        fontSize: "0.8125rem",
        color: "#166534",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.5rem",
      }}
    >
      <span style={{ flexShrink: 0 }}>✓</span>
      {message}
    </div>
  );
}

/* ── FormField wrapper ───────────────────────────────────────────────── */
export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {hint && (
        <p style={{ fontSize: "0.6875rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
