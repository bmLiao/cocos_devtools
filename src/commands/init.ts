import { existsSync, cpSync } from 'fs';
import { join, resolve } from 'path';
import { detectCCProject } from '../utils/detect';
import { log } from '../utils/logger';

interface InitOptions {
  force: boolean;
}

const TEMPLATES: Record<number, string> = {
  3: '3x',
};

export async function init(opts: InitOptions) {
  const project = detectCCProject();

  if (!project) {
    log.error('目前目錄不是 Cocos Creator 專案');
    log.dim('  請在包含 assets/ 和 settings/ 的專案根目錄中執行此指令');
    process.exit(1);
  }

  log.info(`偵測到 Cocos Creator ${project.engineMajor}.x 專案`);
  console.log();

  const templateName = TEMPLATES[project.engineMajor];
  if (!templateName) {
    log.error(`暫不支援 Cocos Creator ${project.engineMajor}.x`);
    process.exit(1);
  }

  const destDir = join(project.root, 'preview-template');

  if (existsSync(destDir) && !opts.force) {
    log.warn('preview-template/ 已存在，使用 --force 覆蓋');
    process.exit(1);
  }

  // 從 ccdev 套件內部解析範本路徑
  const pkgRoot = resolve(import.meta.dir, '../..');
  const templateDir = join(pkgRoot, 'template', templateName);

  if (!existsSync(templateDir)) {
    log.error('範本檔案缺失，請重新安裝 ccdev');
    process.exit(1);
  }

  log.step('安裝範本...');
  cpSync(templateDir, destDir, { recursive: true });

  console.log();
  log.success('範本安裝成功!');
  console.log();
  log.tree([
    'preview-template/',
    '  index.ejs',
    '  devtools/',
    '    assets/',
    '      index.js',
    '      style.css',
  ]);
  console.log();
  log.dim('  重新整理瀏覽器預覽即可使用 devtools。');
}
