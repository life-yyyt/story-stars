const DAILY_STORY_LIMIT_MESSAGE = '今天最多发布 3 颗星星，明天再来。';

const hasChinese = (value: string) => /[\u4e00-\u9fff]/.test(value);

export const getUserFacingErrorMessage = (error: unknown, fallback = '操作失败，请稍后再试。') => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized.includes('DAILY_STORY_LIMIT_REACHED')) {
    return DAILY_STORY_LIMIT_MESSAGE;
  }

  if (lower.includes('anonymous sign-ins are disabled')) {
    return '匿名发布身份还没有开启，请先在 Supabase Auth 中启用匿名登录。';
  }

  if (lower.includes('phone') && lower.includes('already')) {
    return '这个手机号已经被使用，请换一个手机号。';
  }

  if (lower.includes('phone') && (lower.includes('provider') || lower.includes('disabled'))) {
    return '手机号登录还没有开启，请先在 Supabase Auth 中启用 Phone 登录。';
  }

  if (lower.includes('phone') && (lower.includes('invalid') || lower.includes('format'))) {
    return '手机号格式不正确，请输入 11 位手机号，或使用 +86 开头的国际格式。';
  }

  if (
    (lower.includes('sms') || lower.includes('phone')) &&
    (lower.includes('send') || lower.includes('delivery') || lower.includes('channel'))
  ) {
    return '手机号验证码没有发送成功，请确认 Supabase 已开启 Phone 登录并配置短信服务。';
  }

  if (lower.includes('user not found') || lower.includes('not registered')) {
    return '没有找到这个手机号保护的星星。';
  }

  if (
    lower.includes('token') &&
    (lower.includes('expired') || lower.includes('invalid') || lower.includes('not found'))
  ) {
    return '验证码无效或已过期，请重新获取。';
  }

  if (lower.includes('could not find the table') || lower.includes('public.stories')) {
    return '云端数据库还没有完成初始化，请先执行最新 Supabase SQL。';
  }

  if (lower.includes('could not find the function') || lower.includes('schema cache')) {
    return '云端数据库函数还没有完成初始化，请先执行最新 Supabase SQL。';
  }

  if (lower.includes('column reference') && lower.includes('ambiguous')) {
    return '云端数据库函数需要更新，请执行最新 SQL 后再试。';
  }

  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return '当前身份没有权限执行这个操作。';
  }

  if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
    return '网络连接不稳定，请稍后再试。';
  }

  if (lower.includes('jwt') && lower.includes('expired')) {
    return '登录状态已过期，请重新打开 App 后再试。';
  }

  if (lower.includes('duplicate key') && lower.includes('coordinate')) {
    return '坐标生成发生冲突，请再试一次。';
  }

  if (lower.includes('null value') || lower.includes('not-null')) {
    return '故事数据不完整，请检查后再发布。';
  }

  if (hasChinese(normalized) && normalized.length <= 120) {
    return normalized;
  }

  return fallback;
};
