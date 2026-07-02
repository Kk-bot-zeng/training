"use client";

import { useEffect, useState, Suspense } from "react";
import { Form, Input, Select, DatePicker, TimePicker, Button, Card, message, Tag } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import type { Department } from "@/types";
import dayjs from "dayjs";

function CreateForm() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form] = Form.useForm();

  const templateParam = searchParams.get("tpl");

  useEffect(() => {
    fetch("/api/departments").then(r => r.json()).then(data => {
      if (data.success) setDepartments(data.data);
    });
  }, []);

  useEffect(() => {
    if (templateParam) {
      try {
        const tpl = JSON.parse(decodeURIComponent(templateParam));
        form.setFieldsValue({
          title: tpl.title,
          type: tpl.type,
          startTime: dayjs(tpl.startTime, "HH:mm"),
          endTime: dayjs(tpl.endTime, "HH:mm"),
        });
      } catch {}
    }
  }, [templateParam, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const body = {
        ...values,
        date: dayjs(values.date as string).format("YYYY-MM-DD"),
        startTime: dayjs(values.startTime as string).format("HH:mm"),
        endTime: dayjs(values.endTime as string).format("HH:mm"),
      };
      const res = await fetch("/api/trainings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { message.success("培训创建成功！"); router.push(`/admin/trainings/${data.data.id}`); }
      else message.error(data.message);
    } catch { message.error("创建失败"); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>创建培训</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
          {templateParam ? "从模板创建，已预填信息" : "填写培训信息，生成签到二维码"}
        </p>
      </div>

      <Card style={{ maxWidth: 640, borderRadius: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ type: "training" }}>
          <Form.Item name="title" label="培训标题" rules={[{ required: true, message: "请输入" }]}>
            <Input placeholder="如：2024年Q1产品知识培训" />
          </Form.Item>
          <Form.Item name="description" label="培训描述">
            <Input.TextArea rows={2} placeholder="培训内容简介（选填）" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[{ label: "培训", value: "training" }, { label: "考试", value: "exam" }]} />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="startTime" label="开始时间" rules={[{ required: true }]}>
              <TimePicker style={{ width: "100%" }} format="HH:mm" />
            </Form.Item>
            <Form.Item name="endTime" label="结束时间" rules={[{ required: true }]}>
              <TimePicker style={{ width: "100%" }} format="HH:mm" />
            </Form.Item>
          </div>
          <Form.Item name="location" label="地点">
            <Input placeholder="如：3楼会议室A" />
          </Form.Item>
          <Form.Item name="departmentIds" label="参加部门" rules={[{ required: true, message: "请选择" }]}>
            <Select mode="multiple" placeholder="选择参加部门" options={departments.map(d => ({ label: d.name, value: d.id }))} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={submitting} size="large"
              style={{ borderRadius: 10, height: 44, padding: "0 32px", fontWeight: 600 }}>
              创建培训
            </Button>
            <Button onClick={() => router.back()} size="large" style={{ borderRadius: 10, height: 44, marginLeft: 12 }}>
              返回
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default function CreateTrainingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>加载中...</div>}>
      <CreateForm />
    </Suspense>
  );
}
