"use client";

/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Card, Radio, Checkbox, Input, Tag, Modal, Progress, message, Spin } from "antd";
import { ClockCircleOutlined, WarningOutlined } from "@ant-design/icons";

const typeLabels: Record<string, string> = { single: "单选题", multi: "多选题", judge: "判断题", essay: "问答题" };
const MAX_SCREEN_SWITCHES = 3;

export default function ExamTakingPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  const [paper, setPaper] = useState<Record<string, unknown> | null>(null);
  const [attempt, setAttempt] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [markedQuestions, setMarkedQuestions] = useState<Record<number, boolean>>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [switchCount, setSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const submittingRef = useRef(false);
  const answersRef = useRef<Record<number, string>>({});
  const attemptIdRef = useRef<number | null>(null);
  const lastSavedAnswersRef = useRef("");
  const saveInFlightRef = useRef(false);

  // Load paper and start attempt
  useEffect(() => {
    const init = async () => {
      try {
        const paperRes = await fetch(`/api/papers/${paperId}`);
        const paperData = await paperRes.json();
        if (!paperData.success) { message.error(paperData.message || "试卷当前不可用"); router.push("/portal/exams"); return; }
        setPaper(paperData.data);

        // Start or resume attempt
        const attRes = await fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId: parseInt(paperId) }) });
        const attData = await attRes.json();
        if (attData.success) {
          setAttempt(attData.data);
          attemptIdRef.current = Number(attData.data.id);
          setSwitchCount(Number(attData.data.screenSwitches) || 0);
          const elapsed = Math.max(0, Math.floor((Date.now() - new Date(attData.data.startTime).getTime()) / 1000));
          setTimeLeft(Math.max(1, paperData.data.duration * 60 - elapsed));
          if (attData.data.answers) {
            try {
              const prev = JSON.parse(attData.data.answers as string);
              const map: Record<number, string> = {};
              for (const a of prev) map[a.questionId] = a.userAnswer;
              setAnswers(map);
              answersRef.current = map;
              lastSavedAnswersRef.current = JSON.stringify(map);
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

  useEffect(() => { answersRef.current = answers; }, [answers]);

  const autosaveAnswers = useCallback(async (keepalive = false) => {
    const attemptId = attemptIdRef.current;
    if (!attemptId || submittingRef.current || saveInFlightRef.current) return;
    const snapshot = JSON.stringify(answersRef.current);
    if (snapshot === lastSavedAnswersRef.current) return;
    saveInFlightRef.current = true;
    try {
      const answerList = Object.entries(answersRef.current).map(([questionId, userAnswer]) => ({ questionId: Number(questionId), userAnswer }));
      const response = await fetch("/api/attempts", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, keepalive,
        body: JSON.stringify({ action: "autosave", attemptId, answers: answerList }),
      });
      const data = await response.json();
      if (data.success) { lastSavedAnswersRef.current = snapshot; setLastSavedAt(new Date()); }
    } catch {
      // Keep the dirty snapshot; the next interval or screen switch will retry it.
    } finally { saveInFlightRef.current = false; }
  }, []);

  useEffect(() => {
    if (!attempt?.id) return;
    const timer = window.setInterval(() => { void autosaveAnswers(); }, 10_000);
    const handlePageHide = () => { void autosaveAnswers(true); };
    window.addEventListener("pagehide", handlePageHide);
    return () => { window.clearInterval(timer); window.removeEventListener("pagehide", handlePageHide); };
  }, [attempt?.id, autosaveAnswers]);

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

  const handleSubmit = useCallback(async (auto = false, recordedSwitches?: number) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const answerArr = paper ? ((paper.paperQuestions as Record<string, unknown>[]) || []).map(q => ({
        questionId: q.questionId,
        userAnswer: answers[q.questionId as number] || "",
      })) : [];
      let data: { success?: boolean; message?: string } = {};
      for (let retry = 0; retry < 3; retry++) {
        try {
          const res = await fetch("/api/attempts", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId: attempt?.id, answers: answerArr, screenSwitches: recordedSwitches ?? switchCount }),
          });
          data = await res.json();
          if (data.success || res.status < 500) break;
        } catch { data = { success: false, message: "网络连接不稳定" }; }
        await new Promise((resolve) => window.setTimeout(resolve, 800 * (retry + 1)));
      }
      if (data.success) {
        lastSavedAnswersRef.current = JSON.stringify(answers);
        message.success(auto ? "⏰ 时间到，已自动交卷" : "交卷成功！");
        router.push("/portal/scores");
      } else {
        submittingRef.current = false;
        message.error(`${data.message || "提交失败"}，答案仍保留，请再次点击交卷`, 6);
      }
    } catch { submittingRef.current = false; message.error("提交失败，答案仍保留，请再次点击交卷", 6); } finally { setSubmitting(false); }
  }, [submitting, answers, attempt, paper, switchCount, router]);

  // Both desktop window blur and mobile app/background switching count as leaving the exam.
  // The debounce prevents one physical switch from being counted twice by blur + visibilitychange.
  useEffect(() => {
    if (!attempt?.id || submittingRef.current) return;
    let lastRecordedAt = 0;
    let recording = false;
    const recordSwitch = async () => {
      const now = Date.now();
      if (recording || submittingRef.current || now - lastRecordedAt < 800) return;
      lastRecordedAt = now;
      recording = true;
      try {
        const response = await fetch("/api/attempts", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: attempt.id, answers: Object.entries(answersRef.current).map(([questionId, userAnswer]) => ({ questionId: Number(questionId), userAnswer })) }),
          keepalive: true,
        });
        const data = await response.json();
        if (!data.success) return;
        const count = Number(data.data.screenSwitches) || 0;
        setSwitchCount(count);
        setShowWarning(count > 0 && count < MAX_SCREEN_SWITCHES);
        if (count >= MAX_SCREEN_SWITCHES) {
          message.error(`切屏已达 ${MAX_SCREEN_SWITCHES} 次，系统正在自动交卷`);
          await handleSubmit(true, count);
        }
      } finally { recording = false; }
    };
    const handleVisibility = () => { if (document.hidden) void recordSwitch(); };
    const handleBlur = () => { if (!document.hidden) void recordSwitch(); };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [attempt?.id, handleSubmit]);

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
    <div style={{ width: "100%", margin: "0 auto" }}>
      {/* Header Bar */}
      <div className="exam-taking-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: 12, padding: "12px 20px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{paper.title as string}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: timeLeft < 300 ? "#ef4444" : "#374151" }}>
            <ClockCircleOutlined /><span style={{ fontWeight: 700, fontSize: 18, fontFamily: "monospace" }}>{formatTime(timeLeft)}</span>
          </div>
          {lastSavedAt && <span style={{ color: "#94a3b8", fontSize: 12 }}>已自动保存 {lastSavedAt.toLocaleTimeString("zh-CN", { hour12: false })}</span>}
          <Button danger type="primary" onClick={() => { Modal.confirm({ title: "确认交卷？", content: `已答 ${answeredCount}/${questions.length} 题，未答题目计0分`, onOk: () => handleSubmit(false) }); }}
            style={{ borderRadius: 8 }} loading={submitting}>交卷</Button>
        </div>
      </div>

      {showWarning && (
        <div style={{ background: "#fef3c7", padding: "8px 16px", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <WarningOutlined style={{ color: "#d97706" }} /> 你已切屏 {switchCount} 次，再切屏 {MAX_SCREEN_SWITCHES - switchCount} 次将自动交卷
        </div>
      )}

      <div className="exam-taking-layout" style={{ display: "flex", gap: 16 }}>
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
            <Button onClick={() => setMarkedQuestions((previous) => ({ ...previous, [q?.id as number]: !previous[q?.id as number] }))}
              style={{ borderRadius: 10 }}>{markedQuestions[q?.id as number] ? "取消标记" : "⏺ 标记"}</Button>
            <Button type="primary" onClick={() => currentIdx < questions.length - 1 ? setCurrentIdx(prev => prev + 1) : handleSubmit(false)}
              style={{ borderRadius: 10 }}>{currentIdx < questions.length - 1 ? "下一题" : "完成交卷"}</Button>
          </div>
        </div>

        {/* Answer Card Sidebar */}
        <div className="exam-answer-sidebar" style={{ width: 220, flexShrink: 0 }}>
          <Card size="small" title="答题卡" style={{ borderRadius: 12, position: "sticky", top: 80 }}>
            <Progress percent={Math.round((answeredCount / questions.length) * 100)} size="small" style={{ marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {questions.map((pq, i) => {
                const qid = pq.questionId as number;
                const ans = answers[qid];
                const isAnswered = Boolean(ans?.trim());
                const isMarked = Boolean(markedQuestions[qid]);
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
