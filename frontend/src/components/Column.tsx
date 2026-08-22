'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { Plus, MoreVertical } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/contexts/PermissionContext';

interface ColumnProps {
  column: any;
  tasks: any[];
  onCreateTask: (columnId: string, title: string) => void;
}

export function Column({ column, tasks, onCreateTask }: ColumnProps) {
  const { can } = usePermissions();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const canAddTask = can('tasks.create');

  const handleCreateTask = () => {
    if (newTaskTitle.trim()) {
      onCreateTask(column.id, newTaskTitle.trim());
      setNewTaskTitle('');
      setShowAddTask(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="min-w-[280px] w-[280px] flex-shrink-0 bg-gray-100/90 dark:bg-gray-800/70 rounded-xl flex flex-col max-h-full border border-gray-200/70 dark:border-gray-700/70"
    >
      <div
        className="h-1 rounded-t-xl shrink-0"
        style={{ backgroundColor: column.color || '#94a3b8' }}
      />
      <div
        {...attributes}
        {...listeners}
        className="px-3 py-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200 truncate">{column.name}</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-900/50 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button className="p-1 hover:bg-gray-200/70 dark:hover:bg-gray-700 rounded transition-colors">
          <MoreVertical className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto ui-scroll space-y-2 p-2 min-h-[120px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-6">No tasks</p>
        )}
      </div>

      {showAddTask ? (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTask();
              if (e.key === 'Escape') {
                setShowAddTask(false);
                setNewTaskTitle('');
              }
            }}
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
            placeholder="Enter task title..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateTask}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddTask(false);
                setNewTaskTitle('');
              }}
              className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        canAddTask && (
          <button
            onClick={() => setShowAddTask(true)}
            className="mx-2 mb-2 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        )
      )}
    </div>
  );
}

