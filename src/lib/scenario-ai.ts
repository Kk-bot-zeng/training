type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callScenarioAi(messages: AiMessage[], json = false) {
  const apiKey = process.env.TURING_API_KEY;
  if (!apiKey) throw new Error("AI服务尚未配置");
  const baseUrl = (process.env.TURING_BASE_URL || "https://live-turing.cn.llm.tcljd.com/api/v1").replace(/\/$/, "");
  const model = process.env.TURING_MODEL || "deepseek-v4-flash";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.35, max_tokens: 5000, ...(json ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || data?.message || "AI服务调用失败");
  return String(data?.choices?.[0]?.message?.content || "").trim();
}

export function parseAiJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI没有返回有效结构");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export const scenarioScriptShape = `只输出JSON：{"name":"剧本名称","customerProfile":"客户身份、场景、显性需求、隐藏需求、预算、性格","trainingGoal":"训练目标","forbiddenRules":"禁止错误承诺和敏感话术","openingMessage":"AI客户第一句话","nodes":[{"name":"节点名称","customerBehavior":"该阶段客户表现与可动态追问","learnerGoal":"学员需完成的目标","passCondition":"进入下一节点的判断条件","referenceTalking":"参考优秀话术"}],"scoringCriteria":[{"name":"评分项","weight":数字,"description":"评分标准"}]}`;
