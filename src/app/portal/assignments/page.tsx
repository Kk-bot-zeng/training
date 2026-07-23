"use client";

import { useEffect, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { Button, Card, Empty, Input, Progress, Space, Tag, Typography, Upload, message } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, FileTextOutlined, UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

type WorkFile = { name: string; url: string; type: string; size: number };
type Assignment = {
  id: number; title: string; description?: string; dueDate: string;
  submissions?: { files: string; comment?: string; submittedAt: string }[];
};

const ACCEPT = ".mp4,.mov,.avi,.webm,.mkv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.csv,.zip,.rar,.jpg,.jpeg,.png,.gif,.webp";

export default function PortalAssignmentsPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [files, setFiles] = useState<Record<number, WorkFile[]>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState(0);

  const load = async () => {
    const res = await fetch("/api/assignments"); const data = await res.json();
    if (data.success) setItems(data.data); else message.error(data.message || "获取作业失败");
  };
  useEffect(() => {
    fetch("/api/assignments").then((res) => res.json()).then((data) => {
      if (data.success) setItems(data.data);
      else message.error(data.message || "获取作业失败");
    }).catch(() => message.error("获取作业失败"));
  }, []);

  const upload = async (assignmentId: number, file: File) => {
    if (file.size > 200 * 1024 * 1024) { message.error("单个文件不能超过 200MB"); return false; }
    setActiveId(assignmentId); setProgress(0);
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `assignment-files/${stored.id}/${assignmentId}/${file.lastModified}-${file.size}-${safeName}`;
      const blob = await uploadPresigned(path, file, {
        access: "public", handleUploadUrl: "/api/uploads/assignments", multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      setFiles((prev) => ({ ...prev, [assignmentId]: [...(prev[assignmentId] || []), { name: file.name, url: blob.url, type: file.type, size: file.size }] }));
      message.success(`${file.name} 上传成功`);
    } catch (error) { message.error(error instanceof Error ? error.message : "上传失败"); }
    finally { setActiveId(null); setProgress(0); }
    return false;
  };

  const submit = async (assignment: Assignment) => {
    const workFiles = files[assignment.id] || [];
    if (!workFiles.length) return message.warning("请先上传作业文件");
    const res = await fetch(`/api/assignments/${assignment.id}/submissions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: workFiles, comment: comments[assignment.id] }),
    });
    const data = await res.json();
    if (!data.success) return message.error(data.message || "提交失败");
    message.success("作业提交成功"); setFiles((p) => ({ ...p, [assignment.id]: [] })); await load();
  };

  return <div>
    <div style={{ marginBottom: 20 }}><Typography.Title level={2} style={{ margin: 0 }}>我的作业</Typography.Title><Typography.Text type="secondary">查看作业要求并提交视频、文档、表格等文件</Typography.Text></div>
    {!items.length ? <Empty description="暂无作业" /> : <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {items.map((item) => {
        const submitted = item.submissions?.[0]; const expired = dayjs().isAfter(dayjs(item.dueDate));
        let submittedFiles: WorkFile[] = []; try { submittedFiles = submitted ? JSON.parse(submitted.files) : []; } catch {}
        return <Card key={item.id} style={{ borderRadius: 16 }} title={<Space><span>{item.title}</span>{submitted ? <Tag icon={<CheckCircleOutlined />} color="success">已提交</Tag> : expired ? <Tag color="error">已截止</Tag> : <Tag color="processing">待提交</Tag>}</Space>} extra={<span style={{ color: expired ? "#cf1322" : "#64748b" }}><ClockCircleOutlined /> 截止 {dayjs(item.dueDate).format("YYYY-MM-DD HH:mm")}</span>}>
          <Typography.Paragraph style={{ whiteSpace: "pre-wrap", color: "#475569" }}>{item.description || "暂无补充说明"}</Typography.Paragraph>
          {submitted && <div style={{ background: "#f0fdf8", padding: 12, borderRadius: 10, marginBottom: 14 }}><strong>最近提交：</strong> {dayjs(submitted.submittedAt).format("YYYY-MM-DD HH:mm")}<div style={{ marginTop: 6 }}><Space wrap>{submittedFiles.map(f => <a key={f.url} href={f.url} target="_blank" rel="noreferrer"><FileTextOutlined /> {f.name}</a>)}</Space></div></div>}
          {!expired && <>
            <Upload.Dragger accept={ACCEPT} multiple showUploadList={false} disabled={activeId === item.id} beforeUpload={(file) => { void upload(item.id, file); return false; }}>
              <UploadOutlined style={{ fontSize: 30, color: "#25c9a5" }} /><p style={{ margin: 6 }}>点击或拖拽作业文件到这里</p><p style={{ color: "#8a98aa", fontSize: 12 }}>支持视频、Office、PDF、图片、压缩包等，单文件不超过 200MB</p>
            </Upload.Dragger>
            {activeId === item.id && <Progress percent={progress} style={{ marginTop: 8 }} />}
            {!!files[item.id]?.length && <div style={{ marginTop: 12 }}><Space direction="vertical" style={{ width: "100%" }}>{files[item.id].map((f, index) => <div key={f.url} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "8px 12px", borderRadius: 8 }}><span><FileTextOutlined /> {f.name}</span><Button type="text" danger icon={<DeleteOutlined />} onClick={() => setFiles(p => ({ ...p, [item.id]: p[item.id].filter((_, i) => i !== index) }))} /></div>)}</Space></div>}
            <Input.TextArea value={comments[item.id]} onChange={(e) => setComments(p => ({ ...p, [item.id]: e.target.value }))} placeholder="提交备注（选填）" rows={2} style={{ marginTop: 12 }} />
            <Button type="primary" onClick={() => submit(item)} disabled={!files[item.id]?.length || activeId === item.id} style={{ marginTop: 12 }}>{submitted ? "更新提交" : "提交作业"}</Button>
          </>}
        </Card>;
      })}
    </Space>}
  </div>;
}
