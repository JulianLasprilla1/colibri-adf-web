// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import Providers from './providers'
import { Toaster } from '@/components/ui/sonner' // ✅ Importar Sonner

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Colibrí ADF',
  description: 'Centralización de órdenes de compra',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.className
        )}
      >
        <Providers>
          {children}
          {/* ✅ Toaster configurado */}
          <Toaster
            position="bottom-right" // Esquina inferior derecha
            richColors // Colores según tipo de toast
            closeButton // Mostrar botón de cerrar
            duration={3000} // 3 segundos por defecto
          />
        </Providers>
      </body>
    </html>
  )
}
