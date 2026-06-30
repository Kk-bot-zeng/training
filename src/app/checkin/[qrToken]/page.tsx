"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dayjs from "dayjs";

interface CheckinEmployee {
  id: number;
  name: string;
  employeeNo: string;
  departmentName: string;
  checkedIn: boolean;
  status: string | null;
  checkInTime: string | null;
}

interface TrainingInfo {
  id: number;
  title: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  status: string;
}

const statusLabelMap: Record<string, string> = {
  present: "出席",
  late: "迟到",
  leave: "请假",
  absent: "缺勤",
};

export default function CheckinPage() {
  const params = useParams();
  const qrToken = params.qrToken as string;

  const [training, setTraining] = useState<TrainingInfo | null>(null);
  const [employees, setEmployees] = useState<CheckinEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingIn, setCheckingIn] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!qrToken) return;
    setLoading(true);
    setError("");

    try {
      const [infoRes, empRes] = await Promise.all([
        fetch(`/api/checkin/info?qrToken=${qrToken}`),
        fetch(`/api/checkin/employees?qrToken=${qrToken}`),
      ]);

      const info = await infoRes.json();
      const emp = await empRes.json();

      if (!info.success) {
        setError(info.message || "培训不存在");
        return;
      }

      setTraining(info.data);

      if (emp.success) {
        setEmployees(emp.data);
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [qrToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckin = async (employeeId: number) => {
    setCheckingIn(employeeId);
    try {
      const res = await fetch("/api/checkin/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, employeeId }),
      });
      const data = await res.json();

      if (data.success) {
        showToast("success", data.message || "签到成功");
        // Update local state
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === employeeId
              ? {
                  ...e,
                  checkedIn: true,
                  status: data.data.status,
                  checkInTime: data.data.checkInTime,
                }
              : e
          )
        );
      } else {
        showToast("error", data.message || "签到失败");
      }
    } catch {
      showToast("error", "网络错误");
    } finally {
      setCheckingIn(null);
    }
  };

  const filteredEmployees = search
    ? employees.filter(
        (e) =>
          e.name.includes(search) || e.employeeNo.includes(search)
      )
    : employees;

  const checkedInCount = employees.filter((e) => e.checkedIn).length;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">无法签到</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!training) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-600">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg text-white text-sm font-medium animate-bounce ${
            toast.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {toast.type === "success" ? "✅ " : "❌ "}
          {toast.message}
        </div>
      )}

      {/* Training Info Header */}
      <div className="bg-white rounded-b-3xl shadow-lg px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold text-gray-800">{training.title}</h1>
        <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-500">
          <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-medium">
            {training.type === "exam" ? "考试" : "培训"}
          </span>
          <span>
            📅 {dayjs(training.date).format("MM月DD日")}
          </span>
          <span>
            🕐 {training.startTime}-{training.endTime}
          </span>
          {training.location && <span>📍 {training.location}</span>}
        </div>

        {/* Check-in progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{
                width: `${employees.length > 0 ? (checkedInCount / employees.length) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-sm font-bold text-gray-600 whitespace-nowrap">
            {checkedInCount}/{employees.length}
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 mt-4">
        <input
          type="text"
          placeholder="🔍 搜索姓名或工号..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-full border-0 shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Employee list */}
      <div className="px-4 mt-3 pb-8">
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              {search ? "未找到匹配的员工" : "暂无可签到的员工"}
            </div>
          ) : (
            filteredEmployees.map((emp, idx) => (
              <div
                key={emp.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  idx !== filteredEmployees.length - 1 ? "border-b border-gray-50" : ""
                } ${emp.checkedIn ? "bg-green-50" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                    emp.checkedIn ? "bg-green-500" : "bg-blue-500"
                  }`}
                >
                  {emp.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">
                    {emp.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {emp.employeeNo} · {emp.departmentName}
                  </p>
                </div>

                {/* Status / Button */}
                {emp.checkedIn ? (
                  <div className="text-right shrink-0">
                    <span className="text-green-600 text-sm font-medium">
                      ✅ {statusLabelMap[emp.status || "present"] || emp.status}
                    </span>
                    {emp.checkInTime && (
                      <p className="text-xs text-gray-400">
                        {dayjs(emp.checkInTime).format("HH:mm")}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckin(emp.id)}
                    disabled={checkingIn === emp.id}
                    className="shrink-0 px-5 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingIn === emp.id ? "签到中..." : "签到"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
