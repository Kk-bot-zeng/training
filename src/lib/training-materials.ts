export type TrainingMaterial = { name?: string; url: string; type?: string };

const EMPTY_MARKERS = new Set(["无", "暂无", "没有", "未上传", "无课件", "无录屏", "-", "--", "/", "null", "undefined"]);

export function validResourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || EMPTY_MARKERS.has(url.toLowerCase())) return null;
  return /^(https?:\/\/|\/)/i.test(url) ? url : null;
}

export function normalizeTrainingMaterials(value: unknown): TrainingMaterial[] {
  let items: unknown = value;
  if (typeof value === "string") {
    try { items = JSON.parse(value); } catch { items = []; }
  }
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const source = item as { name?: unknown; url?: unknown; type?: unknown };
    const url = validResourceUrl(source.url);
    if (!url) return [];
    const name = typeof source.name === "string" && source.name.trim() ? source.name.trim() : `课件${index + 1}`;
    const type = typeof source.type === "string" ? source.type.trim() : undefined;
    return [{ name, url, ...(type ? { type } : {}) }];
  });
}
