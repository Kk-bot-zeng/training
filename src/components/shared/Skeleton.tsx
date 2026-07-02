"use client";

import { Skeleton } from "antd";

export function PageSkeleton() {
  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <Skeleton.Input active size="large" style={{ width: 180, height: 28 }} />
        <Skeleton.Input active size="small" style={{ width: 260, marginTop: 8 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 12 }} />
            <Skeleton.Input active size="large" style={{ width: 60, height: 36 }} />
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <Skeleton.Input active size="large" style={{ width: 180, height: 28 }} />
        <Skeleton.Input active size="small" style={{ width: 240, marginTop: 8 }} />
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    </div>
  );
}
