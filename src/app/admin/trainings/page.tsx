"use client";

import { useEffect, useState } from "react";
import { Table, Button, Space, Tag, Select, Popconfirm, message, Calendar, Badge, Segmented, Radio } from "antd";
import { PlusOutlined, EyeOutlined, QrcodeOutlined, DeleteOutlined, UnorderedListOutlined, CalendarOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { Training, Department } from "@/types";
import dayjs from "dayjs";

const statusColors: Record<string, string> = { upcoming: "blue", ongoing: "green", completed: "gray" };
const statusLabels: Record<string, string> = { upcoming: "未开始", ongoing: "进行中", completed: "已结束" };

const QUICK_FILTERS = [
  { label: "全部", value: "all" },
  { label: "今天", value: "today" },
  { label: "本周", value: "week" },
  { label: "本月", value: "month" },
];

const TEMPLATES = [
  { title: "产品知识培训", type: "training" as const, startTime: "09:00", endTime: "12:00", desc: "新员工产品知识培训模板" },
  { title: "季度安全考试", type: "exam" as const, startTime: "14:00", endTime: "16:00", desc: "安全知识考核" },
  { title: "销售技巧分享会", type: "training" as const, startTime: "10:00", endTime: "11:30", desc: "销售案例分享" },
  { title: "技术架构评审", type: "training" as const, startTime: "09:30", endTime: "17:00", desc: "技术方案评审会" },
  { title: "部门周会", type: "training" as const, startTime: "09:00", endTime: "10:00", desc: "每周例会" },
];

export default function TrainingsPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [quickFilter, setQuickFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const router = useRouter();

  const fetchTrainings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/trainings?pageSize=200&${params}`);
      const data = await res.json();
      if (data.success) {
        let items = data.data.items;
        if (quickFilter !== "all") {
          const now = dayjs();
          items = items.filter((t: Training) => {
            const d = dayjs(t.date);
            if (quickFilter === "today") return d.isSame(now, "day");
            if (quickFilter === "week") return d.isSame(now, "week");
            if (quickFilter === "month") return d.isSame(now, "month");
            return true;
          });
        }
        setTrainings(items);
      }
    } finally { setLoading(false); }
  };

  const fetchDepartments = async () => {
    const res = await fetch("/api/departments");
    const data = await res.json();
    if (data.success) setDepartments(data.data);
  };

  useEffect(() => { fetchDepartments(); }, []);
  useEffect(() => { fetchTrainings(); }, [statusFilter, typeFilter, quickFilter]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/trainings/${id}`, { method: "DELETE" });
    message.success("删除成功");
    fetchTrainings();
  };

  const handleQuickCreate = (tpl: typeof TEMPLATES[0]) => {
    router.push(`/admin/trainings/create?tpl=${encodeURIComponent(JSON.stringify(tpl))}`);
  };

  const getDeptNames = (deptIdsJson: string) => {
    try {
      return (JSON.parse(deptIdsJson) as number[])
        .map(id => departments.find(d => d.id === id)?.name).filter(Boolean).join(", ");
    } catch { return "-"; }
  };

  // Calendar data
  const calendarData: Record<string, Training[]> = {};
  for (const t of trainings) {
    const key = dayjs(t.date).format("YYYY-MM-DD");
    if (!calendarData[key]) calendarData[key] = [];
    calendarData[key].push(t);
  }

  const columns = [
    { title: "培训标题", dataIndex: "title", key: "title", ellipsis: true },
    { title: "类型", dataIndex: "type", key: "type", render: (t: string) => <Tag color={t === "exam" ? "red" : "blue"}>{t === "exam" ? "考试" : "培训"}</Tag> },
    { title: "日期", dataIndex: "date", key: "date", render: (d: string) => dayjs(d).format("YYYY-MM-DD") },
    { title: "时间", key: "time", render: (_: unknown, r: Training) => `${r.startTime}-${r.endTime}` },
    { title: "地点", dataIndex: "location", key: "location", render: (l: string | null) => l || "-" },
    { title: "涉及部门", dataIndex: "departmentIds", key: "depts", render: (d: string) => getDeptNames(d) },
    { title: "状态", dataIndex: "status", key: "status", render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: "操作", key: "actions", width: 160, render: (_: unknown, r: Training) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => router.push(`/admin/trainings/${r.id}`)}>详情</Button>
          <Button type="link" size="small" icon={<QrcodeOutlined />} onClick={() => router.push(`/admin/trainings/${r.id}/qr`)}>码</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>培训管理</h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>创建和管理培训/考试，生成签到二维码</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push("/admin/trainings/create")}
          style={{ borderRadius: 10, height: 40, fontWeight: 500 }}>创建培训</Button>
      </div>

      {/* Quick Filters & View Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <Space wrap>
          <Radio.Group value={quickFilter} onChange={e => setQuickFilter(e.target.value)} size="small"
            optionType="button" buttonStyle="solid">
            {QUICK_FILTERS.map(f => <Radio.Button key={f.value} value={f.value}>{f.label}</Radio.Button>)}
          </Radio.Group>
          <Select placeholder="状态筛选" allowClear style={{ width: 110 }} onChange={setStatusFilter}
            options={[{ label: "未开始", value: "upcoming" }, { label: "进行中", value: "ongoing" }, { label: "已结束", value: "completed" }]} />
          <Select placeholder="类型筛选" allowClear style={{ width: 110 }} onChange={setTypeFilter}
            options={[{ label: "培训", value: "training" }, { label: "考试", value: "exam" }]} />
        </Space>
        <Segmented options={[
          { label: <><UnorderedListOutlined /> 列表</>, value: "list" },
          { label: <><CalendarOutlined /> 日历</>, value: "calendar" },
        ]} value={viewMode} onChange={(v) => setViewMode(v as "list" | "calendar")} />
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <>
          <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <Table dataSource={trainings} columns={columns} rowKey="id" loading={loading}
              pagination={{ pageSize: 20 }} locale={{ emptyText: "暂无培训" }} scroll={{ x: 1000 }} />
          </div>

          {/* Templates */}
          <div style={{ marginTop: 20, background: "#fff", borderRadius: 16, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ThunderboltOutlined style={{ color: "#f59e0b", fontSize: 16 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1f2937", margin: 0 }}>培训模板 · 一键创建</h3>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {TEMPLATES.map((tpl, i) => (
                <div key={i} onClick={() => handleQuickCreate(tpl)}
                  style={{ flex: "1 1 200px", minWidth: 180, maxWidth: 240, padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 12, cursor: "pointer", transition: "all 0.2s", background: "#fafbfc" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#6384ff"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,132,255,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}>
                  <Tag color={tpl.type === "exam" ? "red" : "blue"} style={{ marginBottom: 6 }}>{tpl.type === "exam" ? "考试" : "培训"}</Tag>
                  <p style={{ fontWeight: 600, color: "#1f2937", margin: "0 0 4px", fontSize: 14 }}>{tpl.title}</p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>🕐 {tpl.startTime}-{tpl.endTime}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Calendar View */
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <Calendar
            value={selectedDate}
            onChange={d => setSelectedDate(d)}
            cellRender={(date: dayjs.Dayjs) => {
              const key = date.format("YYYY-MM-DD");
              const dayData = calendarData[key] || [];
              if (dayData.length === 0) return null;
              return (
                <div style={{ overflow: "hidden" }}>
                  {dayData.slice(0, 2).map(t => (
                    <div key={t.id} onClick={(e) => { e.stopPropagation(); router.push(`/admin/trainings/${t.id}`); }}
                      style={{ fontSize: 11, padding: "1px 4px", marginBottom: 2, borderRadius: 4, background: t.status === "completed" ? "#e5e7eb" : t.type === "exam" ? "#fef2f2" : "#eff6ff", color: t.type === "exam" ? "#dc2626" : "#2563eb", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>
                      <Badge status={t.status === "ongoing" ? "processing" : t.status === "upcoming" ? "default" : "default"} />
                      {t.title}
                    </div>
                  ))}
                  {dayData.length > 2 && <div style={{ fontSize: 10, color: "#9ca3af" }}>+{dayData.length - 2} 更多</div>}
                </div>
              );
            }}
          />
          {/* Selected date trainings */}
          <div style={{ marginTop: 20, borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
              {selectedDate.format("YYYY年MM月DD日")} 培训安排
            </h4>
            {calendarData[selectedDate.format("YYYY-MM-DD")]?.length ? (
              calendarData[selectedDate.format("YYYY-MM-DD")].map(t => (
                <div key={t.id} onClick={() => router.push(`/admin/trainings/${t.id}`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#1f2937", fontSize: 14 }}>{t.title}</span>
                    <span style={{ color: "#9ca3af", fontSize: 13, marginLeft: 12 }}>{t.startTime}-{t.endTime} · {t.location || "待定"}</span>
                  </div>
                  <Space>
                    <Tag color={statusColors[t.status]}>{statusLabels[t.status]}</Tag>
                    <Button type="link" size="small" onClick={e => { e.stopPropagation(); router.push(`/admin/trainings/${t.id}/qr`); }}>二维码</Button>
                  </Space>
                </div>
              ))
            ) : (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: 24 }}>当天暂无培训安排</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
