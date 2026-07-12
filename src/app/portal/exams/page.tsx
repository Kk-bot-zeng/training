"use client";

import useSWR from "swr";
import { Card, List, Tag, Button, Spin } from "antd";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { fetcher, swrConfig } from "@/lib/fetcher";

export default function ExamListPage() {
  const router = useRouter();
  const { data: exams, isLoading } = useSWR("/api/papers?status=published", fetcher, swrConfig);

  const published = exams || [];

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>我的考试</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0" }}>参加定时考试或模拟练习</p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>
      ) : published.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: "center", padding: 40 }}>
          <p style={{ color: "#9ca3af", fontSize: 16 }}>暂无考试安排</p>
        </Card>
      ) : (
        <List grid={{ gutter: 16, xs: 1, sm: 1, md: 2 }} dataSource={published} renderItem={(e: Record<string, unknown>) => (
          <List.Item>
            <Card hoverable style={{ borderRadius: 16 }} onClick={() => router.push(`/portal/exams/${e.id}`)}
              title={<span style={{ fontSize: 15, fontWeight: 600 }}>{e.title as string}</span>}
              extra={<Tag color={e.type === "timed" ? "blue" : "green"}>{e.type === "timed" ? "定时考试" : "模拟练习"}</Tag>}>
              <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 2 }}>
                <div>⏱ 时长：{e.duration as number}分钟</div>
                <div>✅ 及格：{e.passScore as number}分</div>
                {(e.startTime as string) && <div>🕐 {dayjs(e.startTime as string).format("MM/DD HH:mm")}</div>}
              </div>
              <Button type="primary" block style={{ marginTop: 12, borderRadius: 10 }}>开始考试</Button>
            </Card>
          </List.Item>
        )} />
      )}
    </div>
  );
}
