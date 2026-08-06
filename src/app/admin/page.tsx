"use client";

import { useState } from "react";
import useSWR from "swr";
import { Row, Col, Table, Tag, Spin, Modal, DatePicker, message } from "antd";
import {
  TeamOutlined, BookOutlined, PercentageOutlined, ApartmentOutlined,
  PlusOutlined, DownloadOutlined, CrownOutlined, RiseOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import type { OverviewStats } from "@/types";
import { downloadFile } from "@/lib/download";
import { fetcher, swrConfig } from "@/lib/fetcher";

const { RangePicker } = DatePicker;

const AttendanceTrendChart = dynamic(
  () => import("@/components/admin-dashboard-charts").then((module) => module.AttendanceTrendChart),
  { ssr: false, loading: () => <div style={{ height: 240 }} /> },
);
const DepartmentRateChart = dynamic(
  () => import("@/components/admin-dashboard-charts").then((module) => module.DepartmentRateChart),
  { ssr: false, loading: () => <div style={{ height: 240 }} /> },
);

const statCards = [
  { key: "totalEmployees", title: "在职员工", icon: <TeamOutlined />, gradient: "#173ec8", iconBg: "#edf2ff", iconColor: "#173ec8", suffix: "人" },
  { key: "totalTrainingsThisMonth", title: "所选期间培训", icon: <BookOutlined />, gradient: "#315ce0", iconBg: "#eef3ff", iconColor: "#315ce0", suffix: "场" },
  { key: "avgAttendanceRate", title: "平均出勤率", icon: <PercentageOutlined />, gradient: "#5477e8", iconBg: "#f0f4ff", iconColor: "#5477e8", suffix: "%" },
  { key: "activeDepartments", title: "部门总数", icon: <ApartmentOutlined />, gradient: "#7792ed", iconBg: "#f3f6ff", iconColor: "#607fe3", suffix: "个" },
];

export default function DashboardPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [overviewRange, setOverviewRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const router = useRouter();
  const { data: stats } = useSWR<OverviewStats & { managedTrainingCount: number; historicalRecordCount: number; departments: { name: string; rate: string; total: number }[]; trend: { month: string; rate: number; count: number }[]; attendanceStars: { rank: number; employeeId: number; name: string; dept: string; total: number; rate: number; attendedCount: number; eligibleCount: number }[] }>(
    overviewRange ? `/api/statistics/overview?startDate=${overviewRange[0].format("YYYY-MM-DD")}&endDate=${overviewRange[1].format("YYYY-MM-DD")}` : "/api/statistics/overview", fetcher, swrConfig,
  );
  const departments = stats?.departments;
  const trendData = stats?.trend || [];
  const attendanceStars = stats?.attendanceStars || [];
  const deptRank = (departments || []).map((department) => ({
    name: department.name,
    rate: parseFloat(department.rate),
    total: department.total,
  }));
  const loading = !stats || !departments;

  const handleExport = async () => {
    if (!dateRange) { message.warning("请选择日期范围"); return; }
    const [start, end] = dateRange;
    try {
      await downloadFile(
        `/api/export/attendance?startDate=${start.format("YYYY-MM-DD")}&endDate=${end.format("YYYY-MM-DD")}&type=comprehensive`,
        `培训考勤综合报表_${dayjs().format("YYYYMMDD")}.xlsx`
      );
      message.success("报表已生成");
      setExportOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    }
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}><Spin size="large" /></div>;

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>数据概览</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 8 }}><p style={{ color: "#9ca3af", margin: 0, fontSize: 14 }}>培训考勤数据一目了然</p><RangePicker value={overviewRange} onChange={(value) => setOverviewRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null)} placeholder={["开始日期", "结束日期"]} allowClear /></div>
      </div>

      {/* 渐变色统计卡片 */}
      <Row gutter={[20, 20]}>
        {statCards.map((card) => {
          const value = stats ? (stats as unknown as Record<string, number>)[card.key] || 0 : 0;
          return (
            <Col xs={24} sm={12} xl={6} key={card.key}>
              <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.3s ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: card.gradient }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 8px", fontWeight: 500 }}>{card.title}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 700, color: "#1f2937", lineHeight: 1 }}>{value}</span>
                      <span style={{ fontSize: 14, color: "#9ca3af" }}>{card.suffix}</span>
                    </div>
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: card.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: card.iconColor }}>{card.icon}</div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* 图表区 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* 出勤趋势图 */}
        <Col xs={24} lg={14}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <RiseOutlined style={{ color: "#6384ff", fontSize: 18 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0 }}>出勤率趋势</h3>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{overviewRange ? "所选期间按月" : "本月"}</span>
            </div>
            <AttendanceTrendChart data={trendData} />
          </div>
        </Col>

        {/* 部门出勤对比 */}
        <Col xs={24} lg={10}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: "0 0 16px" }}>🏆 部门出勤率对比</h3>
            <DepartmentRateChart data={deptRank} />
          </div>
        </Col>
      </Row>

      {/* 下方三栏 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* 出勤排名 TOP5 */}
        <Col xs={24} md={8}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <CrownOutlined style={{ color: "#f59e0b", fontSize: 16 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0 }}>出勤之星 TOP5</h3>
            </div>
            <div style={{ maxHeight: 316, overflowY: "auto", paddingRight: 4, overscrollBehavior: "contain" }}>
            {attendanceStars.length === 0 ? (
              <div style={{ padding: "28px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>暂无可统计的完成培训考勤数据</div>
            ) : attendanceStars.map((emp, i) => (
              <div key={emp.employeeId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < attendanceStars.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : "#9ca3af", width: 24, textAlign: "center" }}>
                  {emp.rank}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.name}</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{emp.dept} · 参加{emp.total}次</p>
                </div>
                <Tag color={emp.rate >= 95 ? "success" : emp.rate >= 85 ? "processing" : "warning"} style={{ borderRadius: 8 }}>{emp.rate}%</Tag>
              </div>
            ))}
            </div>
          </div>
        </Col>

        {/* 近期培训 */}
        <Col xs={24} md={8}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0 }}>📅 近期培训</h3>
              <span onClick={() => router.push("/admin/trainings")} style={{ fontSize: 13, color: "#6384ff", cursor: "pointer", fontWeight: 500 }}>查看全部 →</span>
            </div>
            <div style={{ maxHeight: 316, overflowY: "auto", paddingRight: 4, overscrollBehavior: "contain" }}><Table<{ id: string; title: string; date: string; rate: number | null }> dataSource={(stats?.recentTrainings || []) as unknown as { id: string; title: string; date: string; rate: number | null }[]} columns={[
              { title: "名称", dataIndex: "title", key: "title", ellipsis: true },
              { title: "日期", dataIndex: "date", key: "date", width: 100, render: (d: string) => new Date(d).toLocaleDateString("zh-CN") },
              { title: "出勤率", dataIndex: "rate", key: "rate", width: 80, render: (r: number | null) => <Tag color={r !== null && r >= 90 ? "success" : r !== null && r >= 70 ? "warning" : "error"} style={{ borderRadius: 8 }}>{r ?? 0}%</Tag> },
            ]} rowKey="id" pagination={false} size="small" showHeader={false}
              onRow={(r: { id: string }) => ({ onClick: () => r.id.startsWith("training-") ? router.push(`/admin/trainings/${r.id.replace("training-", "")}`) : router.push("/admin/training-records"), style: { cursor: "pointer" } })}
              locale={{ emptyText: "暂无培训" }} /></div>
          </div>
        </Col>

        {/* 快捷操作 */}
        <Col xs={24} md={8}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: "0 0 16px" }}>⚡ 快捷操作</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => router.push("/admin/trainings/create")}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", border: "none", borderRadius: 10, background: "#173ec8", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "opacity 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.9"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                <PlusOutlined /> 创建新培训
              </button>
              <button onClick={() => setExportOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                <DownloadOutlined /> 导出综合报表
              </button>
              <button onClick={() => router.push("/admin/employees")}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#f9fafb", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#e5e7eb"} onMouseLeave={e => e.currentTarget.style.background = "#f9fafb"}>
                <TeamOutlined /> 管理员工数据
              </button>
            </div>
          </div>
        </Col>
      </Row>

      {/* 导出报表弹窗 */}
      <Modal title="📥 导出综合报表" open={exportOpen} onOk={handleExport} onCancel={() => setExportOpen(false)}
        okText="生成报表" cancelText="取消" width={480}>
        <div style={{ padding: "12px 0" }}>
          <p style={{ color: "#6b7280", marginBottom: 16, fontSize: 14 }}>
            请选择导出数据的时间范围，系统将生成包含以下内容的 Excel 报表：
          </p>
          <ul style={{ color: "#6b7280", fontSize: 13, marginBottom: 20, paddingLeft: 20 }}>
            <li><strong>综合概览</strong> — 总培训场次、总出勤率、各部门对比</li>
            <li><strong>培训明细</strong> — 每场培训的出勤率详情</li>
            <li><strong>员工统计</strong> — 每位员工的出勤次数和出勤率</li>
            <li><strong>考勤明细</strong> — 逐条签到记录</li>
          </ul>
          <RangePicker value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null} onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            style={{ width: "100%" }} placeholder={["开始日期", "结束日期"]} />
        </div>
      </Modal>
    </div>
  );
}
