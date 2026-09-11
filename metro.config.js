// Metro 配置：SlyWrite Lite 完全使用 Expo SDK 52 默认解析。
// 说明：SlyWrite 原项目在此处为 turndown / @mixmark-io/domino 做过 resolveRequest 重映射
// （HTML → Markdown 还原），Lite 不依赖 turndown，整段逻辑已删除，无需保留。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
