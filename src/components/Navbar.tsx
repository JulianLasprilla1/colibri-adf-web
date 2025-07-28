'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Navbar({ email }: { email: string | null }) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white shadow-md px-6 py-3 flex justify-between items-center">
      <h1 className="text-lg font-bold">Colibrí ADF</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{email}</span>
        <Button variant="destructive" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </nav>
  )
}
