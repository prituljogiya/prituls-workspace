'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { User, Calendar, Tag, MessageSquare, CheckSquare } from 'lucide-react';

interface TaskCardProps {
  task: any;
}

export function TaskCard({ task }: TaskCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getIssueTypeColor = (type: string) => {
    switch (type) {
      case 'BUG': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'STORY': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'EPIC': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 3) return 'bg-red-500';
    if (priority >= 2) return 'bg-orange-500';
    if (priority >= 1) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all group relative"
    >
      {/* Drag Handle - Small area on the left for dragging */}
      <div
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-l"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-3 h-3 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="2" cy="2" r="0.8" />
            <circle cx="5" cy="2" r="0.8" />
            <circle cx="8" cy="2" r="0.8" />
            <circle cx="2" cy="5" r="0.8" />
            <circle cx="5" cy="5" r="0.8" />
            <circle cx="8" cy="5" r="0.8" />
            <circle cx="2" cy="8" r="0.8" />
            <circle cx="5" cy="8" r="0.8" />
            <circle cx="8" cy="8" r="0.8" />
          </svg>
        </div>
      </div>
      
      {/* Clickable Content Area - Most of the card is clickable */}
      <div
        onClick={() => router.push(`/projects/${task.projectId}/tasks/${task.id}`)}
        className="p-3 pl-8 cursor-pointer"
      >
      {/* Issue Type Badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getIssueTypeColor(task.issueType)} dark:bg-opacity-20`}>
          {task.issueType}
        </span>
        <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority || 0)} flex-shrink-0`} title={`Priority ${task.priority || 0}`} />
      </div>

      {/* Title */}
      <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {task.title}
      </h4>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 2).map((label: any) => (
            <span
              key={label.id}
              className="px-1.5 py-0.5 text-xs font-medium rounded text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
          {task.labels.length > 2 && (
            <span className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
              +{task.labels.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          {task.assignments && task.assignments.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignments.slice(0, 2).map((assignment: any) => (
                <div
                  key={assignment.user.id}
                  className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center border border-white dark:border-gray-800 font-medium"
                  title={assignment.user.firstName + ' ' + assignment.user.lastName}
                >
                  {assignment.user.firstName[0]}{assignment.user.lastName[0]}
                </div>
              ))}
              {task.assignments.length > 2 && (
                <div className="w-5 h-5 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-xs flex items-center justify-center border border-white dark:border-gray-800 font-medium">
                  +{task.assignments.length - 2}
                </div>
              )}
            </div>
          )}
          {task.storyPoints && (
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-1">
              {task.storyPoints} SP
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {task.dueDate && (
            <div className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          {task._count?.comments > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {task._count.comments}
            </span>
          )}
          {task.checklist && Array.isArray(task.checklist) && task.checklist.length > 0 && (
            <span className="flex items-center gap-0.5">
              <CheckSquare className="h-3 w-3" />
              {task.checklist.filter((item: any) => item.isChecked).length}/{task.checklist.length}
            </span>
          )}
          {!task.checklist && task._count?.checklist > 0 && (
            <span className="flex items-center gap-0.5">
              <CheckSquare className="h-3 w-3" />
              {task._count.checklist}
            </span>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

