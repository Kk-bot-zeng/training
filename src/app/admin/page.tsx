"use client";

import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Tag, Spin } from "antd";
import {
  TeamOutlined,
  BookOutlined,
  PercentageOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { OverviewStats } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/statistics/overview")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStats(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  const recentColumns = [
    { title: "培训名称", dataIndex: "title", key: "title" },
    {
      title: "日期",
      dataIndex: "date",
      key: "date",
      render: (d: string) => new Date(d).toLocaleDateString("zh-CN"),
    },
    {
      title: "出勤率",
      dataIndex: "rate",
      key: "rate",
      render: (r: number) => (
        <Tag color={r >= 90 ? "green" : r >= 70 ? "orange" : "red"}>{r}%</Tag>
      ),
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">数据概览</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="在职员工总数"
              value={stats?.totalEmployees || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="本月培训场次"
              value={stats?.totalTrainingsThisMonth || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均出勤率"
              value={stats?.avgAttendanceRate || 0}
              prefix={<PercentageOutlined />}
              suffix="%"
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="部门数量"
              value={stats?.activeDepartments || 0}
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="近期培训" className="!mt-4">
        <Table
          dataSource={stats?.recentTrainings || []}
          columns={recentColumns}
          rowKey="id"
          pagination={false}
          size="small"
          onRow={(record) => ({
            onClick: () => router.push(`/admin/trainings/${record.id}`),
            style: { cursor: "pointer" },
          })}
          locale={{ emptyText: "暂无已完成的培训" }}
        />
      </Card>
    </div>
  );
}
