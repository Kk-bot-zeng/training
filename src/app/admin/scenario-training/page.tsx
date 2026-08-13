"use client";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Tree,
  Descriptions,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

type Group = { id: number; name: string; _count?: { scripts: number } };
type Script = {
  id: number;
  groupId?: number;
  name: string;
  generationMode: string;
  productModel?: string;
  productMaterial?: string;
  customerProfile: string;
  trainingGoal: string;
  forbiddenRules?: string;
  openingMessage: string;
  nodes: Array<Record<string, string>>;
  scoringCriteria: Array<Record<string, string | number>>;
  difficulty: string;
  status: string;
};
export default function ScenarioAdmin() {
  const [tab, setTab] = useState("scripts"),
    [groups, setGroups] = useState<Group[]>([]),
    [scripts, setScripts] = useState<Script[]>([]),
    [tasks, setTasks] = useState<Record<string, unknown>[]>([]),
    [employees, setEmployees] = useState<
      Array<{
        id: number;
        name: string;
        employeeNo?: string;
        department: { name: string };
      }>
    >([]),
    [scriptOpen, setScriptOpen] = useState(false),
    [taskOpen, setTaskOpen] = useState(false),
    [step, setStep] = useState(0),
    [generating, setGenerating] = useState(false),
    [editing, setEditing] = useState<Script | null>(null),
    [editingTask, setEditingTask] = useState<any>(null),
    [selectedGroup, setSelectedGroup] = useState<string>("all"),
    [resultSession, setResultSession] = useState<any>();
  const [form] = Form.useForm(),
    [taskForm] = Form.useForm();
  const load = async () => {
    const [g, s, t, e] = await Promise.all([
      fetch("/api/scenario/groups").then((r) => r.json()),
      fetch("/api/scenario/scripts").then((r) => r.json()),
      fetch("/api/scenario/tasks").then((r) => r.json()),
      fetch("/api/employees?compact=true&pageSize=100").then((r) => r.json()),
    ]);
    if (g.success) setGroups(g.data);
    if (s.success) setScripts(s.data);
    if (t.success) setTasks(t.data);
    if (e.success) setEmployees(e.data.items);
  };
  useEffect(() => {
    load();
  }, []);
  const addGroup = () =>
    Modal.confirm({
      title: "新建剧本分组",
      content: (
        <Input
          id="scenario-group-name"
          placeholder="如：电视/京东自营/屏幕反光"
        />
      ),
      onOk: async () => {
        const name = (
          document.getElementById("scenario-group-name") as HTMLInputElement
        )?.value;
        const d = await fetch("/api/scenario/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }).then((r) => r.json());
        if (!d.success) throw new Error(d.message);
        load();
      },
    });
  const generate = async () => {
    const v = form.getFieldsValue();
    if (!v.instruction) return message.warning("请填写训练指令");
    setGenerating(true);
    try {
      const d = await fetch("/api/scenario/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      }).then((r) => r.json());
      if (!d.success) throw new Error(d.message);
      form.setFieldsValue(d.data);
      setStep(1);
      message.success("AI剧本已生成，请审核修改");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };
  const saveScript = async () => {
    await form.validateFields(["scoringCriteria", "status"]);
    const v = form.getFieldsValue(true);
    if (!String(v.name || "").trim()) {
      setStep(1);
      return message.error("剧本名称为空，请在模拟咨询流程中填写");
    }
    if (!Array.isArray(v.nodes) || !v.nodes.length) {
      setStep(1);
      return message.error("请至少保留一个模拟咨询流程节点");
    }
    const d = await fetch("/api/scenario/scripts", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...v, id: editing?.id }),
    }).then((r) => r.json());
    if (!d.success) return message.error(d.message);
    message.success("剧本已保存");
    setScriptOpen(false);
    load();
  };
  const nextScriptStep = async () => {
    if (step === 0) {
      await form.validateFields(["instruction"]);
    } else if (step === 1) {
      await form.validateFields(["name"]);
      const v = form.getFieldsValue(true);
      if (!Array.isArray(v.nodes) || !v.nodes.length)
        return message.error("请至少保留一个模拟咨询流程节点");
    }
    setStep(step + 1);
  };
  const openScript = (s?: Script) => {
    setEditing(s || null);
    setStep(s ? 1 : 0);
    form.resetFields();
    form.setFieldsValue(
      s || {
        generationMode: "product",
        difficulty: "standard",
        status: "draft",
        nodes: [],
        scoringCriteria: [],
      },
    );
    setScriptOpen(true);
  };
  const openTask = (task?: any) => {
    setEditingTask(task || null);
    taskForm.resetFields();
    taskForm.setFieldsValue(
      task
        ? {
            name: task.name,
            scriptId: task.scriptId,
            employeeIds: (task.assignments || []).map((a: any) => a.employeeId),
            time:
              task.startTime && task.endTime
                ? [dayjs(task.startTime), dayjs(task.endTime)]
                : undefined,
            durationMinutes: task.durationMinutes,
            maxAttempts: task.maxAttempts,
            passScore: task.passScore,
            allowHints: task.allowHints,
          }
        : {
            durationMinutes: 30,
            maxAttempts: 1,
            passScore: 60,
            allowHints: true,
          },
    );
    setTaskOpen(true);
  };
  const saveTask = async () => {
    const v = await taskForm.validateFields();
    const d = await fetch("/api/scenario/tasks", {
      method: editingTask ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v,
        id: editingTask?.id,
        startTime: v.time?.[0]?.toISOString(),
        endTime: v.time?.[1]?.toISOString(),
      }),
    }).then((r) => r.json());
    if (!d.success) return message.error(d.message);
    message.success(editingTask ? "任务已更新并重新发布" : "任务已发布");
    setTaskOpen(false);
    setEditingTask(null);
    taskForm.resetFields();
    load();
  };
  const deleteScript = async (script: Script) => {
    const d = await fetch("/api/scenario/scripts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [script.id] }),
    }).then((x) => x.json());
    if (!d.success) return message.error(d.message);
    message.success(`剧本“${script.name}”已删除`);
    await load();
  };
  const scriptCols = [
    { title: "剧本名称", dataIndex: "name" },
    {
      title: "分组",
      dataIndex: "groupId",
      render: (v: number) => groups.find((g) => g.id === v)?.name || "未分组",
    },
    {
      title: "生成方式",
      dataIndex: "generationMode",
      render: (v: string) =>
        ({
          product: "商品知识训练",
          practical: "实战能力进阶",
          custom: "自定义内容",
        })[v] || v,
    },
    { title: "难度", dataIndex: "difficulty" },
    {
      title: "状态",
      dataIndex: "status",
      render: (v: string) => (
        <Tag color={v === "published" ? "green" : "default"}>
          {v === "published" ? "已发布" : "草稿"}
        </Tag>
      ),
    },
    {
      title: "操作",
      render: (_: unknown, r: Script) => (
        <Space wrap>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openScript(r)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除剧本？"
            description="关联的演练任务和演练记录也会一并删除，此操作不可恢复。"
            onConfirm={() => deleteScript(r)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除剧本
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const viewResult = async (id: number) => {
    const d = await fetch(`/api/scenario/sessions/${id}`).then((r) => r.json());
    if (d.success) setResultSession(d.data);
    else message.error(d.message);
  };
  const taskCols = [
    { title: "任务名称", dataIndex: "name" },
    { title: "剧本", render: (_: unknown, r: any) => r.script?.name },
    {
      title: "参与人数",
      render: (_: unknown, r: any) => r.assignments?.length || 0,
    },
    {
      title: "完成/通过",
      render: (_: unknown, r: any) =>
        `${(r.sessions || []).filter((s: any) => s.status === "graded").length}/${(r.sessions || []).filter((s: any) => s.score >= r.passScore).length}`,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (v: string) => (
        <Tag color="blue">{v === "published" ? "进行中" : v}</Tag>
      ),
    },
    {
      title: "操作",
      render: (_: unknown, r: any) => (
        <Space wrap>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openTask(r)}
          >
            编辑/重新发布
          </Button>
          {(r.sessions || [])
            .filter((s: any) => s.status === "graded")
            .map((s: any) => (
              <Button key={s.id} type="link" onClick={() => viewResult(s.id)}>
                查看{s.score}分复盘
              </Button>
            ))}
          <Popconfirm
            title="确认删除任务及演练记录？"
            onConfirm={async () => {
              await fetch("/api/scenario/tasks", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [r.id] }),
              });
              load();
            }}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const visibleScripts =
    selectedGroup === "all"
      ? scripts
      : scripts.filter((s) => String(s.groupId) === selectedGroup);
  return (
    <div>
      <Card
        bordered={false}
        style={{
          borderRadius: 18,
          marginBottom: 16,
          background: "linear-gradient(135deg,#102f9d,#2897ed)",
          color: "white",
        }}
      >
        <h1 style={{ color: "white", margin: 0 }}>场景演练</h1>
        <p style={{ margin: "8px 0 0", opacity: 0.86 }}>
          AI生成剧本 · 模拟真实客户 · 动态追问 · 自动评分复盘
        </p>
      </Card>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: "scripts",
            label: "AI剧本",
            children: (
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Card
                    title="剧本分组"
                    extra={
                      <Button
                        type="text"
                        icon={<PlusOutlined />}
                        onClick={addGroup}
                      />
                    }
                  >
                    <Tree
                      defaultExpandAll
                      selectedKeys={[selectedGroup]}
                      onSelect={(keys) => {
                        const key = String(keys[0] || "all");
                        if (!key.startsWith("script-")) setSelectedGroup(key);
                      }}
                      treeData={[
                        {
                          key: "all",
                          title: `全部剧本（${scripts.length}）`,
                          children: [
                            ...groups.map((g) => ({
                              key: String(g.id),
                              title: `${g.name}（${g._count?.scripts || 0}）`,
                              children: scripts
                                .filter((s) => s.groupId === g.id)
                                .map((s) => ({
                                  key: `script-${s.id}`,
                                  title: (
                                    <Space
                                      size={4}
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      <span>{s.name}</span>
                                      <Popconfirm
                                        title="确认删除剧本？"
                                        description="关联任务和演练记录也会删除。"
                                        onConfirm={() => deleteScript(s)}
                                      >
                                        <Button
                                          type="text"
                                          size="small"
                                          danger
                                          aria-label={`删除剧本${s.name}`}
                                          icon={<DeleteOutlined />}
                                        />
                                      </Popconfirm>
                                    </Space>
                                  ),
                                  isLeaf: true,
                                })),
                            })),
                            ...scripts
                              .filter((s) => !s.groupId)
                              .map((s) => ({
                                key: `script-${s.id}`,
                                title: (
                                  <Space
                                    size={4}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <span>{s.name}</span>
                                    <Popconfirm
                                      title="确认删除剧本？"
                                      description="关联任务和演练记录也会删除。"
                                      onConfirm={() => deleteScript(s)}
                                    >
                                      <Button
                                        type="text"
                                        size="small"
                                        danger
                                        aria-label={`删除剧本${s.name}`}
                                        icon={<DeleteOutlined />}
                                      />
                                    </Popconfirm>
                                  </Space>
                                ),
                                isLeaf: true,
                              })),
                          ],
                        },
                      ]}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={18}>
                  <Card
                    extra={
                      <Button
                        type="primary"
                        icon={<RobotOutlined />}
                        onClick={() => openScript()}
                      >
                        新建AI剧本
                      </Button>
                    }
                  >
                    <Table
                      rowKey="id"
                      dataSource={visibleScripts}
                      columns={scriptCols as never}
                      scroll={{ x: 800 }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "tasks",
            label: "演练任务",
            children: (
              <Card
                extra={
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => openTask()}
                  >
                    发布演练任务
                  </Button>
                }
              >
                <Table
                  rowKey="id"
                  dataSource={tasks}
                  columns={taskCols as never}
                  scroll={{ x: 900 }}
                />
              </Card>
            ),
          },
        ]}
      />
      <Drawer
        title={editing ? "编辑AI剧本" : "新建AI剧本"}
        open={scriptOpen}
        onClose={() => setScriptOpen(false)}
        width={760}
        extra={
          <Space>
            {step > 0 && (
              <Button onClick={() => setStep(step - 1)}>上一步</Button>
            )}
            {step < 2 ? (
              <Button type="primary" onClick={nextScriptStep}>
                下一步
              </Button>
            ) : (
              <Button type="primary" onClick={saveScript}>
                保存剧本
              </Button>
            )}
          </Space>
        }
      >
        <Steps
          current={step}
          items={[
            { title: "剧本信息" },
            { title: "模拟咨询流程" },
            { title: "评价标准" },
          ]}
          style={{ marginBottom: 24 }}
        />
        <Form form={form} layout="vertical" preserve>
          {step === 0 && (
            <>
              <Form.Item name="generationMode" label="生成方式">
                <Select
                  options={[
                    { value: "product", label: "商品知识训练" },
                    { value: "practical", label: "实战能力进阶" },
                    { value: "custom", label: "自定义内容" },
                  ]}
                />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="productModel" label="产品型号">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="groupId" label="剧本分组">
                    <Select
                      allowClear
                      options={groups.map((g) => ({
                        value: g.id,
                        label: g.name,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="productMaterial" label="产品资料">
                <Input.TextArea
                  rows={5}
                  placeholder="粘贴一页纸、参数和标准知识；AI只以这里的资料为事实依据"
                />
              </Form.Item>
              <Form.Item
                name="instruction"
                label="训练指令"
                rules={[{ required: true }]}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="例如：模拟顾客咨询防眩光、安装和质保，重点训练需求挖掘及异议处理"
                />
              </Form.Item>
              <Form.Item name="difficulty" label="难度">
                <Select
                  options={[
                    { value: "simple", label: "简单" },
                    { value: "standard", label: "标准" },
                    { value: "hard", label: "困难" },
                  ]}
                />
              </Form.Item>
              <Button
                block
                type="primary"
                loading={generating}
                icon={<RobotOutlined />}
                onClick={generate}
              >
                AI生成完整剧本
              </Button>
            </>
          )}
          {step === 1 && (
            <>
              <Form.Item
                name="name"
                label="剧本名称"
                rules={[{ required: true }]}
                preserve
              >
                <Input />
              </Form.Item>
              <Form.Item name="customerProfile" label="买家需求及背景">
                <Input.TextArea rows={5} />
              </Form.Item>
              <Form.Item name="trainingGoal" label="训练目标">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="forbiddenRules" label="禁止事项">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="openingMessage" label="客户开场白">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.List name="nodes">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((f, i) => (
                      <Card
                        key={f.key}
                        size="small"
                        title={`流程节点 ${i + 1}`}
                        extra={
                          <Button
                            danger
                            type="text"
                            onClick={() => remove(f.name)}
                          >
                            删除
                          </Button>
                        }
                        style={{ marginBottom: 12 }}
                      >
                        <Form.Item
                          {...f}
                          name={[f.name, "name"]}
                          label="节点名称"
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          {...f}
                          name={[f.name, "customerBehavior"]}
                          label="客户表现与追问"
                        >
                          <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item
                          {...f}
                          name={[f.name, "learnerGoal"]}
                          label="学员目标"
                        >
                          <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item
                          {...f}
                          name={[f.name, "passCondition"]}
                          label="通关条件"
                        >
                          <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item
                          {...f}
                          name={[f.name, "referenceTalking"]}
                          label="参考话术"
                        >
                          <Input.TextArea rows={2} />
                        </Form.Item>
                      </Card>
                    ))}
                    <Button block onClick={() => add({})}>
                      添加流程节点
                    </Button>
                  </>
                )}
              </Form.List>
            </>
          )}
          {step === 2 && (
            <>
              <Form.List name="scoringCriteria">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((f, i) => (
                      <Row gutter={8} key={f.key}>
                        <Col span={8}>
                          <Form.Item
                            {...f}
                            name={[f.name, "name"]}
                            label={i === 0 ? "评分项" : ""}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item
                            {...f}
                            name={[f.name, "weight"]}
                            label={i === 0 ? "权重" : ""}
                          >
                            <InputNumber
                              min={1}
                              max={100}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={9}>
                          <Form.Item
                            {...f}
                            name={[f.name, "description"]}
                            label={i === 0 ? "评分标准" : ""}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <Button
                            danger
                            type="text"
                            onClick={() => remove(f.name)}
                          >
                            删
                          </Button>
                        </Col>
                      </Row>
                    ))}
                    <Button block onClick={() => add({ weight: 20 })}>
                      添加评分项
                    </Button>
                  </>
                )}
              </Form.List>
              <Form.Item name="status" label="剧本状态">
                <Select
                  options={[
                    { value: "draft", label: "保存草稿" },
                    { value: "published", label: "发布可用" },
                  ]}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
      <Drawer
        title={editingTask ? "编辑并重新发布演练任务" : "发布演练任务"}
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          setEditingTask(null);
        }}
        width={620}
        extra={
          <Button type="primary" onClick={saveTask}>
            {editingTask ? "保存并重新发布" : "发布"}
          </Button>
        }
      >
        <Form form={taskForm} layout="vertical">
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="scriptId"
            label="选择剧本"
            rules={[{ required: true }]}
          >
            <Select
              options={scripts
                .filter((s) => s.status === "published")
                .map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item
            name="employeeIds"
            label="指定学员"
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.name} · ${e.department.name}${e.employeeNo ? ` · ${e.employeeNo}` : ""}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="time" label="任务有效时间">
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="durationMinutes" label="单次时长(分)">
                <InputNumber min={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxAttempts" label="训练次数">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="passScore" label="合格分">
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="allowHints" label="允许提示" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
      <Modal
        title="学员演练复盘"
        open={Boolean(resultSession)}
        onCancel={() => setResultSession(undefined)}
        footer={null}
        width={760}
      >
        {resultSession && (
          <>
            <Descriptions
              bordered
              size="small"
              items={[
                {
                  key: "employee",
                  label: "学员",
                  children: `${resultSession.employee.name} · ${resultSession.employee.department.name}`,
                },
                {
                  key: "score",
                  label: "得分",
                  children: (
                    <Tag
                      color={
                        resultSession.score >= resultSession.task.passScore
                          ? "green"
                          : "orange"
                      }
                    >
                      {resultSession.score}分
                    </Tag>
                  ),
                },
                {
                  key: "summary",
                  label: "总体评价",
                  span: 2,
                  children: resultSession.feedback?.summary,
                },
              ]}
            />
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card size="small" title="问题">
                  <ul>
                    {(resultSession.feedback?.problems || []).map(
                      (x: string, i: number) => (
                        <li key={i}>{x}</li>
                      ),
                    )}
                  </ul>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="推荐话术">
                  <ul>
                    {(resultSession.feedback?.betterReplies || []).map(
                      (x: string, i: number) => (
                        <li key={i}>{x}</li>
                      ),
                    )}
                  </ul>
                </Card>
              </Col>
            </Row>
            <Card
              size="small"
              title="完整对话"
              style={{ marginTop: 12, maxHeight: 320, overflow: "auto" }}
            >
              {resultSession.messages.map((m: any, i: number) => (
                <p key={i}>
                  <b>{m.role === "user" ? "学员" : "AI客户"}：</b>
                  {m.content}
                </p>
              ))}
            </Card>
          </>
        )}
      </Modal>
    </div>
  );
}
