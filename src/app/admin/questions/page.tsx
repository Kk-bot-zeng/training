"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Table, Tag, message } from "antd";
import { DeleteOutlined, EditOutlined, ImportOutlined, PlusOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

type Question = { id: number; type: string; productModel: string; category: string; difficulty: string; content: string; options?: string; answer: string; score: number; analysis?: string };
const typeLabels: Record<string, string> = { single: "单选", multi: "多选", judge: "判断", essay: "问答" };
const typeColors: Record<string, string> = { single: "blue", multi: "purple", judge: "cyan", essay: "orange" };
const diffLabels: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [productModelFilter, setProductModelFilter] = useState<string>();
  const [typeFilter, setTypeFilter] = useState<string>();
  const [search, setSearch] = useState("");
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const questionType = Form.useWatch("type", form);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "500" });
    if (productModelFilter) params.set("productModel", productModelFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);
    try {
      const data = await fetch(`/api/questions?${params}`).then((res) => res.json());
      if (data.success) { setQuestions(data.data.items); setModels(data.data.models || []); }
      else message.error(data.message || "获取题库失败");
    } finally { setLoading(false); }
  }, [productModelFilter, search, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchQuestions(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchQuestions]);

  const saveQuestion = async () => {
    try {
      const values = await form.validateFields(); setSubmitting(true);
      const payload = { ...values, options: values.optionsStr ? values.optionsStr.split("|").map((v: string) => v.trim()).filter(Boolean) : null };
      const data = await fetch(editingQ ? `/api/questions/${editingQ.id}` : "/api/questions", {
        method: editingQ ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }).then((res) => res.json());
      if (!data.success) return message.error(data.message || "保存失败");
      message.success(editingQ ? "题目已更新" : "题目已添加"); setDrawerOpen(false); setEditingQ(null); form.resetFields(); await fetchQuestions();
    } finally { setSubmitting(false); }
  };

  const deleteOne = async (id: number) => {
    const data = await fetch(`/api/questions/${id}`, { method: "DELETE" }).then((res) => res.json());
    if (!data.success) return message.error(data.message || "删除失败，题目可能正在试卷中使用");
    message.success("删除成功"); setSelectedIds((ids) => ids.filter((key) => key !== id)); await fetchQuestions();
  };

  const batchDelete = async () => {
    const data = await fetch("/api/questions/batch", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds }) }).then((res) => res.json());
    if (!data.success) return message.error(data.message || "批量删除失败");
    message.success(data.message); setSelectedIds([]); await fetchQuestions();
  };

  const batchEdit = async () => {
    const values = await batchForm.validateFields();
    const data = await fetch("/api/questions/batch", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, ...values }) }).then((res) => res.json());
    if (!data.success) return message.error(data.message || "批量编辑失败");
    message.success(`已更新 ${data.data.updated} 道题`); setBatchOpen(false); batchForm.resetFields(); setSelectedIds([]); await fetchQuestions();
  };

  const importExcel = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]]);
    let created = 0;
    for (const row of rows) {
      const type = row["题型"] === "单选" ? "single" : row["题型"] === "多选" ? "multi" : row["题型"] === "判断" ? "judge" : "essay";
      const response = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type, productModel: row["型号"] || "通用", category: row["分类"] || "通用", difficulty: row["难度"] === "简单" ? "easy" : row["难度"] === "困难" ? "hard" : "medium",
        content: row["题目"], options: row["选项"]?.split("|").map((v) => v.trim()).filter(Boolean) || null, answer: row["答案"], score: Number(row["分值"]) || 2, analysis: row["解析"] || "",
      }) });
      if (response.ok) created++;
    }
    message.success(`成功导入 ${created}/${rows.length} 道题`); setImportOpen(false); await fetchQuestions(); return false;
  };

  const columns = [
    { title: "题目", dataIndex: "content", ellipsis: true, width: 320 },
    { title: "型号", dataIndex: "productModel", width: 130, render: (value: string) => <Tag color="geekblue">{value}</Tag> },
    { title: "分类", dataIndex: "category", width: 110, render: (value: string) => <Tag>{value}</Tag> },
    { title: "题型", dataIndex: "type", width: 85, render: (value: string) => <Tag color={typeColors[value]}>{typeLabels[value]}</Tag> },
    { title: "难度", dataIndex: "difficulty", width: 75, render: (value: string) => diffLabels[value] || value },
    { title: "分值", dataIndex: "score", width: 65 },
    { title: "操作", width: 135, fixed: "right" as const, render: (_: unknown, record: Question) => <Space size={0}>
      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingQ(record); form.setFieldsValue({ ...record, optionsStr: record.options ? JSON.parse(record.options).join("|") : "" }); setDrawerOpen(true); }}>编辑</Button>
      <Popconfirm title="确定删除这道题吗？" description="已加入试卷的题目不会被删除。" onConfirm={() => deleteOne(record.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />} /></Popconfirm>
    </Space> },
  ];

  return <div>
    <div className="page-toolbar">
      <div><h1>题库管理</h1><p>按产品型号管理题目，支持批量选择、编辑和删除</p></div>
      <Space wrap>
        <Input.Search placeholder="搜索题目" allowClear onSearch={setSearch} style={{ width: 180 }} />
        <Select placeholder="型号筛选" allowClear showSearch value={productModelFilter} onChange={setProductModelFilter} style={{ width: 150 }} options={models.map((value) => ({ label: value, value }))} />
        <Select placeholder="题型筛选" allowClear value={typeFilter} onChange={setTypeFilter} style={{ width: 120 }} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} />
        <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>批量导入</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingQ(null); form.resetFields(); setDrawerOpen(true); }}>添加题目</Button>
      </Space>
    </div>
    {selectedIds.length > 0 && <div className="batch-action-bar"><span>已选择 {selectedIds.length} 道题</span><Space><Button icon={<EditOutlined />} onClick={() => setBatchOpen(true)}>批量编辑</Button><Popconfirm title={`确认删除选中的 ${selectedIds.length} 道题？`} description="已加入试卷的题目会自动保留。" onConfirm={batchDelete}><Button danger icon={<DeleteOutlined />}>批量删除</Button></Popconfirm><Button type="link" onClick={() => setSelectedIds([])}>取消选择</Button></Space></div>}
    <div className="table-card"><Table<Question> rowKey="id" dataSource={questions} columns={columns} loading={loading} rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds, preserveSelectedRowKeys: true }} pagination={{ pageSize: 30, showSizeChanger: false }} scroll={{ x: 1000 }} /></div>

    <Drawer title={editingQ ? "编辑题目" : "添加题目"} open={drawerOpen} width={520} onClose={() => { setDrawerOpen(false); setEditingQ(null); form.resetFields(); }} extra={<Button type="primary" loading={submitting} onClick={saveQuestion}>保存</Button>}>
      <Form form={form} layout="vertical" preserve={false} initialValues={{ type: "single", productModel: "通用", category: "通用", difficulty: "medium", score: 2 }}>
        <Form.Item name="productModel" label="产品型号" rules={[{ required: true, message: "请输入产品型号" }]}><Input placeholder="例如：鹤 7 Pro 26 款；通用题填写“通用”" /></Form.Item>
        <Form.Item name="category" label="知识分类"><Input placeholder="例如：产品参数、卖点知识" /></Form.Item>
        <Form.Item name="type" label="题型" rules={[{ required: true }]}><Radio.Group optionType="button" options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item name="difficulty" label="难度"><Radio.Group optionType="button" options={Object.entries(diffLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item name="content" label="题目内容" rules={[{ required: true, message: "请输入题目" }]}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="optionsStr" label="选项（用 | 分隔）" help="例如：A. 选项一 | B. 选项二"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="answer" label={questionType === "essay" ? "参考答案（选填）" : "答案"} rules={[{ required: questionType !== "essay", message: "请填写答案" }]}><Input /></Form.Item>
        <Form.Item name="score" label="分值"><InputNumber min={1} max={100} /></Form.Item>
        <Form.Item name="analysis" label="答案解析"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Drawer>

    <Modal title={`批量编辑 ${selectedIds.length} 道题`} open={batchOpen} onCancel={() => setBatchOpen(false)} onOk={batchEdit} okText="应用修改">
      <Form form={batchForm} layout="vertical"><p style={{ color: "#64748b" }}>只填写需要统一修改的字段，留空的字段保持不变。</p>
        <Form.Item name="productModel" label="统一修改型号"><Input placeholder="例如：鹤 7 Pro 26 款" /></Form.Item>
        <Form.Item name="category" label="统一修改分类"><Input /></Form.Item>
        <Form.Item name="difficulty" label="统一修改难度"><Select allowClear options={Object.entries(diffLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
      </Form>
    </Modal>
    <Modal title="批量导入题目" open={importOpen} onCancel={() => setImportOpen(false)} footer={null}><p>Excel 表头：<b>型号、题型、分类、难度、题目、选项、答案、分值、解析</b></p><input type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); }} /></Modal>
  </div>;
}
