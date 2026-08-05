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
import { Plus, MoreVertical } from 'lucide-react';

interface BoardViewProps {
  boardId: string;
  projectId: string;
}

export function BoardView({ boardId, projectId }: BoardViewProps) {
  const [board, setBoard] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sprintFilter, setSprintFilter] = useState<'all' | 'active'>('active');
  const [activeSprintName, setActiveSprintName] = useState<string | null>(null);

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
          allTasks.push({ ...task, columnId: col.id, projectId });
        });
      });
      setTasks(allTasks);

      const active = allTasks.find((t) => t.sprint?.status === 'ACTIVE')?.sprint;
      setActiveSprintName(active?.name || null);
      setSprintFilter(active ? 'active' : 'all');
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
        // Move task to new column (status synced on server from column name)
        try {
          await api.patch(`/tasks/${activeId}/move`, {
            columnId: targetColumn.id,
            boardId: boardId,
            order: 0,
          });

          // Refresh board to get updated data (keeps sprint relation + DONE status)
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
  const visibleTasks =
    sprintFilter === 'active'
      ? tasks.filter((t) => t.sprint?.status === 'ACTIVE')
      : tasks;

  return (
    <div className="h-full min-h-0 bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {sprintFilter === 'active' && activeSprintName
            ? `Showing active sprint: ${activeSprintName}`
            : 'Showing all board tasks'}
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setSprintFilter('active')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sprintFilter === 'active'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Active sprint
          </button>
          <button
            onClick={() => setSprintFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sprintFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            All tasks
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0 px-4 items-stretch">
          <SortableContext
            items={columns.map(c => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => {
              const columnTasks = visibleTasks.filter(t => t.columnId === column.id);
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

          {/* Add Column Button - Jira Style */}
          <div className="w-[280px] min-w-[280px] max-w-[280px] flex-shrink-0">
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
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[280px]">
              <h4 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-4 break-words">{activeTask.title}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

