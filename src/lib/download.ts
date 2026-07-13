export async function downloadFile(url: string, fallbackName: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    let message = "导出失败";
    try { message = (await response.json()).message || message; } catch {}
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename = utf8Name ? decodeURIComponent(utf8Name) : fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
