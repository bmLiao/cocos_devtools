import { signal, computed } from '@preact/signals';

/** 目前選取的 cc.Node */
export const selectedNode = signal<any>(null);

/** 每幀 toggle（1 / -1），驅動屬性面板重繪 */
export const updateTick = signal<number>(1);

/** Profiler 浮窗是否展開 */
export const profilerOpen = signal<boolean>(false);

/** 節點樹資料（每幀重建） */
export interface TreeNode {
  uuid: string;
  name: string;
  active: boolean;
  children: TreeNode[];
  path: string[];
}
export const treeData = signal<TreeNode[]>([]);

/** 已展開節點的 uuid 集合 */
export const expandedUuids = signal<Set<string>>(new Set());

/** 是否有節點被選取且有效 */
export const hasSelection = computed(() => selectedNode.value !== null);

/** 節點搜尋關鍵詞 */
export const searchQuery = signal<string>('');
