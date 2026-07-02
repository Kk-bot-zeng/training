"use client";

import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Space, Popconfirm, message, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { Department } from "@/types";

const pageHeader = (title: string, desc: string) => (
  <div style={{ marginBottom: 24 }}>
    <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>{title}</h1>
    <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>{desc}</p>
  </div>
);

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments");
      const data = await res.json();
      if (data.success) setDepartments(data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const url = editingDept ? `/api/departments/${editingDept.id}` : "/api/departments";
      const method = editingDept ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await res.json();
      if (data.success) { message.success(editingDept ? "更新成功" : "创建成功"); setModalOpen(false); form.resetFields(); setEditingDept(null); fetchDepartments(); }
      else message.error(data.message);
    } catch {} finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { message.success("删除成功"); fetchDepartments(); }
    else message.error(data.message);
  };

  const columns = [
    { title: "#", dataIndex: "id", key: "id", width: 60 },
    { title: "部门名称", dataIndex: "name", key: "name", render: (name: string) => <span style={{ fontWeight: 600, color: "#1f2937" }}>{name}</span> },
    { title: "员工人数", dataIndex: "_count", key: "_count", render: (c: { employees: number }) => <Tag color="blue" style={{ borderRadius: 8 }}>{c?.employees || 0} 人</Tag> },
    { title: "创建时间", dataIndex: "createdAt", key: "createdAt", render: (d: string) => new Date(d).toLocaleString("zh-CN") },
    { title: "操作", key: "actions", width: 160, render: (_: unknown, record: Department) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingDept(record); form.setFieldsValue({ name: record.name }); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        {pageHeader("部门管理", "管理公司组织架构")}
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingDept(null); form.resetFields(); setModalOpen(true); }}
          style={{ borderRadius: 10, height: 40, fontWeight: 500, marginTop: 4 }}>
          添加部门
        </Button>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={departments} columns={columns} rowKey="id" loading={loading} pagination={false} locale={{ emptyText: "暂无部门" }} />
      </div>
      <Modal title={editingDept ? "编辑部门" : "添加部门"} open={modalOpen} onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingDept(null); }} confirmLoading={submitting} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: "请输入" }]}>
            <Input placeholder="如：技术部" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
