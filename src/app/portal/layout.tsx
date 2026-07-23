"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Avatar, Dropdown, ConfigProvider, Drawer, Grid, Button } from "antd";
import { DashboardOutlined, BookOutlined, CheckCircleOutlined, EditOutlined, BarChartOutlined, LogoutOutlined, UserOutlined, FormOutlined, MenuOutlined } from "@ant-design/icons";

const { Sider, Content } = Layout;

const menuItems = [
  { key: "/portal", icon: <DashboardOutlined />, label: "首页" },
  { key: "/portal/exams", icon: <EditOutlined />, label: "我的考试" },
  { key: "/portal/trainings", icon: <BookOutlined />, label: "学习资料" },
  { key: "/portal/assignments", icon: <FormOutlined />, label: "我的作业" },
  { key: "/portal/attendance", icon: <CheckCircleOutlined />, label: "我的考勤" },
  { key: "/portal/scores", icon: <BarChartOutlined />, label: "成绩记录" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; role: string }>({ name: "", role: "" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

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

  // Match longest key first so /portal/exams wins over /portal
  const selectedKey = [...menuItems]
    .sort((a, b) => b.key.length - a.key.length)
    .find(m => pathname === m.key || pathname.startsWith(m.key + "/"))?.key || "/portal";

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#25c9a5", borderRadius: 12, colorText: "#153247", colorBgLayout: "#edf3f5" }, components: { Menu: { darkItemBg: "transparent", darkItemSelectedBg: "rgba(52,213,177,0.14)", darkItemSelectedColor: "#42debb", darkItemColor: "#87a5b8", darkItemHoverBg: "rgba(255,255,255,0.05)" } } }}>
      <Layout className="portal-shell" style={{ minHeight: "100vh" }}>
        {!isMobile && <Sider width={220} className="ocean-sider">
          <div className="ocean-brand" style={{ padding: "0 22px" }}>
            <div className="ocean-mark">T</div>
            <div><span className="ocean-brand-name">雷鸟培训</span><small>STUDENT PORTAL</small></div>
          </div>
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems as never}
            onClick={({ key }) => router.push(key)}
            style={{ background: "transparent", padding: "8px" }} />
        </Sider>}
        <Drawer placement="left" width={280} open={isMobile && mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)} styles={{ body: { padding: 0 }, header: { display: "none" } }}
          className="ocean-mobile-drawer">
          <div className="ocean-sider mobile-menu-panel">
            <div className="ocean-brand" style={{ padding: "0 22px" }}>
              <div className="ocean-mark">T</div>
              <div><span className="ocean-brand-name">雷鸟培训</span><small>STUDENT PORTAL</small></div>
            </div>
            <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems as never}
              onClick={({ key }) => { setMobileMenuOpen(false); router.push(key); }}
              style={{ background: "transparent", padding: 8 }} />
          </div>
        </Drawer>
        <Layout className="ocean-workspace">
          <div className="ocean-topbar">
            <Button className="mobile-menu-button" type="text" icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)} aria-label="打开导航菜单" />
            <Dropdown menu={{ items: [{ key: "logout", icon: <LogoutOutlined />, label: "退出", danger: true }], onClick: () => { document.cookie = "token=; path=/; max-age=0"; router.push("/login"); } }} placement="bottomRight">
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar size={32} icon={<UserOutlined />} style={{ background: "#e8ecf4", color: "#4b5563" }} />
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{user.name}</span>
              </div>
            </Dropdown>
          </div>
          <Content className="ocean-content">{children}</Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
