"use client";

import { useEffect, useState } from "react";
import { Row, Col, Card, List, Tag, Spin } from "antd";
import { useRouter } from "next/navigation";
import { BookOutlined, EditOutlined, CheckCircleOutlined, TrophyOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function PortalDashboard() {
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Record<string, unknown>[]>([]);
  const [attendance, setAttendance] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/papers").then(r => r.json()),
      fetch("/api/auth/me").then(r => r.json()),
    ]).then(([papersData, userData]) => {
      if (papersData.success) {
        const published = papersData.data.filter((p: Record<string, unknown>) => p.status === "published");
        setExams(published);
      }
      // Fetch employee attendance & stats
      if (userData.success && userData.data.role === "employee") {
        fetch(`/api/statistics/employee?employeeId=${userData.data.id}`).then(r => r.json()).then(d => {
          if (d.success) {
            setAttendance(d.data.records?.slice(0, 5) || []);
            setStats({ total: d.data.summary.total, attended: d.data.summary.attended, rate: parseFloat(d.data.summary.rate) || 0 });
          }
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin size="large" /></div>;

  const statCards = [
    { title: "已参加培训", value: stats.total || 0, suffix: "场", icon: <BookOutlined />, color: "#667eea", bg: "rgba(102,126,234,0.12)" },
    { title: "出勤率", value: stats.rate || 0, suffix: "%", icon: <CheckCircleOutlined />, color: "#43e97b", bg: "rgba(67,233,123,0.12)" },
    { title: "待考考试", value: exams.length, suffix: "场", icon: <EditOutlined />, color: "#f5576c", bg: "rgba(245,87,108,0.12)" },
    { title: "平均分", value: 0, suffix: "分", icon: <TrophyOutlined />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  ];

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>👋 欢迎回来</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>查看你的培训考勤和考试安排</p>
      </div>

      <Row gutter={[16, 16]}>
        {statCards.map(c => (
          <Col xs={12} sm={6} key={c.title}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "20px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", color: c.color, fontSize: 18 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1f2937" }}>{c.value}<span style={{ fontSize: 14, color: "#9ca3af", fontWeight: 400 }}>{c.suffix}</span></div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>{c.title}</div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="📋 进行中的考试" style={{ borderRadius: 16 }} onClick={() => router.push("/portal/exams")}>
            {exams.length === 0 ? <p style={{ color: "#9ca3af" }}>暂无考试安排</p> :
              <List size="small" dataSource={exams.slice(0, 4)} renderItem={(e: Record<string, unknown>) => (
                <List.Item extra={<Tag color="blue">{e.type === "timed" ? "定时" : "练习"}</Tag>}
                  onClick={() => router.push(`/portal/exams/${e.id}`)} style={{ cursor: "pointer" }}>
                  <List.Item.Meta title={e.title as string} description={`${e.duration}分钟 · ${e.passScore}分及格`} />
                </List.Item>
              )} />
            }
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="📊 近期考勤" style={{ borderRadius: 16 }} onClick={() => router.push("/portal/attendance")}>
            {(!attendance || attendance.length === 0) ? <p style={{ color: "#9ca3af" }}>暂无考勤记录</p> :
              <List size="small" dataSource={attendance} renderItem={(a: Record<string, unknown>) => (
                <List.Item>
                  <List.Item.Meta
                    title={(a.training as { title: string })?.title || "培训"}
                    description={a.status === "present" ? "✅ 出席" : a.status === "late" ? "⚠️ 迟到" : "❌ 缺勤"}
                  />
                </List.Item>
              )} />
            }
          </Card>
        </Col>
      </Row>
    </div>
  );
}
