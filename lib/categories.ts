/**
 * 相册目录（分类）定义
 *
 * 目前固定两个目录：审美（/aesthetic）与摄影（/lens）。
 * NAV_CATEGORIES 决定前台导航顺序（审美在最左）。
 */
import type { AlbumCategory } from './types'

export const ALBUM_CATEGORIES = ['aesthetic', 'lens'] as const

export const DEFAULT_CATEGORY: AlbumCategory = 'lens'

/** 前台导航顺序 */
export const NAV_CATEGORIES: AlbumCategory[] = ['aesthetic', 'lens']

export const CATEGORY_META: Record<
  AlbumCategory,
  { label: string; path: string }
> = {
  aesthetic: { label: '审美', path: '/aesthetic' },
  lens: { label: '摄影', path: '/lens' },
}

/** 未知值兜底为默认目录 */
export function normalizeCategory(value: unknown): AlbumCategory {
  return (ALBUM_CATEGORIES as readonly string[]).includes(value as string)
    ? (value as AlbumCategory)
    : DEFAULT_CATEGORY
}
