"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Button, Typography, message } from "antd";
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
} from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: "/admin", icon: <DashboardOutlined />, label: "首页" },
  { key: "/admin/departments", icon: <ApartmentOutlined />, label: "部门管理" },
  { key: "/admin/employees", icon: <TeamOutlined />, label: "员工管理" },
  { key: "/admin/trainings", icon: <BookOutlined />, label: "培训管理" },
  { key: "/admin/attendance", icon: <CheckCircleOutlined />, label: "考勤记录" },
  { key: "/admin/statistics", icon: <BarChartOutlined />, label: "统计分析" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUsername(data.data.username);
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors
    }
    document.cookie = "token=; path=/; max-age=0";
    message.success("已退出登录");
    router.push("/login");
  };

  // Determine selected key based on pathname
  const selectedKey =
    menuItems.find((item) => pathname === item.key)?.key || "/admin";

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={220}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-700">
          <Text
            strong
            className="!text-white text-lg whitespace-nowrap overflow-hidden"
          >
            {collapsed ? "考勤" : "📋 培训考勤系统"}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>

      <Layout>
        <Header className="!bg-white flex items-center justify-between px-4 border-b border-gray-200">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div className="flex items-center gap-3">
            <Text>👤 {username}</Text>
            <Button
              type="text"
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              退出
            </Button>
          </div>
        </Header>

        <Content className="m-4 p-4 bg-white rounded-lg overflow-auto">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
