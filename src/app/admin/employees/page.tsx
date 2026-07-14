"use client";

import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Upload,
  Modal,
  Space,
  Tag,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  ImportOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  UploadOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { Employee, Department } from "@/types";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<number | undefined>();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (deptFilter) params.set("departmentId", String(deptFilter));

      const res = await fetch(`/api/employees?${params}`);
      const data = await res.json();
      if (data.success) setEmployees(data.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    const res = await fetch("/api/departments");
    const data = await res.json();
    if (data.success) setDepartments(data.data);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, deptFilter]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const url = editingEmp
        ? `/api/employees/${editingEmp.id}`
        : "/api/employees";
      const method = editingEmp ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (data.success) {
        message.success(editingEmp ? "更新成功" : "创建成功");
        setDrawerOpen(false);
        form.resetFields();
        setEditingEmp(null);
        fetchEmployees();
      } else {
        message.error(data.message);
      }
    } catch {
      // form validation
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      message.success(data.message);
      fetchEmployees();
    } else {
      message.error(data.message);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/employees/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setImportResult(data.data);
        if (data.data.created > 0) {
          message.success(`成功导入 ${data.data.created} 名员工`);
          fetchEmployees();
        }
      } else {
        message.error(data.message);
      }
    } catch {
      message.error("导入失败");
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    { title: "姓名", dataIndex: "name", key: "name" },
    { title: "工号", dataIndex: "employeeNo", key: "employeeNo" },
    {
      title: "部门",
      dataIndex: "department",
      key: "department",
      render: (dept: Department) => dept?.name || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={s === "active" ? "green" : "red"}>
          {s === "active" ? "在职" : "离职"}
        </Tag>
      ),
    },
    {
      title: "手机号",
      dataIndex: "phone",
      key: "phone",
      render: (p: string | null) => p || "-",
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
      render: (_: unknown, record: Employee) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingEmp(record);
              form.setFieldsValue(record);
              setDrawerOpen(true);
            }}
          >
            编辑
          </Button>
          <Button type="link" size="small" icon={<KeyOutlined />}
            onClick={() => {
              const pw = prompt("为新学员设置登录密码（至少4位）：");
              if (pw && pw.length >= 4) {
                fetch(`/api/employees/${record.id}/password`, {
                  method: "PUT", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password: pw }),
                }).then(r => r.json()).then(d => {
                  message.success(d.message || "密码设置成功");
                });
              } else if (pw) {
                message.warning("密码至少4位");
              }
            }}>
            密码
          </Button>
          <Popconfirm
            title={`确定删除“${record.name}”的账号？`}
            description="删除后，该员工账号及其设备绑定、考勤和考试记录都将被彻底删除，且无法恢复。"
            okText="确定彻底删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除账号</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>员工管理</h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>管理公司员工信息，支持批量导入</p>
        </div>
        <Space wrap>
          <Input.Search
            placeholder="搜索姓名/工号"
            allowClear
            onSearch={setSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="筛选部门"
            allowClear
            style={{ width: 150 }}
            onChange={(v) => setDeptFilter(v)}
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
          <Button
            icon={<ImportOutlined />}
            onClick={() => setImportModalOpen(true)}
          >
            导入Excel
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingEmp(null);
              form.resetFields();
              setDrawerOpen(true);
            }}
          >
            添加员工
          </Button>
        </Space>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "8px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table
          dataSource={employees}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 名员工` }}
          locale={{ emptyText: "暂无员工数据" }}
          scroll={{ x: 800 }}
        />
      </div>

      {/* Employee Form Drawer */}
      <Drawer
        title={editingEmp ? "编辑员工" : "添加员工"}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          form.resetFields();
          setEditingEmp(null);
        }}
        width={400}
        extra={
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            保存
          </Button>
        }
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="员工姓名" />
          </Form.Item>
          <Form.Item
            name="employeeNo"
            label="工号"
            rules={[{ required: true, message: "请输入工号" }]}
          >
            <Input placeholder="唯一工号" disabled={!!editingEmp} />
          </Form.Item>
          <Form.Item
            name="departmentId"
            label="部门"
            rules={[{ required: true, message: "请选择部门" }]}
          >
            <Select
              placeholder="选择部门"
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号（选填）" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select
              options={[
                { label: "在职", value: "active" },
                { label: "离职", value: "inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Import Modal */}
      <Modal
        title="批量导入员工"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setImportResult(null);
        }}
        footer={null}
        width={600}
      >
        <div className="mb-4">
          <p className="mb-2 text-gray-500">
            请上传 Excel 文件（.xlsx / .xls），表头需包含：<strong>姓名、部门、密码</strong>
          </p>
          <Button
            icon={<DownloadOutlined />}
            type="link"
            onClick={() => {
              // Generate template download
              const XLSX = require("xlsx");
              const ws = XLSX.utils.aoa_to_sheet([
                ["姓名", "部门", "密码"],
                ["张三", "技术部", "123456"],
              ]);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "员工导入模板");
              XLSX.writeFile(wb, "员工导入模板.xlsx");
            }}
          >
            下载导入模板
          </Button>
        </div>

        <Upload.Dragger
          accept=".xlsx,.xls"
          maxCount={1}
          beforeUpload={(file) => {
            handleImport(file);
            return false;
          }}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: "#1677ff" }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 .xlsx 和 .xls 格式</p>
        </Upload.Dragger>

        {importing && <p className="mt-4 text-center">正在导入...</p>}

        {importResult && (
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <p>
              总计 <strong>{importResult.total}</strong> 条，
              成功 <strong className="text-green-600">{importResult.created}</strong> 条，
              跳过 <strong className="text-orange-500">{importResult.skipped}</strong> 条
            </p>
            {importResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-red-500 font-medium">错误信息：</p>
                <ul className="text-sm text-red-500 list-disc pl-4">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
