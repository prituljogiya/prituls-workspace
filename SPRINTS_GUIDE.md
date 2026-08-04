# Sprints Guide - How Sprints Work in This System

## 🎯 What Are Sprints?

Sprints are **time-boxed periods** (usually 1-4 weeks) where teams work on a set of tasks to achieve a specific goal. This is a core concept from **Agile/Scrum** methodology.

## 📍 Where to Use Sprints

### 1. **Project Planning**
- Break down large projects into manageable time periods
- Set clear goals for each sprint
- Track progress over time

### 2. **Task Organization**
- Group related tasks together
- Focus team efforts on specific features
- Manage workload effectively

### 3. **Progress Tracking**
- Monitor how much work is completed vs. planned
- Use burndown charts to visualize progress
- Identify if you're on track to meet sprint goals

## 🔄 How Sprints Work - Step by Step

### Step 1: Create a Sprint
1. Go to your project: `/projects/[projectId]/sprints`
2. Click **"New Sprint"** button
3. Fill in:
   - **Sprint Name**: e.g., "Sprint 1 - User Authentication"
   - **Start Date**: When the sprint begins
   - **End Date**: When the sprint ends (usually 1-4 weeks later)
   - **Goal**: What you want to achieve in this sprint
4. Click **"Create"**

**Status**: `PLANNED` (not started yet)

### Step 2: Add Tasks to Sprint

#### Option A: From Backlog
1. Go to **Backlog** page: `/projects/[projectId]/backlog`
2. Select tasks you want to add (checkboxes)
3. Click **"Move to Sprint"**
4. Choose the sprint from the list

#### Option B: From Sprint Detail Page
1. Open a sprint: `/projects/[projectId]/sprints/[sprintId]`
2. In the right sidebar, you'll see **"Add from Backlog"**
3. Click the arrow (→) next to a task to add it to the sprint

**Important**: Tasks need **Story Points** for burndown charts to work!

### Step 3: Start the Sprint
1. On the sprints page, find your planned sprint
2. Click **"Start"** button
3. Status changes to `ACTIVE`
4. Team can now work on sprint tasks

### Step 4: Track Progress

#### View Burndown Chart
1. Click **"Burndown"** button on an active sprint
2. The chart shows:
   - **Remaining Points**: How many story points are left
   - **Ideal Line**: Where you should be if on track
   - **Actual Line**: Where you actually are

#### Update Task Status
- As tasks are completed, update their status to `DONE`
- The burndown chart updates automatically
- Story points are counted when tasks are marked as `DONE`

### Step 5: End the Sprint
1. When sprint period ends, click **"End"** button
2. Status changes to `COMPLETED`
3. Review what was accomplished
4. Plan next sprint

## 📊 Key Features

### 1. **Burndown Chart**
- Shows if you're on track to complete all sprint tasks
- Compares actual progress vs. ideal progress
- Helps identify if sprint goals are achievable

### 2. **Story Points**
- Tasks should have story points assigned (1, 2, 3, 5, 8, etc.)
- Story points represent effort/complexity
- Burndown chart uses story points to track progress

### 3. **Sprint Status**
- **PLANNED**: Sprint created but not started
- **ACTIVE**: Sprint is currently running
- **COMPLETED**: Sprint has ended

## ⚠️ Common Issues & Solutions

### Issue 1: Burndown Chart Not Showing
**Problem**: Chart is empty or shows error

**Solutions**:
- ✅ Make sure sprint has **start date** and **end date** set
- ✅ Tasks in sprint need **story points** assigned
- ✅ Sprint must be **ACTIVE** or **COMPLETED** (not PLANNED)

### Issue 2: Can't Add Tasks to Sprint
**Problem**: Tasks don't appear in backlog or can't be moved

**Solutions**:
- ✅ Tasks must be in **backlog** first (`isInBacklog: true`)
- ✅ Create tasks in backlog, then move them to sprint
- ✅ Check you have permission (PROJECT_MANAGER role)

### Issue 3: Story Points Not Counting
**Problem**: Burndown shows 0 story points

**Solutions**:
- ✅ Edit tasks and add story points (1, 2, 3, 5, 8, etc.)
- ✅ Story points are in task detail page sidebar
- ✅ Burndown only counts tasks with story points

### Issue 4: Tasks Not Moving to Sprint
**Problem**: Clicking "Move to Sprint" doesn't work

**Solutions**:
- ✅ Check browser console for errors
- ✅ Verify you're logged in with correct role
- ✅ Make sure sprint exists and is in PLANNED or ACTIVE status

## 🎯 Best Practices

### 1. **Sprint Planning**
- Plan sprints 1-2 weeks in advance
- Set realistic goals
- Include buffer time for unexpected issues

### 2. **Task Management**
- Add story points to all sprint tasks
- Break large tasks into smaller ones
- Prioritize tasks by importance

### 3. **Daily Standups**
- Review burndown chart daily
- Update task statuses regularly
- Identify blockers early

### 4. **Sprint Review**
- Review completed work at sprint end
- Analyze burndown chart for insights
- Use velocity (completed story points) to plan next sprint

## 📍 Navigation Paths

1. **Create Sprint**: `/projects/[id]/sprints` → Click "New Sprint"
2. **View Sprints**: `/projects/[id]/sprints`
3. **Sprint Detail**: `/projects/[id]/sprints/[sprintId]`
4. **Backlog**: `/projects/[id]/backlog`
5. **Add Tasks**: Backlog → Select tasks → "Move to Sprint"

## 🔧 Technical Details

### Sprint States
```typescript
PLANNED → ACTIVE → COMPLETED
```

### Task Flow
```
Backlog → Sprint → Board → Done
```

### Burndown Calculation
- **Total Points**: Sum of all story points in sprint
- **Completed Points**: Sum of story points for tasks marked DONE
- **Remaining Points**: Total - Completed
- **Ideal Line**: Linear decrease from total to 0

## 💡 Example Workflow

1. **Week 1 - Planning**:
   - Create "Sprint 1" (2 weeks)
   - Add 10 tasks from backlog (total: 50 story points)
   - Set goal: "Complete user authentication feature"

2. **Week 1 - Start**:
   - Start sprint
   - Team begins working on tasks
   - Update task statuses as work progresses

3. **Week 2 - Mid Sprint**:
   - Check burndown chart
   - 25 story points completed (on track!)
   - 25 story points remaining

4. **Week 3 - End Sprint**:
   - End sprint
   - Review: 48/50 story points completed
   - Plan Sprint 2 with remaining tasks

## 🚀 Quick Start Checklist

- [ ] Create a project
- [ ] Add tasks to backlog
- [ ] Assign story points to tasks
- [ ] Create a sprint with dates
- [ ] Move tasks from backlog to sprint
- [ ] Start the sprint
- [ ] View burndown chart
- [ ] Update task statuses as work progresses
- [ ] End sprint when complete

## 📞 Need Help?

If sprints aren't working:
1. Check browser console for errors
2. Verify backend is running on port 5001
3. Check user permissions (role)
4. Ensure tasks have story points
5. Verify sprint has start/end dates

