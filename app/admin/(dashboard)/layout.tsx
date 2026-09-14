import AdminShell from '@/components/admin/AdminShell'

/** 仪表盘页面共享的外壳布局（侧边栏 + 登出） */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell>{children}</AdminShell>
}
