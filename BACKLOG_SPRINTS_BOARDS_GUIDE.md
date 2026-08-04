# Understanding Backlog, Sprints, and Boards

## Overview

This guide explains how **Backlog**, **Sprints**, and **Boards** work together in the project management system.

## The Three Components

### 1. 📋 **Backlog** (Planning Stage)
- **Purpose**: A list of all planned tasks that haven't been assigned to active work yet
- **Location**: Project → Backlog page
- **Characteristics**:
  - Tasks have `isInBacklog: true`
  - Tasks can be in backlog without being on a board or in a sprint
  - Used for planning and prioritization
  - Tasks can be moved from backlog to sprints or boards

### 2. 🏃 **Sprints** (Time-Boxed Work)
- **Purpose**: Time-boxed work periods (typically 1-4 weeks) where tasks are committed for that period
- **Location**: Project → Sprints page
- **Characteristics**:
  - Sprints have start and end dates
  - Tasks can be added to sprints from backlog
  - Tasks in sprints can also be on boards
  - Used for Scrum/Agile methodology
  - Tracks sprint velocity and burndown charts

### 3. 📊 **Boards** (Visual Workflow)
- **Purpose**: Kanban-style visual boards with columns showing task workflow
- **Location**: Project → Boards page
- **Characteristics**:
  - Boards have columns (e.g., "To Do", "In Progress", "Done")
  - Tasks can be dragged between columns
  - Tasks can be on boards and in sprints simultaneously
  - Visual representation of work status

## How They Work Together

```
┌─────────────┐
│   BACKLOG   │  ← All planned tasks
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│   SPRINTS   │   │   BOARDS    │
│             │   │             │
│ Sprint 1    │   │ To Do       │
│ Sprint 2    │   │ In Progress │
│             │   │ Done        │
└─────────────┘   └─────────────┘
```

### Example Workflow:

1. **Planning Phase**:
   - Create tasks in **Backlog**
   - Prioritize and estimate tasks

2. **Sprint Planning**:
   - Create a Sprint (e.g., "Sprint 1: Jan 1-14")
   - Move tasks from **Backlog** to **Sprint**

3. **Active Work**:
   - Tasks in Sprint also appear on **Board**
   - Move tasks between board columns as work progresses
   - Update task status (To Do → In Progress → Done)

4. **Status Sync**:
   - When you change task status, it automatically moves to the matching column on the board
   - Status "In Progress" → Column "In Progress"
   - Status "Done" → Column "Done"

## Task States

A task can be in multiple states simultaneously:

- ✅ **In Backlog**: `isInBacklog: true`
- ✅ **In Sprint**: `sprintId: "sprint-123"`
- ✅ **On Board**: `boardId: "board-456"`, `columnId: "column-789"`
- ✅ **Status**: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `BLOCKED`

**Example**: A task can be:
- In Backlog: ❌ (moved to sprint)
- In Sprint: ✅ Sprint 1
- On Board: ✅ Board "Development" → Column "In Progress"
- Status: `IN_PROGRESS`

## Common Operations

### Moving Tasks

1. **Backlog → Sprint**:
   - Go to Backlog page
   - Select task(s)
   - Click "Move to Sprint"
   - Choose sprint

2. **Backlog → Board**:
   - Go to Backlog page
   - Click "Move to Board" on a task
   - Task appears on board in "To Do" column

3. **Sprint → Board**:
   - Tasks in sprint can be added to boards
   - They appear in the appropriate column based on status

4. **Board Column → Board Column**:
   - Drag and drop tasks between columns
   - Or change status in task details (auto-moves to matching column)

### Status and Column Mapping

When you change a task's status, it automatically moves to the matching column:

| Status | Column Name |
|--------|-------------|
| `TODO` | "To Do" |
| `IN_PROGRESS` | "In Progress" |
| `IN_REVIEW` | "In Review" |
| `DONE` | "Done" |
| `BLOCKED` | "Blocked" |

**Note**: Column names are case-insensitive. If a matching column doesn't exist, the status is updated but the task stays in its current column.

## Best Practices

1. **Start with Backlog**: Create all tasks in backlog first
2. **Plan Sprints**: Move tasks from backlog to sprints during sprint planning
3. **Use Boards for Daily Work**: View and manage tasks on boards during active work
4. **Keep Status Updated**: Update task status as work progresses (auto-syncs with columns)
5. **Review Sprint Progress**: Use burndown charts to track sprint progress

## Visual Example

```
Project: "Website Redesign"
│
├── Backlog (10 tasks)
│   ├── Task A (not in sprint/board)
│   ├── Task B (not in sprint/board)
│   └── ...
│
├── Sprint 1: Jan 1-14 (5 tasks)
│   ├── Task C → Board "Dev" → Column "In Progress"
│   ├── Task D → Board "Dev" → Column "To Do"
│   └── ...
│
└── Board "Development" (3 columns)
    ├── To Do (2 tasks)
    ├── In Progress (1 task)
    └── Done (0 tasks)
```

## FAQ

**Q: Can a task be in backlog and on a board?**
A: No. When you move a task to a board, it's removed from backlog (`isInBacklog: false`).

**Q: Can a task be in a sprint and on a board?**
A: Yes! Tasks can be in sprints and on boards simultaneously. This is common.

**Q: What happens when I change task status?**
A: If the task is on a board, it automatically moves to the column matching the new status (if that column exists).

**Q: How do I remove a task from a sprint?**
A: Go to the Sprint detail page and click "Remove" on the task.

**Q: How do I remove a task from a board?**
A: Move it back to backlog, or delete the task.

