'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

export default function Navbar({ email = null }: { email?: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
          />
        </svg>
      ),
    },
    {
      label: 'Órdenes',
      href: '/ordenes',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7h16M4 12h16M4 17h16"
          />
        </svg>
      ),
    },
    {
      label: 'Productos',
      href: '/productos',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      label: 'Configuración',
      href: '/configuracion',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.273.07 2.573-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ]

  const isActive = (href: string) => pathname === href

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <>
      {/* Sidebar Desktop */}
      <aside className="hidden md:block fixed inset-y-0 left-0 z-50 group/sidebar">
        <div className="flex h-full w-16 hover:w-64 transition-[width] duration-300 ease-in-out bg-white border-r border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col w-64">
            {/* Header / Logo */}
            <div className="h-16 flex items-center gap-3 pl-3 pr-4 border-b border-gray-100 relative">
              <Image src="/logo.png" alt="Colibrí ADF" width={44} height={44} className="object-contain shrink-0" priority />
              <span className="text-[13px] font-semibold tracking-tight text-[#353455] leading-tight opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
                Colibrí <span className="text-[#6c56a3]">ADF</span>
              </span>
            </div>
            {/* Nav items */}
            <nav className="flex-1 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md mx-2 transition-all ${
                    isActive(item.href)
                      ? 'bg-[#3534550d] text-[#353455] border border-[#3534551a]'
                      : 'text-gray-600 hover:text-[#353455] hover:bg-[#35345510] border border-transparent'
                  }`}
                >
                  <span className="text-gray-400 group-hover:text-[#353455] transition-colors">
                    {item.icon}
                  </span>
                  <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>
            {/* Footer user + logout */}
            <div className="border-t border-gray-100 p-3 mt-auto">
              {email && (
                <div className="flex items-center gap-3 px-2 py-2 rounded-md">
                  <div className="h-8 w-8 rounded-full bg-[#a489dd] text-white flex items-center justify-center text-xs font-semibold">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {email}
                    </p>
                    <p className="text-[10px] text-gray-400">Conectado</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                  Salir
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Botón móvil flotante */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 h-10 w-10 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center active:scale-95"
        aria-label="Abrir menú"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-gray-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 h-full bg-white border-r border-gray-200 shadow-xl flex flex-col animate-[slideIn_.25s_ease]">
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="relative shrink-0 after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-[#35345526] after:shadow-[0_0_0_3px_rgba(53,52,85,0.05)] rounded-full">
                  <Image src="/logo.png" alt="Colibrí ADF" width={46} height={46} className="object-contain rounded-full" priority />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight text-[#353455] leading-tight">Colibrí <span className="text-[#6c56a3]">ADF</span></span>
                  <span className="text-[10px] tracking-wide uppercase font-medium text-[#35345599]">Operaciones</span>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-[#efe9fb] text-[#4f3d78]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-gray-400">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-gray-100 p-4 space-y-3">
              {email && (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#a489dd] text-white flex items-center justify-center text-sm font-semibold">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {email}
                    </p>
                    <p className="text-xs text-gray-400">Conectado</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-md text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animación keyframes */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  )
}
