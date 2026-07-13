"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Button, Avatar, Dropdown, Breadcrumb, ConfigProvider } from "antd";
import {
  DashboardOutlined, ApartmentOutlined, TeamOutlined, BookOutlined,
  CheckCircleOutlined, BarChartOutlined, LogoutOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, UserOutlined, HomeOutlined, FolderOpenOutlined,
  EditOutlined, FileTextOutlined,
} from "@ant-design/icons";

const { Sider, Content } = Layout;

const menuItems = [
  { type: "group", label: "主菜单", children: [
    { key: "/admin", icon: <DashboardOutlined />, label: "数据概览" },
  ]},
  { type: "group", label: "基础数据", children: [
    { key: "/admin/departments", icon: <ApartmentOutlined />, label: "部门管理" },
    { key: "/admin/employees", icon: <TeamOutlined />, label: "员工管理" },
  ]},
  { type: "group", label: "培训考勤", children: [
    { key: "/admin/trainings", icon: <BookOutlined />, label: "培训管理" },
    { key: "/admin/attendance", icon: <CheckCircleOutlined />, label: "考勤记录" },
  ]},
  { type: "group", label: "数据分析", children: [
    { key: "/admin/statistics", icon: <BarChartOutlined />, label: "统计分析" },
  ]},
  { type: "group", label: "培训档案", children: [
    { key: "/admin/training-records", icon: <FolderOpenOutlined />, label: "培训档案" },
  ]},
  { type: "group", label: "考试管理", children: [
    { key: "/admin/questions", icon: <EditOutlined />, label: "题库管理" },
    { key: "/admin/exam-papers", icon: <FileTextOutlined />, label: "试卷管理" },
  ]},
];

const breadcrumbMap: Record<string, string> = {
  "/admin": "数据概览",
  "/admin/departments": "部门管理",
  "/admin/employees": "员工管理",
  "/admin/trainings": "培训管理",
  "/admin/trainings/create": "创建培训",
  "/admin/attendance": "考勤记录",
  "/admin/statistics": "统计分析",
  "/admin/training-records": "培训档案",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUsername(u.name);
        if (u.role !== "admin") router.push("/login");
        return;
      } catch {}
    }
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.data));
        setUsername(data.data.username);
      } else router.push("/login");
    }).catch(() => router.push("/login"));
  }, [router]);

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  };

  const selectedKey = menuItems
    .flatMap(g => (g as { children?: { key: string }[] }).children || [])
    .find(item => pathname === item.key)?.key || "/admin";

  // Breadcrumb
  const breadcrumbItems: { title: React.ReactNode; href?: string }[] = [
    { title: <HomeOutlined />, href: "/admin" },
  ];
  if (pathname !== "/admin") {
    const base = breadcrumbMap[pathname];
    const basePath = "/" + pathname.split("/").slice(1, 3).join("/");
    const baseLabel = breadcrumbMap[basePath];
    if (baseLabel && basePath !== pathname) {
      breadcrumbItems.push({ title: baseLabel, href: basePath });
      breadcrumbItems.push({ title: breadcrumbMap[pathname] || "详情" });
    } else if (base) {
      breadcrumbItems.push({ title: base });
    } else if (pathname.startsWith("/admin/trainings/")) {
      breadcrumbItems.push({ title: "培训管理", href: "/admin/trainings" });
      breadcrumbItems.push({ title: pathname.endsWith("/qr") ? "二维码" : "培训详情" });
    }
  }

  return (
    <ConfigProvider theme={{ token: {
      colorPrimary: "#25c9a5", borderRadius: 12, colorText: "#153247",
      colorBgLayout: "#edf3f5", colorBorderSecondary: "#e1e9ed",
    }, components: { Menu: {
      darkItemBg: "transparent", darkItemSelectedBg: "rgba(52,213,177,0.14)",
      darkItemSelectedColor: "#42debb", darkItemColor: "#87a5b8",
      darkItemHoverBg: "rgba(255,255,255,0.05)", darkGroupTitleColor: "#52748b",
    }}}}>
      <Layout className="admin-shell" style={{ minHeight: "100vh", overflow: "hidden" }}>
        <Sider trigger={null} collapsible collapsed={collapsed} width={240}
          className="ocean-sider" style={{ borderRight: "none" }}>
          <div className="ocean-brand" style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? 0 : "0 24px" }}>
            <div className="ocean-mark">T</div>
            {!collapsed && <div><span className="ocean-brand-name">雷鸟培训</span><small>LEARNING HUB</small></div>}
          </div>
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems as never}
            onClick={({ key }) => router.push(key)}
            style={{ background: "transparent", borderRight: "none", padding: "8px", fontSize: 14 }} />
        </Sider>

        <Layout className="ocean-workspace">
          <div className="ocean-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 16, color: "#4b5563" }} />
              <Breadcrumb
                items={breadcrumbItems as never}
                style={{ fontSize: 13 }}
              />
            </div>
            <Dropdown menu={{ items: [{ key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true }], onClick: ({ key }) => { if (key === "logout") handleLogout(); } }} placement="bottomRight">
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar size={32} icon={<UserOutlined />} style={{ background: "#e8ecf4", color: "#4b5563" }} />
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{username}</span>
              </div>
            </Dropdown>
          </div>
          <Content className="ocean-content">
            {children}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
