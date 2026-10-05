// 笔记/正文编辑模板状态管理
// 本地持久化储存用户的习惯格式与自定义模板，支持增删改查
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EditorTemplate {
  id: string;
  title: string;
  content: string;
  description?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'slywrite-lite-editor-templates-v1';

export const DEFAULT_TEMPLATES: EditorTemplate[] = [
  {
    id: 'note-std',
    title: '标准笔记结构',
    description: '核心观点、记录细节与思考总结',
    content: '## 核心要点\n\n§\n\n## 详细记录\n\n\n\n## 思考与启发\n',
    updatedAt: '2026-10-05',
  },
  {
    id: 'memo-todo',
    title: '日程与待办清单',
    description: '待办事项核对清单与备忘记录',
    content: '### 今日目标\n\n- [ ] §\n- [ ] \n- [ ] \n\n### 临时备忘\n\n\n\n### 晚间复盘\n',
    updatedAt: '2026-10-05',
  },
  {
    id: 'reading-card',
    title: '读书/研究卡片',
    description: '文献或书籍的摘录卡片格式',
    content: '> §核心引文或观点摘录\n\n**出处/作者**：\n**关联概念**：[[]]\n**个人感悟**：\n',
    updatedAt: '2026-10-05',
  },
  {
    id: 'diary-log',
    title: '日志日记随笔',
    description: '日常随笔与情绪流水账模板',
    content: '### 事件记录\n\n§\n\n### 心境随笔\n',
    updatedAt: '2026-10-05',
  },
];

interface TemplatesState {
  templates: EditorTemplate[];
  ready: boolean;
  loadTemplates: () => Promise<void>;
  addTemplate: (title: string, content: string, description?: string) => Promise<void>;
  updateTemplate: (id: string, title: string, content: string, description?: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: DEFAULT_TEMPLATES,
  ready: false,

  loadTemplates: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ templates: parsed, ready: true });
          return;
        }
      }
      set({ templates: DEFAULT_TEMPLATES, ready: true });
    } catch {
      set({ templates: DEFAULT_TEMPLATES, ready: true });
    }
  },

  addTemplate: async (title, content, description) => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const newT: EditorTemplate = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim() || '未命名模板',
      content,
      description: description?.trim() || undefined,
      updatedAt: dateStr,
    };
    const next = [newT, ...get().templates];
    set({ templates: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  updateTemplate: async (id, title, content, description) => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const next = get().templates.map((t) =>
      t.id === id
        ? {
            ...t,
            title: title.trim() || t.title,
            content,
            description: description?.trim() || undefined,
            updatedAt: dateStr,
          }
        : t,
    );
    set({ templates: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  deleteTemplate: async (id) => {
    const next = get().templates.filter((t) => t.id !== id);
    set({ templates: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  resetToDefaults: async () => {
    set({ templates: DEFAULT_TEMPLATES });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
  },
}));

// 初始化自动加载
useTemplatesStore.getState().loadTemplates();
