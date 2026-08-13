import { NextRequest, NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";
import { callScenarioAi, parseAiJson, scenarioScriptShape } from "@/lib/scenario-ai";

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin(); const body=await request.json();
    const modeLabel:Record<string,string>={product:"商品知识训练",practical:"实战能力进阶",custom:"自定义内容"};
    const prompt=`你是雷鸟电视与显示器零售培训专家。请生成一个可供AI扮演顾客、学员扮演销售的完整文字场景演练剧本。\n生成方式：${modeLabel[body.generationMode]||"自定义内容"}\n产品型号：${body.productModel||"通用"}\n产品资料：${body.productMaterial||"未提供，禁止虚构具体参数"}\n管理员指令：${body.instruction||"训练需求挖掘、产品推荐、异议处理和成交引导"}\n难度：${body.difficulty||"standard"}\n要求5-8个递进节点，客户要像真人一样根据学员回答动态追问；评分权重合计100。\n【最高优先级事实约束】产品参数、价格、优惠、安装费用、保修范围、退换货政策、门店、电话、平台规则等，只能引用“产品资料”中明确写出的内容。资料没有写明时，剧本必须要求学员回答“需以官方最新政策/页面/客服确认为准”，严禁补充常识、假设数字、虚构联系方式或具体承诺。${scenarioScriptShape}`;
    const raw=parseAiJson(await callScenarioAi([{role:"user",content:prompt}],true,{maxTokens:2400,temperature:0.2}));
    const result={
      ...raw,
      nodes:Array.isArray(raw.nodes)?raw.nodes.map((node:Record<string,unknown>,index:number)=>({
        name:String(node.name||node.node||`流程节点${index+1}`),
        customerBehavior:String(node.customerBehavior||""),
        learnerGoal:String(node.learnerGoal||""),
        passCondition:String(node.passCondition||""),
        referenceTalking:String(node.referenceTalking||""),
      })):[],
      scoringCriteria:Array.isArray(raw.scoringCriteria)?raw.scoringCriteria:[],
    };
    return NextResponse.json({success:true,data:result});
  } catch(error){ console.error("Generate scenario script error:",error); return NextResponse.json({success:false,message:error instanceof Error?error.message:"AI生成失败"},{status:500}); }
}
