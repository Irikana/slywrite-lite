// 更新检查：匿名读取本应用公开发布的最新版本与安装包地址。
// 全程只有只读 GET，不携带也不存储任何凭据；失败时抛出中文说明的 Error，由界面决定提示文案。
// 取版本方式：优先拉发布列表按版本号比较取最大，而不是依赖「最新」端点的返回顺序，
// 避免历史归档条目因发布时间较晚而被当成最新版。

/** 发布源标识（更新检查所需的唯一外部常量，不涉及任何凭据） */
const RELEASE_SOURCE = { owner: 'Irikana', repo: 'slywrite-lite' } as const;

const API_BASE = 'https://api.github.com';

/** 未指定具体版本时的固定下载地址（跟随最新发布的重定向） */
export const LATEST_APK_URL = `https://github.com/${RELEASE_SOURCE.owner}/${RELEASE_SOURCE.repo}/releases/latest/download/app-release.apk`;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
  assets: ReleaseAsset[];
}

interface RawAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

interface RawRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: RawAsset[];
}

function mapRelease(data: RawRelease): ReleaseInfo {
  return {
    tagName: data.tag_name,
    name: data.name || data.tag_name,
    publishedAt: data.published_at,
    htmlUrl: data.html_url,
    body: data.body ?? '',
    assets: (data.assets ?? []).map((a) => ({
      name: a.name,
      browser_download_url: a.browser_download_url,
      size: a.size ?? 0,
    })),
  };
}

/** 请求头：只要内容协商，不带 Authorization */
function plainHeaders(): HeadersInit {
  return { Accept: 'application/vnd.github+json' };
}

/** 把 HTTP 状态码翻译成用户看得懂的中文原因 */
function httpError(status: number): Error {
  if (status === 403 || status === 429) return new Error('检查更新太频繁，请稍后再试');
  if (status === 404) return new Error('还没有可检查的发布版本');
  return new Error(`检查更新失败（${status}）`);
}

/**
 * 取最新发布：列表可用时按版本号取最大；列表异常时退回「最新」端点。
 * 尚无任何发布时返回 null（调用方显示「暂无发布版本」）。
 */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/repos/${RELEASE_SOURCE.owner}/${RELEASE_SOURCE.repo}/releases?per_page=15`, {
      headers: plainHeaders(),
      cache: 'no-store',
    });
  } catch {
    throw new Error('网络不可达，暂时无法检查更新');
  }

  if (res.ok) {
    const list = (await res.json()) as RawRelease[];
    const usable = (list ?? []).filter((r) => !r.draft && !r.prerelease).map(mapRelease);
    if (usable.length === 0) return null;
    return usable.reduce((best, r) => (compareVersions(r.tagName, best.tagName) > 0 ? r : best));
  }

  // 列表接口不可用（限流等）时，用最新端点兜底一次；404 视为「暂无发布」
  if (res.status !== 404) {
    let fallback: Response;
    try {
      fallback = await fetch(`${API_BASE}/repos/${RELEASE_SOURCE.owner}/${RELEASE_SOURCE.repo}/releases/latest`, {
        headers: plainHeaders(),
        cache: 'no-store',
      });
    } catch {
      throw new Error('网络不可达，暂时无法检查更新');
    }
    if (fallback.ok) return mapRelease((await fallback.json()) as RawRelease);
    if (fallback.status === 404) return null;
    throw httpError(fallback.status);
  }

  throw httpError(res.status);
}

/**
 * 版本号比较：去掉前缀 v 后按点分段逐位比较，缺位补 0，
 * 因此 0.0.1.1 大于 0.0.1，也兼容三段与四段混用。非数字段按 0 处理。
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length, 4);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
