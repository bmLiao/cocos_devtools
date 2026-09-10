/** 彈窗內優先用注入的 window.cc，否則回退到 opener（遊戲頁） */
function gameWindow(): any {
  return (window as any).opener ?? window;
}

/** 取得 Cocos 引擎全域物件 */
export const cc = (): any => (window as any)['cc'] ?? gameWindow()['cc'];

export const getScene = (): any => cc()?.director?.getScene();

export const isReady = (): boolean => !!cc() && !!getScene();

export const isValid = (node: any): boolean => !!node && cc()?.isValid(node);

export const getComponents = (ccNode: any): Array<{ name: string; target: any }> =>
  (ccNode?.components ?? []).map((c: any) => ({ name: c.__classname__ as string, target: c }));

export const getSceneChildren = (): any[] => getScene()?.children ?? [];

export const getChildByUuid = (node: any, uuid: string): any => node?.getChildByUuid(uuid) ?? null;

function getProfiler(c: any): any {
  return c?.profiler ?? c?.internal?.profiler ?? null;
}

/** 在遊戲頁啟動 profiler 統計（未 showStats 時 stats 為 null） */
export function ensureProfilerStats(): any {
  const c = cc();
  if (!c) return null;
  const profiler = getProfiler(c);
  try {
    if (profiler && typeof profiler.showStats === 'function') {
      profiler.showStats();
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof c.debug?.setDisplayStats === 'function') {
      c.debug.setDisplayStats(true);
    }
  } catch {
    /* ignore */
  }
  return profiler?.stats ?? profiler?._stats ?? null;
}

function readCounterValue(data: any): number | null {
  if (data == null) return null;
  const counter = data.counter ?? data;
  const raw = counter._value ?? counter.value ?? data.value ?? data.average;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatStatValue(data: any, fallback: number | null): string {
  const n = readCounterValue(data) ?? fallback;
  if (n == null) return '—';
  const integer = data?.isInteger ?? Number.isInteger(n);
  return integer ? String(n | 0) : n.toFixed(2);
}

function stripDesc(desc: unknown, fallback: string): string {
  const s = String(desc ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || fallback;
}

export interface ProfilerStatItem {
  key: string;
  desc: string;
  value: string;
}

const STAT_KEYS = [
  'fps',
  'draws',
  'frame',
  'instances',
  'tricount',
  'logic',
  'physics',
  'render',
  'textureMemory',
  'bufferMemory',
] as const;

const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  fps: 'FPS',
  draws: 'Draws',
  frame: 'Frame',
  instances: 'Instances',
  tricount: 'Triangles',
  logic: 'Logic',
  physics: 'Physics',
  render: 'Render',
  textureMemory: 'Texture mem',
  bufferMemory: 'Buffer mem',
};

/** 讀取 profiler.stats，並在缺失時回退 director/device 計數 */
export function readProfilerStats(): ProfilerStatItem[] {
  const c = cc();
  const stats = ensureProfilerStats();
  const device = c?.director?.root?.device;
  const dt = Number(c?.game?.deltaTime ?? 0);
  const fallbacks: Record<string, number | null> = {
    fps: dt > 0 ? 1 / dt : null,
    draws: device?.numDrawCalls ?? null,
    instances: device?.numInstances ?? null,
    tricount: device?.numTris ?? null,
  };

  return STAT_KEYS.map((key) => {
    const data = stats?.[key];
    return {
      key,
      desc: stripDesc(data?.desc, STAT_LABELS[key]),
      value: formatStatValue(data, fallbacks[key] ?? null),
    };
  });
}

/** 沿 uuid 路徑從場景根尋找節點 */
export const resolveNodeByPath = (path: string[]): any => {
  let node: any = getScene();
  for (const uuid of path) {
    node = getChildByUuid(node, uuid);
    if (!node) return null;
  }
  return node;
};

/** 將節點/元件輸出到遊戲頁 window.temp1、temp2... 方便在預覽頁主控台操作 */
export const outputToConsole = (target: any): void => {
  const w = gameWindow();
  let i = 1;
  while (w['temp' + i] !== undefined) i++;
  w['temp' + i] = target;
  w.console?.log('temp' + i, target);
  if (w !== window) console.log('temp' + i, target);
};

/** 在場景中標示繪製節點包圍盒，2s 後自動銷毀 */
export const drawNodeRect = (target: any): void => {
  const c = cc();
  if (!c) return;
  let rect: any;
  const transform = target.getComponent(c.UITransformComponent);
  if (transform) {
    rect = getSelfBoundingBoxToWorld(transform, c);
  } else {
    const worldPos = c.v3();
    target.getWorldPosition(worldPos);
    rect = c.rect(worldPos.x, worldPos.y, 0, 0);
  }
  const canvasNode = new c.Node('__DevTools_Highlight__');
  const scene = getScene();
  scene.addChild(canvasNode);
  canvasNode.addComponent(c.Canvas);
  const bgNode = new c.Node();
  const graphics = bgNode.addComponent(c.GraphicsComponent);
  const bgTransform = bgNode.addComponent(c.UITransformComponent);
  canvasNode.addChild(bgNode);
  const centerPos = c.v3(rect.center.x, rect.center.y, 0);
  const localPos = c.v3();
  canvasNode.getComponent(c.UITransformComponent).convertToNodeSpaceAR(centerPos, localPos);
  bgNode.setPosition(localPos);
  bgNode.layer = target.layer;
  const isZeroSize = rect.width === 0 || rect.height === 0;
  if (isZeroSize) {
    graphics.circle(0, 0, 100);
    graphics.fillColor = c.Color.GREEN;
    graphics.fill();
  } else {
    bgTransform.width = rect.width;
    bgTransform.height = rect.height;
    graphics.rect(
      -bgTransform.width / 2,
      -bgTransform.height / 2,
      bgTransform.width,
      bgTransform.height,
    );
    graphics.fillColor = new c.Color().fromHEX('#E91E6390');
    graphics.fill();
  }
  setTimeout(() => {
    if (c.isValid(canvasNode)) canvasNode.destroy();
  }, 2000);
};

function getSelfBoundingBoxToWorld(transform: any, c: any): any {
  const _worldMatrix = c.mat4();
  if (transform.node.parent) {
    transform.node.parent.getWorldMatrix(_worldMatrix);
    const parentMat = _worldMatrix;
    const _matrix = c.mat4();
    c.Mat4.fromRTS(
      _matrix,
      transform.node.getRotation(),
      transform.node.getPosition(),
      transform.node.getScale(),
    );
    const width = transform._contentSize.width;
    const height = transform._contentSize.height;
    const rect = c.rect(
      -transform._anchorPoint.x * width,
      -transform._anchorPoint.y * height,
      width,
      height,
    );
    c.Mat4.multiply(_worldMatrix, parentMat, _matrix);
    rect.transformMat4(_worldMatrix);
    return rect;
  }
  return transform.getBoundingBox();
}
