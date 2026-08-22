'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import api from '@/lib/api';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionContext';

interface BoardViewProps {
  boardId: string;
  projectId: string;
}

export function BoardView({ boardId, projectId }: BoardViewProps) {
  const { can } = usePermissions();
  const canManageBoard = can('boards.manage');
  const canMoveTasks = can('tasks.edit');
  const [board, setBoard] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchBoard();
  }, [boardId]);

  const fetchBoard = async () => {
    try {
      const response = await api.get(`/boards/${boardId}`);
      setBoard(response.data.board);
      setColumns(response.data.board.columns || []);
      
      // Flatten all tasks from columns
      const allTasks: any[] = [];
      response.data.board.columns?.forEach((col: any) => {
        col.tasks?.forEach((task: any) => {
          allTasks.push({ ...task, columnId: col.id });
        });
      });
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to fetch board:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canMoveTasks && !canManageBoard) return;
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a task
    const activeTask = tasks.find(t => t.id === activeId);
    if (activeTask) {
      // Check if dropped on a column
      const targetColumn = columns.find(c => c.id === overId);
      if (targetColumn && targetColumn.id !== activeTask.columnId) {
        // Move task to new column
        try {
          // Map column name to status
          const columnNameToStatus: Record<string, string> = {
            'to do': 'TODO',
            'todo': 'TODO',
            'in progress': 'IN_PROGRESS',
            'inprogress': 'IN_PROGRESS',
            'in review': 'IN_REVIEW',
            'inreview': 'IN_REVIEW',
            'review': 'IN_REVIEW',
            'done': 'DONE',
            'blocked': 'BLOCKED',
          };
          
          const targetStatus = columnNameToStatus[targetColumn.name.toLowerCase()];
          
          // Update task column and status
          await api.patch(`/tasks/${activeId}/move`, {
            columnId: targetColumn.id,
            boardId: boardId,
            order: 0,
          });
          
          // Also update status if column name matches a status
          if (targetStatus && targetStatus !== activeTask.status) {
            try {
              await api.patch(`/tasks/${activeId}`, { status: targetStatus });
            } catch (statusError) {
              console.error('Failed to update status:', statusError);
            }
          }
          
          // Refresh board to get updated data
          fetchBoard();
        } catch (error) {
          console.error('Failed to move task:', error);
          fetchBoard(); // Refresh on error
        }
      }
      return;
    }

    // Check if dragging a column
    const activeColumnIndex = columns.findIndex(c => c.id === activeId);
    const overColumnIndex = columns.findIndex(c => c.id === overId);

    if (activeColumnIndex !== -1 && overColumnIndex !== -1 && activeColumnIndex !== overColumnIndex) {
      const newColumns = arrayMove(columns, activeColumnIndex, overColumnIndex);
      setColumns(newColumns);

      // Update column orders
      try {
        const columnOrders = newColumns.map((col, index) => ({
          columnId: col.id,
          order: index,
        }));
        await api.patch(`/boards/${boardId}/columns/reorder`, { columnOrders });
      } catch (error) {
        console.error('Failed to reorder columns:', error);
        fetchBoard(); // Refresh on error
      }
    }
  };

  const createColumn = async (name: string) => {
    try {
      const response = await api.post(`/boards/${boardId}/columns`, { name });
      setColumns([...columns, response.data.column]);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create column');
    }
  };

  const createTask = async (columnId: string, title: string) => {
    try {
      const response = await api.post('/tasks', {
        title,
        projectId,
        boardId,
        columnId,
        issueType: 'TASK',
      });
      setTasks([...tasks, { ...response.data.task, columnId }]);
      fetchBoard(); // Refresh to get full task data
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create task');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 h-full px-4">
          <SortableContext
            items={columns.map(c => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => {
              const columnTasks = tasks.filter(t => t.columnId === column.id);
              return (
                <Column
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onCreateTask={createTask}
                />
              );
            })}
          </SortableContext>

          {/* Add Column Button */}
          {canManageBoard && (
          <div className="min-w-[280px] flex-shrink-0">
            <button
              onClick={() => {
                const name = prompt('Column name:');
                if (name) createColumn(name);
              }}
              className="w-full h-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-white dark:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Add Column</span>
            </button>
          </div>
          )}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 min-w-[280px]">
              <h4 className="font-medium text-sm text-gray-900 dark:text-white">{activeTask.title}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

