'use client';

import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface AnalyticsChartProps {
  data: { date: string; leads: number }[];
}

export default function AnalyticsChart({ data }: AnalyticsChartProps) {
  return (
    <div style={{ width: '100%', height: 300, marginTop: '1rem', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00D1FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false} 
            stroke="rgba(var(--foreground-rgb), 0.05)" 
          />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--card)', 
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: 'var(--foreground)',
              backdropFilter: 'blur(10px)'
            }}
            itemStyle={{ color: 'var(--primary)' }}
          />
          <Area 
            type="monotone" 
            dataKey="leads" 
            stroke="#00D1FF" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorLeads)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
