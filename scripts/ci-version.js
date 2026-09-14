// CI 版本号注入：把 package.json 的三位正式版本（A.B.C）扩成 A.B.C.<构建号>，
// 写入 package.json / app.json（仅工作区，不提交），供构建产物与「关于」页读取。
// 规则出处见 AGENTS.md「版本号规则（全软件统一）」：第四位是测试构建号，
// 每次 CI 构建自动 +1（以 GitHub run_number 为源），正式发布只递增第三位。
// 用法：node scripts/ci-version.js <build-number>
// 输出：GITHUB_OUTPUT 中 base=A.B.C、full=A.B.C.N（若在该环境）。
'use strict';
const fs = require('fs');
const path = require('path');

const buildNo = process.argv[2];
if (!buildNo || !/^\d+$/.test(buildNo)) {
  console.error('[ci-version] 用法：node scripts/ci-version.js <构建号（纯数字）>');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
// 兼容四段存量（如 0.0.15.11）：取前三段作为正式版本
const base = pkg.version.split('.').slice(0, 3).join('.');
// 第四位构建号必须写成 semver 前发布标识（A.B.C-N）：
// electron-builder 对 package.json version 做 semver 校验，四段点分号（0.0.1.2）
// 直接报 Invalid version 使 PC 打包秒败（2026-09-14 CI run 34805680213 实证）。
// Android APK 不受此限制（expo 只把 version 字符串写进应用标签），但为全软件统一，
// 注入脚本一律产出 A.B.C-N 形式；展示时可按 '-' 拆分还原四段语义。
const full = `${base}-${buildNo}`;

pkg.version = full;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
app.expo.version = full;
if (app.expo.android) {
  // versionCode 必须严格递增且为正整数：run_number 天然满足；上限防护 Android 整型
  const code = Number(buildNo);
  if (code > 0 && code < 2_100_000_000) app.expo.android.versionCode = code;
}
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

console.log(`[ci-version] 正式版本 ${base} -> 构建版本 ${full}（versionCode=${buildNo}，仅工作区改动，不提交）`);

const out = process.env.GITHUB_OUTPUT;
if (out) {
  fs.appendFileSync(out, `base=${base}\nfull=${full}\n`);
}
