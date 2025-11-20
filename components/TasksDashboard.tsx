
import React, { useState, useEffect, useMemo } from 'react';
import { type Task, type TaskStatus, type AdminUser, type TaskPriority } from '../types';
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

const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
    const colors = {
        high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    };
    return (
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${colors[priority] || colors.low}`}>
            {priority}
        </span>
    );
};

const DueDateDisplay: React.FC<{ dueDate: string }> = ({ dueDate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const dueTimestamp = due.getTime();

  let color = 'text-gray-500 dark:text-gray-400';
  let text = new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (dueTimestamp < todayTimestamp) {
    color = 'text-red-600 dark:text-red-400 font-semibold';
    text += ' (Overdue)';
  } else if (dueTimestamp === todayTimestamp) {
    color = 'text-orange-600 dark:text-orange-400 font-semibold';
    text = 'Today';
  }

  return (
    <div className={`flex items-center space-x-1.5 text-xs ${color}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      <span>{text}</span>
    </div>
  );
};

const AssigneeAvatar: React.FC<{ email: string }> = ({ email }) => (
    <div 
        className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
        title={email}
    >
        {email.charAt(0).toUpperCase()}
    </div>
);

const TaskCard: React.FC<{ task: Task; onClick: () => void; adminUsers: AdminUser[] }> = ({ task, onClick, adminUsers }) => {
  const assignee = adminUsers.find(u => u.email === task.assigneeEmail);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id);
      }}
      onClick={onClick}
      className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md cursor-pointer border border-gray-200 dark:border-gray-700 transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex justify-between items-start mb-2">
          <PriorityBadge priority={task.priority || 'medium'} />
          {assignee && <AssigneeAvatar email={assignee.email} />}
      </div>
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{task.title}</h4>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
        {task.dueDate ? <DueDateDisplay dueDate={task.dueDate} /> : <span className="text-xs text-gray-400">No due date</span>}
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
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  const fetchData = async () => {
    try {
      // Keep loading state minimal for refreshes
      if (tasks.length === 0) setIsLoading(true);
      
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

  const filteredTasks = useMemo(() => {
      return tasks.filter(t => {
          const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesAssignee = !filterAssignee || t.assigneeEmail === filterAssignee;
          return matchesSearch && matchesAssignee;
      });
  }, [tasks, searchQuery, filterAssignee]);

  const tasksByStatus = useMemo(() => {
    return filteredTasks.reduce((acc, task) => {
      acc[task.status] = acc[task.status] || [];
      acc[task.status].push(task);
      return acc;
    }, {} as Record<TaskStatus, Task[]>);
  }, [filteredTasks]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      try {
        await saveTask(adminToken, { ...task, status });
      } catch (err) {
        setError('Failed to update task status.');
        fetchData(); // Revert
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Task Board</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage event tasks and track progress.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
             {/* Filters */}
             <div className="relative flex-grow md:flex-grow-0">
                <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-primary focus:border-primary"
                />
             </div>
             <select 
                value={filterAssignee}
                onChange={e => setFilterAssignee(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-primary focus:border-primary"
             >
                 <option value="">All Assignees</option>
                 {adminUsers.map(u => <option key={u.id} value={u.email}>{u.email}</option>)}
             </select>
             <button
                onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
                className="flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md shadow-sm hover:bg-primary/90 text-sm font-medium whitespace-nowrap"
             >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                 New Task
             </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-220px)] overflow-y-auto md:overflow-hidden pb-4">
        {COLUMNS.map(col => (
          <div key={col.id} className="flex flex-col bg-gray-100 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 h-full max-h-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-t-xl">
                <h3 className="font-bold text-gray-700 dark:text-gray-200">{col.title}</h3>
                <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs font-bold">
                    {tasksByStatus[col.id]?.length || 0}
                </span>
            </div>
            
            <div
              onDrop={(e) => handleDrop(e, col.id)}
              onDragOver={(e) => e.preventDefault()}
              className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[150px]"
            >
              {tasksByStatus[col.id]?.map(task => (
                <TaskCard 
                    key={task.id} 
                    task={task}
                    adminUsers={adminUsers}
                    onClick={() => { setEditingTask(task); setIsModalOpen(true); }}
                />
              ))}
              {(!tasksByStatus[col.id] || tasksByStatus[col.id].length === 0) && (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg m-2">
                      Drop items here
                  </div>
              )}
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
