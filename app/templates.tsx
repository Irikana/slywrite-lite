import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTemplatesStore, type EditorTemplate } from '../src/store/templates-store';
import { SPACING, useTheme, type Palette } from '../src/theme';

export default function TemplatesPage() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const templates = useTemplatesStore((st) => st.templates);
  const addTemplate = useTemplatesStore((st) => st.addTemplate);
  const updateTemplate = useTemplatesStore((st) => st.updateTemplate);
  const deleteTemplate = useTemplatesStore((st) => st.deleteTemplate);
  const resetToDefaults = useTemplatesStore((st) => st.resetToDefaults);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formContent, setFormContent] = useState('');

  const openNewModal = useCallback(() => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormContent('');
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((t: EditorTemplate) => {
    setEditingId(t.id);
    setFormTitle(t.title);
    setFormDesc(t.description || '');
    setFormContent(t.content);
    setModalVisible(true);
  }, []);

  const handleSave = async () => {
    if (!formTitle.trim()) {
      if (Platform.OS === 'web') {
        window.alert('请输入模板名称');
      } else {
        Alert.alert('提示', '请输入模板名称');
      }
      return;
    }
    if (editingId) {
      await updateTemplate(editingId, formTitle, formContent, formDesc);
    } else {
      await addTemplate(formTitle, formContent, formDesc);
    }
    setModalVisible(false);
  };

  const handleDelete = (t: EditorTemplate) => {
    const confirmAction = async () => {
      await deleteTemplate(t.id);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`确定删除模板「${t.title}」吗？`)) {
        confirmAction();
      }
    } else {
      Alert.alert('删除模板', `确定删除模板「${t.title}」吗？`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: confirmAction },
      ]);
    }
  };

  const handleReset = () => {
    const confirmAction = async () => {
      await resetToDefaults();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('确定要恢复为内置预设模板吗？自定义模板将被重置。')) {
        confirmAction();
      }
    } else {
      Alert.alert('恢复预设', '确定要恢复为内置预设模板吗？自定义模板将被重置。', [
        { text: '取消', style: 'cancel' },
        { text: '恢复预设', style: 'destructive', onPress: confirmAction },
      ]);
    }
  };

  return (
    <View style={s.page}>
      {/* 顶栏 */}
      <View style={s.headBar}>
        <View style={s.headLeft}>
          <Text style={s.headTitle}>模板管理</Text>
          <Text style={s.headSubtitle}>正文编辑快捷插入格式</Text>
        </View>
        <Pressable style={s.newBtn} onPress={openNewModal}>
          <Text style={s.newBtnText}>+ 新建模板</Text>
        </Pressable>
      </View>

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={
          <View style={s.introBox}>
            <Text style={s.introText}>
              储存个人的常用版式与结构。在笔记编辑器中点击「模板」菜单可快速插入。在模板中使用 § 可标定光标落点。
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardDate}>{item.updatedAt}</Text>
            </View>
            {item.description ? <Text style={s.cardDesc}>{item.description}</Text> : null}
            <Text style={s.cardPreview} numberOfLines={3}>
              {item.content}
            </Text>
            <View style={s.cardActions}>
              <Pressable style={s.actionBtn} onPress={() => openEditModal(item)}>
                <Text style={s.actionBtnText}>编辑</Text>
              </Pressable>
              <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDelete(item)}>
                <Text style={[s.actionBtnText, s.deleteBtnText]}>删除</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={s.footer}>
            <Pressable style={s.resetBtn} onPress={handleReset}>
              <Text style={s.resetBtnText}>恢复内置预设模板</Text>
            </Pressable>
          </View>
        }
      />

      <View style={s.bottomBar}>
        <Pressable style={s.bottomBtn} onPress={() => router.back()}>
          <Text style={s.bottomBtnText}>返回笔记本</Text>
        </Pressable>
      </View>

      {/* 新建/编辑模板弹窗 */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalDialog}>
            <Text style={s.modalTitle}>{editingId ? '编辑模板' : '新建模板'}</Text>
            <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>模板名称</Text>
              <TextInput
                style={s.textInput}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="例如：会议纪要 / 读书笔记"
                placeholderTextColor={colors.textLight}
              />

              <Text style={s.fieldLabel}>描述说明（可选）</Text>
              <TextInput
                style={s.textInput}
                value={formDesc}
                onChangeText={setFormDesc}
                placeholder="简要描述模板用途"
                placeholderTextColor={colors.textLight}
              />

              <Text style={s.fieldLabel}>模板正文内容</Text>
              <Text style={s.fieldHint}>
                支持 Markdown 格式，输入 § 表示插入时光标停留的位置。
              </Text>
              <TextInput
                style={[s.textInput, s.contentInput]}
                value={formContent}
                onChangeText={setFormContent}
                placeholder="在此输入模板正文..."
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={s.modalActions}>
              <Pressable style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: COLORS.bg },
    headBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
    },
    headLeft: { flex: 1 },
    headTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    headSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    newBtn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      backgroundColor: COLORS.infoBg,
      paddingVertical: 5,
      paddingHorizontal: SPACING.md,
    },
    newBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.accent },
    listContent: {
      padding: SPACING.md,
    },
    introBox: {
      backgroundColor: COLORS.bgSubtle,
      borderLeftWidth: 3,
      borderLeftColor: COLORS.accent,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    introText: {
      fontSize: 13,
      lineHeight: 20,
      color: COLORS.textSecondary,
    },
    card: {
      backgroundColor: COLORS.bgSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: SPACING.md,
      padding: SPACING.md,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.text,
      flex: 1,
    },
    cardDate: {
      fontSize: 11,
      color: COLORS.textLight,
      marginLeft: SPACING.sm,
    },
    cardDesc: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginBottom: SPACING.xs,
    },
    cardPreview: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      lineHeight: 18,
      color: COLORS.textLight,
      backgroundColor: COLORS.bg,
      padding: SPACING.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: SPACING.sm,
    },
    cardActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: SPACING.xs,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 4,
      alignItems: 'center',
    },
    actionBtnText: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    deleteBtn: {
      borderLeftWidth: 1,
      borderLeftColor: COLORS.border,
    },
    deleteBtnText: {
      color: COLORS.danger,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: SPACING.lg,
    },
    resetBtn: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    resetBtnText: {
      fontSize: 12,
      color: COLORS.textLight,
    },
    bottomBar: {
      padding: SPACING.md,
      borderTopWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
    },
    bottomBtn: {
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      backgroundColor: COLORS.bg,
    },
    bottomBtnText: { fontSize: 13, color: COLORS.text },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.md,
    },
    modalDialog: {
      width: '100%',
      maxWidth: 500,
      maxHeight: '85%',
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: SPACING.md,
    },
    modalScroll: {
      maxHeight: 400,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.text,
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    fieldHint: {
      fontSize: 11,
      color: COLORS.textLight,
      marginBottom: SPACING.xs,
    },
    textInput: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      color: COLORS.text,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      fontSize: 14,
    },
    contentInput: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      height: 180,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    cancelBtn: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cancelBtnText: {
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    saveBtn: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      backgroundColor: COLORS.accent,
    },
    saveBtnText: {
      fontSize: 14,
      color: '#fff',
      fontWeight: '600',
    },
  });
