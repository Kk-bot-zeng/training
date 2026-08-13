"use client";

import { useEffect } from "react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const key = "training-page-recovery";
    const lastReload = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - lastReload > 30_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  }, []);

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ textAlign: "center" }}>
      <h2>页面需要重新加载</h2>
      <p style={{ color: "#64748b" }}>系统已更新或网络刚刚中断，请刷新后继续使用。</p>
      <button onClick={() => window.location.reload()} style={{ marginRight: 10 }}>刷新页面</button>
      <button onClick={reset}>重新尝试</button>
    </div>
  </main>;
}
