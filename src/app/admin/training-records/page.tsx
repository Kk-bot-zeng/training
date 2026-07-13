"use client";

import { useEffect, useState } from "react";
import { Table, Button, Drawer, Form, Input, Select, DatePicker, InputNumber, Space, Tag, message, Popconfirm, Radio, Upload, Descriptions } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ImportOutlined, EyeOutlined, LinkOutlined, PlayCircleOutlined, FileTextOutlined, UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { upload } from "@vercel/blob/client";

const formatLabels: Record<string, string> = { online: "线上", offline: "线下", hybrid: "混合" };
const formatColors: Record<string, string> = { online: "blue", offline: "green", hybrid: "purple" };
const statusLabels: Record<string, string> = { pending: "待开始", ongoing: "进行中", completed: "已完成" };
const statusColors: Record<string, string> = { pending: "default", ongoing: "processing", completed: "success" };

export default function TrainingRecordsPage() {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [materialUploading, setMaterialUploading] = useState(false);
  const [materialUploadProgress, setMaterialUploadProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [formatFilter, setFormatFilter] = useState<string | undefined>();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ total?: number; created?: number; errors?: string[] } | null>(null);
  const [form] = Form.useForm();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (formatFilter) params.set("format", formatFilter);
      const res = await fetch(`/api/training-records?${params}`);
      const data = await res.json();
      if (data.success) setRecords(data.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, [search, statusFilter, formatFilter]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const url = editingRecord ? `/api/training-records/${editingRecord.id}` : "/api/training-records";
      const method = editingRecord ? "PUT" : "POST";
      const body = { ...values, date: values.date ? dayjs(values.date).format("YYYY-MM-DD") : undefined };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { message.success(editingRecord ? "更新成功" : "创建成功"); setDrawerOpen(false); form.resetFields(); setEditingRecord(null); fetchRecords(); }
      else message.error(data.message);
    } catch {} finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/training-records/${id}`, { method: "DELETE" });
    message.success("删除成功"); fetchRecords();
  };

  const handleMaterialUpload = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["ppt", "pptx", "pdf"].includes(extension)) {
      message.error("仅支持 PPT、PPTX 和 PDF 文件");
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      message.error("单个课件不能超过 50MB");
      return false;
    }

    setMaterialUploading(true);
    setMaterialUploadProgress(0);
    try {
      const blob = await upload(`training-materials/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/materials",
        multipart: true,
        onUploadProgress: ({ percentage }) => setMaterialUploadProgress(Math.round(percentage)),
      });
      const materials = form.getFieldValue("materials") || [];
      form.setFieldValue("materials", [...materials, { name: file.name, url: blob.url, type: extension }]);
      message.success(`${file.name} 上传成功`);
    } catch (error) {
      console.error(error);
      message.error(error instanceof Error ? error.message : "课件上传失败，请重试");
    } finally {
      setMaterialUploading(false);
      setMaterialUploadProgress(0);
    }
    return false;
  };

  const handleImport = async (file: File) => {
    const formData = new FormData(); formData.append("file", file);
    const res = await fetch("/api/training-records/import", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) { setImportResult(data.data); if (data.data.created > 0) { message.success(`成功导入 ${data.data.created} 条记录`); fetchRecords(); } }
    else message.error(data.message);
    return false;
  };

  const columns = [
    { title: "培训主题", dataIndex: "topic", key: "topic", width: 200, render: (t: string, r: Record<string, unknown>) => (
        <a onClick={() => { setDetailRecord(r); setDetailOpen(true); }} style={{ fontWeight: 600, color: "#1f2937" }}>{t}</a>
      )},
    { title: "培训时间", dataIndex: "date", key: "date", width: 110, render: (d: string) => dayjs(d).format("YYYY-MM-DD") },
    { title: "对象", dataIndex: "target", key: "target", width: 120, ellipsis: true },
    { title: "发起人", dataIndex: "initiator", key: "initiator", width: 80 },
    { title: "形式", dataIndex: "format", key: "format", width: 80, render: (f: string) => <Tag color={formatColors[f]}>{formatLabels[f]}</Tag> },
    { title: "人数", dataIndex: "participantCount", key: "participantCount", width: 60 },
    { title: "讲师", dataIndex: "instructor", key: "instructor", width: 80, render: (v: string | null) => v || "-" },
    { title: "状态", dataIndex: "status", key: "status", width: 90, render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: "课件", dataIndex: "materials", key: "materials", width: 80, render: (m: string | null) => {
        if (!m) return <span style={{ color: "#d1d5db" }}>-</span>;
        try { const arr = JSON.parse(m); return <Tag icon={<FileTextOutlined />} color="orange">{arr.length}个</Tag>; }
        catch { return <Tag icon={<FileTextOutlined />} color="orange">1个</Tag>; }
      }},
    { title: "录屏", dataIndex: "recording", key: "recording", width: 70, render: (r: string | null) => r ? <Tag icon={<PlayCircleOutlined />} color="red">有</Tag> : <span style={{ color: "#d1d5db" }}>-</span> },
    { title: "操作", key: "actions", width: 140, render: (_: unknown, r: Record<string, unknown>) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setDetailRecord(r); setDetailOpen(true); }}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingRecord(r); form.setFieldsValue({ ...r, date: r.date ? dayjs(r.date as string) : undefined }); setDrawerOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id as number)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )},
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>培训档案</h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>管理过往培训记录、课件与录屏资料</p>
        </div>
        <Space wrap>
          <Input.Search placeholder="搜索主题/发起人/讲师" allowClear style={{ width: 220 }} onSearch={setSearch} />
          <Select placeholder="状态筛选" allowClear style={{ width: 110 }} onChange={setStatusFilter}
            options={[{ label: "待开始", value: "pending" }, { label: "进行中", value: "ongoing" }, { label: "已完成", value: "completed" }]} />
          <Select placeholder="培训形式" allowClear style={{ width: 110 }} onChange={setFormatFilter}
            options={[{ label: "线上", value: "online" }, { label: "线下", value: "offline" }, { label: "混合", value: "hybrid" }]} />
          <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)}>批量导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setDrawerOpen(true); }}
            style={{ borderRadius: 10, fontWeight: 500 }}>添加记录</Button>
        </Space>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={records} columns={columns} rowKey="id" loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} locale={{ emptyText: "暂无培训档案，点击右上角添加或导入" }}
          scroll={{ x: 1300 }} size="middle" />
      </div>

      {/* Add/Edit Drawer */}
      <Drawer title={editingRecord ? "编辑培训档案" : "添加培训档案"} open={drawerOpen} width={500}
        onClose={() => { setDrawerOpen(false); form.resetFields(); setEditingRecord(null); }}
        extra={<Button type="primary" loading={submitting} onClick={handleSubmit} style={{ borderRadius: 10 }}>保存</Button>}>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="topic" label="培训主题" rules={[{ required: true, message: "请输入" }]}>
            <Input placeholder="如：2025年春季产品知识培训" />
          </Form.Item>
          <Form.Item name="target" label="培训对象" rules={[{ required: true, message: "请输入" }]}>
            <Input placeholder="如：技术部、产品部全体员工" />
          </Form.Item>
          <Form.Item name="date" label="培训时间" rules={[{ required: true, message: "请选择" }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="initiator" label="需求发起人" rules={[{ required: true, message: "请输入" }]}>
            <Input placeholder="如：张三" />
          </Form.Item>
          <Form.Item name="format" label="培训形式" initialValue="offline">
            <Radio.Group>
              <Radio.Button value="offline">线下</Radio.Button>
              <Radio.Button value="online">线上</Radio.Button>
              <Radio.Button value="hybrid">混合</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="participantCount" label="参训人数" initialValue={0}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="instructor" label="讲师">
            <Input placeholder="如：李四" />
          </Form.Item>
          <Form.Item name="description" label="需求描述">
            <Input.TextArea rows={3} placeholder="培训需求详细描述" />
          </Form.Item>
          <Form.Item name="status" label="需求状态" initialValue="completed">
            <Select options={[{ label: "待开始", value: "pending" }, { label: "进行中", value: "ongoing" }, { label: "已完成", value: "completed" }]} />
          </Form.Item>
          <Form.Item name="recording" label="培训录屏链接">
            <Input placeholder="如：https://meeting.tencent.com/xxx" prefix={<PlayCircleOutlined />} />
          </Form.Item>
          <Form.Item label="课件资料" help="可上传 PPT、PPTX、PDF（单个不超过 50MB），也可以继续手工添加链接。">
            <Upload.Dragger
              accept=".ppt,.pptx,.pdf"
              multiple
              disabled={materialUploading}
              beforeUpload={(file) => { void handleMaterialUpload(file); return false; }}
              showUploadList={false}
              style={{ marginBottom: 12 }}
            >
              <UploadOutlined style={{ fontSize: 30, color: "#0b3b72" }} />
              <p style={{ margin: "8px 0 2px", fontWeight: 600 }}>
                {materialUploading ? `正在上传 ${materialUploadProgress}%` : "点击或拖拽本地课件到这里"}
              </p>
              <p style={{ margin: 0, color: "#8a98aa", fontSize: 12 }}>支持 PPT、PPTX、PDF，上传后自动加入下方列表</p>
            </Upload.Dragger>
            <Form.List name="materials">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Space key={key} style={{ display: "flex", marginBottom: 8 }}>
                      <Form.Item noStyle name={[name, "name"]}><Input placeholder="课件名称" style={{ width: 150 }} /></Form.Item>
                      <Form.Item noStyle name={[name, "url"]}><Input placeholder="链接（飞书/PPT）" style={{ width: 200 }} /></Form.Item>
                      <Button size="small" danger onClick={() => remove(name)}>删</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ name: "", url: "", type: "link" })} block icon={<PlusOutlined />}>添加课件</Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer title="培训详情" open={detailOpen} width={520} onClose={() => { setDetailOpen(false); setDetailRecord(null); }}>
        {detailRecord && (
          <div>
            <Descriptions bordered column={1} size="small" labelStyle={{ fontWeight: 600, width: 100 }}>
              <Descriptions.Item label="培训主题">{detailRecord.topic as string}</Descriptions.Item>
              <Descriptions.Item label="培训对象">{detailRecord.target as string}</Descriptions.Item>
              <Descriptions.Item label="培训时间">{dayjs(detailRecord.date as string).format("YYYY年MM月DD日")}</Descriptions.Item>
              <Descriptions.Item label="需求发起人">{detailRecord.initiator as string}</Descriptions.Item>
              <Descriptions.Item label="培训形式"><Tag color={formatColors[detailRecord.format as string]}>{formatLabels[detailRecord.format as string]}</Tag></Descriptions.Item>
              <Descriptions.Item label="参训人数">{detailRecord.participantCount as number}</Descriptions.Item>
              <Descriptions.Item label="讲师">{(detailRecord.instructor as string) || "-"}</Descriptions.Item>
              <Descriptions.Item label="需求状态"><Tag color={statusColors[detailRecord.status as string]}>{statusLabels[detailRecord.status as string]}</Tag></Descriptions.Item>
              <Descriptions.Item label="需求描述">{(detailRecord.description as string) || "-"}</Descriptions.Item>
            </Descriptions>

{(detailRecord.recording as string) && (
              <div style={{ marginTop: 20, padding: 16, background: "#fef2f2", borderRadius: 12 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#991b1b" }}>
                  <PlayCircleOutlined style={{ marginRight: 6 }} />培训录屏
                </h4>
                <a href={detailRecord.recording as string} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#2563eb", fontSize: 13, wordBreak: "break-all" }}>
                  {detailRecord.recording as string}
                </a>
              </div>
            )}

            {/* 课件 */}
            {(detailRecord.materials as string) && (() => {
              try {
                const mats = JSON.parse(detailRecord.materials as string) as { name: string; url: string; type?: string }[];
                if (!mats.length) return null;
                return (
                  <div style={{ marginTop: 20, padding: 16, background: "#fff7ed", borderRadius: 12 }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#9a3412" }}>
                      <FileTextOutlined style={{ marginRight: 6 }} />课件资料（{mats.length}个）
                    </h4>
                    {mats.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < mats.length - 1 ? "1px solid #fed7aa" : "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name || `课件${i + 1}`}</span>
                        {m.url ? (
                          <a href={m.url} target="_blank" rel="noopener noreferrer"
                            style={{ color: "#2563eb", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                            <LinkOutlined /> 打开
                          </a>
                        ) : (
                          <span style={{ color: "#d1d5db", fontSize: 12 }}>无链接</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}
          </div>
        )}
      </Drawer>

      {/* Import Modal */}
      <Drawer title="批量导入培训档案" open={importModalOpen} width={480} onClose={() => { setImportModalOpen(false); setImportResult(null); }}>
        <p style={{ color: "#6b7280", marginBottom: 16, fontSize: 13 }}>
          Excel 表头：<strong>培训主题、培训对象、培训时间、需求发起人、培训形式、参训人数、讲师、需求描述、需求状态、课件、培训录屏</strong>
        </p>
        <Upload.Dragger accept=".xlsx,.xls" maxCount={1} beforeUpload={(file) => { handleImport(file); return false; }} showUploadList={false}>
          <UploadOutlined style={{ fontSize: 40, color: "#1677ff" }} />
          <p style={{ marginTop: 8 }}>点击或拖拽 Excel 文件上传</p>
        </Upload.Dragger>
        {importResult && (
          <div style={{ marginTop: 16, padding: 12, background: "#f9fafb", borderRadius: 8, fontSize: 13 }}>
            <p>总计 <strong>{importResult.total}</strong> 条，成功 <strong style={{ color: "#059669" }}>{importResult.created}</strong> 条</p>
            {importResult.errors && importResult.errors.length > 0 && (
              <ul style={{ color: "#dc2626", marginTop: 8, paddingLeft: 20 }}>
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
