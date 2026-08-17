"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Breadcrumb,
  ConfigProvider,
  Drawer,
} from "antd";
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
  HomeOutlined,
  FolderOpenOutlined,
  EditOutlined,
  FileTextOutlined,
  FormOutlined,
  AuditOutlined,
  MenuOutlined,
} from "@ant-design/icons";

const { Sider, Content } = Layout;

function FastNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const prefetch = () => router.prefetch(href);
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      style={{ color: "inherit" }}
    >
      {children}
    </Link>
  );
}

const menuItems = [
  {
    type: "group",
    label: "主菜单",
    children: [
      { key: "/admin", icon: <DashboardOutlined />, label: "数据概览" },
    ],
  },
  {
    type: "group",
    label: "基础数据",
    children: [
      {
        key: "/admin/departments",
        icon: <ApartmentOutlined />,
        label: "部门管理",
      },
      { key: "/admin/employees", icon: <TeamOutlined />, label: "员工管理" },
    ],
  },
  {
    type: "group",
    label: "培训考勤",
    children: [
      { key: "/admin/trainings", icon: <BookOutlined />, label: "培训管理" },
      {
        key: "/admin/attendance",
        icon: <CheckCircleOutlined />,
        label: "考勤记录",
      },
      {
        key: "/admin/passage-records",
        icon: <AuditOutlined />,
        label: "过堂记录",
      },
    ],
  },
  {
    type: "group",
    label: "数据分析",
    children: [
      {
        key: "/admin/statistics",
        icon: <BarChartOutlined />,
        label: "统计分析",
      },
    ],
  },
  {
    type: "group",
    label: "培训档案",
    children: [
      {
        key: "/admin/training-records",
        icon: <FolderOpenOutlined />,
        label: "培训档案",
      },
      {
        key: "/admin/learning-progress",
        icon: <BarChartOutlined />,
        label: "培训进度追踪",
      },
    ],
  },
  {
    type: "group",
    label: "考试管理",
    children: [
      { key: "/admin/questions", icon: <EditOutlined />, label: "题库管理" },
      {
        key: "/admin/exam-papers",
        icon: <FileTextOutlined />,
        label: "试卷管理",
      },
    ],
  },
  {
    type: "group",
    label: "作业管理",
    children: [
      { key: "/admin/assignments", icon: <FormOutlined />, label: "作业管理" },
    ],
  },
  {
    type: "group",
    label: "捕手计划",
    children: [
      {
        key: "/admin/catcher-plan",
        icon: <FileTextOutlined />,
        label: "问答收集和制图",
      },
    ],
  },
  {
    type: "group",
    label: "场景演练",
    children: [
      {
        key: "/admin/scenario-training",
        icon: <FormOutlined />,
        label: "AI场景演练",
      },
    ],
  },
];

const breadcrumbMap: Record<string, string> = {
  "/admin": "数据概览",
  "/admin/departments": "部门管理",
  "/admin/employees": "员工管理",
  "/admin/trainings": "培训管理",
  "/admin/trainings/create": "创建培训",
  "/admin/attendance": "考勤记录",
  "/admin/passage-records": "过堂记录",
  "/admin/statistics": "统计分析",
  "/admin/training-records": "培训档案",
  "/admin/learning-progress": "培训进度追踪",
  "/admin/assignments": "作业管理",
  "/admin/catcher-plan": "问答收集和制图",
  "/admin/scenario-training": "AI场景演练",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          localStorage.setItem("user", JSON.stringify(data.data));
          setUsername(data.data.username);
          if (data.data.role !== "admin") window.location.assign("/portal");
        } else window.location.assign("/login");
      })
      .catch(() => window.location.assign("/login"));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  };

  const fastMenuItems = menuItems.map((group) => ({
    ...group,
    children: group.children?.map((item) => ({
      ...item,
      label: <FastNavLink href={item.key}>{item.label}</FastNavLink>,
    })),
  }));
  const selectedKey =
    menuItems
      .flatMap((g) => (g as { children?: { key: string }[] }).children || [])
      .find((item) => pathname === item.key)?.key || "/admin";

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
      breadcrumbItems.push({
        title: pathname.endsWith("/qr") ? "二维码" : "培训详情",
      });
    }
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#173ec8",
          borderRadius: 10,
          colorText: "#17213a",
          colorBgLayout: "#f4f6fb",
          colorBorderSecondary: "#e7eaf2",
        },
        components: {
          Menu: {
            darkItemBg: "transparent",
            darkItemSelectedBg: "#edf2ff",
            darkItemSelectedColor: "#173ec8",
            darkItemColor: "#53617d",
            darkItemHoverBg: "#f5f7fc",
            darkGroupTitleColor: "#9aa4b8",
          },
        },
      }}
    >
      <Layout
        className="admin-shell"
        style={{ minHeight: "100vh", overflow: "hidden" }}
      >
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={240}
          className="ocean-sider desktop-sider"
          style={{ borderRight: "none" }}
        >
          <div
            className="ocean-brand"
            style={{
              justifyContent: collapsed ? "center" : "flex-start",
              padding: collapsed ? 0 : "0 24px",
            }}
          >
            <Image
              className={collapsed ? "brand-symbol" : "brand-logo"}
              src={
                collapsed ? "/ffalcon-logo-stacked.png" : "/ffalcon-logo.png"
              }
              alt="FFALCON 雷鸟"
              width={174}
              height={42}
              priority
            />
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={fastMenuItems as never}
            style={{
              background: "transparent",
              borderRight: "none",
              padding: "8px",
              fontSize: 14,
            }}
          />
        </Sider>

        <Drawer
          placement="left"
          width={280}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          styles={{ body: { padding: 0 }, header: { display: "none" } }}
          className="ocean-mobile-drawer"
        >
          <div className="ocean-sider mobile-menu-panel">
            <div className="ocean-brand" style={{ padding: "0 22px" }}>
              <Image
                className="brand-logo"
                src="/ffalcon-logo.png"
                alt="FFALCON 雷鸟"
                width={174}
                height={42}
              />
            </div>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={fastMenuItems as never}
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: "transparent", padding: 8 }}
            />
          </div>
        </Drawer>

        <Layout className="ocean-workspace">
          <div className="ocean-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Button
                className="desktop-menu-button"
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: 16, color: "#4b5563" }}
              />
              <Button
                className="mobile-menu-button"
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuOpen(true)}
                aria-label="打开导航菜单"
              />
              <Breadcrumb
                items={breadcrumbItems as never}
                style={{ fontSize: 13 }}
              />
            </div>
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <Avatar
                  size={32}
                  icon={<UserOutlined />}
                  style={{ background: "#e8ecf4", color: "#4b5563" }}
                />
                <span
                  style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}
                >
                  {username}
                </span>
              </div>
            </Dropdown>
          </div>
          <Content className="ocean-content">{children}</Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
