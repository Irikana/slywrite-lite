/**
 * Postinstall 补丁：修复 SlyWrite Lite 在 Expo SDK 52 下的 Android Release 构建。
 *
 * 背景（GitHub Actions run 34618375223，`gradlew assembleRelease` 两个失败）：
 *
 * 1. expo-modules-core/android/ExpoModulesCorePlugin.gradle 第 95 行
 *    `from components.release` 在配置 project ':expo' 时抛
 *    "Could not get unknown property 'release' for SoftwareComponent container"。
 *    AGP 8.x 下 release 组件要到 afterEvaluate 之后才注册，直接引用即失败。
 *    策略：把该 publication 包进 components.findByName('release') 判空。
 *
 * 2. expo-module-gradle-plugin 是 Expo SDK 53 才引入的 Gradle 插件，SDK 52 的
 *    `expo prebuild` 生成的 android/settings.gradle 里没有任何 includeBuild 指向它。
 *    一旦某个被自动链接的模块（历史上是 expo-image-picker 16.1.x 带入的
 *    expo-image-loader 5.1.x）用上这个插件，Gradle 直接报
 *    "Plugin [id: 'expo-module-gradle-plugin'] was not found"。
 *    策略：在依赖安装阶段就检测并报错，提示把版本钉回 SDK 52 对应版本，
 *    避免浪费三分钟后只看到一条 Gradle 堆栈。
 *
 * 本脚本幂等：重复执行会打印 SKIP。
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');

function log(msg) {
  console.log('[patch-android] ' + msg);
}

// --- 补丁 1：components.release 判空 ---
function patchExpoModulesCore() {
  const filePath = path.join(nodeModulesDir, 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');

  if (!fs.existsSync(filePath)) {
    log('SKIP: 未找到 expo-modules-core/android/ExpoModulesCorePlugin.gradle');
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes("findByName('release')") || content.includes('findByName("release")')) {
    log('SKIP: ExpoModulesCorePlugin.gradle 已打过补丁（存在 findByName 判空）');
    return;
  }

  if (!content.includes('from components.release')) {
    log('SKIP: ExpoModulesCorePlugin.gradle 未引用 components.release，无需补丁');
    return;
  }

  const lines = content.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*release\s*\(\s*MavenPublication\s*\)\s*\{\s*$/.test(lines[i])) {
      start = i;
      break;
    }
  }

  if (start < 0) {
    log('警告: 未定位到 release(MavenPublication) 块，请人工确认该文件是否已变更');
    return;
  }

  let depth = 0;
  let end = -1;
  for (let i = start; i < lines.length; i++) {
    for (let k = 0; k < lines[i].length; k++) {
      if (lines[i][k] === '{') depth++;
      if (lines[i][k] === '}') depth--;
    }
    if (depth === 0 && i > start) {
      end = i;
      break;
    }
  }

  if (end < 0) {
    log('警告: release(MavenPublication) 块括号不匹配，跳过补丁');
    return;
  }

  const indent = (lines[start].match(/^\s*/) || [''])[0];
  const block = lines.slice(start, end + 1);
  const wrapped = [indent + "if (components.findByName('release') != null) {"];
  block.forEach(function (line) {
    wrapped.push(line.trim() === '' ? line : '  ' + line);
  });
  wrapped.push(indent + '}');
  lines.splice(start, block.length, ...wrapped);

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  log('PATCHED: ExpoModulesCorePlugin.gradle（components.release 判空包裹）');
}

// --- 检测 2：SDK 53 才有的 expo-module-gradle-plugin ---
function listExpoModules() {
  const modules = [];

  function probe(dir) {
    if (!fs.existsSync(path.join(dir, 'expo-module.config.json'))) return;
    const gradle = path.join(dir, 'android', 'build.gradle');
    if (!fs.existsSync(gradle)) return;
    modules.push({ dir: dir, gradle: gradle });
  }

  function eachChild(parent) {
    if (!fs.existsSync(parent)) return;
    fs.readdirSync(parent, { withFileTypes: true }).forEach(function (entry) {
      if (!entry.isDirectory()) return;
      const full = path.join(parent, entry.name);
      if (entry.name.startsWith('@')) {
        fs.readdirSync(full, { withFileTypes: true }).forEach(function (scoped) {
          if (scoped.isDirectory()) probe(path.join(full, scoped.name));
        });
      } else {
        probe(full);
      }
    });
  }

  eachChild(nodeModulesDir);
  return modules;
}

// 插件在 SDK 53 起随 expo-modules-core 一起发布，这里探测它是否真的可用
function gradlePluginAvailable() {
  const candidates = [
    path.join(nodeModulesDir, 'expo-module-gradle-plugin'),
    path.join(nodeModulesDir, 'expo-modules-core', 'android', 'expo-gradle-plugin'),
    path.join(nodeModulesDir, 'expo', 'android', 'expo-gradle-plugin'),
  ];
  return candidates.some(function (p) { return fs.existsSync(p); });
}

function checkSdk53OnlyPlugin() {
  if (gradlePluginAvailable()) {
    log('OK: 检测到 expo-module-gradle-plugin 可用，跳过版本漂移检查');
    return;
  }

  const offenders = [];
  listExpoModules().forEach(function (mod) {
    const content = fs.readFileSync(mod.gradle, 'utf8');
    if (!/id\s*\(?\s*['"]expo-module-gradle-plugin['"]/.test(content)) return;
    let version = '未知';
    try {
      version = JSON.parse(fs.readFileSync(path.join(mod.dir, 'package.json'), 'utf8')).version;
    } catch (e) {
      // 读不到 package.json 时保留“未知”
    }
    offenders.push(path.relative(nodeModulesDir, mod.dir) + '@' + version);
  });

  if (offenders.length === 0) {
    log('OK: 自动链接的模块均未使用 expo-module-gradle-plugin');
    return;
  }

  console.error('[patch-android] 错误: 以下自动链接模块使用了 Expo SDK 53 才有的 expo-module-gradle-plugin，');
  console.error('[patch-android]        SDK 52 的 settings.gradle 不会 includeBuild 该插件，assembleRelease 必然失败：');
  offenders.forEach(function (o) { console.error('[patch-android]        - ' + o); });
  console.error('[patch-android] 处理办法: 把对应依赖钉回 SDK 52 版本（npx expo install <包名> --fix），并同步 package-lock.json。');
  process.exitCode = 1;
}

log('应用 Android 构建补丁...');
patchExpoModulesCore();
checkSdk53OnlyPlugin();
log('完成。');
