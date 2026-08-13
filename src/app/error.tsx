"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, url: location.href }) }).catch(() => undefined);
    const url = new URL(window.location.href);
    const recoveries = Number(url.searchParams.get("_recover") || 0);
    if (recoveries < 2) {
      url.searchParams.set("_recover", String(recoveries + 1));
      url.searchParams.set("_ts", String(Date.now()));
      window.location.replace(url.toString());
    }
  }, [error]);

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ textAlign: "center" }}>
      <h2>页面需要重新加载</h2>
      <p style={{ color: "#64748b" }}>系统已更新或网络刚刚中断，请刷新后继续使用。</p>
      <button onClick={() => { const url = new URL(window.location.href); url.searchParams.set("_ts", String(Date.now())); window.location.replace(url.toString()); }} style={{ marginRight: 10 }}>刷新页面</button>
      <button onClick={reset}>重新尝试</button>
    </div>
  </main>;
}
