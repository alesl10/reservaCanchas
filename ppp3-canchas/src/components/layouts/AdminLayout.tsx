import type { ReactNode } from 'react'
import { Header } from '@/components/layout'

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {/* Mismo ancho máximo y gutters que el Header (max-w-7xl) para que queden alineados. */}
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
        {children}
      </div>
    </>
  )
}
