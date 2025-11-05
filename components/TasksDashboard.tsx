import React, { useState, useEffect, useMemo } from 'react';
import { type Task, type TaskStatus, type AdminUser } from '../types';
import { getTasks, saveTask, getAdminUsers, deleteTask } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { TaskEditorModal } from './TaskEditorModal';

interface TasksDashboardProps {
  adminToken: string;
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'completed', title: 'Completed' },
];

const DueDateDisplay: React.FC<{ dueDate: string }> = ({ dueDate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const dueTimestamp = due.getTime();

  let color = 'text-gray-500 dark:text-gray-400';
  let text = new Date(year, month - 1, day + 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (dueTimestamp < todayTimestamp) {
    color = 'text-red-600 dark:text-red-500 font-semibold';
    text += ' (Overdue)';
  } else if (dueTimestamp === todayTimestamp) {
    color = 'text-orange-600 dark:text-orange-500 font-semibold';
    text = 'Today';
  }

  return (
    <div className={`flex items-center space-x-1.5 text-xs ${color}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      <span>{text}</span>
    </div>
  );
};

const TaskCard: React.FC<{ task: Task; onClick: () => void; adminUsers: AdminUser[] }> = ({ task, onClick, adminUsers }) => {
  const assignee = adminUsers.find(u => u.email === task.assigneeEmail);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id);
      }}
      onClick={onClick}
      className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg cursor-pointer border border-gray-200 dark:border-gray-700"
    >
      <h4 className="font-semibold text-gray-800 dark:text-gray-200">{task.title}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
        {task.dueDate ? <DueDateDisplay dueDate={task.dueDate} /> : <div />}
        {assignee && <div className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">{assignee.email.charAt(0).toUpperCase()}</div>}
      </div>
    </div>
  );
};

export const TasksDashboard: React.FC<TasksDashboardProps> = ({ adminToken }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tasksData, usersData] = await Promise.all([
        getTasks(adminToken, 'main-event'),
        getAdminUsers(adminToken),
      ]);
      setTasks(tasksData);
      setAdminUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [adminToken]);

  const tasksByStatus = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc[task.status] = acc[task.status] || [];
      acc[task.status].push(task);
      return acc;
    }, {} as Record<TaskStatus, Task[]>);
  }, [tasks]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      try {
        await saveTask(adminToken, { ...task, status });
      } catch (err) {
        setError('Failed to update task status.');
        fetchData(); // Revert optimistic update on failure
      }
    }
  };

  const handleSaveTask = async (data: Partial<Task>): Promise<boolean> => {
    try {
      await saveTask(adminToken, { ...data, eventId: 'main-event' });
      await fetchData();
      return true;
    } catch (err) {
      alert(`Error saving task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
        try {
            await deleteTask(adminToken, taskId);
            await fetchData();
            return true;
        } catch(err) {
            alert(`Error deleting task: ${err instanceof Error ? err.message : 'Unknown error'}`);
            return false;
        }
    }
    return false;
  };
  
  if (isLoading) {
    return <ContentLoader text="Loading tasks..." />;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Task Board</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Organize and track your event planning tasks.</p>
        </div>
        <button
          onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
          className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90"
        >
          Add Task
        </button>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMNS.map(col => (
          <div key={col.id} className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4">
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 px-2 pb-3 border-b-2 border-gray-200 dark:border-gray-700">
              {col.title}
              <span className="ml-2 text-sm text-gray-500">{tasksByStatus[col.id]?.length || 0}</span>
            </h3>
            <div
              onDrop={(e) => handleDrop(e, col.id)}
              onDragOver={(e) => e.preventDefault()}
              className="mt-4 space-y-4 min-h-[200px]"
            >
              {tasksByStatus[col.id]?.map(task => (
                <TaskCard 
                    key={task.id} 
                    task={task}
                    adminUsers={adminUsers}
                    onClick={() => { setEditingTask(task); setIsModalOpen(true); }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <TaskEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={editingTask}
        adminUsers={adminUsers}
      />
    </>
  );
};