'use client';

import React, { useMemo } from 'react';

export interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: 'success' | 'danger' | 'primary' | 'warning' | 'info';
  showDots?: boolean;
}

export function MiniSparkline({
  data,
  width = 60,
  height = 20,
  className = '',
  color = 'primary',
  showDots = false,
}: MiniSparklineProps) {
  const pathData = useMemo(() => {
    if (!data || data.length === 0) return '';

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return { x, y };
    });

    const path = points
      .map((point, index) => {
        if (index === 0) {
          return `M ${point.x} ${point.y}`;
        }
        return `L ${point.x} ${point.y}`;
      })
      .join(' ');

    return { path, points };
  }, [data, width, height]);

  const colorClasses = {
    success: 'stroke-success',
    danger: 'stroke-danger',
    primary: 'stroke-primary',
    warning: 'stroke-warning',
    info: 'stroke-info',
  };

  const dotColorClasses = {
    success: 'fill-success',
    danger: 'fill-danger',
    primary: 'fill-primary',
    warning: 'fill-warning',
    info: 'fill-info',
  };

  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} className={className}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth="1" opacity="0.2" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      {/* Sparkline path */}
      <path
        d={pathData.path}
        fill="none"
        className={colorClasses[color]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Optional dots at data points */}
      {showDots && pathData.points && pathData.points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="1.5"
          className={dotColorClasses[color]}
        />
      ))}
    </svg>
  );
}

// Utility function to generate mock sparkline data for demo
export function generateMockSparklineData(days: number = 7, trend: 'up' | 'down' | 'flat' = 'flat'): number[] {
  const baseValue = 100;
  const data: number[] = [];

  for (let i = 0; i < days; i++) {
    let value = baseValue;
    const randomVariation = (Math.random() - 0.5) * 20;

    if (trend === 'up') {
      value += i * 5 + randomVariation;
    } else if (trend === 'down') {
      value -= i * 5 + randomVariation;
    } else {
      value += randomVariation;
    }

    data.push(Math.max(0, value));
  }

  return data;
}
