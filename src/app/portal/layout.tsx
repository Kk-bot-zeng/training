"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  ConfigProvider,
  Drawer,
  Button,
} from "antd";
import {
  DashboardOutlined,
  BookOutlined,
  CheckCircleOutlined,
  EditOutlined,
  BarChartOutlined,
  LogoutOutlined,
  UserOutlined,
  FormOutlined,
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
  { key: "/portal", icon: <DashboardOutlined />, label: "首页" },
  { key: "/portal/exams", icon: <EditOutlined />, label: "我的考试" },
  { key: "/portal/trainings", icon: <BookOutlined />, label: "学习资料" },
  {
    key: "/portal/learning-progress",
    icon: <BookOutlined />,
    label: "我的学习进度",
  },
  { key: "/portal/assignments", icon: <FormOutlined />, label: "我的作业" },
  {
    key: "/portal/attendance",
    icon: <CheckCircleOutlined />,
    label: "我的考勤",
  },
  { key: "/portal/scores", icon: <BarChartOutlined />, label: "成绩记录" },
  {
    key: "/portal/catcher-plan",
    icon: <FormOutlined />,
    label: "捕手计划 · 问题反馈",
  },
  {
    key: "/portal/scenario-training",
    icon: <EditOutlined />,
    label: "场景演练",
  },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ name: string; role: string }>({
    name: "",
    role: "",
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const fastMenuItems = menuItems.map((item) => ({
    ...item,
    label: <FastNavLink href={item.key}>{item.label}</FastNavLink>,
  }));

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    localStorage.removeItem("user");
    window.location.assign("/login");
  };

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          localStorage.setItem("user", JSON.stringify(data.data));
          setUser({ name: data.data.username, role: data.data.role });
          if (data.data.role === "admin") window.location.assign("/admin");
        } else window.location.assign("/login");
      })
      .catch(() => window.location.assign("/login"));
  }, []);

  // Match longest key first so /portal/exams wins over /portal
  const selectedKey =
    [...menuItems]
      .sort((a, b) => b.key.length - a.key.length)
      .find((m) => pathname === m.key || pathname.startsWith(m.key + "/"))
      ?.key || "/portal";

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#173ec8",
          borderRadius: 10,
          colorText: "#17213a",
          colorBgLayout: "#f4f6fb",
        },
        components: {
          Menu: {
            darkItemBg: "transparent",
            darkItemSelectedBg: "#edf2ff",
            darkItemSelectedColor: "#173ec8",
            darkItemColor: "#53617d",
            darkItemHoverBg: "#f5f7fc",
          },
        },
      }}
    >
      <Layout className="portal-shell" style={{ minHeight: "100vh" }}>
        <Sider width={220} className="ocean-sider desktop-sider">
          <div className="ocean-brand" style={{ padding: "0 22px" }}>
            <Image
              className="brand-logo"
              src="/ffalcon-logo.png"
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
            style={{ background: "transparent", padding: "8px" }}
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
            <Button
              className="mobile-menu-button"
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="打开导航菜单"
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: "退出",
                    danger: true,
                  },
                ],
                onClick: handleLogout,
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
                  {user.name}
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
