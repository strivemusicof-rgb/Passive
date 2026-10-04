import type { CosmeticItemDto, PlotDto } from '@landrush/shared';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { C, R, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import { game } from '@/lib/game';

/** "Look" card on your own plot: pick one of your skins and flags (or none). */
export function PlotLook({ plot, onChange }: { plot: PlotDto; onChange: (plot: PlotDto) => void }) {
  const { t } = useTranslation();
  const [owned, setOwned] = useState<CosmeticItemDto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .cosmetics()
      .then((r) => setOwned(r.items.filter((i) => i.owned && (i.type === 'plotSkin' || i.type === 'plotFlag'))))
      .catch(() => setOwned([]));
  }, []);

  const pick = async (body: { skin?: string | null; flag?: string | null }) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await game.setPlotStyle(plot.key, body));
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  if (!owned) return null;
  const skins = owned.filter((i) => i.type === 'plotSkin');
  const flags = owned.filter((i) => i.type === 'plotFlag');

  return (
    <Card style={styles.card}>
      <Text variant="bodyBold">{t('plot.look')}</Text>
      <Text variant="small" color={C.textSecondary}>
        {t('plot.skin')}
      </Text>
      <View style={styles.row}>
        <Chip selected={!plot.skin} disabled={busy} onPress={() => pick({ skin: null })}>
          <Text variant="tiny">{t('plot.none')}</Text>
        </Chip>
        {skins.map((s) => (
          <Chip key={s.id} selected={plot.skin?.id === s.id} disabled={busy} onPress={() => pick({ skin: s.id })}>
            <View style={[styles.swatch, { backgroundColor: s.value, shadowColor: s.value }]} />
          </Chip>
        ))}
      </View>
      <Text variant="small" color={C.textSecondary}>
        {t('plot.flag')}
      </Text>
      <View style={styles.row}>
        <Chip selected={!plot.flag} disabled={busy} onPress={() => pick({ flag: null })}>
          <Text variant="tiny">{t('plot.none')}</Text>
        </Chip>
        {flags.map((f) => (
          <Chip key={f.id} selected={plot.flag?.id === f.id} disabled={busy} onPress={() => pick({ flag: f.id })}>
            <Text style={styles.emoji}>{f.value}</Text>
          </Chip>
        ))}
      </View>
      {error && (
        <Text variant="small" color={C.danger}>
          {error}
        </Text>
      )}
      <Pressable onPress={() => router.push('/shop')} hitSlop={8}>
        <Text variant="small" color={C.green}>
          {t('plot.getMore')} ›
        </Text>
      </Pressable>
    </Card>
  );
}

function Chip({
  selected,
  disabled,
  onPress,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, selected && styles.selected]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: S.md, gap: S.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: S.sm,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: C.green, borderWidth: 2 },
  swatch: { width: 22, height: 22, borderRadius: 6, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  emoji: { fontSize: 22, lineHeight: 28 },
});
