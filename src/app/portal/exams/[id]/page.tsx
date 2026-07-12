"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Card, Radio, Checkbox, Input, Tag, Modal, Progress, message, Spin } from "antd";
import { ClockCircleOutlined, CheckCircleOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const typeLabels: Record<string, string> = { single: "单选题", multi: "多选题", judge: "判断题", essay: "问答题" };

export default function ExamTakingPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  const [paper, setPaper] = useState<Record<string, unknown> | null>(null);
  const [attempt, setAttempt] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [switchCount, setSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load paper and start attempt
  useEffect(() => {
    const init = async () => {
      try {
        const paperRes = await fetch(`/api/papers/${paperId}`);
        const paperData = await paperRes.json();
        if (!paperData.success) { message.error("试卷不存在"); router.push("/portal/exams"); return; }
        setPaper(paperData.data);
        setTimeLeft(paperData.data.duration * 60);

        // Start or resume attempt
        const attRes = await fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId: parseInt(paperId) }) });
        const attData = await attRes.json();
        if (attData.success) {
          setAttempt(attData.data);
          if (attData.data.answers) {
            try {
              const prev = JSON.parse(attData.data.answers as string);
              const map: Record<number, string> = {};
              for (const a of prev) map[a.questionId] = a.userAnswer;
              setAnswers(map);
            } catch {}
          }
        } else {
          message.warning(attData.message || "当前不能参加该考试");
          setPaper(null);
          router.replace("/portal/exams");
        }
      } catch { message.error("加载失败"); } finally { setLoading(false); }
    };
    init();
  }, [paperId, router]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleSubmit(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft > 0]);

  // Screen switch detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setSwitchCount(prev => {
          const next = prev + 1;
          if (paper && next >= (paper.maxSwitch as number)) {
            message.error("切屏次数已达上限，自动交卷");
            handleSubmit(true);
          } else if (paper && next >= (paper.maxSwitch as number) - 1) {
            setShowWarning(true);
          }
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [paper]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const answerArr = paper ? ((paper.paperQuestions as Record<string, unknown>[]) || []).map(q => ({
        questionId: q.questionId,
        userAnswer: answers[q.questionId as number] || "",
      })) : [];
      const res = await fetch("/api/attempts", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt?.id, answers: answerArr, screenSwitches: switchCount }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(auto ? "⏰ 时间到，已自动交卷" : "交卷成功！");
        router.push("/portal/scores");
      } else message.error(data.message);
    } catch { message.error("提交失败"); } finally { setSubmitting(false); }
  }, [submitting, answers, attempt, paper, switchCount, router]);

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  if (!paper) return null;

  const questions = (paper.paperQuestions as Record<string, unknown>[]) || [];
  const currentQ = questions[currentIdx];
  const q = currentQ?.question as Record<string, unknown> | undefined;
  const options: string[] = q?.options ? (() => { try { return JSON.parse(q.options as string); } catch { return []; } })() : [];
  if (q?.type === "judge" && options.length === 0) options.push("正确", "错误");

  const answeredCount = Object.keys(answers).filter(k => answers[parseInt(k)]?.trim()).length;
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: 12, padding: "12px 20px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{paper.title as string}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: timeLeft < 300 ? "#ef4444" : "#374151" }}>
            <ClockCircleOutlined /><span style={{ fontWeight: 700, fontSize: 18, fontFamily: "monospace" }}>{formatTime(timeLeft)}</span>
          </div>
          <Button danger type="primary" onClick={() => { Modal.confirm({ title: "确认交卷？", content: `已答 ${answeredCount}/${questions.length} 题，未答题目计0分`, onOk: () => handleSubmit(false) }); }}
            style={{ borderRadius: 8 }} loading={submitting}>交卷</Button>
        </div>
      </div>

      {showWarning && (
        <div style={{ background: "#fef3c7", padding: "8px 16px", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <WarningOutlined style={{ color: "#d97706" }} /> 你已切换屏幕 {switchCount} 次，再切换 {paper.maxSwitch as number - switchCount} 次将自动交卷
        </div>
      )}

      <div style={{ display: "flex", gap: 16 }}>
        {/* Question Area */}
        <div style={{ flex: 1 }}>
          {q ? (
            <Card style={{ borderRadius: 12 }}>
              <div style={{ marginBottom: 16 }}>
                <Tag color="blue">{typeLabels[q.type as string]}</Tag>
                <Tag>{`${currentQ.score as number}分`}</Tag>
                <span style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>第 {currentIdx + 1}/{questions.length} 题</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 20, lineHeight: 1.6 }}>{q.content as string}</h3>

              {["single", "multi"].includes(q.type as string) && options.length === 0 && (
                <Alert type="error" showIcon message="该题未配置选项，请联系管理员在题库中补充后重新考试" />
              )}

              {q.type === "essay" ? (
                <Input.TextArea rows={6} value={answers[q.id as number] || ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id as number]: e.target.value }))}
                  placeholder="请输入你的答案..." />
              ) : q.type === "multi" ? (
                <Checkbox.Group value={(answers[q.id as number] || "").split(",").filter(Boolean)}
                  onChange={vals => setAnswers(prev => ({ ...prev, [q.id as number]: vals.join(",") }))}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {options.map((opt, i) => <Checkbox key={i} value={String.fromCharCode(65 + i)} style={{ fontSize: 15 }}>{opt}</Checkbox>)}
                  </div>
                </Checkbox.Group>
              ) : (
                <Radio.Group value={answers[q.id as number] || undefined}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id as number]: e.target.value }))}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {options.map((opt, i) => (
                      <Radio key={i} value={q.type === "judge" ? opt : String.fromCharCode(65 + i)} style={{ fontSize: 15 }}>{opt}</Radio>
                    ))}
                  </div>
                </Radio.Group>
              )}
            </Card>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <Button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev - 1)} style={{ borderRadius: 10 }}>上一题</Button>
            <Button onClick={() => setAnswers(prev => ({ ...prev, [q?.id as number]: answers[q?.id as number] ? "" : "__marked__" }))}
              style={{ borderRadius: 10 }}>{answers[q?.id as number] === "__marked__" ? "取消标记" : "⏺ 标记"}</Button>
            <Button type="primary" onClick={() => currentIdx < questions.length - 1 ? setCurrentIdx(prev => prev + 1) : handleSubmit(false)}
              style={{ borderRadius: 10 }}>{currentIdx < questions.length - 1 ? "下一题" : "完成交卷"}</Button>
          </div>
        </div>

        {/* Answer Card Sidebar */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <Card size="small" title="答题卡" style={{ borderRadius: 12, position: "sticky", top: 80 }}>
            <Progress percent={Math.round((answeredCount / questions.length) * 100)} size="small" style={{ marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {questions.map((pq, i) => {
                const qid = pq.questionId as number;
                const ans = answers[qid];
                const isAnswered = ans && ans !== "__marked__";
                const isMarked = ans === "__marked__";
                const isCurrent = i === currentIdx;
                return (
                  <div key={i} onClick={() => setCurrentIdx(i)}
                    style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500,
                      border: isCurrent ? "2px solid #6384ff" : "1px solid #e5e7eb",
                      background: isAnswered ? "#d1fae5" : isMarked ? "#fef3c7" : "#fff",
                      color: isAnswered ? "#059669" : "#374151" }}>
                    {i + 1}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#d1fae5", borderRadius: 3, marginRight: 4 }} />已答
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#fef3c7", borderRadius: 3, margin: "0 4px 0 12px" }} />标记
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 3, margin: "0 4px 0 12px" }} />未答
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
