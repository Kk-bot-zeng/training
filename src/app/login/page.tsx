"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Form, Input, Button, message, Modal, Radio, Space } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [loginHint, setLoginHint] = useState("");
  const [accountChoices, setAccountChoices] = useState<Array<{ id: number; departmentName: string; employeeNo?: string | null }>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>();
  const [pendingLogin, setPendingLogin] = useState<{ username: string; password: string }>();

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) message.error(error);
  }, []);

  const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15_000) => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = window.setTimeout(() => controller?.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, ...(controller ? { signal: controller.signal } : {}) });
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const onFinish = async (values: { username: string; password: string; employeeId?: number }) => {
    setLoading(true);
    setLoginHint("正在验证账号…");
    try {
      let data: { success?: boolean; code?: string; message?: string; data?: { role?: string; candidates?: Array<{ id: number; departmentName: string; employeeNo?: string | null }> } } = {};
      for (let retry = 0; retry < 2; retry++) {
        try {
          const res = await fetchWithTimeout("/api/auth/login", {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          }, 15_000);
          const responseText = await res.text();
          try { data = JSON.parse(responseText); }
          catch { data = { success: false, message: "服务器响应异常，请稍后重试" }; }
          if (data.success || res.status < 500) break;
        } catch {
          data = { success: false, message: "网络连接超时，请检查网络后重试" };
        }
        if (retry === 0) {
          setLoginHint("网络不稳定，正在自动重试…");
          await new Promise((resolve) => window.setTimeout(resolve, 600));
        }
      }
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.data));
        setLoginHint("登录成功，正在进入系统…");
        let sessionOk = false;
        for (let retry = 0; retry < 3 && !sessionOk; retry++) {
          try {
            const session = await fetchWithTimeout("/api/auth/me", { credentials: "include", cache: "no-store" }, 10_000);
            sessionOk = session.ok;
          } catch {}
          if (!sessionOk) await new Promise((resolve) => window.setTimeout(resolve, 500 * (retry + 1)));
        }
        if (!sessionOk) {
          localStorage.removeItem("user");
          throw new Error("登录状态未保存，请检查浏览器是否允许 Cookie 后重试");
        }
        message.success("登录成功");
        const nextPath = new URLSearchParams(window.location.search).get("next");
        const safeNextPath = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
        window.location.assign(safeNextPath || (data.data?.role === "admin" ? "/admin" : "/portal"));
      } else if (data.code === "ACCOUNT_SELECTION_REQUIRED" && data.data?.candidates?.length) {
        setPendingLogin({ username: values.username, password: values.password });
        setAccountChoices(data.data.candidates);
        setSelectedEmployeeId(data.data.candidates[0].id);
        setLoginHint("");
      } else message.error(data.message || "登录失败");
    } catch (error) { message.error(error instanceof Error ? error.message : "网络错误"); }
    finally { setLoading(false); setLoginHint((current) => current.startsWith("登录成功") ? current : ""); }
  };

  return (
    <div className="ocean-login">
      <section className="login-brand-panel">
        <Image src="/ffalcon-logo.png" alt="FFALCON 雷鸟" width={220} height={54} priority />
        <div className="login-brand-copy">
          <span>FFALCON LEARNING CENTER</span>
          <h1>让每一次学习<br />都驱动组织进化</h1>
          <p>培训 · 考勤 · 考试 · 作业，一体化数字学习管理平台</p>
        </div>
        <div className="login-brand-orbit" />
      </section>

      <div className="ocean-login-card">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image className="login-mobile-logo" src="/ffalcon-logo.png" alt="FFALCON 雷鸟" width={170} height={42} priority />
          <h1>欢迎登录</h1>
          <p className="login-subtitle">雷鸟培训管理系统</p>
        </div>

        <Form onFinish={onFinish} action="/api/auth/login/browser" method="post" size="large" layout="vertical">
          <input type="hidden" name="next" value="" />
          <Form.Item name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input name="username" prefix={<UserOutlined style={{ color: "#9ca3af" }} />} placeholder="姓名 / 工号 / 管理员账号"
              style={{ borderRadius: 10, height: 48 }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password name="password" prefix={<LockOutlined style={{ color: "#9ca3af" }} />} placeholder="密码"
              style={{ borderRadius: 10, height: 48 }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} className="login-submit">
              {loading ? "正在登录" : "登 录"}
            </Button>
            {loginHint && <div style={{ textAlign: "center", marginTop: 10, color: "#64748b", fontSize: 13 }}>{loginHint}</div>}
          </Form.Item>
        </Form>

        <p className="login-footer">
          FFALCON LEARNING HUB · 2026
        </p>
      </div>

      <Modal
        title="请选择所属部门"
        open={accountChoices.length > 0}
        okText="确认登录"
        cancelText="取消"
        confirmLoading={loading}
        onCancel={() => { setAccountChoices([]); setPendingLogin(undefined); }}
        onOk={() => pendingLogin && selectedEmployeeId && onFinish({ ...pendingLogin, employeeId: selectedEmployeeId })}
      >
        <p style={{ color: "#64748b" }}>系统检测到多个同名账号，请选择本次登录使用的部门。</p>
        <Radio.Group value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
          <Space direction="vertical">
            {accountChoices.map((choice) => (
              <Radio key={choice.id} value={choice.id}>
                {choice.departmentName}{choice.employeeNo ? `（工号：${choice.employeeNo}）` : ""}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </Modal>
    </div>
  );
}
