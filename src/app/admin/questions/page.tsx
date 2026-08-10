"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Table, Tag, Upload, message } from "antd";
import { DeleteOutlined, DownloadOutlined, EditOutlined, ImportOutlined, PlusOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

type Question = { id: number; type: string; productModel: string; category: string; difficulty: string; content: string; options?: string; answer: string; score: number; analysis?: string };
const typeLabels: Record<string, string> = { single: "单选", multi: "多选", judge: "判断", essay: "问答" };
const typeColors: Record<string, string> = { single: "blue", multi: "purple", judge: "cyan", essay: "orange" };
const diffLabels: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };
const IMPORT_HEADERS = ["题目分类", "题型", "难度", "题目", "选项", "答案", "分值", "解析"] as const;

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
      const payload = { ...values, options: values.optionsStr ? values.optionsStr.split(/\r?\n/).map((v: string) => v.trim()).filter(Boolean) : null };
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
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0 })[0] || []).map((header) => String(header).trim());
    const missingHeaders = IMPORT_HEADERS.filter((header) => !headers.includes(header));
    if (missingHeaders.length) {
      message.error(`模板格式不正确，缺少列：${missingHeaders.join("、")}`);
      return false;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    if (!rows.length) { message.warning("导入文件中没有题目"); return false; }
    const invalidRows = rows.flatMap((row, index) => {
      const type = String(row["题型"] || "").trim();
      const difficulty = String(row["难度"] || "").trim();
      const requiresAnswer = type !== "问答";
      if (!row["题目"] || !type || !["单选", "多选", "判断", "问答"].includes(type) || !["简单", "中等", "困难"].includes(difficulty) || (requiresAnswer && !row["答案"])) return [index + 2];
      return [];
    });
    if (invalidRows.length) {
      message.error(`第 ${invalidRows.slice(0, 8).join("、")} 行格式不完整或题型/难度不符合模板要求${invalidRows.length > 8 ? "…" : ""}`);
      return false;
    }
    let created = 0;
    for (const row of rows) {
      const type = row["题型"] === "单选" ? "single" : row["题型"] === "多选" ? "multi" : row["题型"] === "判断" ? "judge" : "essay";
      const response = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type, productModel: row["题目分类"] || "通用", category: row["题目分类"] || "通用", difficulty: row["难度"] === "简单" ? "easy" : row["难度"] === "困难" ? "hard" : "medium",
        content: row["题目"], options: row["选项"]?.split(/\r?\n/).map((v) => v.trim()).filter(Boolean) || null, answer: row["答案"], score: Number(row["分值"]) || 2, analysis: row["解析"] || "",
      }) });
      if (response.ok) created++;
    }
    message.success(`成功导入 ${created}/${rows.length} 道题`); setImportOpen(false); await fetchQuestions(); return false;
  };

  const downloadTemplate = () => {
    const rows = [
      [...IMPORT_HEADERS],
      ["鹤7 Pro 26款", "单选", "中等", "示例：该型号支持哪项功能？", "A. 功能一\nB. 功能二\nC. 功能三\nD. 功能四", "A", "2", "填写答案解析（选填）"],
      ["通用", "判断", "简单", "示例：雷鸟培训系统支持手机端考试。", "", "正确", "2", "判断题选项可留空"],
      ["通用", "问答", "困难", "示例：请说明产品的核心卖点。", "", "", "10", "问答题答案可留空，由管理员阅卷"],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 42 }, { wch: 42 }, { wch: 12 }, { wch: 10 }, { wch: 32 }];
    const template = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(template, sheet, "题库导入模板");
    XLSX.writeFile(template, "雷鸟培训系统-题库导入模板.xlsx");
  };
  const columns = [
    { title: "题目", dataIndex: "content", ellipsis: true, width: 320 },
    { title: "题目分类", dataIndex: "productModel", width: 150, render: (value: string) => <Tag color="geekblue">{value}</Tag> },
    { title: "题型", dataIndex: "type", width: 85, render: (value: string) => <Tag color={typeColors[value]}>{typeLabels[value]}</Tag> },
    { title: "难度", dataIndex: "difficulty", width: 75, render: (value: string) => diffLabels[value] || value },
    { title: "分值", dataIndex: "score", width: 65 },
    { title: "操作", width: 135, fixed: "right" as const, render: (_: unknown, record: Question) => <Space size={0}>
      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingQ(record); form.setFieldsValue({ ...record, optionsStr: record.options ? JSON.parse(record.options).join("\\n") : "" }); setDrawerOpen(true); }}>编辑</Button>
      <Popconfirm title="确定删除这道题吗？" description="已加入试卷的题目不会被删除。" onConfirm={() => deleteOne(record.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />} /></Popconfirm>
    </Space> },
  ];

  return <div>
    <div className="page-toolbar">
      <div><h1>题库管理</h1><p>按题目分类管理题目，支持批量选择、编辑和删除</p></div>
      <Space wrap>
        <Input.Search placeholder="搜索题目" allowClear onSearch={setSearch} style={{ width: 180 }} />
        <Select placeholder="题目分类筛选" allowClear showSearch value={productModelFilter} onChange={setProductModelFilter} style={{ width: 150 }} options={models.map((value) => ({ label: value, value }))} />
        <Select placeholder="题型筛选" allowClear value={typeFilter} onChange={setTypeFilter} style={{ width: 120 }} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} />
        <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>下载模板 / 批量导入</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingQ(null); form.resetFields(); setDrawerOpen(true); }}>添加题目</Button>
      </Space>
    </div>
    {selectedIds.length > 0 && <div className="batch-action-bar"><span>已选择 {selectedIds.length} 道题</span><Space><Button icon={<EditOutlined />} onClick={() => setBatchOpen(true)}>批量编辑</Button><Popconfirm title={`确认删除选中的 ${selectedIds.length} 道题？`} description="已加入试卷的题目会自动保留。" onConfirm={batchDelete}><Button danger icon={<DeleteOutlined />}>批量删除</Button></Popconfirm><Button type="link" onClick={() => setSelectedIds([])}>取消选择</Button></Space></div>}
    <div className="table-card"><Table<Question> rowKey="id" dataSource={questions} columns={columns} loading={loading} rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds, preserveSelectedRowKeys: true }} pagination={{ pageSize: 30, showSizeChanger: false }} scroll={{ x: 1000 }} /></div>

    <Drawer title={editingQ ? "编辑题目" : "添加题目"} open={drawerOpen} width={520} onClose={() => { setDrawerOpen(false); setEditingQ(null); form.resetFields(); }} extra={<Button type="primary" loading={submitting} onClick={saveQuestion}>保存</Button>}>
      <Form form={form} layout="vertical" preserve={false} initialValues={{ type: "single", productModel: "通用", difficulty: "medium", score: 2 }}>
        <Form.Item name="productModel" label="题目分类" rules={[{ required: true, message: "请输入题目分类" }]} help="请手动填写分类，例如：通用、鹤7 Pro 26款。"><Input placeholder="请输入题目分类" /></Form.Item>
        <Form.Item name="type" label="题型" rules={[{ required: true }]}><Radio.Group optionType="button" options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item name="difficulty" label="难度"><Radio.Group optionType="button" options={Object.entries(diffLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item name="content" label="题目内容" rules={[{ required: true, message: "请输入题目" }]}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="optionsStr" label="选项（每行一项）" help="每行填写一个选项，例如：A. 选项一"><Input.TextArea rows={4} placeholder={"A. 选项一\\nB. 选项二\\nC. 选项三"} /></Form.Item>
        <Form.Item name="answer" label={questionType === "essay" ? "参考答案（选填）" : "答案"} rules={[{ required: questionType !== "essay", message: "请填写答案" }]}><Input /></Form.Item>
        <Form.Item name="score" label="分值"><InputNumber min={1} max={100} /></Form.Item>
        <Form.Item name="analysis" label="答案解析"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Drawer>

    <Modal title={`批量编辑 ${selectedIds.length} 道题`} open={batchOpen} onCancel={() => setBatchOpen(false)} onOk={batchEdit} okText="应用修改">
      <Form form={batchForm} layout="vertical"><p style={{ color: "#64748b" }}>只填写需要统一修改的字段，留空的字段保持不变。</p>
        <Form.Item name="productModel" label="统一修改题目分类"><Input placeholder="例如：鹤 7 Pro 26 款或通用" /></Form.Item>
        <Form.Item name="difficulty" label="统一修改难度"><Select allowClear options={Object.entries(diffLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
      </Form>
    </Modal>
    <Modal title="批量导入题目" open={importOpen} onCancel={() => setImportOpen(false)} footer={null}>
      <p>请先下载最新版模板。模板字段会随题库字段更新：<b>{IMPORT_HEADERS.join("、")}</b></p>
      <p style={{ color: "#64748b", fontSize: 13 }}>题型支持单选、多选、判断、问答；难度支持简单、中等、困难。选项请在 Excel 单元格内换行填写，每行一项；问答题答案可留空。</p>
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载最新版导入模板</Button>
        <Upload.Dragger accept=".xlsx,.xls" maxCount={1} showUploadList={false} beforeUpload={(file) => { void importExcel(file as File); return false; }} style={{ padding: "12px 0" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>点击选择 Excel 文件，或拖拽文件到这里</p>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>支持 .xlsx、.xls 格式，选择后将自动开始导入</p>
        </Upload.Dragger>
      </Space>
    </Modal>
  </div>;
}
