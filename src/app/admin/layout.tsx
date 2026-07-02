"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Button, Avatar, Dropdown, theme, ConfigProvider } from "antd";
import {
  DashboardOutlined,
  ApartmentOutlined,
  TeamOutlined,
  BookOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";

const { Sider, Content } = Layout;

const menuItems = [
  { key: "/admin", icon: <DashboardOutlined />, label: "数据概览" },
  { key: "/admin/departments", icon: <ApartmentOutlined />, label: "部门管理" },
  { key: "/admin/employees", icon: <TeamOutlined />, label: "员工管理" },
  { key: "/admin/trainings", icon: <BookOutlined />, label: "培训管理" },
  { key: "/admin/attendance", icon: <CheckCircleOutlined />, label: "考勤记录" },
  { key: "/admin/statistics", icon: <BarChartOutlined />, label: "统计分析" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUsername(data.data.username);
        else router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  };

  const selectedKey = menuItems.find((item) => pathname === item.key)?.key || "/admin";

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            darkItemBg: "transparent",
            darkItemSelectedBg: "rgba(99, 132, 255, 0.15)",
            darkItemSelectedColor: "#6384ff",
            darkItemColor: "rgba(255,255,255,0.65)",
            darkItemHoverBg: "rgba(255,255,255,0.04)",
          },
        },
      }}
    >
      <Layout style={{ minHeight: "100vh", overflow: "hidden" }}>
        {/* 侧边栏 */}
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={240}
          style={{
            background: "linear-gradient(180deg, #0d1a32 0%, #132044 100%)",
            borderRight: "none",
          }}
        >
          {/* Logo区 */}
          <div
            style={{
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              padding: collapsed ? 0 : "0 24px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #6384ff, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              T
            </div>
            {!collapsed && (
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" }}>
                培训考勤
              </span>
            )}
          </div>

          {/* 菜单 */}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => router.push(key)}
            style={{
              background: "transparent",
              borderRight: "none",
              padding: "12px 8px",
              fontSize: 14,
            }}
          />
        </Sider>

        {/* 右侧内容区 */}
        <Layout style={{ background: "#f0f2f5" }}>
          {/* 顶部导航 */}
          <div
            style={{
              height: 56,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, color: "#4b5563" }}
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: "退出登录",
                    danger: true,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === "logout") handleLogout();
                },
              }}
              placement="bottomRight"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar size={32} icon={<UserOutlined />} style={{ background: "#e8ecf4", color: "#4b5563" }} />
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{username}</span>
              </div>
            </Dropdown>
          </div>

          {/* 页面内容 - 全屏无滚动 */}
          <Content style={{ padding: 24, overflow: "auto", height: "calc(100vh - 56px)" }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
