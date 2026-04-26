export interface ModerationPayload {
  title: string;
  body: string;
}

export interface ModerationResponse {
  status: 'approved' | 'rejected';
  reasonCode: string;
  message: string;
  suggestion: string;
  ruleHits?: string[];
  llmLabel?: string;
}

interface PrescreenRule {
  code: string;
  pattern: RegExp;
  message: string;
  suggestion: string;
}

const prescreenRules: PrescreenRule[] = [
  {
    code: 'phone_contact',
    pattern: /1[3-9]\d{9}/,
    message: '检测到手机号或类似联系方式。',
    suggestion: '删除联系方式，只保留故事内容后再提交。',
  },
  {
    code: 'wechat_contact',
    pattern: /(微信|vx|v信|wechat|加v|v我)/i,
    message: '检测到微信导流相关表达。',
    suggestion: '去掉“加我”“私聊”等导流表达。',
  },
  {
    code: 'qq_contact',
    pattern: /(QQ|扣扣|群号|企鹅号)/i,
    message: '检测到 QQ 或群组导流信息。',
    suggestion: '删除 QQ、群号或加群引导后再试。',
  },
  {
    code: 'external_link',
    pattern: /(https?:\/\/|www\.|\.com|\.cn|\.net|短链)/i,
    message: '检测到外部链接或网址导流。',
    suggestion: '第一版不允许外链导流，请移除网址。',
  },
  {
    code: 'qr_code',
    pattern: /(二维码|扫码|扫我|扫码添加)/i,
    message: '检测到二维码或扫码导流内容。',
    suggestion: '删除二维码、扫码等相关描述。',
  },
  {
    code: 'ad_copy',
    pattern: /(下单|购买|返佣|代理|引流|推广|优惠|合作请联系|店铺)/i,
    message: '检测到明显广告或推广文案。',
    suggestion: '把内容改成单纯的故事表达，不要带推广目的。',
  },
];

const softAdSignals = [
  '加我了解',
  '联系我',
  '私聊获取',
  '资源分享',
  '副业',
  '想赚钱',
  '加入我们',
  '轻松月入',
  '适合宝妈',
];

export const runPrescreen = ({ title, body }: ModerationPayload): ModerationResponse | null => {
  const text = `${title}\n${body}`.trim();
  const hits = prescreenRules.filter((rule) => rule.pattern.test(text));

  if (hits.length === 0) {
    return null;
  }

  return {
    status: 'rejected',
    reasonCode: hits[0].code,
    message: hits[0].message,
    suggestion: hits[0].suggestion,
    ruleHits: hits.map((rule) => rule.code),
    llmLabel: 'rules_rejected',
  };
};

export const heuristicFallbackModeration = ({ title, body }: ModerationPayload): ModerationResponse => {
  const text = `${title}\n${body}`.trim();
  const score = softAdSignals.reduce((sum, signal) => sum + (text.includes(signal) ? 1 : 0), 0);

  if (score >= 2) {
    return {
      status: 'rejected',
      reasonCode: 'llm_soft_ad',
      message: '内容里有较明显的软广或导流倾向。',
      suggestion: '减少收益承诺、招募和行动号召，让它更像故事本身。',
      llmLabel: 'heuristic_soft_ad',
    };
  }

  return {
    status: 'approved',
    reasonCode: 'approved',
    message: '审核通过。',
    suggestion: '你的故事可以进入宇宙。',
    llmLabel: 'heuristic_approved',
  };
};
