export default function AdminLoading() {
  return (
    <div
      style={{
        minHeight: 280,
        display: "grid",
        placeItems: "center",
        color: "#64748b",
      }}
    >
      <div>
        <div className="route-loading-spinner" />
        <p>页面加载中…</p>
      </div>
    </div>
  );
}
