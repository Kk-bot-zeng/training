"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Card, Col, Input, Progress, Result, Row, Space, Spin, Tag, message } from "antd";
import { RobotOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";

export default function ScenarioChat() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<any>();
  const [remaining, setRemaining] = useState<number>();
  const bottom = useRef<HTMLDivElement>(null);
  const load = () => fetch(`/api/scenario/sessions/${id}`, { cache: "no-store" }).then(r => r.json()).then(d => {
    if (d.success) { setData(d.data); if (d.data.feedback) setResult(d.data.feedback); }
    else message.error(d.message);
  });
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!data?.startedAt || !data?.task?.durationMinutes || result) return;
    const update = () => setRemaining(Math.max(0, data.task.durationMinutes * 60 - Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000)));
    update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer);
  }, [data?.startedAt, data?.task?.durationMinutes, result]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [data?.messages?.length]);
  const send = async () => {
    if (!text.trim() || sending) return;
    const current = text; setText("");
    setData((value: any) => ({ ...value, messages: [...value.messages, { role: "user", content: current, time: new Date().toISOString() }] }));
    setSending(true);
    try {
      const response = await fetch(`/api/scenario/sessions/${id}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: current }) });
      const responseData = await response.json();
      if (!responseData.success) throw new Error(responseData.message);
      await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "发送失败"); await load(); }
    finally { setSending(false); }
  };
  const submit = async () => {
    setGrading(true);
    try {
      const responseData = await fetch(`/api/scenario/sessions/${id}/submit`, { method: "POST" }).then(r => r.json());
      if (!responseData.success) throw new Error(responseData.message);
      setResult(responseData.data.feedback);
    } catch (error) { message.error(error instanceof Error ? error.message : "评分失败"); }
    finally { setGrading(false); }
  };
  if (!data) return <div style={{ textAlign: "center", padding: 80 }}><Spin /></div>;
  if (result) return <Card style={{ borderRadius: 18 }}>
    <Result status={result.score >= data.task.passScore ? "success" : "warning"} title={`演练得分：${result.score} 分`} subTitle={result.summary} extra={<Button type="primary" onClick={() => router.push("/portal/scenario-training")}>返回任务列表</Button>} />
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}><Card title="做得好的地方"><ul>{(result.strengths || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Card></Col>
      <Col xs={24} md={12}><Card title="需要改进"><ul>{(result.problems || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Card></Col>
      <Col xs={24} md={12}><Card title="遗漏知识点"><ul>{(result.missedPoints || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Card></Col>
      <Col xs={24} md={12}><Card title="推荐话术"><ul>{(result.betterReplies || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Card></Col>
    </Row>
  </Card>;
  const nodes = data.task.script.nodes || [];
  return <div>
    <Card style={{ borderRadius: 16, marginBottom: 12 }}>
      <Row align="middle" gutter={16}><Col flex="auto"><h2 style={{ margin: 0 }}>{data.task.name}</h2><span style={{ color: "#64748b" }}>AI扮演客户，请像真实销售一样自然沟通</span></Col><Col><Space wrap><Tag color={(remaining||0)<300?"red":"blue"}>剩余 {Math.floor((remaining||0)/60)}:{String((remaining||0)%60).padStart(2,"0")}</Tag><Tag color="blue">第 {Math.min(data.currentNode + 1, nodes.length)}/{nodes.length} 阶段</Tag></Space></Col></Row>
      <Progress percent={nodes.length ? Math.round(data.currentNode / nodes.length * 100) : 0} showInfo={false} />
    </Card>
    <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 16, overflow: "hidden" }}>
      <div style={{ height: "55vh", overflowY: "auto", padding: 16, background: "#f4f7fb" }}>
        {data.messages.map((item: any, index: number) => <div key={index} style={{ display: "flex", justifyContent: item.role === "user" ? "flex-end" : "flex-start", gap: 8, marginBottom: 16 }}>
          {item.role !== "user" && <Avatar icon={<RobotOutlined />} style={{ background: "#1677ff" }} />}
          <div style={{ maxWidth: "78%", background: item.role === "user" ? "#1677ff" : "white", color: item.role === "user" ? "white" : "#1e293b", padding: "11px 14px", borderRadius: 14, boxShadow: "0 1px 3px #0001", whiteSpace: "pre-wrap" }}>{item.content}</div>
          {item.role === "user" && <Avatar icon={<UserOutlined />} />}
        </div>)}
        {sending && <div style={{ color: "#64748b" }}><RobotOutlined /> 客户正在思考…</div>}<div ref={bottom} />
      </div>
      <div style={{ padding: 14, borderTop: "1px solid #e5e7eb" }}>
        <Space.Compact style={{ width: "100%" }}><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => {
          if (event.key !== "Enter" || event.shiftKey) return;
          const nativeEvent = event.nativeEvent as KeyboardEvent;
          if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
          event.preventDefault(); event.stopPropagation(); send();
        }} placeholder="输入你的销售话术，Enter发送，Shift+Enter换行" /><Button type="primary" icon={<SendOutlined />} loading={sending} onClick={send} style={{ height: "auto" }}>发送</Button></Space.Compact>
        <Button block danger loading={grading} onClick={submit} style={{ marginTop: 10 }}>结束演练并生成评分报告</Button>
      </div>
    </Card>
  </div>;
}
