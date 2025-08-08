'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar({ email = null }: { email?: string | null }) {
  const pathname = usePathname()

  // Determinar qué enlace está activo
  const isActive = (path: string) => {
    return pathname === path ? 'border-b-2 border-indigo-300' : ''
  }

  return (
    <nav className="bg-white border-b border-gray-200 text-gray-800 shadow-sm h-16 flex items-center fixed w-full top-0 left-0 z-50">
      <div className="container mx-auto px-4 h-full flex justify-between items-center">
        {/* Logo y nombre */}
        <div className="flex items-center h-full">
          <span className="text-xl font-bold mr-8 text-indigo-700">
            Colibri ADF
          </span>

          {/* Enlaces de navegación */}
          <div className="hidden md:flex h-full">
            <Link
              href="/dashboard"
              className={`flex items-center px-4 h-full hover:bg-gray-100 transition-colors ${isActive(
                '/dashboard'
              )}`}
            >
              Dashboard
            </Link>
            <Link
              href="/ordenes"
              className={`flex items-center px-4 h-full hover:bg-gray-100 transition-colors ${isActive(
                '/ordenes'
              )}`}
            >
              Órdenes
            </Link>
            <Link
              href="/productos"
              className={`flex items-center px-4 h-full hover:bg-gray-100 transition-colors ${isActive(
                '/productos'
              )}`}
            >
              Productos
            </Link>
            <Link
              href="/configuracion"
              className={`flex items-center px-4 h-full hover:bg-gray-100 transition-colors ${isActive(
                '/configuracion'
              )}`}
            >
              Configuración
            </Link>
          </div>
        </div>

        {/* Información de usuario y botón de cerrar sesión */}
        <div className="flex items-center space-x-4">
          {email && (
            <div className="bg-gray-100 px-3 py-1.5 rounded-full text-sm flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="truncate max-w-[150px]">{email}</span>
            </div>
          )}

          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
