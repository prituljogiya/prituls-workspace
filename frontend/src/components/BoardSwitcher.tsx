'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Columns3, Search } from 'lucide-react';
import api from '@/lib/api';

type BoardOption = {
  id: string;
  name: string;
};

export function BoardSwitcher({
  projectId,
  currentBoardId,
  currentName,
}: {
  projectId?: string;
  currentBoardId?: string;
  currentName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api
      .get(`/boards/project/${projectId}`)
      .then((res) => {
        if (!cancelled) setBoards(res.data.boards || []);
      })
      .catch(() => {
        if (!cancelled) setBoards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) => b.name.toLowerCase().includes(q));
  }, [boards, query]);

  if (!projectId) return null;

  const label = currentName || boards.find((b) => b.id === currentBoardId)?.name || 'Boards';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 max-w-[280px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
        aria-expanded={open}
      >
        <Columns3 className="h-4 w-4 shrink-0 text-primary-600" />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-40 overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a board…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-500">No boards match</p>
            ) : (
              filtered.map((board) => {
                const href = `/projects/${projectId}/boards/${board.id}`;
                const active = currentBoardId === board.id || pathname === href;
                return (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQuery('');
                      router.push(href);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                      active
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <Columns3 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{board.name}</span>
                  </button>
                );
              })
            )}
          </div>
          <Link
            href={`/projects/${projectId}/boards`}
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40"
          >
            View all boards
          </Link>
        </div>
      )}
    </div>
  );
}
