import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

export const metadata: Metadata = {
  title: "雷鸟培训系统",
  description: "部门培训考勤管理与统计分析系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
