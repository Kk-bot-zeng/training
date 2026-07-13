"use client";

import useSWR from "swr";
import { Button, Space, Table, Tag, Spin, Tooltip } from "antd";
import { FileTextOutlined, PlayCircleOutlined, LinkOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { fetcher, swrConfig } from "@/lib/fetcher";

type Material = { name: string; url: string; type?: string };
type TrainingRecord = {
  id: number;
  topic: string;
  date: string;
  instructor: string | null;
  status: "pending" | "ongoing" | "completed";
  materials: string | null;
  recording: string | null;
};

const statusLabels = { pending: "待开始", ongoing: "进行中", completed: "已完成" };
const statusColors = { pending: "default", ongoing: "processing", completed: "success" };

function parseMaterials(value: string | null): Material[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function MyTrainingsPage() {
  const { data, isLoading } = useSWR<{ items: TrainingRecord[]; total: number }>(
    "/api/training-records?pageSize=100",
    fetcher,
    { ...swrConfig, refreshInterval: 30000 }
  );
  const records = data?.items || [];

  if (isLoading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;

  const columns = [
    { title: "培训主题", dataIndex: "topic", key: "topic", width: 260, render: (topic: string) => <strong>{topic}</strong> },
    { title: "培训时间", dataIndex: "date", key: "date", width: 130, render: (date: string) => dayjs(date).format("YYYY-MM-DD") },
    { title: "讲师", dataIndex: "instructor", key: "instructor", width: 120, render: (instructor: string | null) => instructor || "待定" },
    {
      title: "状态", dataIndex: "status", key: "status", width: 100,
      render: (status: TrainingRecord["status"]) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>,
    },
    {
      title: "课件", dataIndex: "materials", key: "materials", minWidth: 220,
      render: (value: string | null) => {
        const materials = parseMaterials(value);
        if (!materials.length) return <span style={{ color: "#9aa9b2" }}>暂未上传</span>;
        return (
          <Space size={[6, 6]} wrap>
            {materials.map((material, index) => material.url ? (
              <Tooltip title={material.name} key={`${material.name}-${index}`}>
                <Button size="small" icon={<FileTextOutlined />} href={material.url} target="_blank" rel="noopener noreferrer">
                  {material.name || `课件${index + 1}`}
                </Button>
              </Tooltip>
            ) : <Tag key={`${material.name}-${index}`} icon={<FileTextOutlined />}>{material.name || `课件${index + 1}`}</Tag>)}
          </Space>
        );
      },
    },
    {
      title: "录屏", dataIndex: "recording", key: "recording", width: 130,
      render: (recording: string | null) => recording ? (
        <Button type="link" icon={<PlayCircleOutlined />} href={recording} target="_blank" rel="noopener noreferrer">观看录屏</Button>
      ) : <span style={{ color: "#9aa9b2" }}>暂未上传</span>,
    },
  ];

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>学习资料</h1>
        <p style={{ color: "#82939e", margin: "4px 0 0" }}>
          查看培训主题、课件和录屏，资料更新后会自动同步
        </p>
      </div>
      <div style={{ background: "#fff", borderRadius: 17, padding: "4px 0", boxShadow: "0 12px 32px rgba(12,43,61,.07)" }}>
        <Table<TrainingRecord> dataSource={records} columns={columns} rowKey="id"
          pagination={{ pageSize: 20 }} scroll={{ x: 980 }}
          locale={{ emptyText: <div style={{ padding: 40 }}><LinkOutlined style={{ fontSize: 24, marginBottom: 8 }} /><br />暂无培训学习资料</div> }} />
      </div>
    </div>
  );
}
