"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, DatePicker, Input, message, Select, Space, Table, Tag } from "antd";
import dayjs, { Dayjs } from "dayjs";

type Department = { id: number; name: string };
type Employee = { id: number; name: string; employeeNo?: string; department: { name: string }; record?: { status: string; remark?: string } | null };
const labels: Record<string, string> = { pending: "待过堂", passed: "通过", failed: "未通过", leave: "请假" };
const colors: Record<string, string> = { pending: "default", passed: "success", failed: "error", leave: "blue" };

export default function PassageRecordsPage() {
  const [date, setDate] = useState<Dayjs>(dayjs()); const [departmentId, setDepartmentId] = useState<number>();
  const [departments, setDepartments] = useState<Department[]>([]); const [employees, setEmployees] = useState<Employee[]>([]); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const params = new URLSearchParams({ date: date.format("YYYY-MM-DD") }); if (departmentId) params.set("departmentId", String(departmentId)); const [records, depts] = await Promise.all([fetch(`/api/passage-records?${params}`).then(r => r.json()), fetch("/api/departments").then(r => r.json())]); if (records.success) setEmployees(records.data); else message.error(records.message); if (depts.success) setDepartments(depts.data); } finally { setLoading(false); } }, [date, departmentId]);
  useEffect(() => { void load(); }, [load]);
  const save = async (employeeId: number, status: string, remark?: string) => { const result = await fetch("/api/passage-records", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: date.format("YYYY-MM-DD"), employeeId, status, remark }) }).then(r => r.json()); if (!result.success) { message.error(result.message); return; } setEmployees(rows => rows.map(row => row.id === employeeId ? { ...row, record: { status, remark } } : row)); };
  const columns = [
    { title: "部门", dataIndex: ["department", "name"], width: 160, render: (name: string) => <Tag color="blue">{name}</Tag> },
    { title: "员工", dataIndex: "name", width: 150 },
    { title: "工号", dataIndex: "employeeNo", width: 120, render: (value?: string) => value || "-" },
    { title: "过堂情况", width: 190, render: (_: unknown, row: Employee) => <Select value={row.record?.status || "pending"} style={{ width: 130 }} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} onChange={(status) => void save(row.id, status, row.record?.remark)} /> },
    { title: "备注", render: (_: unknown, row: Employee) => <Input defaultValue={row.record?.remark} placeholder="选填" onBlur={(event) => { if (event.target.value !== (row.record?.remark || "")) void save(row.id, row.record?.status || "pending", event.target.value); }} /> },
    { title: "当前状态", width: 110, render: (_: unknown, row: Employee) => <Tag color={colors[row.record?.status || "pending"]}>{labels[row.record?.status || "pending"]}</Tag> },
  ];
  return <div><div className="page-toolbar"><div><h1>过堂记录</h1><p>按部门记录每位员工的过堂情况，默认展示在职员工。</p></div><Space wrap><DatePicker value={date} onChange={(value) => value && setDate(value)} allowClear={false} /><Select placeholder="全部部门" allowClear value={departmentId} onChange={setDepartmentId} style={{ width: 180 }} options={departments.map(dept => ({ value: dept.id, label: dept.name }))} /></Space></div><Card><Table<Employee> rowKey="id" dataSource={employees} columns={columns} loading={loading} pagination={{ pageSize: 30, showSizeChanger: false }} scroll={{ x: 850 }} locale={{ emptyText: "当前部门暂无在职员工" }} /></Card></div>;
}
