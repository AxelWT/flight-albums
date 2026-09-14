/** 共享类型定义 */

export interface Album {
  id: string
  title: string
  description: string | null
  coverPath: string
  sortOrder: number
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
  sortOrder?: number
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
