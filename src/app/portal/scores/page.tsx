"use client";

import useSWR from "swr";
import { Table, Tag, Spin } from "antd";
import dayjs from "dayjs";
import { fetcher, swrConfig } from "@/lib/fetcher";

type Attempt = {
  id: number;
  score: number | null;
  totalScore: number;
  status: string;
  endTime: string | null;
  createdAt: string;
  paper: { title: string; passScore: number; totalScore: number };
};

export default function ScoresPage() {
  const { data: attempts, isLoading } = useSWR<Attempt[]>("/api/attempts", fetcher, swrConfig);

  if (isLoading) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }

  const columns = [
    { title: "考试名称", dataIndex: ["paper", "title"], key: "title" },
    {
      title: "成绩", key: "score",
      render: (_: unknown, record: Attempt) => record.score === null ? "待批改" : `${record.score} / ${record.totalScore}`,
    },
    {
      title: "结果", key: "result",
      render: (_: unknown, record: Attempt) => {
        if (record.score === null) return <Tag>待批改</Tag>;
        const passed = record.score >= record.paper.passScore;
        return <Tag color={passed ? "green" : "red"}>{passed ? "及格" : "未及格"}</Tag>;
      },
    },
    {
      title: "提交时间", key: "time",
      render: (_: unknown, record: Attempt) => dayjs(record.endTime || record.createdAt).format("YYYY-MM-DD HH:mm"),
    },
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>成绩记录</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>查看你的考试历史成绩</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={attempts || []} columns={columns} rowKey="id" pagination={{ pageSize: 20 }}
          locale={{ emptyText: "暂无考试成绩" }} />
      </div>
    </div>
  );
}
