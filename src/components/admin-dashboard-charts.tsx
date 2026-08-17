"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function AttendanceTrendChart({ data }: { data: { month: string; rate: number; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#182b3b22" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#65727d" }} axisLine={false} tickLine={false} />
        <YAxis domain={[70, 100]} tick={{ fontSize: 12, fill: "#65727d" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
        <Line type="monotone" dataKey="rate" stroke="#111820" strokeWidth={2} dot={{ r: 4, fill: "#111820" }} activeDot={{ r: 6, fill: "#111820" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DepartmentRateChart({ data }: { data: { name: string; rate: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#182b3b22" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#65727d" }} axisLine={false} tickLine={false} unit="%" />
        <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12, fill: "#37424b" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "none" }} />
        <Bar dataKey="rate" radius={[0, 4, 4, 0]} fill="#111820" />
      </BarChart>
    </ResponsiveContainer>
  );
}
