import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { CosmicBackground } from '@/src/components/ui/cosmic-background';
import { GlassCard } from '@/src/components/ui/glass-card';
import { GlassInput } from '@/src/components/ui/glass-input';
import { PrimaryButton } from '@/src/components/ui/primary-button';
import { SectionHeading } from '@/src/components/ui/section-heading';
import { useAppContext } from '@/src/context/app-context';
import { getUserFacingErrorMessage } from '@/src/lib/error-message';
import { getPhoneTail, normalizePhoneForAuth } from '@/src/lib/phone';
import { productFlags } from '@/src/lib/product-flags';
import { cosmicTheme } from '@/src/lib/theme';

type AuthMode = 'protect' | 'recover';

export default function LoginScreen() {
  const router = useRouter();
  const { loginHint, requestOtp, requestPhoneBinding, session, verifyOtp, verifyPhoneBinding } = useAppContext();
  const canProtectCurrentSession = Boolean(session?.isAnonymous);
  const [mode, setMode] = useState<AuthMode>(canProtectCurrentSession ? 'protect' : 'recover');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(loginHint);
  const isProtected = Boolean(session && !session.isAnonymous);
  const phoneTail = useMemo(() => getPhoneTail(session?.phone), [session?.phone]);
  const activeMode = canProtectCurrentSession ? mode : 'recover';
  const phoneAuthEnabled = productFlags.phoneAuthEnabled;

  const resetCodeStep = (nextMode: AuthMode) => {
    setMode(nextMode);
    setCode('');
    setStep('phone');
    setFeedback(null);
  };

  const onRequestCode = async () => {
    const nextPhone = normalizePhoneForAuth(phone);
    if (!phoneAuthEnabled) {
      setFeedback('手机号找回稍后开放。');
      return;
    }

    if (!nextPhone) {
      setFeedback('请输入手机号。');
      return;
    }

    if (activeMode === 'protect' && !canProtectCurrentSession) {
      setFeedback('请先发布一颗星星，或切换到找回已有星星。');
      return;
    }

    try {
      setSubmitting(true);
      if (activeMode === 'protect') {
        await requestPhoneBinding(nextPhone);
      } else {
        await requestOtp(nextPhone);
      }
      setFeedback('验证码已发送。');
      setStep('code');
    } catch (error) {
      const message = getUserFacingErrorMessage(error, '验证码发送失败，请稍后再试。');
      setFeedback(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    const nextPhone = normalizePhoneForAuth(phone);
    const nextCode = code.trim();
    if (!phoneAuthEnabled) {
      setFeedback('手机号找回稍后开放。');
      return;
    }

    if (!nextCode) {
      setFeedback('请输入验证码。');
      return;
    }

    try {
      setSubmitting(true);
      if (activeMode === 'protect') {
        await verifyPhoneBinding(nextPhone, nextCode);
      } else {
        await verifyOtp(nextPhone, nextCode);
      }

      setFeedback(activeMode === 'protect' ? '已保护。' : '已找回。');
      setTimeout(() => router.back(), 650);
    } catch (error) {
      const message = getUserFacingErrorMessage(error, activeMode === 'protect' ? '绑定失败，请检查验证码后再试。' : '找回失败，请检查验证码后再试。');
      setFeedback(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <CosmicBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <GlassCard style={styles.card}>
            <SectionHeading
              eyebrow={activeMode === 'protect' ? 'Protect' : 'Recover'}
              title={isProtected ? '已保护' : activeMode === 'protect' ? '保护星星' : '找回星星'}
            />

            {isProtected ? (
              <View style={styles.protectedCard}>
                <Text style={styles.protectedTitle}>已保护</Text>
                <Text style={styles.protectedText}>
                  {phoneTail ? `尾号 ${phoneTail}` : '当前身份已绑定'}
                </Text>
              </View>
            ) : !phoneAuthEnabled ? (
              <View style={styles.protectedCard}>
                <Text style={styles.protectedTitle}>稍后开放</Text>
                <Text style={styles.protectedText}>当前版本会保留本机发布身份。手机号找回接入短信服务后再开放。</Text>
              </View>
            ) : (
              <View style={styles.form}>
                {canProtectCurrentSession ? (
                  <View style={styles.modeRow}>
                    <ModeButton
                      active={activeMode === 'protect'}
                      label="保护当前身份"
                      onPress={() => resetCodeStep('protect')}
                    />
                    <ModeButton
                      active={activeMode === 'recover'}
                      label="找回已有星星"
                      onPress={() => resetCodeStep('recover')}
                    />
                  </View>
                ) : null}

                <View style={styles.field}>
                    <Text style={styles.label}>手机号</Text>
                  <GlassInput
                    keyboardType="phone-pad"
                    placeholder="手机号"
                    textContentType="telephoneNumber"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                {step === 'code' ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>验证码</Text>
                    <GlassInput
                      keyboardType="number-pad"
                      placeholder="验证码"
                      textContentType="oneTimeCode"
                      value={code}
                      onChangeText={setCode}
                    />
                  </View>
                ) : null}

                {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
              </View>
            )}

            <View style={styles.actions}>
              {isProtected ? (
                <PrimaryButton label="返回我的星星" onPress={() => router.back()} />
              ) : !phoneAuthEnabled ? (
                <PrimaryButton label="返回我的星星" onPress={() => router.back()} />
              ) : step === 'phone' ? (
                <PrimaryButton
                  label={submitting ? '正在发送...' : '获取验证码'}
                  onPress={() => void onRequestCode()}
                  disabled={submitting}
                />
              ) : (
                <>
                  <PrimaryButton
                    label={submitting ? '正在验证...' : activeMode === 'protect' ? '确认绑定' : '确认找回'}
                    onPress={() => void onVerify()}
                    disabled={submitting}
                  />
                  <PrimaryButton
                    label="重新输入手机号"
                    variant="ghost"
                    onPress={() => {
                      setCode('');
                      setStep('phone');
                    }}
                  />
                </>
              )}
              {!isProtected ? <PrimaryButton label="暂时跳过" variant="ghost" onPress={() => router.back()} /> : null}
            </View>
          </GlassCard>
        </View>
      </SafeAreaView>
    </View>
  );
}

const ModeButton = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
    <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: cosmicTheme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  form: {
    marginTop: 24,
    gap: 16,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.065)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  modeButtonActive: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  modeLabel: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  modeLabelActive: {
    color: cosmicTheme.colors.text,
  },
  field: {
    gap: 10,
  },
  label: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  feedback: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  protectedCard: {
    marginTop: 22,
    borderRadius: cosmicTheme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.075)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 16,
    gap: 6,
  },
  protectedTitle: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 15,
  },
  protectedText: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
});
