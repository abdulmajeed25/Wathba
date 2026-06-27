import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
  Header,
  Text,
  Card,
  Button,
  Icon,
  Badge,
  ProgressBar,
} from '../../src/ui';
import {
  useProject,
  useRewardTiers,
  useTransparency,
  useProjectUpdates,
  useProjectComments,
  useProjectFaqs,
} from '../../src/data/hooks';
import { fmtSAR, fmtPct, toArabicDigits } from '../../src/data/format';

type TabKey = 'story' | 'transparency' | 'updates' | 'community' | 'faq';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const projectQ = useProject(id);
  const tiersQ = useRewardTiers(id);
  const transparencyQ = useTransparency(id);
  const updatesQ = useProjectUpdates(id);
  const commentsQ = useProjectComments(id);
  const faqsQ = useProjectFaqs(id);
  const [tab, setTab] = useState<TabKey>('story');

  if (!projectQ.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <Header />
        <View style={{ padding: 24 }}>
          <Text tone="muted">جاري التحميل…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const p = projectQ.data;
  const pct = fmtPct(p.raisedHalalas, p.goalHalalas);
  const stretch = p.releaseThresholdPct < 100;
  const thresholdHalalas = Math.round((p.goalHalalas * p.releaseThresholdPct) / 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Breadcrumb + headline */}
        <View style={{ padding: 24, paddingBottom: 12 }}>
          <Pressable
            onPress={() => router.push('/explore')}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 14 }}
          >
            <Icon name="arrow_forward" size={16} color={colors.muted} />
            <Text tone="muted" variant="small">
              استكشف
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 8 }}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
              {p.categoryAr}
            </Text>
            <Text tone="muted2" variant="small">
              · {p.cityAr}
            </Text>
          </View>
          <Text variant="h1" style={{ fontSize: 30, lineHeight: 36, marginBottom: 8 }}>
            {p.titleAr}
          </Text>
          <Text variant="body" tone="textSoft" style={{ fontSize: 15, lineHeight: 24 }}>
            {p.shortDescAr}
          </Text>
        </View>

        {/* Gallery placeholder */}
        <View style={{ marginHorizontal: 24, marginBottom: 16 }}>
          <View
            style={{
              height: 240,
              borderRadius: 20,
              backgroundColor: p.imageAccent ?? colors.phBg,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Icon name="play_circle" size={56} color="rgba(255,255,255,0.85)" />
            <LinearGradient
              colors={['transparent', 'rgba(6,18,31,0.4)']}
              style={{ position: 'absolute', inset: 0, borderRadius: 20 }}
            />
          </View>
        </View>

        {/* Platform-partner banner (mandatory disclosure) */}
        {p.platformPartner && (
          <View style={{ marginHorizontal: 24, marginBottom: 16 }}>
            <Card padding={16} radius={16} style={{ borderColor: '#6d4df055', backgroundColor: 'rgba(109,77,240,0.06)' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Icon name="verified" size={20} color="#6d4df0" />
                <Text style={{ color: '#6d4df0', fontWeight: '700' }}>بشراكة وثبة · Wathba Venture</Text>
              </View>
              <Text tone="textSoft" variant="small">
                {p.platformPartner.disclosureAr}
              </Text>
            </Card>
          </View>
        )}

        {/* Funding sidebar */}
        <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
          <Card padding={22}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <Text num style={{ fontSize: 32, fontWeight: '700' }}>
                {fmtSAR(p.raisedHalalas)}
              </Text>
              <Text
                num
                style={{ fontSize: 17, fontWeight: '700', color: pct >= 100 ? colors.pos : colors.accent }}
              >
                {toArabicDigits(pct)}٪
              </Text>
            </View>
            <Text num tone="muted2" variant="small" style={{ marginBottom: 14 }}>
              من هدف {fmtSAR(p.goalHalalas)}
            </Text>
            <ProgressBar pct={pct / 100} over={pct >= 100} style={{ marginBottom: 18 }} />

            {/* Threshold disclosure — §3 mandatory */}
            {stretch && (
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: 12,
                  borderRadius: 11,
                  backgroundColor: `rgba(${colors.accentRgb},0.07)`,
                  borderWidth: 1,
                  borderColor: `rgba(${colors.accentRgb},0.18)`,
                  marginBottom: 18,
                }}
              >
                <Icon name="tips_and_updates" size={18} color={colors.accent} />
                <Text variant="small" tone="textSoft" style={{ flex: 1, lineHeight: 18 }}>
                  يكفي الوصول لـ <Text num style={{ fontWeight: '700' }}>{fmtSAR(thresholdHalalas)}</Text> ({toArabicDigits(p.releaseThresholdPct)}٪) لإطلاق الإنتاج.
                  المبلغ الأكبر هدف امتداد (Stretch Goal) لميزات إضافية.
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row-reverse', marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text num style={{ fontSize: 22, fontWeight: '700' }}>
                  {toArabicDigits(p.backersCount)}
                </Text>
                <Text tone="muted2" variant="small">
                  داعم
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: `rgba(${colors.inkRgb},0.1)`, marginHorizontal: 12 }} />
              <View style={{ flex: 1 }}>
                <Text num style={{ fontSize: 22, fontWeight: '700' }}>
                  {toArabicDigits(p.daysLeft)}
                </Text>
                <Text tone="muted2" variant="small">
                  يوم متبقٍ
                </Text>
              </View>
            </View>
            <Button
              title="ادعم هذا المشروع"
              full
              size="lg"
              onPress={() => router.push(`/pledge/${p.id}` as never)}
            />
            <View style={{ flexDirection: 'row-reverse', gap: 11, marginTop: 11 }}>
              <Button title="ذكّرني" variant="ghost" iconLeft="notifications" style={{ flex: 1 }} />
              <Button title="شارك" variant="ghost" iconLeft="share" style={{ flex: 1 }} />
            </View>
            <View
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: `rgba(${colors.inkRgb},0.08)`,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <LinearGradient
                colors={colors.grad as unknown as [string, string]}
                style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.onAccent, fontWeight: '700' }}>
                  {p.creator.charAt(0)}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 13.5 }}>{p.creator}</Text>
                <Text tone="muted2" variant="mutedSmall">
                  مشاريع متعددة · مبدع موثّق ✓
                </Text>
              </View>
              <Button title="متابعة" variant="ghost" size="sm" />
            </View>
            <View
              style={{
                marginTop: 14,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: 11,
                backgroundColor: 'rgba(52,211,153,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(52,211,153,0.18)',
              }}
            >
              <Icon name="verified_user" size={16} color={colors.pos} />
              <Text variant="small" tone="textSoft" style={{ flex: 1 }}>
                الكل أو لا شيء — يُموَّل فقط عند بلوغ الهدف.
              </Text>
            </View>
          </Card>
        </View>

        {/* Tabs */}
        <View style={{ marginBottom: 24, paddingHorizontal: 24 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row-reverse', gap: 22 }}
            style={{ borderBottomWidth: 1, borderBottomColor: `rgba(${colors.inkRgb},0.08)` }}
          >
            {[
              { id: 'story', label: 'القصة', icon: 'menu_book' },
              { id: 'transparency', label: 'الشفافية', icon: 'query_stats' },
              { id: 'updates', label: 'التحديثات', icon: 'campaign', badge: updatesQ.data?.length },
              { id: 'community', label: 'المجتمع', icon: 'forum', badge: commentsQ.data?.length },
              { id: 'faq', label: 'الأسئلة', icon: 'help' },
            ].map((t) => {
              const isActive = t.id === tab;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id as TabKey)}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 2,
                    borderBottomColor: isActive ? colors.accent : 'transparent',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <Icon name={t.icon} size={18} color={isActive ? colors.accent : colors.muted} />
                  <Text style={{ color: isActive ? colors.accent : colors.muted, fontWeight: '600' }}>
                    {t.label}
                  </Text>
                  {t.badge !== undefined && t.badge !== null && (
                    <View
                      style={{
                        backgroundColor: `rgba(${colors.inkRgb},0.08)`,
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                        borderRadius: 20,
                      }}
                    >
                      <Text num variant="mutedSmall">
                        {toArabicDigits(t.badge)}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Tab body */}
        <View style={{ paddingHorizontal: 24 }}>
          {tab === 'story' && (
            <View>
              <Text variant="h2" style={{ marginBottom: 14 }}>
                عن المشروع
              </Text>
              <Text variant="body" tone="textSoft" style={{ lineHeight: 28, marginBottom: 18 }}>
                بدأت فكرة المشروع من حاجةٍ بسيطة: أداة يصنعها مبدعون من المنطقة، بمعايير عالمية،
                وبسعرٍ عادل. أمضى الفريق ١٨ شهراً في البحث والتطوير قبل أن يصل إلى هذه النسخة التي
                بين أيديكم اليوم.
              </Text>
              <Text variant="body" tone="textSoft" style={{ lineHeight: 28, marginBottom: 24 }}>
                كل تفصيلة صُمّمت بعناية — من الخامات المستدامة إلى تجربة الاستخدام السلسة. ودعمكم
                اليوم هو ما يحوّل هذا النموذج إلى منتجٍ بين يدي آلاف الأشخاص.
              </Text>
              <View
                style={{
                  height: 220,
                  borderRadius: 16,
                  backgroundColor: colors.phBg,
                  marginBottom: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text num tone="muted2" variant="mutedSmall">
                  [ صورة توضيحية للمنتج ]
                </Text>
              </View>
              <Text variant="h3" style={{ marginBottom: 14 }}>
                لماذا الآن؟
              </Text>
              <Text variant="body" tone="textSoft" style={{ lineHeight: 28 }}>
                لأن المنطقة تزخر بالمواهب التي تستحق منصةً تؤمن بها. ولأن الوقت مثاليٌّ لإطلاق
                منتجٍ يجمع بين الهوية المحلية والطموح العالمي. انضم إلينا في هذه الوثبة.
              </Text>
            </View>
          )}

          {tab === 'transparency' && transparencyQ.data && (
            <View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Icon name="query_stats" size={24} color={colors.pos} />
                <Text variant="h2">لوحة الشفافية الحيّة</Text>
              </View>
              <Text tone="muted" variant="small" style={{ marginBottom: 22 }}>
                نوضّح بالضبط كيف يُنفَق كل ريال تدعمنا به. تُحدَّث هذه اللوحة تلقائياً مع كل مرحلة.
              </Text>
              <Card style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 18 }}>
                  <Text style={{ fontWeight: '600' }}>توزيع الميزانية</Text>
                  <Text num style={{ color: colors.accent }}>
                    {fmtSAR(p.raisedHalalas)}
                  </Text>
                </View>
                {transparencyQ.data.budget.map((b) => (
                  <View key={b.label} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 7 }}>
                      <Text tone="textSoft" variant="small">
                        {b.label}
                      </Text>
                      <Text num tone="muted" variant="small">
                        {toArabicDigits(b.pct)}٪
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 8,
                        borderRadius: 30,
                        backgroundColor: `rgba(${colors.inkRgb},0.06)`,
                        overflow: 'hidden',
                      }}
                    >
                      <View style={{ height: '100%', width: `${b.pct}%`, backgroundColor: b.color, borderRadius: 30 }} />
                    </View>
                  </View>
                ))}
              </Card>
              <Text variant="h3" style={{ marginBottom: 14 }}>
                الجدول الزمني للإنفاق
              </Text>
              <View>
                {transparencyQ.data.timeline.map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          borderWidth: 3,
                          borderColor: colors.accent,
                          backgroundColor: colors.bg,
                        }}
                      />
                      {i < transparencyQ.data.timeline.length - 1 && (
                        <View
                          style={{
                            width: 2,
                            flex: 1,
                            backgroundColor: `rgba(${colors.inkRgb},0.1)`,
                            marginTop: 2,
                            minHeight: 40,
                          }}
                        />
                      )}
                    </View>
                    <Card
                      style={{
                        flex: 1,
                        flexDirection: 'row-reverse',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      padding={14}
                    >
                      <View>
                        <Text style={{ fontWeight: '600', fontSize: 14 }}>{t.label}</Text>
                        <Text num tone="muted2" variant="mutedSmall" style={{ marginTop: 2 }}>
                          {t.date}
                        </Text>
                      </View>
                      <Text num style={{ color: colors.accent, fontWeight: '700' }}>
                        {t.amount}
                      </Text>
                    </Card>
                  </View>
                ))}
              </View>
            </View>
          )}

          {tab === 'updates' && (
            <View style={{ gap: 14 }}>
              {(updatesQ.data ?? []).map((u) => (
                <Card key={u.n}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        backgroundColor: `rgba(${colors.accentRgb},0.12)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text num style={{ color: colors.accent, fontWeight: '700' }}>
                        #{toArabicDigits(u.n)}
                      </Text>
                    </View>
                    <Badge label={u.tag} tone="accent" />
                    <View style={{ flex: 1 }} />
                    <Text num tone="muted2" variant="mutedSmall">
                      {u.date}
                    </Text>
                  </View>
                  <Text variant="h4" style={{ marginBottom: 6 }}>
                    {u.title}
                  </Text>
                  <Text variant="body" tone="muted" style={{ lineHeight: 24 }}>
                    {u.body}
                  </Text>
                </Card>
              ))}
            </View>
          )}

          {tab === 'community' && (
            <View>
              <Card style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 20 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    backgroundColor: `rgba(${colors.inkRgb},0.06)`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="person" size={20} color={colors.muted2} />
                </View>
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: `rgba(${colors.inkRgb},0.04)`,
                    borderRadius: 11,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                  }}
                >
                  <Text tone="muted2">شارك رأيك مع المجتمع…</Text>
                </Pressable>
              </Card>
              <View style={{ gap: 18 }}>
                {(commentsQ.data ?? []).map((c, i) => (
                  <View key={i} style={{ flexDirection: 'row-reverse', gap: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: `rgba(${colors.inkRgb},0.08)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '700' }}>{c.initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                        <View
                          style={{
                            paddingVertical: 2,
                            paddingHorizontal: 8,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: c.rankColor,
                          }}
                        >
                          <Text style={{ color: c.rankColor, fontSize: 10, fontWeight: '700' }}>
                            {c.rank}
                          </Text>
                        </View>
                        <Text num tone="muted2" variant="mutedSmall">
                          {c.time}
                        </Text>
                      </View>
                      <Text variant="body" tone="textSoft" style={{ marginBottom: 8 }}>
                        {c.body}
                      </Text>
                      <View style={{ flexDirection: 'row-reverse', gap: 16 }}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                          <Icon name="favorite_border" size={14} color={colors.muted2} />
                          <Text num tone="muted2" variant="mutedSmall">
                            {toArabicDigits(c.likes)}
                          </Text>
                        </View>
                        <Text tone="muted2" variant="mutedSmall">
                          رد
                        </Text>
                      </View>
                      {c.reply && (
                        <View
                          style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: `rgba(${colors.accentRgb},0.06)`,
                            borderWidth: 1,
                            borderColor: `rgba(${colors.accentRgb},0.18)`,
                          }}
                        >
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Icon name="verified" size={14} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                              المبدع
                            </Text>
                          </View>
                          <Text variant="small" tone="textSoft">
                            {c.reply}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {tab === 'faq' && (
            <View style={{ gap: 12 }}>
              {(faqsQ.data ?? []).map((f, i) => (
                <Card key={i}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Icon name="help" size={20} color={colors.accent} />
                    <Text variant="h4" style={{ flex: 1 }}>
                      {f.q}
                    </Text>
                  </View>
                  <Text variant="body" tone="muted" style={{ lineHeight: 22 }}>
                    {f.a}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* REWARD TIERS */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Icon name="redeem" size={22} color={colors.gold} />
            <Text variant="h3">اختر مكافأتك</Text>
          </View>
          <View style={{ gap: 14 }}>
            {(tiersQ.data ?? []).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/pledge/${p.id}?tier=${t.id}` as never)}
              >
                <Card>
                  {t.popular && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -9,
                        right: 16,
                        backgroundColor: colors.gold,
                        paddingVertical: 3,
                        paddingHorizontal: 11,
                        borderRadius: 20,
                      }}
                    >
                      <Text style={{ color: colors.onAccent, fontSize: 11, fontWeight: '700' }}>
                        الأكثر شعبية
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <Text num style={{ fontSize: 22, fontWeight: '700', color: colors.accent }}>
                      {fmtSAR(t.amountHalalas)}
                    </Text>
                    <Text num tone="muted2" variant="mutedSmall">
                      {toArabicDigits(t.backers)} داعم
                    </Text>
                  </View>
                  <Text variant="h4" style={{ marginBottom: 7 }}>
                    {t.titleAr}
                  </Text>
                  <Text variant="small" tone="muted" style={{ marginBottom: 14, lineHeight: 22 }}>
                    {t.descAr}
                  </Text>
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: `rgba(${colors.inkRgb},0.07)`,
                      paddingTop: 12,
                      gap: 8,
                    }}
                  >
                    {t.items.map((it, j) => (
                      <View key={j} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                        <Icon name="check_circle" size={16} color={colors.pos} />
                        <Text variant="small" tone="textSoft" style={{ flex: 1 }}>
                          {it}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: `rgba(${colors.inkRgb},0.07)`,
                    }}
                  >
                    <Text num tone="muted2" variant="mutedSmall">
                      التسليم: {t.estDelivery}
                    </Text>
                    {t.limitQty && (
                      <Text num style={{ color: colors.gold, fontWeight: '700', fontSize: 12 }}>
                        تبقى {toArabicDigits(t.limitQty - t.claimedQty)} وحدة
                      </Text>
                    )}
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
