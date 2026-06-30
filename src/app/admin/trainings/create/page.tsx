"use client";

import { useEffect, useState } from "react";
import {
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  Button,
  Card,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import type { Department } from "@/types";
import dayjs from "dayjs";

export default function CreateTrainingPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const [form] = Form.useForm();

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setDepartments(data.data);
      });
  }, []);

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        message.success("培训创建成功！");
        router.push(`/admin/trainings/${data.data.id}`);
      } else {
        message.error(data.message);
      }
    } catch {
      message.error("创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">创建培训</h2>
      <Card className="max-w-2xl">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ type: "training" }}
        >
          <Form.Item
            name="title"
            label="培训标题"
            rules={[{ required: true, message: "请输入培训标题" }]}
          >
            <Input placeholder="如：2024年Q1产品知识培训" />
          </Form.Item>

          <Form.Item name="description" label="培训描述">
            <Input.TextArea rows={3} placeholder="培训内容简介（选填）" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: "请选择类型" }]}
          >
            <Select
              options={[
                { label: "培训", value: "training" },
                { label: "考试", value: "exam" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: "请选择日期" }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="startTime"
              label="开始时间"
              rules={[{ required: true, message: "请选择开始时间" }]}
            >
              <TimePicker className="w-full" format="HH:mm" />
            </Form.Item>
            <Form.Item
              name="endTime"
              label="结束时间"
              rules={[{ required: true, message: "请选择结束时间" }]}
            >
              <TimePicker className="w-full" format="HH:mm" />
            </Form.Item>
          </div>

          <Form.Item name="location" label="地点">
            <Input placeholder="如：3楼会议室A" />
          </Form.Item>

          <Form.Item
            name="departmentIds"
            label="参加部门"
            rules={[{ required: true, message: "请选择参加部门" }]}
          >
            <Select
              mode="multiple"
              placeholder="选择需要参加培训的部门"
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} size="large">
              创建培训
            </Button>
            <Button className="ml-3" onClick={() => router.back()} size="large">
              返回
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
