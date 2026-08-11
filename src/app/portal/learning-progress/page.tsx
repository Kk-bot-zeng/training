"use client";

import { useState } from "react";
import useSWR from "swr";
import { Alert, Button, Card, Modal, Progress, Tag } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { fetcher } from "@/lib/fetcher";

type Material = { name?: string; url: string; type?: string };
type Item = { id: number; videoSeconds: number; videoDuration: number; completedAt?: string; task: { title: string; productLine: string; recording?: string; materials?: string } };

export default function MyLearningPage() {
  const { data, mutate, isLoading } = useSWR<Item[]>("/api/learning-tasks", fetcher);
  const [preview, setPreview] = useState<{ assignmentId: number; material: Material } | null>(null);
  const save = async (id: number, body: object) => {
    await fetch("/api/learning-tasks/progress", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId: id, ...body }) });
    mutate();
  };

  return <div>
    <h1>我的学习进度</h1>
    <p style={{ color: "#82939e" }}>完成指定的培训录屏、课件与一页纸学习</p>
    {!isLoading && data?.length === 0 && <Card><div style={{ textAlign: "center", padding: 32, color: "#82939e" }}>暂无待学习任务</div></Card>}
    {(data || []).map((item) => {
      const percent = item.videoDuration ? Math.round(item.videoSeconds / item.videoDuration * 100) : 0;
      let taskMaterials: Material[] = [];
      try { taskMaterials = JSON.parse(item.task.materials || "[]"); } catch {}
      return <Card key={item.id} style={{ marginBottom: 16 }} title={item.task.title}
        extra={<Tag color={item.task.productLine === "tv" ? "purple" : "blue"}>{item.task.productLine === "tv" ? "电视" : "显示器"}</Tag>}>
        <Progress percent={item.completedAt ? 100 : percent} status={item.completedAt ? "success" : "active"} />
        {item.task.recording && <div style={{ background: "#0b1220", borderRadius: 10, overflow: "hidden", aspectRatio: "16 / 9" }}>
          <video controls controlsList="nodownload noremoteplayback" disablePictureInPicture preload="metadata" src={item.task.recording}
            onContextMenu={(event) => event.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onLoadedMetadata={(event) => save(item.id, { videoSeconds: item.videoSeconds, videoDuration: event.currentTarget.duration })}
            onTimeUpdate={(event) => { if (Math.floor(event.currentTarget.currentTime) % 15 === 0) save(item.id, { videoSeconds: event.currentTarget.currentTime, videoDuration: event.currentTarget.duration }); }} />
        </div>}
        {item.task.recording && <Alert style={{ marginTop: 10 }} type="info" showIcon message="视频仅限在线学习，不提供下载；支持断点续播并自动保存进度。" />}
        {taskMaterials.map((material, index) => <Button key={index} icon={<FileTextOutlined />}
          onClick={() => { setPreview({ assignmentId: item.id, material }); void save(item.id, { viewedFile: material.url }); }}
          style={{ margin: "12px 8px 0 0" }}>在线查看 {material.name || "学习资料"}</Button>)}
      </Card>;
    })}
    <Modal title={preview?.material.name || "在线学习资料"} open={Boolean(preview)} onCancel={() => setPreview(null)}
      footer={null} width={1000} destroyOnHidden styles={{ body: { padding: 0 } }}>
      <Alert type="info" showIcon message="资料仅限在线学习，不提供下载。请勿截图、录屏或对外传播。" style={{ margin: "12px 0" }} />
      {preview && <iframe title={preview.material.name || "学习资料"} src={preview.material.url}
        sandbox="allow-same-origin allow-scripts" referrerPolicy="no-referrer"
        onContextMenu={(event) => event.preventDefault()}
        style={{ width: "100%", height: "68vh", border: 0, background: "#f4f6fb" }} />}
    </Modal>
  </div>;
}
