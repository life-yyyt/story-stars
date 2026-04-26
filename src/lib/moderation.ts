import { ModerationResult } from '@/src/types/domain';

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
    suggestion: '把联系方式删除，保留故事本身的表达。',
  },
  {
    code: 'wechat_contact',
    pattern: /(微信|vx|v信|wechat|加v|v我)/i,
    message: '检测到微信导流相关表达。',
    suggestion: '去掉“加我”“私聊”等导流表达，再重新发布。',
  },
  {
    code: 'qq_contact',
    pattern: /(QQ|企鹅号|群号|扣扣)/i,
    message: '检测到 QQ 或群组导流信息。',
    suggestion: '删除 QQ、群号或加群引导后再试。',
  },
  {
    code: 'external_link',
    pattern: /(https?:\/\/|www\.|\.com|\.cn|\.net|短链)/i,
    message: '检测到外部链接或导流地址。',
    suggestion: '第一版不允许外链导流，请移除网址后再发布。',
  },
  {
    code: 'qr_code',
    pattern: /(二维码|扫码|扫码添加|扫我)/i,
    message: '检测到二维码或扫码导流内容。',
    suggestion: '请删除扫码、二维码相关描述。',
  },
  {
    code: 'ad_copy',
    pattern: /(下单|购买|优惠|代理|返佣|引流|推广|店铺|合作请联系|私信领取)/i,
    message: '检测到明显广告或导流文案。',
    suggestion: '让内容回到故事本身，避免带有推广目的的表述。',
  },
];

const suspiciousSignals = [
  '适合所有人',
  '稳赚',
  '副业',
  '轻松月入',
  '资源分享',
  '加我了解',
  '私聊获取',
  '联系我',
  '加入我们',
  '想赚钱',
];

export const moderateDraftLocally = (title: string, body: string): ModerationResult => {
  const text = `${title}\n${body}`.trim();
  const hits = prescreenRules.filter((rule) => rule.pattern.test(text));

  if (hits.length > 0) {
    return {
      status: 'rejected',
      reasonCode: hits[0].code,
      message: hits[0].message,
      suggestion: hits[0].suggestion,
      ruleHits: hits.map((rule) => rule.code),
      llmLabel: 'rules_rejected',
    };
  }

  const suspicionScore = suspiciousSignals.reduce((score, signal) => score + (text.includes(signal) ? 1 : 0), 0);

  if (suspicionScore >= 2) {
    return {
      status: 'rejected',
      reasonCode: 'llm_soft_ad',
      message: '内容里有较明显的软广或导流倾向。',
      suggestion: '减少招募、收益、联系方式和行动号召，让它更像故事而不是推广。',
      llmLabel: 'heuristic_soft_ad',
    };
  }

  return {
    status: 'approved',
    reasonCode: 'approved',
    message: '审核通过。',
    suggestion: '你的故事可以被放进宇宙了。',
    llmLabel: 'heuristic_approved',
  };
};
