"use client";

import { useEffect, useState } from "react";
import { Button, Card, Empty, Form, Input, List, Modal, Select, Space, Tag, message } from "antd";
import dayjs from "dayjs";

type Item = { id: number; question: string; answer?: string | null; productModel?: string | null; category?: string | null; status: string; createdAt: string };

export default function PortalCatcherPlanPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const load = async () => {
    const response = await fetch("/api/catcher-questions", { cache: "no-store" });
    const data = await response.json();
    if (data.success) setItems(data.data);
  };
  useEffect(() => { load(); }, []);
  const submit = async () => {
    const values = await form.validateFields(); setSaving(true);
    try {
      const response = await fetch("/api/catcher-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      message.success("问题已提交"); setOpen(false); form.resetFields(); await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "提交失败"); }
    finally { setSaving(false); }
  };
  return <div>
    <Card bordered={false} style={{ borderRadius: 18, marginBottom: 16, background: "linear-gradient(135deg,#1239b7,#2b86e5)", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div><h1 style={{ color: "white", margin: 0 }}>捕手计划 · 问答收集</h1><p style={{ margin: "8px 0 0", opacity: .85 }}>把一线真实问题带回来，让产品知识持续完善</p></div>
        <Button size="large" onClick={() => setOpen(true)}>反馈问题</Button>
      </div>
    </Card>
    <Card title="我的反馈" bordered={false} style={{ borderRadius: 16 }}>
      {!items.length ? <Empty description="还没有反馈问题" /> : <List dataSource={items} renderItem={(item) => <List.Item>
        <List.Item.Meta title={<Space wrap><span>{item.question}</span><Tag color={item.answer ? "green" : "orange"}>{item.answer ? "已回答" : "待回答"}</Tag></Space>}
          description={<div><Space wrap><span>{item.productModel || "通用"}</span>{item.category && <span>{item.category}</span>}<span>{dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}</span></Space>{item.answer && <div style={{ marginTop: 10, padding: 12, background: "#f3f8ff", borderRadius: 10, color: "#17365d" }}><b>答：</b>{item.answer}</div>}</div>} />
      </List.Item>} />}
    </Card>
    <Modal title="反馈产品问题" open={open} onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving} okText="提交">
      <Form form={form} layout="vertical">
        <Form.Item name="productModel" label="产品型号"><Input placeholder="例如：鹤7 Pro 26款" /></Form.Item>
        <Form.Item name="category" label="问题分类"><Select allowClear options={["产品参数","安装调试","功能使用","售后问题","销售话术","其他"].map(value => ({ value }))} /></Form.Item>
        <Form.Item name="question" label="问题内容" rules={[{ required: true, message: "请输入问题" }]}><Input.TextArea rows={5} maxLength={1000} showCount placeholder="请描述实际遇到的问题" /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
