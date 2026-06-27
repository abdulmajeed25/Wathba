import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Button,
  Badge,
  Icon,
  ProgressBar,
  ProjectCard,
  Header,
} from '../src/ui';
import { useTheme } from '../src/theme/ThemeProvider';
import { ar } from '../src/i18n/ar';
import {
  useFeaturedProject,
  useTrendingProjects,
  useCategories,
  useRanks,
  useHowSteps,
} from '../src/data/hooks';
import { fmtSAR, toArabicDigits, fmtPct } from '../src/data/format';
import { liveTicker } from '../src/data/mock';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const featuredQ = useFeaturedProject();
  const trendingQ = useTrendingProjects();
  const catsQ = useCategories();
  const ranksQ = useRanks();
  const stepsQ = useHowSteps();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={{ padding: 24, paddingTop: 32 }}>
          <Badge label={ar.home.badge} withDot tone="accent" style={{ marginBottom: 22 }} />
          <Text
            style={{
              fontSize: 38,
              lineHeight: 42,
              fontWeight: '700',
              letterSpacing: -1,
              marginBottom: 18,
            }}
          >
            {ar.home.h1Top}{'\n'}{ar.home.h1Bottom}{' '}
            <Text
              style={{
                fontSize: 38,
                lineHeight: 42,
                fontWeight: '700',
                color: colors.accent,
              }}
            >
              {ar.home.h1Highlight}
            </Text>
          </Text>
          <Text variant="body" tone="textSoft" style={{ fontSize: 16, lineHeight: 26, marginBottom: 26 }}>
            {ar.home.description}
          </Text>
          <View style={{ gap: 12, marginBottom: 32 }}>
            <Button
              title={ar.home.ctaLaunch}
              iconLeft="bolt"
              size="lg"
              full
              onPress={() => router.push('/launch')}
            />
            <Button
              title={ar.home.ctaDiscover}
              variant="ghost"
              iconLeft="explore"
              size="lg"
              full
              onPress={() => router.push('/explore')}
            />
          </View>

          {/* Stats */}
          <View
            style={{
              flexDirection: 'row-reverse',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 4,
            }}
          >
            <Stat value="٢١.٤M ر.س" label={ar.home.statRaised} />
            <Divider />
            <Stat value="١٢٤K" label={ar.home.statBackers} />
            <Divider />
            <Stat value="٤٨٢" label={ar.home.statProjects} />
          </View>
        </View>

        {/* FEATURED CARD */}
        {featuredQ.data && (
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
            <FeaturedHero project={featuredQ.data} />
          </View>
        )}

        {/* LIVE TICKER */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: `rgba(${colors.inkRgb},0.07)`,
              backgroundColor: `rgba(${colors.inkRgb},0.02)`,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: 'rgba(52,211,153,0.1)',
                borderBottomWidth: 1,
                borderBottomColor: `rgba(${colors.inkRgb},0.07)`,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.pos,
                }}
              />
              <Text style={{ color: colors.pos, fontSize: 13, fontWeight: '700' }}>
                {ar.home.liveNow}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row-reverse', gap: 24, padding: 12 }}
            >
              {liveTicker.map((t, i) => (
                <Text key={i} tone="muted" variant="small">
                  {t}
                </Text>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* CATEGORIES */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <SectionHeader
            title={ar.home.browseByCategory}
            cta={ar.home.viewAll}
            onCta={() => router.push('/explore')}
          />
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            {(catsQ.data ?? []).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/categories/${c.id}` as never)}
                style={{
                  width: '47%',
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: `rgba(${colors.inkRgb},0.08)`,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: `rgba(${colors.accentRgb},0.10)`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Icon name={c.icon} size={22} color={colors.accent} />
                </View>
                <Text style={{ fontWeight: '600', fontSize: 14 }}>{c.ar}</Text>
                <Text num tone="muted2" variant="mutedSmall" style={{ marginTop: 2 }}>
                  {c.count}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* TRENDING */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Icon name="trending_up" size={26} color={colors.accent} />
            <Text variant="h2">{ar.home.trending}</Text>
          </View>
          <Text tone="muted2" variant="small" style={{ marginBottom: 16 }}>
            {ar.home.trendingDesc}
          </Text>
          <View style={{ gap: 16 }}>
            {(trendingQ.data ?? []).slice(0, 4).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </View>
        </View>

        {/* TRANSPARENCY BAND */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Card padding={28} radius={24}>
            <Badge
              label={ar.home.transparency}
              tone="pos"
              icon="visibility"
              style={{ marginBottom: 16 }}
            />
            <Text variant="h2" style={{ marginBottom: 12 }}>
              {ar.home.transparencyTitle}
            </Text>
            <Text variant="body" tone="textSoft" style={{ lineHeight: 26, marginBottom: 18 }}>
              {ar.home.transparencyDesc}
            </Text>
            <Button
              title={ar.home.transparencyCta}
              variant="outline"
              onPress={() => router.push('/projects/sirb' as never)}
            />
          </Card>
        </View>

        {/* RANKS TEASER */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32, alignItems: 'center' }}>
          <Badge
            label={ar.home.ranksBadge}
            tone="gold"
            icon="workspace_premium"
            style={{ marginBottom: 16 }}
          />
          <Text variant="h2" style={{ textAlign: 'center', marginBottom: 10 }}>
            {ar.home.ranksTitle}
          </Text>
          <Text
            variant="body"
            tone="textSoft"
            style={{ textAlign: 'center', maxWidth: 360, marginBottom: 24 }}
          >
            {ar.home.ranksDesc}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, flexDirection: 'row-reverse' }}
          >
            {(ranksQ.data ?? []).map((r) => (
              <View
                key={r.id}
                style={{
                  width: 138,
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 18,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: r.color + '33',
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: r.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Icon name={r.icon} size={26} color={r.color} />
                </View>
                <Text style={{ color: r.color, fontWeight: '700', fontSize: 14 }}>{r.ar}</Text>
                <Text num tone="muted2" variant="mutedSmall" style={{ marginTop: 4, letterSpacing: 2 }}>
                  {r.en}
                </Text>
              </View>
            ))}
          </ScrollView>
          <Button
            title={ar.home.ranksCta}
            variant="ghost"
            style={{ marginTop: 24 }}
            onPress={() => router.push('/ranks')}
          />
        </View>

        {/* HOW IT WORKS */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Text variant="h2" style={{ textAlign: 'center', marginBottom: 6 }}>
            {ar.home.howTitle}
          </Text>
          <Text tone="muted2" variant="small" style={{ textAlign: 'center', marginBottom: 20 }}>
            {ar.home.howDesc}
          </Text>
          <View style={{ gap: 14 }}>
            {(stepsQ.data ?? []).map((s) => (
              <Card key={s.n}>
                <View style={{ flexDirection: 'row-reverse', gap: 14, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: `rgba(${colors.accentRgb},0.15)`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={s.icon} size={24} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="h4" style={{ marginBottom: 4 }}>
                      {s.titleAr}
                    </Text>
                    <Text variant="muted" tone="muted">
                      {s.descAr}
                    </Text>
                  </View>
                  <Text
                    num
                    style={{
                      color: `rgba(${colors.accentRgb},0.2)`,
                      fontSize: 38,
                      fontWeight: '700',
                    }}
                  >
                    {s.n}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* FINAL CTA */}
        <View style={{ paddingHorizontal: 24 }}>
          <View style={{ borderRadius: 24, overflow: 'hidden' }}>
            <LinearGradient
              colors={colors.ctaGrad as unknown as [string, string, string]}
              style={{ padding: 28, alignItems: 'center' }}
            >
              <Text
                style={{
                  color: colors.onAccent,
                  fontSize: 24,
                  fontWeight: '700',
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              >
                {ar.home.finalCtaTitle}
              </Text>
              <Text
                style={{
                  color: 'rgba(6,18,31,0.78)',
                  fontSize: 14,
                  textAlign: 'center',
                  marginBottom: 22,
                }}
              >
                {ar.home.finalCtaDesc}
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pressable
                  onPress={() => router.push('/launch')}
                  style={{
                    backgroundColor: colors.onAccent,
                    paddingVertical: 13,
                    paddingHorizontal: 22,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {ar.home.finalCtaStart}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/how')}
                  style={{
                    paddingVertical: 13,
                    paddingHorizontal: 22,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(6,18,31,0.35)',
                  }}
                >
                  <Text style={{ color: colors.onAccent, fontWeight: '700' }}>
                    {ar.home.finalCtaLearn}
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text num style={{ fontSize: 22, fontWeight: '700' }}>
        {value}
      </Text>
      <Text tone="muted2" variant="mutedSmall" style={{ marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ width: 1, height: 30, backgroundColor: `rgba(${colors.inkRgb},0.1)` }} />;
}

function SectionHeader({
  title,
  cta,
  onCta,
}: {
  title: string;
  cta?: string;
  onCta?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="h2">{title}</Text>
      {cta && (
        <Pressable
          onPress={onCta}
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}
        >
          <Text tone="muted" variant="small">
            {cta}
          </Text>
          <Icon name="arrow_back" size={16} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function FeaturedHero({ project: p }: { project: import('../src/data/mock').ProjectCard }) {
  const { colors } = useTheme();
  const router = useRouter();
  const pct = fmtPct(p.raisedHalalas, p.goalHalalas);
  return (
    <Pressable onPress={() => router.push(`/projects/${p.id}` as never)}>
      <Card padding={0} radius={22}>
        <View
          style={{
            height: 220,
            backgroundColor: p.imageAccent ?? colors.phBg,
            position: 'relative',
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(6,18,31,0.55)']}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(6,18,31,0.85)',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: `rgba(${colors.accentRgb},0.4)`,
            }}
          >
            <Icon name="favorite" size={14} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
              مشروع نحبه
            </Text>
          </View>
        </View>
        <View style={{ padding: 22 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 10 }}>
            <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '600' }}>
              {p.categoryAr}
            </Text>
            <Text tone="muted2" variant="small">
              · {p.cityAr}
            </Text>
          </View>
          <Text variant="h2" style={{ marginBottom: 6 }}>
            {p.titleAr}
          </Text>
          <Text variant="body" tone="muted" style={{ marginBottom: 18 }}>
            {p.shortDescAr}
          </Text>
          <ProgressBar pct={pct / 100} height={9} over={pct >= 100} style={{ marginBottom: 14 }} />
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text num style={{ fontSize: 22, fontWeight: '700' }}>
                {fmtSAR(p.raisedHalalas)}
              </Text>
              <Text num tone="muted2" variant="mutedSmall">
                من {fmtSAR(p.goalHalalas)}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text num style={{ color: colors.accent, fontSize: 20, fontWeight: '700' }}>
                {toArabicDigits(pct)}٪
              </Text>
              <Text tone="muted2" variant="mutedSmall">
                مُموَّل
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text num style={{ fontSize: 20, fontWeight: '700' }}>
                {toArabicDigits(p.daysLeft)}
              </Text>
              <Text tone="muted2" variant="mutedSmall">
                يوم متبقٍ
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
