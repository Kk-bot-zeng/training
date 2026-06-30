"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table,
  Select,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  DatePicker,
  Space,
  message,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Training } from "@/types";

const statusColors: Record<string, string> = {
  present: "green",
  late: "orange",
  leave: "blue",
  absent: "red",
};
const statusLabels: Record<string, string> = {
  present: "出席",
  late: "迟到",
  leave: "请假",
  absent: "缺席",
};

export default function AttendancePage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<number | undefined>();
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [rateData, setRateData] = useState<Record<string, unknown> | null>(null);

  const fetchTrainings = async () => {
    const res = await fetch("/api/trainings?pageSize=200");
    const data = await res.json();
    if (data.success) setTrainings(data.data.items);
  };

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTrainingId) return;

    setLoading(true);
    try {
      const [detailRes, rateRes] = await Promise.all([
        fetch(`/api/trainings/${selectedTrainingId}`),
        fetch(`/api/statistics/rate?trainingId=${selectedTrainingId}`),
      ]);

      const detail = await detailRes.json();
      const rate = await rateRes.json();

      if (detail.success) {
        setRecords((detail.data.attendance as Record<string, unknown>[]) || []);
      }
      if (rate.success) {
        setRateData(rate.data as Record<string, unknown>);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTrainingId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = () => {
    if (!selectedTrainingId) {
      message.warning("请先选择培训");
      return;
    }
    window.open(`/api/export/attendance?trainingId=${selectedTrainingId}`, "_blank");
  };

  const columns = [
    {
      title: "姓名",
      dataIndex: ["employee", "name"],
      key: "name",
    },
    {
      title: "工号",
      dataIndex: ["employee", "employeeNo"],
      key: "employeeNo",
    },
    {
      title: "部门",
      dataIndex: ["employee", "department", "name"],
      key: "dept",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>
      ),
    },
    {
      title: "签到时间",
      dataIndex: "checkInTime",
      key: "checkInTime",
      render: (t: string | null) => (t ? dayjs(t).format("YYYY-MM-DD HH:mm:ss") : "-"),
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      render: (r: string | null) => r || "-",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold">考勤记录</h2>
        <Space wrap>
          <Select
            placeholder="选择培训查看考勤"
            showSearch
            style={{ width: 300 }}
            value={selectedTrainingId}
            onChange={setSelectedTrainingId}
            filterOption={(input, option) =>
              (option?.label as string)?.includes(input)
            }
            options={trainings.map((t) => ({
              label: `${dayjs(t.date).format("YYYY-MM-DD")} ${t.title}`,
              value: t.id,
            }))}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={!selectedTrainingId}
          >
            导出Excel
          </Button>
        </Space>
      </div>

      {rateData && (
        <Row gutter={16} className="mb-4">
          <Col xs={12} sm={4}>
            <Card><Statistic title="总人数" value={rateData.total as number} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="出席" value={rateData.present as number} valueStyle={{ color: "#52c41a" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="迟到" value={rateData.late as number} valueStyle={{ color: "#faad14" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="请假" value={rateData.leave as number} valueStyle={{ color: "#1677ff" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="缺勤" value={rateData.absent as number} valueStyle={{ color: "#ff4d4f" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="出勤率" value={rateData.presentRate as string} valueStyle={{ color: "#722ed1" }} /></Card>
          </Col>
        </Row>
      )}

      <Card>
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: selectedTrainingId ? "暂无签到记录" : "请选择一场培训查看考勤" }}
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  );
}
