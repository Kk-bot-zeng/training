"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.data));
        message.success("登录成功");
        router.push(data.data.role === "admin" ? "/admin" : "/portal");
      }
      else message.error(data.message || "登录失败");
    } catch { message.error("网络错误"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0d1a32 0%, #132044 40%, #1a2744 100%)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* 背景装饰 */}
      <div style={{ position: "absolute", top: -120, right: -80, width: 400, height: 400, borderRadius: "50%", background: "rgba(99,132,255,0.08)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -60, width: 300, height: 300, borderRadius: "50%", background: "rgba(139,92,246,0.06)", pointerEvents: "none" }} />

      <div style={{
        background: "#fff",
        borderRadius: 20,
        padding: "48px 40px",
        width: 400,
        maxWidth: "90vw",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "linear-gradient(135deg, #6384ff, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 700, color: "#fff", margin: "0 auto 16px",
          }}>
            T
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2937", margin: 0 }}>雷鸟培训系统</h1>
        </div>

        <Form onFinish={onFinish} size="large" layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined style={{ color: "#9ca3af" }} />} placeholder="用户名"
              style={{ borderRadius: 10, height: 48 }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined style={{ color: "#9ca3af" }} />} placeholder="密码"
              style={{ borderRadius: 10, height: 48 }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading}
              style={{
                width: "100%", height: 48, borderRadius: 10, fontSize: 15, fontWeight: 600,
                background: "linear-gradient(135deg, #6384ff, #764ba2)", border: "none",
              }}>
              登 录
            </Button>
          </Form.Item>
        </Form>

        <p style={{ textAlign: "center", color: "#d1d5db", fontSize: 12, marginTop: 24 }}>
          Powered by Training System
        </p>
      </div>
    </div>
  );
}
