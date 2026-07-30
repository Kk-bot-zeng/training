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

const SCRIPT_CONTENT_TYPES: Record<string, string> = {
  py: "text/x-python", js: "text/javascript", jsx: "text/jsx", ts: "text/typescript", tsx: "text/tsx",
  sh: "text/x-shellscript", bash: "text/x-shellscript", bat: "application/x-bat", cmd: "application/x-bat",
  ps1: "text/plain", sql: "application/sql", json: "application/json", xml: "application/xml",
  yaml: "application/yaml", yml: "application/yaml", html: "text/html", css: "text/css",
  java: "text/x-java-source", c: "text/x-c", cpp: "text/x-c++", h: "text/x-c", go: "text/x-go", rs: "text/x-rust",
};

export default function PortalAssignmentsPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [files, setFiles] = useState<Record<number, WorkFile[]>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState(0);

  const uploadToLocalServer = async (assignmentId: number, file: File): Promise<WorkFile> => {
    // Smaller chunks are substantially more reliable on mobile networks and stay below proxy limits.
    const chunkSize = 4 * 1024 * 1024;
    const partCount = Math.ceil(file.size / chunkSize);
    const fingerprint = `${assignmentId}:${file.name}:${file.size}:${file.lastModified}`;
    const storageKey = `assignment-upload:${fingerprint}`;
    const resumeUploadId = localStorage.getItem(storageKey);
    const initResponse = await fetch("/api/uploads/assignments/local/init", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, name: file.name, size: file.size, type: file.type || "application/octet-stream", partCount, resumeUploadId }),
    });
    const init = await initResponse.json();
    if (!init.success) throw new Error(init.message || "初始化上传失败");
    localStorage.setItem(storageKey, init.data.uploadId);
    const statusResponse = await fetch(`/api/uploads/assignments/local/${init.data.uploadId}/status`, {
      credentials: "include", headers: { "x-assignment-id": String(assignmentId) },
    });
    const status = await statusResponse.json().catch(() => null);
    const uploadedParts = new Set<number>(status?.success ? status.data.uploadedParts : []);
    for (let index = 0; index < partCount; index++) {
      if (uploadedParts.has(index)) {
        setProgress(Math.round(((index + 1) / partCount) * 100));
        continue;
      }
      let uploaded = false;
      let lastMessage = `第 ${index + 1} 个分片上传失败`;
      for (let attempt = 1; attempt <= 6 && !uploaded; attempt++) {
        try {
          const response = await fetch(`/api/uploads/assignments/local/${init.data.uploadId}/${index}`, {
            method: "PUT", credentials: "include", headers: { "x-assignment-id": String(assignmentId) },
            body: file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)),
          });
          if (response.ok) uploaded = true;
          else {
            const error = await response.json().catch(() => null);
            lastMessage = error?.message || lastMessage;
            if (response.status === 401) throw new Error("登录状态已失效，请重新登录后选择同一文件继续上传");
          }
        } catch (error) {
          lastMessage = error instanceof Error ? error.message : lastMessage;
        }
        if (!uploaded && attempt < 6) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 10000)));
        }
      }
      if (!uploaded) throw new Error(`${lastMessage}，进度已保存，请保持页面打开重试或重新选择同一文件续传`);
      setProgress(Math.round(((index + 1) / partCount) * 100));
    }
    const completeResponse = await fetch("/api/uploads/assignments/local/complete", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, uploadId: init.data.uploadId }),
    });
    const complete = await completeResponse.json();
    if (!complete.success) throw new Error(complete.message || "文件合并失败");
    localStorage.removeItem(storageKey);
    return complete.data;
  };

  const load = async () => {
    const res = await fetch("/api/assignments"); const data = await res.json();
    if (data.success) setItems(data.data); else message.error(data.message || "获取作业失败");
  };
  const focusScannedAssignment = () => {
    const id = new URLSearchParams(window.location.search).get("assignmentId");
    if (id) requestAnimationFrame(() => document.getElementById(`assignment-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  useEffect(() => {
    fetch("/api/assignments").then((res) => res.json()).then((data) => {
      if (data.success) { setItems(data.data); focusScannedAssignment(); }
      else message.error(data.message || "获取作业失败");
    }).catch(() => message.error("获取作业失败"));
  }, []);

  const upload = async (assignmentId: number, file: File) => {
    if (file.size === 0) { message.error("不能上传空文件，请重新选择文件"); return false; }
    if (file.size > 2 * 1024 * 1024 * 1024) { message.error("单个文件不能超过 2GB"); return false; }
    setActiveId(assignmentId); setProgress(0);
    try {
      let uploaded: WorkFile;
      if (process.env.NEXT_PUBLIC_STORAGE_MODE === "local") {
        uploaded = await uploadToLocalServer(assignmentId, file);
      } else {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        const contentType = file.type || SCRIPT_CONTENT_TYPES[extension] || "application/octet-stream";
        const path = `assignment-files/${stored.id}/${assignmentId}/${file.lastModified}-${file.size}-${safeName}`;
        const blob = await uploadPresigned(path, file, {
          access: "public", handleUploadUrl: "/api/uploads/assignments", contentType,
          multipart: file.size >= 20 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        uploaded = { name: file.name, url: blob.url, type: file.type, size: file.size };
      }
      setFiles((prev) => ({ ...prev, [assignmentId]: [...(prev[assignmentId] || []), uploaded] }));
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
        return <Card className="assignment-submit-card" id={`assignment-${item.id}`} key={item.id} style={{ borderRadius: 16, scrollMarginTop: 70 }} title={<Space><span>{item.title}</span>{submitted ? <Tag icon={<CheckCircleOutlined />} color="success">已提交</Tag> : expired ? <Tag color="error">已截止</Tag> : <Tag color="processing">待提交</Tag>}</Space>} extra={<span style={{ color: expired ? "#cf1322" : "#64748b" }}><ClockCircleOutlined /> 截止 {dayjs(item.dueDate).format("YYYY-MM-DD HH:mm")}</span>}>
          <Typography.Paragraph style={{ whiteSpace: "pre-wrap", color: "#475569" }}>{item.description || "暂无补充说明"}</Typography.Paragraph>
          {submitted && <div style={{ background: "#f0fdf8", padding: 12, borderRadius: 10, marginBottom: 14 }}><strong>最近提交：</strong> {dayjs(submitted.submittedAt).format("YYYY-MM-DD HH:mm")}<div style={{ marginTop: 6 }}><Space wrap>{submittedFiles.map(f => <a key={f.url} href={f.url} target="_blank" rel="noreferrer"><FileTextOutlined /> {f.name}</a>)}</Space></div></div>}
          {!expired && <>
            <Upload.Dragger multiple={false} showUploadList={false} disabled={activeId === item.id} beforeUpload={(file) => { void upload(item.id, file); return false; }}>
              <UploadOutlined style={{ fontSize: 30, color: "#25c9a5" }} /><p style={{ margin: 6 }}>点击选择或拖入作业文件</p><p style={{ color: "#8a98aa", fontSize: 12 }}>支持手机视频、文档、表格、脚本、压缩包及其他文件，单文件不超过 2GB，文件数量不限</p>
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
