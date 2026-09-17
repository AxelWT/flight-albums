/** 共享类型定义 */

/** 相册目录（分类） */
export type AlbumCategory = 'aesthetic' | 'lens'

export interface Album {
  id: string
  title: string
  description: string | null
  coverPath: string
  category: AlbumCategory
  sortOrder: number
  /** 访客不可见（管理员登录后可见） */
  hidden: boolean
  /** 已设置访问密码（密码哈希不出库、不进 API 响应） */
  hasPassword: boolean
  createdAt: string
  updatedAt: string
}

export interface Photo {
  id: number
  path: string
  title: string
  description: string | null
  date: string | null
  albumId: string
  location: string | null
  sortOrder: number
  createdAt: string
}

/** 创建/更新相册的输入 */
export interface AlbumInput {
  id: string
  title: string
  description?: string | null
  coverPath: string
  category?: AlbumCategory
  sortOrder?: number
  /** 是否对访客隐藏 */
  hidden?: boolean
  /**
   * 访问密码：字符串 = 设置/修改，null = 清除，undefined = 不变（更新时）。
   * 传入的是明文，由 queries 层做 scrypt 哈希后入库。
   */
  password?: string | null
}

/** 创建/更新照片的输入 */
export interface PhotoInput {
  path: string
  title: string
  description?: string | null
  date?: string | null
  albumId: string
  location?: string | null
  sortOrder?: number
}
