import { parseArgs } from 'util';
import { init } from './commands/init';
import { log } from './utils/logger';

const pkg = require('../package.json');

function printHelp() {
  log.info(`cccdev v${pkg.version}`);
  console.log();
  console.log('用法: cccdev <command> [options]');
  console.log();
  console.log('指令:');
  console.log('  init          將 devtools 預覽範本安裝到 Cocos Creator 專案');
  console.log();
  console.log('選項:');
  console.log('  --help, -h    顯示此說明');
  console.log('  --version     顯示版本');
  console.log('  --force       覆蓋已存在的 preview-template（不詢問）');
}

export async function run() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.version) {
    console.log(pkg.version);
    return;
  }

  if (values.help || positionals.length === 0) {
    printHelp();
    return;
  }

  const command = positionals[0];

  switch (command) {
    case 'init':
      await init({ force: !!values.force });
      break;
    default:
      log.error(`未知指令: ${command}`);
      printHelp();
      process.exit(1);
  }
}
