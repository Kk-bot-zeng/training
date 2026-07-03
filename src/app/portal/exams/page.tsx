"use client";

import { useEffect, useState } from "react";
import { Card, List, Tag, Button, message, Spin } from "antd";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

export default function ExamListPage() {
  const [exams, setExams] = useState<Record<string, unknown>[]>([]);
  const [attempts, setAttempts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/papers").then(r => r.json()),
    ]).then(([p]) => {
      if (p.success) setExams(p.data.filter((x: Record<string, unknown>) => x.status === "published"));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>我的考试</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>参加定时考试或模拟练习</p>
      </div>

      {exams.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: "center", padding: 40 }}>
          <p style={{ color: "#9ca3af", fontSize: 16 }}>暂无考试安排</p>
          <p style={{ color: "#d1d5db", fontSize: 13 }}>等待管理员发布新的考试</p>
        </Card>
      ) : (
        <List grid={{ gutter: 16, xs: 1, sm: 1, md: 2 }} dataSource={exams} renderItem={(e: Record<string, unknown>) => (
          <List.Item>
            <Card hoverable style={{ borderRadius: 16 }} onClick={() => router.push(`/portal/exams/${e.id}`)}
              title={<span style={{ fontSize: 15, fontWeight: 600 }}>{e.title as string}</span>}
              extra={<Tag color={e.type === "timed" ? "blue" : "green"}>{e.type === "timed" ? "定时考试" : "模拟练习"}</Tag>}>
              <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 2 }}>
                <div>⏱ 时长：{e.duration as number}分钟</div>
                <div>✅ 及格：{e.passScore as number}分</div>
                <div>📝 总分：{e.totalScore as number}分</div>
                {(e.startTime as string) && <div>🕐 时间：{dayjs(e.startTime as string).format("MM/DD HH:mm")} - {dayjs(e.endTime as string).format("HH:mm")}</div>}
              </div>
              <Button type="primary" block style={{ marginTop: 12, borderRadius: 10 }}>开始考试</Button>
            </Card>
          </List.Item>
        )} />
      )}
    </div>
  );
}
