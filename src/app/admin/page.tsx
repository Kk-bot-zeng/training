"use client";

import { useEffect, useState } from "react";
import { Row, Col, Table, Tag, Spin } from "antd";
import {
  TeamOutlined,
  BookOutlined,
  PercentageOutlined,
  ApartmentOutlined,
  PlusOutlined,
  ImportOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { OverviewStats } from "@/types";

const statCards = [
  {
    key: "totalEmployees",
    title: "在职员工",
    icon: <TeamOutlined />,
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    iconBg: "rgba(102, 126, 234, 0.15)",
    iconColor: "#667eea",
    suffix: "人",
  },
  {
    key: "totalTrainingsThisMonth",
    title: "本月培训",
    icon: <BookOutlined />,
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    iconBg: "rgba(245, 87, 108, 0.15)",
    iconColor: "#f5576c",
    suffix: "场",
  },
  {
    key: "avgAttendanceRate",
    title: "平均出勤率",
    icon: <PercentageOutlined />,
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    iconBg: "rgba(79, 172, 254, 0.15)",
    iconColor: "#4facfe",
    suffix: "%",
  },
  {
    key: "activeDepartments",
    title: "部门总数",
    icon: <ApartmentOutlined />,
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    iconBg: "rgba(67, 233, 123, 0.15)",
    iconColor: "#43e97b",
    suffix: "个",
  },
];

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  const recentColumns = [
    { title: "培训名称", dataIndex: "title", key: "title", ellipsis: true },
    {
      title: "日期",
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (d: string) => new Date(d).toLocaleDateString("zh-CN"),
    },
    {
      title: "出勤率",
      dataIndex: "rate",
      key: "rate",
      width: 100,
      render: (r: number) => (
        <Tag
          color={r >= 90 ? "success" : r >= 70 ? "warning" : "error"}
          style={{ borderRadius: 8, padding: "0 10px" }}
        >
          {r}%
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>数据概览</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
          培训考勤数据一目了然
        </p>
      </div>

      {/* 渐变色统计卡片 */}
      <Row gutter={[20, 20]}>
        {statCards.map((card) => {
          const value = stats ? (stats as unknown as Record<string, number>)[card.key] || 0 : 0;
          return (
            <Col xs={24} sm={12} xl={6} key={card.key}>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "24px 20px",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "default",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                }}
              >
                {/* 顶部渐变条 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: card.gradient,
                  }}
                />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 8px", fontWeight: 500 }}>
                      {card.title}
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 700, color: "#1f2937", lineHeight: 1 }}>
                        {value}
                      </span>
                      <span style={{ fontSize: 14, color: "#9ca3af" }}>{card.suffix}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: card.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      color: card.iconColor,
                    }}
                  >
                    {card.icon}
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* 下方两栏 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* 近期培训 */}
        <Col xs={24} lg={16}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "24px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0 }}>
                📅 近期培训
              </h3>
              <span
                onClick={() => router.push("/admin/trainings")}
                style={{ fontSize: 13, color: "#6384ff", cursor: "pointer", fontWeight: 500 }}
              >
                查看全部 →
              </span>
            </div>
            <Table
              dataSource={stats?.recentTrainings || []}
              columns={recentColumns}
              rowKey="id"
              pagination={false}
              size="middle"
              showHeader={false}
              onRow={(record) => ({
                onClick: () => router.push(`/admin/trainings/${record.id}`),
                style: { cursor: "pointer" },
              })}
              locale={{ emptyText: "暂无培训记录，点击上方创建第一场培训" }}
            />
          </div>
        </Col>

        {/* 快捷操作 */}
        <Col xs={24} lg={8}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "24px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: "0 0 16px" }}>
              ⚡ 快捷操作
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() => router.push("/admin/trainings/create")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "14px 16px",
                  border: "none",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <PlusOutlined /> 创建新培训
              </button>
              <button
                onClick={() => router.push("/admin/employees")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "14px 16px",
                  border: "none",
                  borderRadius: 12,
                  background: "#f3f4f6",
                  color: "#374151",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e7eb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              >
                <ImportOutlined /> 导入员工数据
              </button>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}
