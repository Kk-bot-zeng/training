"use client";

import { useState } from "react";
import Image from "next/image";
import { Form, Input, Button, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      let data: { success?: boolean; message?: string; data?: { role: string } } = {};
      for (let retry = 0; retry < 3; retry++) {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values), signal: AbortSignal.timeout(15_000),
          });
          data = await res.json();
          if (data.success || res.status < 500) break;
        } catch {
          data = { success: false, message: "网络连接不稳定，正在重试" };
        }
        await new Promise((resolve) => window.setTimeout(resolve, 800 * (retry + 1)));
      }
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.data));
        let sessionOk = false;
        for (let retry = 0; retry < 3 && !sessionOk; retry++) {
          try {
            const session = await fetch("/api/auth/me", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10_000) });
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
      }
      else message.error(data.message || "登录失败");
    } catch (error) { message.error(error instanceof Error ? error.message : "网络错误"); }
    finally { setLoading(false); }
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

        <Form onFinish={onFinish} size="large" layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined style={{ color: "#9ca3af" }} />} placeholder="姓名 / 工号 / 管理员账号"
              style={{ borderRadius: 10, height: 48 }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined style={{ color: "#9ca3af" }} />} placeholder="密码"
              style={{ borderRadius: 10, height: 48 }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} className="login-submit">
              登 录
            </Button>
          </Form.Item>
        </Form>

        <p className="login-footer">
          FFALCON LEARNING HUB · 2026
        </p>
      </div>
    </div>
  );
}
