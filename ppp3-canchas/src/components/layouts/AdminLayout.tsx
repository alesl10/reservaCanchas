import type { ReactNode } from 'react'
import { Header } from '@/components/layout'

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <div className="w-full flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
        {children}
      </div>
    </>
  )
}
