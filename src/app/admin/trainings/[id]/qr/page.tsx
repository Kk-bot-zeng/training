"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Spin, Typography, message, Space, Tag } from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import dynamic from "next/dynamic";
import dayjs from "dayjs";

const { Title, Text } = Typography;

// Dynamically import QRCodeSVG to avoid SSR issues
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  { ssr: false }
);

export default function QRCodePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [training, setTraining] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkinUrl, setCheckinUrl] = useState("");
  const [refreshIn, setRefreshIn] = useState(60);

  const refreshDynamicQr = async () => {
    const res = await fetch(`/api/trainings/${id}/qr`);
    const data = await res.json();
    if (data.success) {
      setCheckinUrl(data.data.checkinUrl);
      setRefreshIn(60);
    }
  };

  const fetchTraining = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trainings/${id}`);
      const data = await res.json();
      if (data.success) setTraining(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraining();
    refreshDynamicQr();
    const qrTimer = setInterval(refreshDynamicQr, 60_000);
    const countdown = setInterval(() => setRefreshIn((value) => Math.max(0, value - 1)), 1000);
    return () => { clearInterval(qrTimer); clearInterval(countdown); };
  }, [id]);

  const handleRegenerate = async () => {
    try {
      const res = await fetch(`/api/trainings/${id}/qr`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        message.success("二维码已重新生成");
        fetchTraining();
        refreshDynamicQr();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error("操作失败");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  if (!training) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push(`/admin/trainings/${id}`)}
        className="!p-0 mb-4"
      >
        返回培训详情
      </Button>

      <Card className="text-center print:shadow-none print:border-none">
        <Title level={2} className="!mb-1">
          {training.title as string}
        </Title>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Tag color="blue">
            {training.type === "exam" ? "考试" : "培训"}
          </Tag>
          <Text type="secondary">
            {dayjs(training.date as string).format("YYYY年MM月DD日")}{" "}
            {training.startTime as string}-{training.endTime as string}
          </Text>
        </div>
        <Text type="secondary" className="block mb-1">
          地点：{(training.location as string) || "待定"}
        </Text>

        <div className="my-6 flex justify-center">
          <div className="p-4 bg-white inline-block rounded-lg shadow-sm border">
            <QRCodeSVG
              value={checkinUrl || ""}
              size={320}
              level="H"
              includeMargin
            />
          </div>
        </div>

        <Text className="block mb-1 text-lg font-medium">
          请使用手机扫描二维码签到
        </Text>
        <Text type="secondary" className="block mb-1">
          动态二维码将在 {refreshIn} 秒后自动更新，截图或转发后会失效
        </Text>
        <Text type="secondary" className="block mb-4 break-all">
          {checkinUrl}
        </Text>

        <Space className="no-print">
          <Button icon={<ReloadOutlined />} onClick={handleRegenerate}>
            重新生成
          </Button>
        </Space>
      </Card>
    </div>
  );
}
