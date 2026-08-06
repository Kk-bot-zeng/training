const GENERAL = "通用";

function compact(value: string) {
  return value.toLowerCase().replace(/[\s\-_·]/g, "");
}

export function inferQuestionModel(text: string, knownModels: string[]) {
  const source = compact(text);
  const known = knownModels
    .filter((model) => model && model !== GENERAL)
    .sort((a, b) => compact(b).length - compact(a).length);
  const matched = known.find((model) => source.includes(compact(model)));
  if (matched) return matched;

  const normalizedText = text.replace(/\s+/g, " ");
  const patterns = [
    /鹤\s*[A-Za-z0-9一二三四五六七八九十]+(?:\s*(?:Pro|Max|Plus))?(?:\s*\d{2,4}\s*款)?/i,
    /(?:鹏|雀|凤)\s*[A-Za-z0-9一二三四五六七八九十]+(?:\s*(?:Pro|Max|Plus))?(?:\s*\d{2,4}\s*款)?/i,
  ];
  for (const pattern of patterns) {
    const value = normalizedText.match(pattern)?.[0]?.trim().replace(/\s+/g, " ");
    if (value) return value;
  }
  return GENERAL;
}

export function questionSearchText(content: unknown, options: unknown, analysis: unknown) {
  const optionText = Array.isArray(options) ? options.join(" ") : typeof options === "string" ? options : "";
  return [content, optionText, analysis].filter(Boolean).join(" ");
}
