"use client";

import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    void fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, url: location.href }) }).catch(() => undefined);
    if (!new URL(location.href).searchParams.has("_fresh")) {
      window.location.replace(`/api/recover?next=${encodeURIComponent(location.pathname + location.search)}`);
    }
  }, [error]);

  return <html lang="zh-CN"><body style={{ margin: 0 }}>
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h2>页面版本已更新</h2>
        <p style={{ color: "#64748b" }}>刷新后即可继续使用，已填写的数据不会被服务器删除。</p>
        <button onClick={() => window.location.replace(`/api/recover?next=${encodeURIComponent(location.pathname + location.search)}`)}>刷新页面</button>
      </div>
    </main>
  </body></html>;
}
