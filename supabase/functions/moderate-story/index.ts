import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  heuristicFallbackModeration,
  ModerationPayload,
  ModerationResponse,
  runPrescreen,
} from './_shared/moderation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const logModeration = async (
  userId: string | null,
  payload: ModerationPayload,
  result: ModerationResponse
) => {
  if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return;
  }

  await supabaseAdmin.from('moderation_logs').insert({
    user_id: userId,
    draft_title: payload.title,
    draft_body: payload.body,
    target_visibility: 'public',
    rule_hit_codes: result.ruleHits ?? [],
    llm_label: result.llmLabel ?? null,
    final_status: result.status,
    message: result.message,
  });
};

const normalizeModerationResponse = (value: unknown): ModerationResponse | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<ModerationResponse>;
  if (record.status !== 'approved' && record.status !== 'rejected') {
    return null;
  }

  return {
    status: record.status,
    reasonCode: record.reasonCode || (record.status === 'approved' ? 'approved' : 'llm_rejected'),
    message: record.message || (record.status === 'approved' ? '审核通过。' : '内容暂时无法发布。'),
    suggestion: record.suggestion || '请调整后再试。',
    llmLabel: record.llmLabel || 'openai_review',
  };
};

const runOpenAiModeration = async (payload: ModerationPayload): Promise<ModerationResponse> => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.4-mini';

  if (!apiKey) {
    return heuristicFallbackModeration(payload);
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            '你是内容审核助手。只判断用户故事是否包含明显广告、导流、联系方式、二维码、外链或违法违规内容。返回严格 JSON，不要返回 Markdown。',
        },
        {
          role: 'user',
          content: `标题：${payload.title}\n正文：${payload.body}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'story_moderation',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              status: {
                type: 'string',
                enum: ['approved', 'rejected'],
              },
              reasonCode: { type: 'string' },
              message: { type: 'string' },
              suggestion: { type: 'string' },
              llmLabel: { type: 'string' },
            },
            required: ['status', 'reasonCode', 'message', 'suggestion', 'llmLabel'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    return heuristicFallbackModeration(payload);
  }

  const data = await response.json();
  const raw = data.output_text ?? '{}';

  try {
    return normalizeModerationResponse(JSON.parse(raw)) ?? heuristicFallbackModeration(payload);
  } catch {
    return heuristicFallbackModeration(payload);
  }
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as ModerationPayload & { userId?: string };

    if (!body.title?.trim() || !body.body?.trim()) {
      return new Response(JSON.stringify({ message: '标题和正文不能为空。' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      title: body.title.trim(),
      body: body.body.trim(),
    };

    const prescreen = runPrescreen(payload);
    if (prescreen) {
      await logModeration(body.userId ?? null, payload, prescreen);
      return new Response(JSON.stringify(prescreen), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await runOpenAiModeration(payload);
    await logModeration(body.userId ?? null, payload, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'rejected',
        reasonCode: 'moderation_error',
        message: '审核服务暂时不可用。',
        suggestion: '请稍后再试。',
        error: error instanceof Error ? error.message : 'unknown',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
