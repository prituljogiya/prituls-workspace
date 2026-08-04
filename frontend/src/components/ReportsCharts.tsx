'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type NamedValue = { name: string; value: number };

function ChartFrame({ children }: { children: React.ReactNode }) {
  return <div className="w-full h-[300px] min-h-[300px]">{children}</div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-gray-500 dark:text-gray-400 text-center py-16 text-sm">{message}</p>
  );
}

export function ProductivityChart({
  data,
}: {
  data: Array<{ name: string; totalTasks: number; completedTasks: number }>;
}) {
  if (!data.length) {
    return <EmptyState message="No productivity data yet. Assign tasks to team members." />;
  }

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
          <XAxis dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis allowDecimals={false} stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 8,
              color: '#f3f4f6',
            }}
          />
          <Legend />
          <Bar dataKey="totalTasks" fill="#3b82f6" name="Total Tasks" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completedTasks" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DistributionPie({
  data,
  emptyMessage,
}: {
  data: NamedValue[];
  emptyMessage: string;
}) {
  const chartData = data.filter((d) => d.value > 0);
  if (!chartData.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            labelLine={false}
            label={({ name, percent }) =>
              `${name} ${((percent || 0) * 100).toFixed(0)}%`
            }
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 8,
              color: '#f3f4f6',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function VelocityChart({
  data,
  averageVelocity,
}: {
  data: Array<{
    sprintName: string;
    totalStoryPoints: number;
    completedStoryPoints: number;
  }>;
  averageVelocity: number;
}) {
  if (!data.length) {
    return <EmptyState message="No completed sprints yet. Finish a sprint to see velocity." />;
  }

  return (
    <>
      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
            <XAxis dataKey="sprintName" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: 8,
                color: '#f3f4f6',
              }}
            />
            <Legend />
            <Bar dataKey="totalStoryPoints" fill="#94a3b8" name="Total Points" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="completedStoryPoints"
              fill="#10b981"
              name="Completed Points"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Average Velocity:{' '}
          <span className="font-bold text-primary-600 dark:text-primary-400">{averageVelocity}</span>{' '}
          story points
        </p>
      </div>
    </>
  );
}
