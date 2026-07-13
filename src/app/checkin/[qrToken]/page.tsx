"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dayjs from "dayjs";

type Training = {
  title: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
};

type Employee = {
  id: number;
  name: string;
  employeeNo: string;
  departmentName: string;
  checkedIn: boolean;
  status: string | null;
  checkInTime: string | null;
};

export default function CheckinPage() {
  const params = useParams();
  const qrToken = params.qrToken as string;
  const [training, setTraining] = useState<Training | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [needsBinding, setNeedsBinding] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadEmployee = async () => {
    const response = await fetch(`/api/checkin/me?qrToken=${encodeURIComponent(qrToken)}`);
    const data = await response.json();
    if (data.success) {
      setEmployee(data.data);
      setNeedsBinding(false);
    } else if (data.code === "DEVICE_BIND_REQUIRED") {
      setNeedsBinding(true);
    } else {
      setError(data.message || "无法识别签到身份");
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/checkin/info?qrToken=${encodeURIComponent(qrToken)}`);
        const data = await response.json();
        if (!data.success) return setError(data.message || "签到二维码无效");
        setTraining(data.data);
        await loadEmployee();
      } catch {
        setError("网络错误，请重新扫码");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [qrToken]);

  const bindDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/checkin/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, identifier, password }),
      });
      const data = await response.json();
      if (!data.success) return setError(data.message || "绑定失败");
      setEmployee({ ...data.data, checkedIn: false, status: null, checkInTime: null });
      setNeedsBinding(false);
      setPassword("");
      setNotice("当前手机已绑定，90天内扫码无需再次登录");
      await loadEmployee();
    } finally {
      setSubmitting(false);
    }
  };

  const submitCheckin = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/checkin/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const data = await response.json();
      if (!data.success) return setError(data.message || "签到失败");
      setEmployee((current) => current ? { ...current, checkedIn: true, status: data.data.status, checkInTime: data.data.checkInTime } : current);
      setNotice(data.message || "签到成功");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-blue-600 flex items-center justify-center text-white">加载中...</div>;

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-8">
      <div className="mx-auto max-w-md">
        <section className="rounded-3xl bg-white p-6 shadow-xl">
          {training && (
            <>
              <h1 className="text-2xl font-bold text-gray-900">{training.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-500">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-600">{training.type === "exam" ? "考试" : "培训"}</span>
                <span>📅 {dayjs(training.date).format("MM月DD日")}</span>
                <span>🕐 {training.startTime}-{training.endTime}</span>
                {training.location && <span>📍 {training.location}</span>}
              </div>
            </>
          )}

          {error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          {notice && <div className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">✅ {notice}</div>}

          {needsBinding && (
            <form onSubmit={bindDevice} className="mt-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">首次使用，请绑定当前手机</h2>
                <p className="mt-1 text-sm text-gray-500">只需验证一次，之后90天扫码即可签到</p>
              </div>
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)}
                placeholder="姓名或工号" autoComplete="username" required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500" />
              <input value={password} onChange={(event) => setPassword(event.target.value)}
                placeholder="登录密码" type="password" autoComplete="current-password" required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500" />
              <button disabled={submitting} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">
                {submitting ? "验证中..." : "验证并绑定手机"}
              </button>
              <p className="text-center text-xs text-gray-400">存在同名学员时请使用工号；重新绑定会让旧手机失效</p>
            </form>
          )}

          {employee && !needsBinding && (
            <section className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white ${employee.checkedIn ? "bg-green-500" : "bg-blue-500"}`}>
                  {employee.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-gray-900">{employee.name}</div>
                  <div className="text-sm text-gray-500">{employee.employeeNo} · {employee.departmentName}</div>
                </div>
              </div>
              {employee.checkedIn ? (
                <div className="mt-5 rounded-xl bg-green-100 p-4 text-center font-semibold text-green-700">
                  ✅ 已签到 · {employee.status === "late" ? "迟到" : "出席"}
                  {employee.checkInTime && <div className="mt-1 text-sm font-normal">{dayjs(employee.checkInTime).format("HH:mm:ss")}</div>}
                </div>
              ) : (
                <button onClick={submitCheckin} disabled={submitting}
                  className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">
                  {submitting ? "签到中..." : "确认本人签到"}
                </button>
              )}
            </section>
          )}
        </section>
        <p className="mt-4 text-center text-xs text-blue-100">动态二维码 · 单设备绑定 · 签到记录可追溯</p>
      </div>
    </main>
  );
}
