/** 弹窗内优先用注入的 window.cc，否则回退到 opener（游戏页） */
function gameWindow(): any {
  return (window as any).opener ?? window;
}

/** 获取 Cocos 引擎全局对象 */
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

/** 在游戏页启动 profiler 统计（未 showStats 时 stats 为 null） */
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

/** 读取 profiler.stats，并在缺失时回退 director/device 计数 */
export function readProfilerStats(): ProfilerStatItem[] {
  const c = cc();
  const stats = ensureProfilerStats();
  const device = c?.director?.root?.device;
  const dt = Number(c?.director?.getDeltaTime?.() ?? c?.game?.deltaTime ?? 0);
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

/** 沿 uuid 路径从场景根查找节点 */
export const resolveNodeByPath = (path: string[]): any => {
  let node: any = getScene();
  for (const uuid of path) {
    node = getChildByUuid(node, uuid);
    if (!node) return null;
  }
  return node;
};

/** 将节点/组件输出到游戏页 window.temp1、temp2... 方便在预览页控制台操作 */
export const outputToConsole = (target: any): void => {
  const w = gameWindow();
  let i = 1;
  while (w['temp' + i] !== undefined) i++;
  w['temp' + i] = target;
  w.console?.log('temp' + i, target);
  if (w !== window) console.log('temp' + i, target);
};

/** 在场景中高亮绘制节点包围盒，2s 后自动销毁 */
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
