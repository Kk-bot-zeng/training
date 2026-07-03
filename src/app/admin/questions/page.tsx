"use client";

import { useEffect, useState } from "react";
import { Table, Button, Drawer, Form, Input, Select, Space, Tag, message, Popconfirm, InputNumber, Radio, Modal } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ImportOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

const typeLabels: Record<string, string> = { single: "单选", multi: "多选", judge: "判断", essay: "问答" };
const typeColors: Record<string, string> = { single: "blue", multi: "purple", judge: "cyan", essay: "orange" };
const diffLabels: Record<string, string> = { easy: "⭐", medium: "⭐⭐", hard: "⭐⭐⭐" };

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchQuestions = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/questions?${params}`);
      const data = await res.json();
      if (data.success) setQuestions(data.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchQuestions(); }, [categoryFilter, typeFilter, search]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const url = editingQ ? `/api/questions/${editingQ.id}` : "/api/questions";
      const method = editingQ ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await res.json();
      if (data.success) { message.success(editingQ ? "更新成功" : "创建成功"); setDrawerOpen(false); form.resetFields(); setEditingQ(null); fetchQuestions(); }
      else message.error(data.message);
    } catch {} finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/questions/${id}`, { method: "DELETE" });
    message.success("删除成功"); fetchQuestions();
  };

  const handleImport = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);
    let created = 0;
    for (const row of rows) {
      const type = row["题型"] === "单选" ? "single" : row["题型"] === "多选" ? "multi" : row["题型"] === "判断" ? "judge" : "essay";
      const options = row["选项"] ? row["选项"].split("|").map((s: string) => s.trim()) : null;
      await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type, category: row["分类"] || "通用", difficulty: row["难度"] === "简单" ? "easy" : row["难度"] === "困难" ? "hard" : "medium",
        content: row["题目"], options, answer: row["答案"], score: parseInt(row["分值"]) || 2, analysis: row["解析"] || "",
      })});
      created++;
    }
    message.success(`导入 ${created} 题`); fetchQuestions(); setImportOpen(false);
    return false;
  };

  const columns = [
    { title: "#", key: "idx", width: 50, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: "题目", dataIndex: "content", key: "content", ellipsis: true, width: 300 },
    { title: "分类", dataIndex: "category", key: "category", width: 100, render: (c: string) => <Tag>{c}</Tag> },
    { title: "题型", dataIndex: "type", key: "type", width: 80, render: (t: string) => <Tag color={typeColors[t]}>{typeLabels[t]}</Tag> },
    { title: "难度", dataIndex: "difficulty", key: "difficulty", width: 70, render: (d: string) => diffLabels[d] || d },
    { title: "分值", dataIndex: "score", key: "score", width: 60 },
    { title: "操作", key: "actions", width: 140, render: (_: unknown, r: Record<string, unknown>) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingQ(r); form.setFieldsValue({ ...r, optionsStr: r.options ? JSON.parse(r.options as string).join("|") : "" }); setDrawerOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id as number)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )},
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>题库管理</h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
            共 {questions.length} 题 · 支持单选/多选/判断/问答题
          </p>
        </div>
        <Space wrap>
          <Input.Search placeholder="搜索题目" allowClear style={{ width: 200 }} onSearch={setSearch} />
          <Select placeholder="题型筛选" allowClear style={{ width: 110 }} onChange={setTypeFilter}
            options={[{ label: "单选", value: "single" }, { label: "多选", value: "multi" }, { label: "判断", value: "judge" }, { label: "问答", value: "essay" }]} />
          <Select placeholder="分类筛选" allowClear style={{ width: 130 }} onChange={setCategoryFilter}
            options={[{ label: "商品参数", value: "商品参数" }, { label: "产品知识", value: "产品知识" }, { label: "规章制度", value: "规章制度" }, { label: "通用", value: "通用" }]} />
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>批量导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingQ(null); form.resetFields(); setDrawerOpen(true); }}
            style={{ borderRadius: 10, fontWeight: 500 }}>添加题目</Button>
        </Space>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={questions} columns={columns} rowKey="id" loading={loading}
          pagination={{ pageSize: 30 }} locale={{ emptyText: "题库为空，点击添加" }} scroll={{ x: 900 }} size="middle" />
      </div>

      {/* Add/Edit Drawer */}
      <Drawer title={editingQ ? "编辑题目" : "添加题目"} open={drawerOpen} width={520}
        onClose={() => { setDrawerOpen(false); form.resetFields(); setEditingQ(null); }}
        extra={<Button type="primary" loading={submitting} onClick={handleSubmit} style={{ borderRadius: 10 }}>保存</Button>}>
        <Form form={form} layout="vertical" preserve={false} initialValues={{ type: "single", difficulty: "medium", score: 2, category: "通用" }}>
          <Form.Item name="type" label="题型" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="single">单选题</Radio.Button>
              <Radio.Button value="multi">多选题</Radio.Button>
              <Radio.Button value="judge">判断题</Radio.Button>
              <Radio.Button value="essay">问答题</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="category" label="分类"><Input placeholder="如：商品参数" /></Form.Item>
          <Form.Item name="difficulty" label="难度">
            <Radio.Group>
              <Radio.Button value="easy">⭐ 简单</Radio.Button>
              <Radio.Button value="medium">⭐⭐ 中等</Radio.Button>
              <Radio.Button value="hard">⭐⭐⭐ 困难</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="content" label="题目内容" rules={[{ required: true, message: "请输入" }]}>
            <Input.TextArea rows={3} placeholder="输入题目..." />
          </Form.Item>
          <Form.Item name="optionsStr" label="选项（用 | 分隔）" help="例：A.6个月|B.12个月|C.18个月|D.24个月">
            <Input.TextArea rows={3} placeholder="判断题留空会自动生成正确/错误选项" />
          </Form.Item>
          <Form.Item name="answer" label="答案" rules={[{ required: true }]} help="单选填字母(A/B/C/D)，多选用逗号分隔(A,C)，判断填对/错">
            <Input placeholder="如：B" />
          </Form.Item>
          <Form.Item name="score" label="分值"><InputNumber min={1} max={100} /></Form.Item>
          <Form.Item name="analysis" label="答案解析"><Input.TextArea rows={2} placeholder="答对/答错后的解析说明" /></Form.Item>
        </Form>
      </Drawer>

      {/* Import Modal */}
      <Modal title="批量导入题目" open={importOpen} onCancel={() => setImportOpen(false)} footer={null} width={500}>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
          Excel 表头：<strong>题型、分类、难度、题目、选项、答案、分值、解析</strong>
          <br />选项用 | 分隔，难度填 简单/中等/困难
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
      </Modal>
    </div>
  );
}
