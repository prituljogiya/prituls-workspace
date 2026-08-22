'use client';

import type { ComponentType, ReactNode } from 'react';

export function PageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label={label}>
      <div className="h-9 w-9 rounded-full border-2 border-primary-200 dark:border-primary-900 border-t-primary-600 animate-spin" />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 px-6 py-12 text-center">
      {Icon ? <Icon className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" /> : null}
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
