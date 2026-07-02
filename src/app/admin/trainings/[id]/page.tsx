"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  Descriptions,
  Table,
  Tag,
  Button,
  Space,
  Select,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
} from "antd";
import { QrcodeOutlined, ExportOutlined, ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import type { Department } from "@/types";

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

export default function TrainingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [training, setTraining] = useState<Record<string, unknown> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchTraining = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trainings/${id}`);
      const data = await res.json();
      if (data.success) setTraining(data.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTraining();
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setDepartments(data.data);
      });
  }, [fetchTraining]);

  const updateStatus = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/trainings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(
          newStatus === "ongoing"
            ? "培训已开始"
            : newStatus === "completed"
            ? "培训已结束，缺勤人员已自动标记"
            : "状态已更新"
        );
        fetchTraining();
      } else {
        message.error(data.message);
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleManualCheckin = async (employeeId: number, status: string) => {
    try {
      const res = await fetch(`/api/trainings/${id}/attendance/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, status }),
      });
      const data = await res.json();
      if (data.success) {
        message.success("操作成功");
        fetchTraining();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error("操作失败");
    }
  };

  const getDeptNames = (deptIdsJson: string) => {
    try {
      const ids = JSON.parse(deptIdsJson) as number[];
      return ids
        .map((dId) => departments.find((d) => d.id === dId)?.name)
        .filter(Boolean)
        .join("、");
    } catch {
      return "-";
    }
  };

  if (!training) return null;

  const summary = training.summary as Record<string, number> | undefined;
  const attendance = training.attendance as Record<string, unknown>[] | undefined;

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
      render: (t: string | null) =>
        t ? dayjs(t).format("HH:mm:ss") : "-",
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      render: (r: string | null) => r || "-",
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, record: Record<string, unknown>) => (
        <Select
          size="small"
          value={record.status as string}
          style={{ width: 100 }}
          onChange={(v) =>
            handleManualCheckin(record.employeeId as number, v)
          }
          options={[
            { label: "出席", value: "present" },
            { label: "迟到", value: "late" },
            { label: "请假", value: "leave" },
            { label: "缺勤", value: "absent" },
          ]}
        />
      ),
    },
  ];

  const statusLabel = training.status as string;

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.back()}
        className="!p-0 mb-2"
      >
        返回列表
      </Button>

      <Card className="mb-4">
        <Descriptions
          title={training.title as string}
          bordered
          column={{ xs: 1, sm: 2 }}
          extra={
            <Space>
              <Button
                icon={<QrcodeOutlined />}
                onClick={() => router.push(`/admin/trainings/${id}/qr`)}
              >
                查看二维码
              </Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                打印签到表
              </Button>
              {statusLabel === "upcoming" && (
                <Button
                  type="primary"
                  loading={statusUpdating}
                  onClick={() => updateStatus("ongoing")}
                >
                  开始培训
                </Button>
              )}
              {statusLabel === "ongoing" && (
                <Popconfirm
                  title="结束培训后，未签到的员工将自动标记为缺勤，确认结束？"
                  onConfirm={() => updateStatus("completed")}
                >
                  <Button type="primary" danger loading={statusUpdating}>
                    结束培训
                  </Button>
                </Popconfirm>
              )}
            </Space>
          }
        >
          <Descriptions.Item label="类型">
            <Tag color={training.type === "exam" ? "red" : "blue"}>
              {training.type === "exam" ? "考试" : "培训"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              color={
                statusLabel === "upcoming"
                  ? "blue"
                  : statusLabel === "ongoing"
                  ? "green"
                  : "gray"
              }
            >
              {statusLabel === "upcoming"
                ? "未开始"
                : statusLabel === "ongoing"
                ? "进行中"
                : "已结束"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="日期">
            {dayjs(training.date as string).format("YYYY年MM月DD日")}
          </Descriptions.Item>
          <Descriptions.Item label="时间">
            {training.startTime as string} - {training.endTime as string}
          </Descriptions.Item>
          <Descriptions.Item label="地点">
            {(training.location as string) || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="参加部门" span={2}>
            {getDeptNames(training.departmentIds as string)}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {(training.description as string) || "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {summary && (
        <Row gutter={16} className="mb-4">
          <Col xs={12} sm={4}>
            <Card><Statistic title="总人数" value={summary.total} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="出席" value={summary.present} valueStyle={{ color: "#52c41a" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="迟到" value={summary.late} valueStyle={{ color: "#faad14" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="请假" value={summary.leave} valueStyle={{ color: "#1677ff" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card><Statistic title="缺勤" value={summary.absent} valueStyle={{ color: "#ff4d4f" }} /></Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card>
              <Statistic
                title="出勤率"
                value={summary.total > 0 ? ((summary.present + summary.late) / summary.total * 100).toFixed(1) : 0}
                suffix="%"
                valueStyle={{ color: "#722ed1" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="考勤记录">
        <Table
          dataSource={attendance || []}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: "暂无签到记录" }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
