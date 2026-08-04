'use client';

import { Sidebar } from './Sidebar';
import { usePathname } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
  projectId?: string;
}

export function Layout({ children, projectId }: LayoutProps) {
  const pathname = usePathname();
  const showSidebar = !pathname?.includes('/login') && !pathname?.includes('/register') && !pathname?.includes('/admin/login');

  if (!showSidebar) {
    return <>{children}</>;
  }

  // Extract projectId from pathname if not provided; ignore reserved segments
  const RESERVED = new Set(['new']);
  const pathProjectId = pathname?.match(/\/projects\/([^\/]+)/)?.[1];
  const extractedProjectId =
    projectId && !RESERVED.has(projectId)
      ? projectId
      : pathProjectId && !RESERVED.has(pathProjectId)
        ? pathProjectId
        : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar projectId={extractedProjectId} />
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}

