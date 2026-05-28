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
  data: { 
    date: string; 
    leads: number; 
    whatsapp?: number; 
    forms?: number;
  }[];
}

export default function AnalyticsChart({ data }: AnalyticsChartProps) {
  return (
    <div style={{ width: '100%', height: 300, marginTop: '1rem', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorForms" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00D1FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorWhatsapp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#25d366" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
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
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}
            labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px', fontWeight: 'bold' }}
          />
          <Area 
            type="monotone" 
            name="WhatsApp"
            dataKey="whatsapp" 
            stroke="#25d366" 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorWhatsapp)" 
            animationDuration={1200}
          />
          <Area 
            type="monotone" 
            name="Formulários"
            dataKey="forms" 
            stroke="#00D1FF" 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorForms)" 
            animationDuration={1200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
