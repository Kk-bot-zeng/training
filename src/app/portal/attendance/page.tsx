"use client";

import useSWR from "swr";
import { Table, Tag, Spin, Card, Statistic, Row, Col } from "antd";
import dayjs from "dayjs";
import { fetcher, swrConfig } from "@/lib/fetcher";

const statusLabels: Record<string, string> = { present: "出席", late: "迟到", leave: "请假", absent: "缺勤" };
const statusColors: Record<string, string> = { present: "green", late: "orange", leave: "blue", absent: "red" };

export default function MyAttendancePage() {
  const { data, isLoading } = useSWR("/api/statistics/employee", fetcher, swrConfig);

  if (isLoading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;

  const columns = [
    { title: "培训名称", dataIndex: ["training", "title"], key: "title" },
    { title: "日期", dataIndex: ["training", "date"], key: "date", render: (d: string) => dayjs(d).format("YYYY-MM-DD") },
    { title: "类型", dataIndex: ["training", "type"], key: "type", render: (t: string) => <Tag color={t === "exam" ? "red" : "blue"}>{t === "exam" ? "考试" : "培训"}</Tag> },
    { title: "状态", dataIndex: "status", key: "status", render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: "签到时间", dataIndex: "checkInTime", key: "time", render: (t: string | null) => t ? dayjs(t).format("HH:mm:ss") : "-" },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>我的考勤</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>查看你的培训出勤记录</p>
      </div>

      {data && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={6}><Card style={{ borderRadius: 12 }}><Statistic title="总培训" value={data.summary.total} suffix="场" /></Card></Col>
          <Col span={6}><Card style={{ borderRadius: 12 }}><Statistic title="出勤" value={data.summary.attended} suffix="次" valueStyle={{ color: "#52c41a" }} /></Card></Col>
          <Col span={6}><Card style={{ borderRadius: 12 }}><Statistic title="缺勤" value={data.summary.absent} suffix="次" valueStyle={{ color: "#ff4d4f" }} /></Card></Col>
          <Col span={6}><Card style={{ borderRadius: 12 }}><Statistic title="出勤率" value={data.summary.rate} valueStyle={{ color: "#722ed1" }} /></Card></Col>
        </Row>
      )}

      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={data?.records || []} columns={columns} rowKey="id" pagination={{ pageSize: 20 }}
          locale={{ emptyText: "暂无考勤记录" }} size="middle" />
      </div>
    </div>
  );
}
