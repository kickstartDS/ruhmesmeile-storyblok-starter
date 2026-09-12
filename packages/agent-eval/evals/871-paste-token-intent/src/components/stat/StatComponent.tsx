import { forwardRef } from "react";

import "./stat.scss";

export interface StatProps {
  /** The headline figure, already formatted for display. */
  value: string;
  /** What the figure measures. */
  label: string;
  /** Period-over-period change, already formatted (e.g. "+12.4%"). */
  delta?: string;
  /** Whether the change is good or bad news for this metric. */
  trend?: "up" | "down";
}

export const Stat = forwardRef<HTMLDivElement, StatProps>(
  ({ value, label, delta, trend = "up" }, ref) => (
    <div className="dsa-stat" ref={ref}>
      <p className="dsa-stat__value">{value}</p>
      <p className="dsa-stat__label">{label}</p>
      {delta ? (
        <p className={`dsa-stat__delta dsa-stat__delta--${trend}`}>{delta}</p>
      ) : null}
    </div>
  ),
);

Stat.displayName = "Stat";
