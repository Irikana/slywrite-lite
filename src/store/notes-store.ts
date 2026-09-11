// 笔记列表状态：只存元数据（body 不进列表 state，省内存），负责刷新、搜索、标签过滤与排序。
import { create } from 'zustand';
import type { NoteMeta } from '../lib/frontmatter';
import { listNotes } from '../lib/notes-vault';

export type SortKey = 'updated' | 'created' | 'title';

interface NotesState {
  notes: NoteMeta[];
  loading: boolean;
  /** 搜索词（小写包含匹配 title / excerpt / tags） */
  query: string;
  /** 当前过滤标签；null 表示全部 */
  activeTag: string | null;
  sort: SortKey;
  /** 是否已完成首次加载 */
  ready: boolean;
  /** 最近一次加载失败的中文说明（界面直接展示；成功后清空） */
  error: string | null;
  /** 启动时加载一次 */
  init: () => Promise<void>;
  /** 强制重扫磁盘 */
  refresh: () => Promise<void>;
  setQuery: (q: string) => void;
  setTag: (tag: string | null) => void;
  setSort: (sort: SortKey) => void;
  /** 保存/新建后更新或插入单条元数据（不触发整盘扫描） */
  upsertMeta: (note: NoteMeta) => void;
  removeMeta: (file: string) => void;
  /** 全部标签及计数（按出现次数倒序） */
  allTags: () => { tag: string; count: number }[];
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  loading: false,
  query: '',
  activeTag: null,
  sort: 'updated',
  ready: false,
  error: null,

  init: async () => {
    if (get().loading) return;
    await get().refresh();
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const notes = await listNotes();
      set({ notes, loading: false, ready: true });
    } catch (e) {
      const { ready } = get();
      set({
        loading: false,
        ready,
        error: e instanceof Error ? e.message : '读取笔记目录失败',
      });
    }
  },

  setQuery: (query) => set({ query }),
  setTag: (activeTag) => set({ activeTag }),
  setSort: (sort) => set({ sort }),

  upsertMeta: (note) => {
    const { notes } = get();
    const idx = notes.findIndex((n) => n.file === note.file);
    const next = idx >= 0 ? notes.map((n) => (n.file === note.file ? note : n)) : [note, ...notes];
    set({ notes: next });
  },

  removeMeta: (file) => {
    set({ notes: get().notes.filter((n) => n.file !== file) });
  },

  allTags: () => {
    const counts = new Map<string, number>();
    for (const meta of get().notes) {
      for (const tag of meta.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'));
  },
}));

/**
 * 列表页展示用的派生结果：搜索 + 标签过滤 + 排序。
 * pinned 永远排前，其余按 sort 键排（updated/created 新者优先，title 中文拼音序）。
 */
export function filterNotes(
  notes: NoteMeta[],
  query: string,
  activeTag: string | null,
  sort: SortKey,
): NoteMeta[] {
  const q = query.trim().toLowerCase();
  const out = notes.filter((n) => {
    if (activeTag && !n.tags.some((t) => t === activeTag)) return false;
    if (!q) return true;
    const hay = `${n.title} ${n.excerpt} ${n.tags.join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  out.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'title') return a.title.localeCompare(b.title, 'zh-Hans-CN');
    const key = sort === 'created' ? a.created.localeCompare(b.created) : a.updated.localeCompare(b.updated);
    return key * -1; // 新者优先
  });
  return out;
}
