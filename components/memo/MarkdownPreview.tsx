import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { parseMarkdown, type Inline } from '@/services/markdown';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { Attachment } from '@/types/memo';

type MarkdownPreviewProps = {
  markdown: string;
  attachments: readonly Attachment[];
  onToggleTask?: (line: number) => void;
};

export function MarkdownPreview({ markdown, attachments, onToggleTask }: MarkdownPreviewProps) {
  const { colors } = useTheme();
  const blocks = parseMarkdown(markdown);

  if (blocks.length === 0) {
    return <Text style={[styles.empty, { color: colors.textTertiary }]}>미리볼 내용이 없어요.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        if (block.type === 'hr') {
          return <View key={`hr-${index}`} style={[styles.hr, { backgroundColor: colors.border }]} />;
        }
        if (block.type === 'image') {
          const attachment = attachments.find((item) => item.id === block.attachmentId);
          if (!attachment?.localUri) {
            return (
              <Text key={`image-${index}`} style={[styles.missing, { color: colors.textTertiary }]}>
                사진을 찾을 수 없어요
              </Text>
            );
          }
          return (
            <Image
              key={`image-${block.attachmentId}`}
              source={{ uri: attachment.localUri }}
              style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
              accessibilityLabel={block.alt}
            />
          );
        }
        if (block.type === 'bullet' || block.type === 'number') {
          return (
            <View key={`${block.type}-${index}`} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.listItem}>
                  <Text style={[styles.marker, { color: colors.textSecondary }]}>
                    {block.type === 'number' ? `${itemIndex + 1}.` : '•'}
                  </Text>
                  <Text style={[styles.body, styles.flex, { color: colors.text }]}>
                    <InlineText inlines={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        if (block.type === 'task') {
          return (
            <View key={`task-${index}`} style={styles.list}>
              {block.items.map((item) => (
                <Pressable
                  key={item.line}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked }}
                  disabled={!onToggleTask}
                  onPress={() => onToggleTask?.(item.line)}
                  style={styles.listItem}>
                  <Text style={[styles.marker, { color: item.checked ? colors.accent : colors.textSecondary }]}>
                    {item.checked ? '☑' : '☐'}
                  </Text>
                  <Text
                    style={[
                      styles.body,
                      styles.flex,
                      { color: colors.text, textDecorationLine: item.checked ? 'line-through' : 'none' },
                    ]}>
                    <InlineText inlines={item.inlines} />
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        }
        if (block.type === 'quote') {
          return (
            <View key={`quote-${index}`} style={[styles.quote, { borderColor: colors.accent }]}>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                <InlineText inlines={block.inlines} />
              </Text>
            </View>
          );
        }
        const headingStyle = block.type === 'h1' ? styles.h1 : block.type === 'h2' ? styles.h2 : block.type === 'h3' ? styles.h3 : styles.body;
        return (
          <Text key={`${block.type}-${index}`} style={[headingStyle, { color: colors.text }]}>
            <InlineText inlines={block.inlines} />
          </Text>
        );
      })}
    </View>
  );
}

function InlineText({ inlines }: { inlines: readonly Inline[] }) {
  const { colors } = useTheme();
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.type === 'bold') {
          return (
            <Text key={index} style={styles.bold}>
              {inline.text}
            </Text>
          );
        }
        if (inline.type === 'italic') {
          return (
            <Text key={index} style={styles.italic}>
              {inline.text}
            </Text>
          );
        }
        if (inline.type === 'link') {
          return (
            <Text
              key={index}
              accessibilityRole="link"
              style={[styles.link, { color: colors.accentText }]}
              onPress={() => {
                void Linking.openURL(inline.href);
              }}>
              {inline.text}
            </Text>
          );
        }
        return <Text key={index}>{inline.text}</Text>;
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  empty: {
    ...typography.body,
    paddingVertical: spacing.xl,
  },
  body: {
    ...typography.body,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  link: {
    textDecorationLine: 'underline',
  },
  list: {
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  marker: {
    width: 24,
    fontSize: 16,
    lineHeight: 24,
  },
  flex: {
    flex: 1,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
  },
  missing: {
    ...typography.caption,
  },
});
