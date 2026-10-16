import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n, { initializeLanguage } from '../i18n';
import { ascScreenshotLocale } from '../lib/ascScreenshotDemo';
import { Text } from '../components/AppText';
import { colors } from '../theme';

type DemoScreen = 'groups' | 'balances' | 'add-expense' | 'simplified-debts' | 'pro-currency';

const SCREENS: DemoScreen[] = ['groups', 'balances', 'add-expense', 'simplified-debts', 'pro-currency'];

const LOCALES = ['en-US', 'he', 'ru', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE'] as const;

function DemoCard({ title, subtitle, amount }: { title: string; subtitle: string; amount: string }) {
  return (
    <View className="mx-4 mb-3 rounded-2xl border border-slate-200 bg-white p-4">
      <Text className="text-lg font-semibold text-slate-900">{title}</Text>
      <Text className="mt-1 text-sm text-slate-500">{subtitle}</Text>
      <Text className="mt-2 text-xl font-bold text-blue-600">{amount}</Text>
    </View>
  );
}

function ScreenBody({ screen }: { screen: DemoScreen }) {
  const { t } = useTranslation();
  if (screen === 'groups') {
    return (
      <View testID="asc-demo-screen-groups">
        <DemoCard title="Barcelona Trip" subtitle="4 members · EUR + ILS" amount="You are owed ₪420" />
        <DemoCard title="Roommates" subtitle="3 members · ILS" amount="You owe ₪85" />
        <DemoCard title="Friday Dinner" subtitle="6 members · ILS" amount="Settled up" />
      </View>
    );
  }
  if (screen === 'balances') {
    return (
      <View testID="asc-demo-screen-balances">
        <DemoCard title="Dana → You" subtitle="Hotels" amount="€120" />
        <DemoCard title="You → Yoni" subtitle="Taxi" amount="₪64" />
        <DemoCard title="Net balance" subtitle="After simplification" amount="+₪210" />
      </View>
    );
  }
  if (screen === 'add-expense') {
    return (
      <View testID="asc-demo-screen-add-expense" className="mx-4 rounded-2xl bg-white p-5">
        <Text className="text-2xl font-bold text-slate-900">{t('expenses.addTitle', 'Add expense')}</Text>
        <Text className="mt-4 text-base text-slate-600">Dinner · ₪480 · split equally</Text>
        <View className="mt-6 rounded-xl bg-blue-600 py-4">
          <Text className="text-center text-lg font-semibold text-white">{t('common.save', 'Save')}</Text>
        </View>
      </View>
    );
  }
  if (screen === 'simplified-debts') {
    return (
      <View testID="asc-demo-screen-simplified-debts">
        <DemoCard title="Before: 6 payments" subtitle="Messy transfers" amount="—" />
        <DemoCard title="After: 2 payments" subtitle="Smart settle-up" amount="Save 67%" />
      </View>
    );
  }
  return (
    <View testID="asc-demo-screen-pro-currency" className="mx-4 rounded-2xl bg-blue-50 p-5">
      <Text className="text-xl font-bold text-blue-900">Pro · Trip FX</Text>
      <Text className="mt-3 text-base text-slate-700">
        €120 + $45 → shown in ₪ with live rates for the whole group.
      </Text>
      <Text className="mt-4 text-sm text-slate-500">Yearly ₪69.90 · Trip Pass ₪19.90</Text>
    </View>
  );
}

export function AscScreenshotDemoRoot() {
  const [screen, setScreen] = useState<DemoScreen>('groups');
  const [ready, setReady] = useState(false);
  const forcedLocale = ascScreenshotLocale();

  useEffect(() => {
    void (async () => {
      await initializeLanguage();
      if (forcedLocale) {
        await i18n.changeLanguage(forcedLocale);
      }
      setReady(true);
    })();
  }, [forcedLocale]);

  const title = useMemo(() => SCREENS.find((s) => s === screen) ?? 'groups', [screen]);

  if (!ready) {
    return <View className="flex-1 bg-slate-100" testID="asc-demo-loading" />;
  }

  return (
    <View className="flex-1 bg-slate-100" testID="asc-demo-root">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-slate-200 bg-white">
        {LOCALES.map((loc) => (
          <Pressable
            key={loc}
            testID={`asc-demo-locale-${loc}`}
            onPress={() => void i18n.changeLanguage(loc)}
            className="px-3 py-3"
          >
            <Text className="text-xs font-medium text-slate-600">{loc}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-slate-200 bg-white">
        {SCREENS.map((s) => (
          <Pressable
            key={s}
            testID={`asc-demo-nav-${s}`}
            onPress={() => setScreen(s)}
            className="px-4 py-3"
          >
            <Text style={{ color: s === screen ? colors.primary : '#64748b' }} className="text-sm font-semibold">
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView className="flex-1 pt-4" testID={`asc-demo-active-${title}`}>
        <Text className="mx-4 mb-4 text-3xl font-bold text-slate-900">KupaPay</Text>
        <ScreenBody screen={screen} />
      </ScrollView>
    </View>
  );
}
