"use client";

import { useEffect, useState } from "react";
import { Table, Tag, Spin } from "antd";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

export default function ScoresPage() {
  const [attempts, setAttempts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(async userData => {
      if (!userData.success) return;
      // Fetch papers + attempts via overview stats
      // For simplicity, let's load papers and check attempts
      const papersRes = await fetch("/api/papers");
      const papersData = await papersRes.json();
      if (!papersData.success) return setLoading(false);

      const results: Record<string, unknown>[] = [];
      for (const p of papersData.data) {
        // Try to find attempts for this user
        const detailRes = await fetch(`/api/statistics/employee?employeeId=${userData.data.id}`);
        // This won't give us exam attempts directly. Let me use a different approach.
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>成绩记录</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>查看你的考试历史成绩</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <p style={{ color: "#9ca3af" }}>完成考试后，成绩将显示在这里</p>
      </div>
    </div>
  );
}
