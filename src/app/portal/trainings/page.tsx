"use client";

import { useEffect, useState } from "react";
import { Table, Tag, Spin } from "antd";
import dayjs from "dayjs";

const statusLabels: Record<string, string> = { present: "出席", late: "迟到", leave: "请假", absent: "缺勤" };
const statusColors: Record<string, string> = { present: "green", late: "orange", leave: "blue", absent: "red" };

export default function MyTrainingsPage() {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(async user => {
      if (!user.success) return;
      const res = await fetch(`/api/statistics/employee?employeeId=${user.data.id}`);
      const d = await res.json();
      if (d.success) setRecords(d.data.records || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;

  const columns = [
    { title: "培训名称", dataIndex: ["training", "title"], key: "title" },
    { title: "日期", dataIndex: ["training", "date"], key: "date", render: (d: string) => dayjs(d).format("YYYY-MM-DD") },
    { title: "类型", dataIndex: ["training", "type"], key: "type", render: (t: string) => <Tag color={t === "exam" ? "red" : "blue"}>{t === "exam" ? "考试" : "培训"}</Tag> },
    { title: "考勤状态", dataIndex: "status", key: "status", render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>我的培训</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>已参加的培训记录</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={records} columns={columns} rowKey="id" pagination={{ pageSize: 20 }}
          locale={{ emptyText: "暂无培训记录" }} size="middle" />
      </div>
    </div>
  );
}
