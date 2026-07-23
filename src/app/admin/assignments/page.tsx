"use client";

import { useEffect, useState } from "react";
import { Button, DatePicker, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined, FileTextOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

type Assignment = {
  id: number; title: string; description?: string; dueDate: string; status: string;
  _count?: { submissions: number };
};
type SubmissionFile = { name: string; url: string; type?: string; size?: number };
type Submission = {
  id: number; files: string; comment?: string; submittedAt: string;
  employee: { name: string; employeeNo?: string; department?: { name: string } };
};

export default function AssignmentsAdminPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [submissionTitle, setSubmissionTitle] = useState("");
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/assignments");
    const data = await res.json();
    if (data.success) setItems(data.data);
    else message.error(data.message || "获取作业失败");
    setLoading(false);
  };

  useEffect(() => {
    fetch("/api/assignments").then((res) => res.json()).then((data) => {
      if (data.success) setItems(data.data);
      else message.error(data.message || "获取作业失败");
      setLoading(false);
    }).catch(() => { message.error("获取作业失败"); setLoading(false); });
  }, []);

  const openEditor = (item?: Assignment) => {
    setEditing(item || null);
    form.setFieldsValue(item ? {
      title: item.title, description: item.description,
      dueDate: dayjs(item.dueDate), status: item.status,
    } : { status: "published" });
    setDrawerOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const res = await fetch(editing ? `/api/assignments/${editing.id}` : "/api/assignments", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, dueDate: values.dueDate.toISOString() }),
      });
      const data = await res.json();
      if (!data.success) return message.error(data.message || "保存失败");
      message.success(editing ? "作业已更新" : "作业已发布");
      setDrawerOpen(false); form.resetFields(); await load();
    } catch { /* form validation */ }
  };

  const viewSubmissions = async (item: Assignment) => {
    const res = await fetch(`/api/assignments/${item.id}/submissions`);
    const data = await res.json();
    if (!data.success) return message.error(data.message || "获取提交记录失败");
    setSubmissionTitle(item.title); setSubmissions(data.data); setSubmissionOpen(true);
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { message.success("作业已删除"); await load(); }
    else message.error(data.message || "删除失败");
  };

  return <div>
    <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div><Typography.Title level={2} style={{ margin: 0 }}>作业管理</Typography.Title><Typography.Text type="secondary">发布作业并查看学员提交的文件</Typography.Text></div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>发布作业</Button>
    </div>
    <div style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
      <Table rowKey="id" loading={loading} dataSource={items} pagination={{ pageSize: 10 }} columns={[
        { title: "作业标题", dataIndex: "title", render: (v: string) => <strong>{v}</strong> },
        { title: "截止时间", dataIndex: "dueDate", render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm") },
        { title: "状态", dataIndex: "status", render: (v: string) => <Tag color={v === "published" ? "success" : "default"}>{v === "published" ? "已发布" : "已关闭"}</Tag> },
        { title: "已提交", render: (_: unknown, row: Assignment) => `${row._count?.submissions || 0} 人` },
        { title: "操作", render: (_: unknown, row: Assignment) => <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => viewSubmissions(row)}>查看提交</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button>
          <Popconfirm title="确定删除该作业及全部提交记录？" onConfirm={() => remove(row.id)}><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space> },
      ]} />
    </div>

    <Drawer title={editing ? "编辑作业" : "发布作业"} open={drawerOpen} width={520} onClose={() => { setDrawerOpen(false); form.resetFields(); }} extra={<Button type="primary" onClick={save}>保存</Button>}>
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="作业标题" rules={[{ required: true, message: "请输入作业标题" }]}><Input placeholder="如：产品知识学习总结" /></Form.Item>
        <Form.Item name="description" label="作业要求"><Input.TextArea rows={7} placeholder="请填写作业内容、格式要求和注意事项" /></Form.Item>
        <Form.Item name="dueDate" label="截止时间" rules={[{ required: true, message: "请选择截止时间" }]}><DatePicker showTime style={{ width: "100%" }} /></Form.Item>
        <Form.Item name="status" label="状态"><Select options={[{ value: "published", label: "已发布" }, { value: "closed", label: "已关闭" }]} /></Form.Item>
      </Form>
    </Drawer>

    <Modal title={`提交记录 · ${submissionTitle}`} open={submissionOpen} onCancel={() => setSubmissionOpen(false)} footer={null} width={900}>
      <Table rowKey="id" dataSource={submissions} pagination={{ pageSize: 8 }} columns={[
        { title: "学员", render: (_: unknown, r: Submission) => <div><strong>{r.employee.name}</strong><div style={{ color: "#8a98aa", fontSize: 12 }}>{r.employee.department?.name || "-"}{r.employee.employeeNo ? ` · ${r.employee.employeeNo}` : ""}</div></div> },
        { title: "提交时间", dataIndex: "submittedAt", width: 165, render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm") },
        { title: "备注", dataIndex: "comment", render: (v?: string) => v || "-" },
        { title: "作业文件", render: (_: unknown, r: Submission) => <Space direction="vertical" size={2}>{(JSON.parse(r.files) as SubmissionFile[]).map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer"><FileTextOutlined /> {f.name}</a>)}</Space> },
      ]} />
    </Modal>
  </div>;
}
