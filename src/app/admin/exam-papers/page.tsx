"use client";

import { useEffect, useState } from "react";
import { Table, Button, Drawer, Form, Input, Select, Switch, InputNumber, DatePicker, Space, Tag, message, Popconfirm, Card, Row, Col, Modal, Statistic } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, BarChartOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const typeLabels: Record<string, string> = { timed: "定时考试", practice: "模拟练习" };

type AttemptDetail = {
  questionId: number;
  questionNo: number;
  content: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
};

type ResultAttempt = {
  id: number;
  score: number | null;
  totalScore: number;
  endTime: string;
  wrongCount: number;
  details: AttemptDetail[];
};

type LearnerResult = {
  employeeId: number;
  name: string;
  employeeNo: string;
  department: string;
  attemptCount: number;
  bestScore: number;
  latestScore: number;
  attempts: ResultAttempt[];
};

export default function ExamPapersPage() {
  const [papers, setPapers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Record<string, unknown>[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsData, setResultsData] = useState<{ paper: Record<string, unknown>; summary: { learnerCount: number; attemptCount: number }; results: LearnerResult[] } | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<ResultAttempt | null>(null);
  const [form] = Form.useForm();
  const selectedQuestionIds: number[] = Form.useWatch("questionIds", form) || [];

  const fetchPapers = async () => {
    setLoading(true);
    const res = await fetch("/api/papers");
    const data = await res.json();
    if (data.success) setPapers(data.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPapers();
    fetch("/api/questions?pageSize=500")
      .then((res) => res.json())
      .then((data) => { if (data.success) setQuestions(data.data.items); });
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const body = {
        ...values,
        questions: (values.questionIds || []).map((questionId: number) => ({
          questionId,
          score: Number(questions.find((question) => question.id === questionId)?.score) || 2,
        })),
        startTime: values.startTime?.toISOString(),
        endTime: values.endTime?.toISOString(),
      };
      const url = editingPaper ? `/api/papers/${editingPaper.id}` : "/api/papers";
      const method = editingPaper ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { message.success(editingPaper ? "更新成功" : "创建成功"); setDrawerOpen(false); form.resetFields(); setEditingPaper(null); fetchPapers(); }
      else message.error(data.message);
    } catch {} finally { setSubmitting(false); }
  };

  const handlePublish = async (id: number) => {
    const res = await fetch(`/api/papers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "published" }) });
    const data = await res.json();
    if (data.success) { message.success("考试已发布！学员端可见"); fetchPapers(); }
    else message.error(data.message || "发布失败");
  };

  const handleEdit = async (paper: Record<string, unknown>) => {
    const res = await fetch(`/api/papers/${paper.id}`);
    const data = await res.json();
    if (!data.success) return message.error(data.message || "加载试卷失败");
    const detail = data.data;
    setEditingPaper(detail);
    form.setFieldsValue({
      ...detail,
      questionIds: detail.paperQuestions.map((item: { questionId: number }) => item.questionId),
      startTime: detail.startTime ? dayjs(detail.startTime) : null,
      endTime: detail.endTime ? dayjs(detail.endTime) : null,
    });
    setDrawerOpen(true);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/papers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { message.success("删除成功"); fetchPapers(); }
    else message.error(data.message || "删除失败");
  };

  const handleResults = async (paper: Record<string, unknown>) => {
    setResultsOpen(true);
    setResultsLoading(true);
    setResultsData(null);
    try {
      const res = await fetch(`/api/papers/${paper.id}/results`);
      const data = await res.json();
      if (data.success) setResultsData(data.data);
      else message.error(data.message || "获取成绩失败");
    } finally {
      setResultsLoading(false);
    }
  };

  const columns = [
    { title: "试卷标题", dataIndex: "title", key: "title", ellipsis: true },
    { title: "类型", dataIndex: "type", key: "type", render: (t: string) => <Tag color={t === "timed" ? "blue" : "green"}>{typeLabels[t]}</Tag> },
    { title: "时长", dataIndex: "duration", key: "duration", render: (d: number) => `${d}分钟` },
    { title: "及格分", dataIndex: "passScore", key: "passScore" },
    { title: "总题数", key: "qCount", render: (_: unknown, r: Record<string, unknown>) => (r._count as { paperQuestions: number })?.paperQuestions || 0 },
    { title: "状态", dataIndex: "status", key: "status", render: (s: string) => <Tag color={s === "published" ? "green" : s === "draft" ? "default" : "red"}>{s === "published" ? "已发布" : s === "draft" ? "草稿" : "已关闭"}</Tag> },
    { title: "操作", key: "actions", render: (_: unknown, r: Record<string, unknown>) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleResults(r)}><BarChartOutlined /> 成绩</Button>
          <Button type="link" size="small" onClick={() => handleEdit(r)}><EditOutlined /> 编辑</Button>
          {r.status === "draft" && <Button type="link" size="small" onClick={() => handlePublish(r.id as number)}><SendOutlined /> 发布</Button>}
          <Popconfirm title="确定删除？该试卷的考试记录也会删除。" onConfirm={() => handleDelete(r.id as number)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )},
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>试卷管理</h1>
          <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>创建和管理考试试卷，发布后学员端可见</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingPaper(null); form.resetFields(); setDrawerOpen(true); }}
          style={{ borderRadius: 10, fontWeight: 500 }}>创建试卷</Button>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "4px 0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Table dataSource={papers} columns={columns} rowKey="id" loading={loading}
          pagination={{ pageSize: 20 }} locale={{ emptyText: "暂无试卷" }} size="middle" />
      </div>

      <Drawer title={editingPaper ? "编辑试卷" : "创建试卷"} open={drawerOpen} width={560}
        onClose={() => { setDrawerOpen(false); form.resetFields(); setEditingPaper(null); }}
        extra={<Button type="primary" loading={submitting} onClick={handleSubmit} style={{ borderRadius: 10 }}>保存</Button>}>
        <Form form={form} layout="vertical" preserve={false} initialValues={{ type: "timed", duration: 60, passScore: 60, totalScore: 100, shuffleQuestions: true, shuffleOptions: true, maxSwitch: 3, allowRetake: false }}>
          <Form.Item name="title" label="试卷标题" rules={[{ required: true }]}><Input placeholder="如：2026年Q3产品知识考核" /></Form.Item>
          <Form.Item name="description" label="考试说明"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="type" label="类型"><Select options={[{ label: "定时考试", value: "timed" }, { label: "模拟练习", value: "practice" }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="duration" label="时长(分钟)"><InputNumber min={1} max={300} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="passScore" label="及格分数"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="totalScore" label="总分"><InputNumber min={1} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="startTime" label="开始时间"><DatePicker showTime style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="endTime" label="结束时间"><DatePicker showTime style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Form.Item name="questionIds" label="选择题目" rules={[{ required: true, message: "请至少选择一道题目" }]}
            help={`已选择题目的分值合计：${selectedQuestionIds.reduce((sum, id) => sum + (Number(questions.find((q) => q.id === id)?.score) || 2), 0)} 分`}>
            <Select mode="multiple" showSearch optionFilterProp="label" placeholder="从题库中选择题目"
              options={questions.map((question) => ({
                value: question.id as number,
                label: `[${question.category}] ${question.content}（${question.score}分）`,
              }))} />
          </Form.Item>
          <Card size="small" title="考试设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="shuffleQuestions" label="随机排序" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col span={8}><Form.Item name="shuffleOptions" label="选项乱序" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col span={8}><Form.Item name="allowRetake" label="允许重复考试" valuePropName="checked" tooltip="开启后学员可反复练习；关闭后每名学员只能提交一次"><Switch /></Form.Item></Col>
            </Row>
            <Form.Item name="maxSwitch" label="切屏次数上限（超过强制交卷）"><InputNumber min={1} max={20} /></Form.Item>
          </Card>
        </Form>
      </Drawer>

      <Drawer title={resultsData ? `${resultsData.paper.title} · 成绩分析` : "成绩分析"}
        open={resultsOpen} width="88vw" loading={resultsLoading}
        onClose={() => { setResultsOpen(false); setSelectedAttempt(null); }}>
        {resultsData && (
          <>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={6}><Card><Statistic title="参考学员" value={resultsData.summary.learnerCount} suffix="人" /></Card></Col>
              <Col span={6}><Card><Statistic title="完成次数" value={resultsData.summary.attemptCount} suffix="次" /></Card></Col>
              <Col span={6}><Card><Statistic title="试卷总分" value={resultsData.paper.totalScore as number} suffix="分" /></Card></Col>
              <Col span={6}><Card><Statistic title="及格分" value={resultsData.paper.passScore as number} suffix="分" /></Card></Col>
            </Row>
            <Table<LearnerResult> dataSource={resultsData.results} rowKey="employeeId"
              locale={{ emptyText: "暂无学员提交记录" }}
              columns={[
                { title: "学员", dataIndex: "name", key: "name" },
                { title: "工号", dataIndex: "employeeNo", key: "employeeNo" },
                { title: "部门", dataIndex: "department", key: "department" },
                { title: "考试/练习次数", dataIndex: "attemptCount", key: "attemptCount", render: (count: number) => `${count} 次` },
                { title: "最好成绩", dataIndex: "bestScore", key: "bestScore", render: (score: number) => `${score} 分` },
                { title: "最近成绩", dataIndex: "latestScore", key: "latestScore", render: (score: number) => `${score} 分` },
              ]}
              expandable={{
                expandedRowRender: (learner) => (
                  <Table<ResultAttempt> dataSource={learner.attempts} rowKey="id" pagination={false} size="small"
                    columns={[
                      { title: "次数", key: "index", render: (_value, _record, index) => `第 ${learner.attempts.length - index} 次` },
                      { title: "成绩", key: "score", render: (_value, attempt) => `${attempt.score ?? 0} / ${attempt.totalScore}` },
                      { title: "错题数", dataIndex: "wrongCount", key: "wrongCount", render: (count: number) => <Tag color={count ? "red" : "green"}>{count} 题</Tag> },
                      { title: "提交时间", dataIndex: "endTime", key: "endTime", render: (time: string) => dayjs(time).format("YYYY-MM-DD HH:mm:ss") },
                      { title: "答题详情", key: "detail", render: (_value, attempt) => <Button type="link" onClick={() => setSelectedAttempt(attempt)}>查看每道题</Button> },
                    ]} />
                ),
              }} />
          </>
        )}
      </Drawer>

      <Modal title="答题详情" open={Boolean(selectedAttempt)} width={900} footer={null}
        onCancel={() => setSelectedAttempt(null)}>
        <Table<AttemptDetail> dataSource={selectedAttempt?.details || []} rowKey="questionId" pagination={false} scroll={{ y: 520 }}
          columns={[
            { title: "题号", dataIndex: "questionNo", key: "questionNo", width: 70 },
            { title: "题目", dataIndex: "content", key: "content", ellipsis: true },
            { title: "学员答案", dataIndex: "userAnswer", key: "userAnswer", render: (answer: string) => answer || "未作答" },
            { title: "正确答案", dataIndex: "correctAnswer", key: "correctAnswer" },
            { title: "结果", dataIndex: "isCorrect", key: "isCorrect", width: 90, render: (correct: boolean | null) => correct === null ? <Tag>待批改</Tag> : <Tag color={correct ? "green" : "red"}>{correct ? "正确" : "错误"}</Tag> },
            { title: "得分", key: "score", width: 90, render: (_value, detail) => `${detail.score}/${detail.maxScore}` },
          ]} />
      </Modal>
    </div>
  );
}
