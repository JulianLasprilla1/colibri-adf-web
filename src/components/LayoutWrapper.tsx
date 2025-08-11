"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noSidebar = pathname === '/login' || pathname === '/register';
  return (
    <div
      className={cn(
        'min-h-screen bg-gray-50 transition-all',
        noSidebar ? 'pl-0 pt-0' : 'md:pl-16 lg:pl-16 pt-16 md:pt-0'
      )}
    >
      {children}
    </div>
  );
}
