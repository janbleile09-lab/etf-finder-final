"use client";

import { useMemo } from "react";

export interface SparklineData {
  points: { datetime: string; close: number }[];
}

interface SparklineProps {
  data: SparklineData | null;
  width?: number;
  height?: number;
  lineColor?: string;
  fillColor?: string;
  loading?: boolean;
}

/**
 * A minimal SVG sparkline chart that renders a line from time series data.
 * Shows a pulsing placeholder while loading, and nothing if data is empty.
 */
export function Sparkline({
  data,
  width = 120,
  height = 40,
  lineColor = "var(--color-primary, #3b82f6)",
  fillColor = "var(--color-primary, #3b82f6)",
  loading = false,
}: SparklineProps) {
  const pathD = useMemo(() => {
    if (!data || data.points.length < 2) return null;

    const points = data.points;
    const closes = points.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const padding = 2; // px padding inside the SVG viewport
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    // Build SVG path
    const coords = points.map((p, i) => {
      const x = padding + (i / (points.length - 1)) * chartW;
      const y = padding + chartH - ((p.close - min) / range) * chartH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    // Path for the line
    const linePath = coords.join(" ");

    // Path for the area fill (close the shape at the bottom)
    const firstX = padding;
    const lastX = padding + chartW;
    const bottomY = padding + chartH;
    const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;

    return { linePath, areaPath };
  }, [data, width, height]);

  // Loading state — pulsing placeholder
  if (loading || !data) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={loading ? "animate-pulse" : ""}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={4}
          className="fill-muted/40"
        />
        {loading && (
          <path
            d={`M 4 ${height / 2} Q ${width / 3} ${height * 0.2} ${width / 2} ${height / 2} T ${width - 4} ${height / 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-muted-foreground/30"
          />
        )}
      </svg>
    );
  }

  // No valid path
  if (!pathD) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={4}
          className="fill-muted/40"
        />
      </svg>
    );
  }

  // Determine if trend is positive (first vs last close)
  const trend =
    data.points[data.points.length - 1].close >= data.points[0].close;
  const actualLineColor = trend ? "var(--color-emerald-500, #10b981)" : "var(--color-red-500, #ef4444)";
  const actualFillColor = trend
    ? "var(--color-emerald-500, #10b981)"
    : "var(--color-red-500, #ef4444)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Sparkline chart, trend ${trend ? "up" : "down"}`}
    >
      {/* Area fill */}
      <path
        d={pathD.areaPath}
        fill={actualFillColor}
        fillOpacity={0.08}
      />
      {/* Line */}
      <path
        d={pathD.linePath}
        fill="none"
        stroke={actualLineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot at the end */}
      {data.points.length > 0 && (() => {
        const last = data.points[data.points.length - 1];
        const closes = data.points.map((p) => p.close);
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        const range = max - min || 1;
        const padding = 2;
        const chartW = width - padding * 2;
        const chartH = height - padding * 2;
        const cx = padding + chartW;
        const cy = padding + chartH - ((last.close - min) / range) * chartH;
        return (
          <circle
            cx={cx.toFixed(1)}
            cy={cy.toFixed(1)}
            r={2}
            fill={actualLineColor}
          />
        );
      })()}
    </svg>
  );
}
