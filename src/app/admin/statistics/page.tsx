"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  Select,
  Table,
  Tag,
  Row,
  Col,
  Statistic,
  Button,
  Spin,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import type { Training, DepartmentRate, Employee } from "@/types";

const statusColors: Record<string, string> = {
  present: "green",
  late: "orange",
  leave: "blue",
  absent: "red",
};
const statusLabels: Record<string, string> = {
  present: "出席",
  late: "迟到",
  leave: "请假",
  absent: "缺席",
};

export default function StatisticsPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<number | undefined>();
  const [rateData, setRateData] = useState<Record<string, unknown> | null>(null);
  const [absentList, setAbsentList] = useState<Record<string, unknown>[]>([]);
  const [deptComparison, setDeptComparison] = useState<DepartmentRate[]>([]);
  const [empSearchId, setEmpSearchId] = useState<number | undefined>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empHistory, setEmpHistory] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTrainings = async () => {
    const res = await fetch("/api/trainings?pageSize=200");
    const data = await res.json();
    if (data.success) setTrainings(data.data.items);
  };

  const fetchDeptComparison = async () => {
    const res = await fetch("/api/statistics/department");
    const data = await res.json();
    if (data.success) setDeptComparison(data.data);
  };

  useEffect(() => {
    fetchTrainings();
    fetchDeptComparison();
    // Load employees for personal search
    fetch("/api/employees?pageSize=50&compact=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEmployees(data.data.items);
      });
  }, []);

  const searchEmployees = async (value: string) => {
    const params = new URLSearchParams({ pageSize: "50", compact: "true" });
    if (value.trim()) params.set("search", value.trim());
    const res = await fetch(`/api/employees?${params}`);
    const data = await res.json();
    if (data.success) setEmployees(data.data.items);
  };

  const fetchTrainingStats = useCallback(async () => {
    if (!selectedTrainingId) return;
    setLoading(true);
    try {
      const [rateRes, absentRes] = await Promise.all([
        fetch(`/api/statistics/rate?trainingId=${selectedTrainingId}`),
        fetch(`/api/statistics/absent?trainingId=${selectedTrainingId}`),
      ]);
      const rate = await rateRes.json();
      const absent = await absentRes.json();
      if (rate.success) setRateData(rate.data);
      if (absent.success) setAbsentList(absent.data);
    } finally {
      setLoading(false);
    }
  }, [selectedTrainingId]);

  useEffect(() => {
    fetchTrainingStats();
  }, [fetchTrainingStats]);

  const handleEmployeeSearch = async (employeeId: number) => {
    setEmpSearchId(employeeId);
    if (!employeeId) {
      setEmpHistory(null);
      return;
    }
    const res = await fetch(`/api/statistics/employee?employeeId=${employeeId}`);
    const data = await res.json();
    if (data.success) setEmpHistory(data.data);
  };

  const handleExportAbsent = () => {
    if (!selectedTrainingId) return;
    window.open(`/api/export/attendance?trainingId=${selectedTrainingId}`, "_blank");
  };

  const absentColumns = [
    {
      title: "姓名",
      dataIndex: ["employee", "name"],
      key: "name",
    },
    {
      title: "工号",
      dataIndex: ["employee", "employeeNo"],
      key: "employeeNo",
    },
    {
      title: "部门",
      dataIndex: ["employee", "department", "name"],
      key: "dept",
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      render: (r: string | null) => r || "-",
    },
  ];

  const deptColumns = [
    { title: "部门", dataIndex: "name", key: "name" },
    { title: "总人次", dataIndex: "total", key: "total" },
    { title: "出勤人次", dataIndex: "attended", key: "attended" },
    {
      title: "出勤率",
      dataIndex: "rate",
      key: "rate",
      render: (r: string) => (
        <Tag color={parseFloat(r) >= 90 ? "green" : parseFloat(r) >= 70 ? "orange" : "red"}>
          {r}
        </Tag>
      ),
    },
  ];

  const historyColumns = [
    { title: "培训名称", dataIndex: ["training", "title"], key: "title" },
    {
      title: "类型",
      dataIndex: ["training", "type"],
      key: "type",
      render: (t: string) => (
        <Tag color={t === "exam" ? "red" : "blue"}>
          {t === "exam" ? "考试" : "培训"}
        </Tag>
      ),
    },
    {
      title: "日期",
      dataIndex: ["training", "date"],
      key: "date",
      render: (d: string) => new Date(d).toLocaleDateString("zh-CN"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>统计分析</h1>
        <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>出勤率统计、部门对比、个人档案</p>
      </div>

      {/* Training-specific stats */}
      <Card title="培训出勤统计" className="mb-4">
        <div className="mb-4">
          <Select
            placeholder="选择培训查看统计"
            showSearch
            style={{ width: 300 }}
            value={selectedTrainingId}
            onChange={(v) => setSelectedTrainingId(v)}
            filterOption={(input, option) =>
              (option?.label as string)?.includes(input)
            }
            options={trainings.map((t) => ({
              label: `${new Date(t.date).toLocaleDateString("zh-CN")} ${t.title}`,
              value: t.id,
            }))}
          />
        </div>

        {loading ? (
          <Spin />
        ) : rateData ? (
          <>
            <Row gutter={16} className="mb-4">
              <Col xs={12} sm={4}>
                <Statistic title="总人数" value={rateData.total as number} />
              </Col>
              <Col xs={12} sm={4}>
                <Statistic title="出席" value={rateData.present as number} valueStyle={{ color: "#52c41a" }} />
              </Col>
              <Col xs={12} sm={4}>
                <Statistic title="迟到" value={rateData.late as number} valueStyle={{ color: "#faad14" }} />
              </Col>
              <Col xs={12} sm={4}>
                <Statistic title="请假" value={rateData.leave as number} valueStyle={{ color: "#1677ff" }} />
              </Col>
              <Col xs={12} sm={4}>
                <Statistic title="缺勤" value={rateData.absent as number} valueStyle={{ color: "#ff4d4f" }} />
              </Col>
              <Col xs={12} sm={4}>
                <Statistic title="出勤率" value={rateData.presentRate as string} valueStyle={{ color: "#722ed1" }} />
              </Col>
            </Row>

            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold">缺勤名单</h4>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleExportAbsent}
                disabled={absentList.length === 0}
              >
                导出
              </Button>
            </div>
            <Table
              dataSource={absentList}
              columns={absentColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: "无缺勤人员 🎉" }}
            />
          </>
        ) : (
          <p className="text-gray-400">请选择一场培训查看详细统计</p>
        )}
      </Card>

      {/* Department comparison */}
      <Card title="部门出勤率对比" className="mb-4">
        <Table
          dataSource={deptComparison}
          columns={deptColumns}
          rowKey="name"
          pagination={false}
          locale={{ emptyText: "暂无数据" }}
        />
      </Card>

      {/* Personal attendance history */}
      <Card title="个人出勤档案">
        <div className="mb-4">
          <Select
            placeholder="搜索员工查看出勤历史"
            showSearch
            style={{ width: 300 }}
            value={empSearchId}
            onChange={handleEmployeeSearch}
            allowClear
            filterOption={false}
            onSearch={searchEmployees}
            options={employees.map((e) => ({
              label: `${e.name} (${e.employeeNo})`,
              value: e.id,
            }))}
          />
        </div>

        {empHistory && (
          <div>
            <p className="mb-2">
              <strong>{(empHistory.employee as Record<string, unknown>)?.name as string}</strong>{" "}
              ({(empHistory.employee as Record<string, unknown>)?.employeeNo as string}) -
              {(empHistory.employee as Record<string, unknown>)?.department as string}
            </p>
            <Row gutter={16} className="mb-4">
              <Col span={6}>
                <Statistic title="参加培训总数" value={(empHistory.summary as Record<string, number>).total} />
              </Col>
              <Col span={6}>
                <Statistic title="出勤次数" value={(empHistory.summary as Record<string, number>).attended} valueStyle={{ color: "#52c41a" }} />
              </Col>
              <Col span={6}>
                <Statistic title="缺勤次数" value={(empHistory.summary as Record<string, number>).absent} valueStyle={{ color: "#ff4d4f" }} />
              </Col>
              <Col span={6}>
                <Statistic title="出勤率" value={(empHistory.summary as Record<string, unknown>).rate as string} valueStyle={{ color: "#722ed1" }} />
              </Col>
            </Row>

            <Table
              dataSource={empHistory.records as Record<string, unknown>[]}
              columns={historyColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
