import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Icon, EmptyState, Button } from '../src/ui';
import { toArabicDigits } from '../src/data/format';

interface Noti {
  id: string;
  kind: 'PLEDGE_RECEIVED' | 'PROJECT_FUNDED' | 'PROJECT_FAILED' | 'MILESTONE_APPROVED' | 'PAYOUT_SENT' | 'UPDATE_POSTED' | 'RANK_UP';
  title: string;
  body: string;
  time: string;
  unread: boolean;
  href?: string;
}

const ICON_FOR = (kind: Noti['kind']) =>
  kind === 'PLEDGE_RECEIVED' ? 'favorite'
  : kind === 'PROJECT_FUNDED' ? 'celebration'
  : kind === 'PROJECT_FAILED' ? 'cancel'
  : kind === 'MILESTONE_APPROVED' ? 'task_alt'
  : kind === 'PAYOUT_SENT' ? 'paid'
  : kind === 'RANK_UP' ? 'workspace_premium'
  : 'campaign';

const COLOR_FOR = (kind: Noti['kind'], colors: { accent: string; pos: string; gold: string; muted: string }) =>
  kind === 'PROJECT_FUNDED' || kind === 'PAYOUT_SENT' ? colors.pos
  : kind === 'RANK_UP' || kind === 'MILESTONE_APPROVED' ? colors.gold
  : kind === 'PROJECT_FAILED' ? '#ef4444'
  : colors.accent;

const MOCK: Noti[] = [
  { id: 'n1', kind: 'PROJECT_FUNDED', title: 'حكايا وصل ١٠٠٪ من هدفه! 🎉', body: 'المشروع نجح وبدأ التصنيع — متابعتك مهمة.', time: 'قبل ١٠ دقائق', unread: true, href: '/projects/hekaya' },
  { id: 'n2', kind: 'UPDATE_POSTED', title: 'تحديث جديد على «سِرب»', body: 'فريق سِرب نشر التحديث #٤ — وصول الدفعة الأولى من المصنع.', time: 'قبل ساعة', unread: true, href: '/projects/sirb' },
  { id: 'n3', kind: 'RANK_UP', title: 'ارتقيت إلى رتبة سفير', body: 'مزايا جديدة فُتحت لك — تفقّدها من «الرتب».', time: 'قبل يومين', unread: true, href: '/ranks' },
  { id: 'n4', kind: 'PLEDGE_RECEIVED', title: 'تأكيد دعمك لـ «سِرب»', body: 'دعمك ٧٥٠ ر.س محجوز بأمان حتى تاريخ ٠٢ يوليو.', time: 'قبل ٣ أيام', unread: false, href: '/backer/pledges/pl1' },
  { id: 'n5', kind: 'PAYOUT_SENT', title: 'تم صرف الدفعة الأولى', body: '٦٤٠,٠٠٠ ر.س حُوّلت لحسابك من مشروع سِرب.', time: 'الأسبوع الماضي', unread: false },
];

export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<Noti[]>(MOCK);

  const markAll = () => setItems((arr) => arr.map((n) => ({ ...n, unread: false })));
  const open = (n: Noti) => {
    setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    if (n.href) router.push(n.href as never);
  };

  const unread = items.filter((n) => n.unread).length;

  if (items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header />
        <EmptyState icon="notifications_none" title="لا توجد إشعارات" subtitle="ستظهر هنا تحديثات مشاريعك ومكافآتك." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="h1" style={{ fontSize: 26 }}>الإشعارات</Text>
            {unread > 0 && (
              <Text num tone="muted" variant="small" style={{ marginTop: 4 }}>
                {toArabicDigits(unread)} غير مقروء
              </Text>
            )}
          </View>
          {unread > 0 && <Button title="تمييز الكل كمقروء" variant="ghost" size="sm" onPress={markAll} />}
        </View>

        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          {items.map((n) => {
            const color = COLOR_FOR(n.kind, colors);
            return (
              <Pressable key={n.id} onPress={() => open(n)}>
                <Card
                  style={{
                    flexDirection: 'row-reverse',
                    gap: 12,
                    backgroundColor: n.unread ? `rgba(${colors.accentRgb},0.04)` : colors.card,
                    borderColor: n.unread ? `rgba(${colors.accentRgb},0.25)` : `rgba(${colors.inkRgb},0.09)`,
                  }}
                >
                  <View
                    style={{
                      width: 44, height: 44, borderRadius: 13,
                      backgroundColor: color + '22',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name={ICON_FOR(n.kind)} size={22} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text style={{ fontWeight: '700', flex: 1 }}>{n.title}</Text>
                      {n.unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />}
                    </View>
                    <Text variant="small" tone="muted" style={{ lineHeight: 20 }}>
                      {n.body}
                    </Text>
                    <Text num tone="muted2" variant="mutedSmall" style={{ marginTop: 6 }}>
                      {n.time}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
