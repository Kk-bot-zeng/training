"use client";

import { useEffect } from "react";

export default function GlobalError() {
  useEffect(() => {
    const key = "training-global-recovery";
    const lastReload = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - lastReload > 30_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  }, []);

  return <html lang="zh-CN"><body style={{ margin: 0 }}>
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h2>页面版本已更新</h2>
        <p style={{ color: "#64748b" }}>刷新后即可继续使用，已填写的数据不会被服务器删除。</p>
        <button onClick={() => window.location.reload()}>刷新页面</button>
      </div>
    </main>
  </body></html>;
}
