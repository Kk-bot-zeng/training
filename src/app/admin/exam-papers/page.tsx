"use client";

import { useEffect, useState } from "react";
import { Table, Button, Drawer, Form, Input, Select, Switch, InputNumber, DatePicker, Space, Tag, message, Popconfirm, Card, Row, Col } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const typeLabels: Record<string, string> = { timed: "定时考试", practice: "模拟练习" };

export default function ExamPapersPage() {
  const [papers, setPapers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchPapers = async () => {
    setLoading(true);
    const res = await fetch("/api/papers");
    const data = await res.json();
    if (data.success) setPapers(data.data);
    setLoading(false);
  };

  useEffect(() => { fetchPapers(); }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const body = { ...values, startTime: values.startTime?.toISOString(), endTime: values.endTime?.toISOString() };
      const url = editingPaper ? `/api/papers/${editingPaper.id}` : "/api/papers";
      const method = editingPaper ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { message.success(editingPaper ? "更新成功" : "创建成功"); setDrawerOpen(false); form.resetFields(); setEditingPaper(null); fetchPapers(); }
      else message.error(data.message);
    } catch {} finally { setSubmitting(false); }
  };

  const handlePublish = async (id: number) => {
    await fetch(`/api/papers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "published" }) });
    message.success("考试已发布！学员端可见"); fetchPapers();
  };

  const columns = [
    { title: "试卷标题", dataIndex: "title", key: "title", ellipsis: true },
    { title: "类型", dataIndex: "type", key: "type", render: (t: string) => <Tag color={t === "timed" ? "blue" : "green"}>{typeLabels[t]}</Tag> },
    { title: "时长", dataIndex: "duration", key: "duration", render: (d: number) => `${d}分钟` },
    { title: "及格分", dataIndex: "passScore", key: "passScore" },
    { title: "总题数", key: "qCount", render: (_: unknown, r: Record<string, unknown>) => (r._count as { paperQuestions: number })?.paperQuestions || 0 },
    { title: "状态", dataIndex: "status", key: "status", render: (s: string) => <Tag color={s === "published" ? "green" : s === "draft" ? "default" : "red"}>{s === "published" ? "已发布" : s === "draft" ? "草稿" : "已关闭"}</Tag> },
    { title: "操作", key: "actions", render: (_: unknown, r: Record<string, unknown>) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setEditingPaper(r); form.setFieldsValue({ ...r, startTime: r.startTime ? dayjs(r.startTime as string) : null, endTime: r.endTime ? dayjs(r.endTime as string) : null }); setDrawerOpen(true); }}><EditOutlined /> 编辑</Button>
          {r.status === "draft" && <Button type="link" size="small" onClick={() => handlePublish(r.id as number)}><SendOutlined /> 发布</Button>}
          <Popconfirm title="确定删除？" onConfirm={() => fetch(`/api/papers/${r.id}`, { method: "DELETE" }).then(() => { message.success("删除成功"); fetchPapers(); })}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )},
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>试卷管理</h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>创建和管理考试试卷，发布后学员端可见</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingPaper(null); form.resetFields(); setDrawerOpen(true); }}
          style={{ borderRadius: 10, fontWeight: 500 }}>创建试卷</Button>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={papers} columns={columns} rowKey="id" loading={loading}
          pagination={{ pageSize: 20 }} locale={{ emptyText: "暂无试卷" }} size="middle" />
      </div>

      <Drawer title={editingPaper ? "编辑试卷" : "创建试卷"} open={drawerOpen} width={560}
        onClose={() => { setDrawerOpen(false); form.resetFields(); setEditingPaper(null); }}
        extra={<Button type="primary" loading={submitting} onClick={handleSubmit} style={{ borderRadius: 10 }}>保存</Button>}>
        <Form form={form} layout="vertical" preserve={false} initialValues={{ type: "timed", duration: 60, passScore: 60, totalScore: 100, shuffleQuestions: true, shuffleOptions: true, maxSwitch: 3, allowRetake: false }}>
          <Form.Item name="title" label="试卷标题" rules={[{ required: true }]}><Input placeholder="如：2026年Q3产品知识考核" /></Form.Item>
          <Form.Item name="description" label="考试说明"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="type" label="类型"><Select options={[{ label: "定时考试", value: "timed" }, { label: "模拟练习", value: "practice" }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="duration" label="时长(分钟)"><InputNumber min={1} max={300} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="passScore" label="及格分数"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="totalScore" label="总分"><InputNumber min={1} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="startTime" label="开始时间"><DatePicker showTime style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="endTime" label="结束时间"><DatePicker showTime style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Card size="small" title="考试设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="shuffleQuestions" label="随机排序" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col span={8}><Form.Item name="shuffleOptions" label="选项乱序" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col span={8}><Form.Item name="allowRetake" label="允许补考" valuePropName="checked"><Switch /></Form.Item></Col>
            </Row>
            <Form.Item name="maxSwitch" label="切屏次数上限（超过强制交卷）"><InputNumber min={1} max={20} /></Form.Item>
          </Card>
        </Form>
      </Drawer>
    </div>
  );
}
