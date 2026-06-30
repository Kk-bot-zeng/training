"use client";

import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { Department } from "@/types";

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const url = editingDept
        ? `/api/departments/${editingDept.id}`
        : "/api/departments";
      const method = editingDept ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (data.success) {
        message.success(editingDept ? "更新成功" : "创建成功");
        setModalOpen(false);
        form.resetFields();
        setEditingDept(null);
        fetchDepartments();
      } else {
        message.error(data.message);
      }
    } catch {
      // form validation error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      message.success("删除成功");
      fetchDepartments();
    } else {
      message.error(data.message);
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    { title: "部门名称", dataIndex: "name", key: "name" },
    {
      title: "员工人数",
      dataIndex: "_count",
      key: "_count",
      render: (c: { employees: number }) => c?.employees || 0,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (d: string) => new Date(d).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, record: Department) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingDept(record);
              form.setFieldsValue({ name: record.name });
              setModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该部门？"
            description="删除前请确保该部门下无在职员工"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">部门管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingDept(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          添加部门
        </Button>
      </div>

      <Table
        dataSource={departments}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: "暂无部门数据" }}
      />

      <Modal
        title={editingDept ? "编辑部门" : "添加部门"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setEditingDept(null);
        }}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: "请输入部门名称" }]}
          >
            <Input placeholder="如：技术部" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
