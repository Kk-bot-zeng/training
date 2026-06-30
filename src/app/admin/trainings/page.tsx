"use client";

import { useEffect, useState } from "react";
import { Table, Button, Space, Tag, Select, Input, Popconfirm, message } from "antd";
import { PlusOutlined, EyeOutlined, QrcodeOutlined, DeleteOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { Training, Department } from "@/types";
import dayjs from "dayjs";

const statusColors: Record<string, string> = {
  upcoming: "blue",
  ongoing: "green",
  completed: "gray",
};
const statusLabels: Record<string, string> = {
  upcoming: "未开始",
  ongoing: "进行中",
  completed: "已结束",
};

export default function TrainingsPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const router = useRouter();

  const fetchTrainings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/trainings?${params}`);
      const data = await res.json();
      if (data.success) setTrainings(data.data.items);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    const res = await fetch("/api/departments");
    const data = await res.json();
    if (data.success) setDepartments(data.data);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchTrainings();
  }, [statusFilter, typeFilter]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/trainings/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      message.success("删除成功");
      fetchTrainings();
    } else {
      message.error(data.message);
    }
  };

  const getDeptNames = (deptIdsJson: string) => {
    try {
      const ids = JSON.parse(deptIdsJson) as number[];
      return ids
        .map((id) => departments.find((d) => d.id === id)?.name)
        .filter(Boolean)
        .join(", ");
    } catch {
      return "-";
    }
  };

  const columns = [
    { title: "培训标题", dataIndex: "title", key: "title" },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      render: (t: string) => (
        <Tag color={t === "exam" ? "red" : "blue"}>
          {t === "exam" ? "考试" : "培训"}
        </Tag>
      ),
    },
    {
      title: "日期",
      dataIndex: "date",
      key: "date",
      render: (d: string) => dayjs(d).format("YYYY-MM-DD"),
    },
    { title: "时间", key: "time", render: (_: unknown, r: Training) => `${r.startTime}-${r.endTime}` },
    { title: "地点", dataIndex: "location", key: "location", render: (l: string | null) => l || "-" },
    {
      title: "涉及部门",
      dataIndex: "departmentIds",
      key: "departmentIds",
      render: (d: string) => getDeptNames(d),
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
      title: "操作",
      key: "actions",
      render: (_: unknown, record: Training) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/admin/trainings/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<QrcodeOutlined />}
            onClick={() => router.push(`/admin/trainings/${record.id}/qr`)}
          >
            二维码
          </Button>
          <Popconfirm
            title="确定删除该培训？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold">培训管理</h2>
        <Space wrap>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            onChange={setStatusFilter}
            options={[
              { label: "未开始", value: "upcoming" },
              { label: "进行中", value: "ongoing" },
              { label: "已结束", value: "completed" },
            ]}
          />
          <Select
            placeholder="类型筛选"
            allowClear
            style={{ width: 120 }}
            onChange={setTypeFilter}
            options={[
              { label: "培训", value: "training" },
              { label: "考试", value: "exam" },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push("/admin/trainings/create")}
          >
            创建培训
          </Button>
        </Space>
      </div>

      <Table
        dataSource={trainings}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: "暂无培训数据" }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
}
