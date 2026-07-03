"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Avatar, Dropdown, ConfigProvider } from "antd";
import { DashboardOutlined, BookOutlined, CheckCircleOutlined, EditOutlined, BarChartOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";

const { Sider, Content } = Layout;

const menuItems = [
  { key: "/portal", icon: <DashboardOutlined />, label: "首页" },
  { key: "/portal/exams", icon: <EditOutlined />, label: "我的考试" },
  { key: "/portal/trainings", icon: <BookOutlined />, label: "我的培训" },
  { key: "/portal/attendance", icon: <CheckCircleOutlined />, label: "我的考勤" },
  { key: "/portal/scores", icon: <BarChartOutlined />, label: "成绩记录" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; role: string }>({ name: "", role: "" });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser({ name: u.name, role: u.role });
        if (u.role === "admin") router.push("/admin");
        return;
      } catch {}
    }
    // Fallback: check API
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.data));
        setUser({ name: data.data.username, role: data.data.role });
        if (data.data.role === "admin") router.push("/admin");
      } else router.push("/login");
    }).catch(() => router.push("/login"));
  }, [router]);

  const selectedKey = menuItems.find(m => pathname === m.key || pathname.startsWith(m.key + "/"))?.key || "/portal";

  return (
    <ConfigProvider theme={{ components: { Menu: { darkItemBg: "transparent", darkItemSelectedBg: "rgba(99,132,255,0.15)", darkItemSelectedColor: "#6384ff", darkItemColor: "rgba(255,255,255,0.65)", darkItemHoverBg: "rgba(255,255,255,0.04)" } } }}>
      <Layout style={{ minHeight: "100vh" }}>
        <Sider width={220} style={{ background: "linear-gradient(180deg, #0d1a32 0%, #132044 100%)" }}>
          <div style={{ height: 72, display: "flex", alignItems: "center", padding: "0 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6384ff, #8b5cf6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>T</div>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>学员中心</span>
          </div>
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems as never}
            onClick={({ key }) => router.push(key)}
            style={{ background: "transparent", padding: "8px" }} />
        </Sider>
        <Layout style={{ background: "#f0f2f5" }}>
          <div style={{ height: 56, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div />
            <Dropdown menu={{ items: [{ key: "logout", icon: <LogoutOutlined />, label: "退出", danger: true }], onClick: () => { document.cookie = "token=; path=/; max-age=0"; router.push("/login"); } }} placement="bottomRight">
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar size={32} icon={<UserOutlined />} style={{ background: "#e8ecf4", color: "#4b5563" }} />
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{user.name}</span>
              </div>
            </Dropdown>
          </div>
          <Content style={{ padding: 24, overflow: "auto", height: "calc(100vh - 56px)" }}>{children}</Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
