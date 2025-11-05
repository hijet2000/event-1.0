import React, { useState, useEffect } from 'react';
import { type Task, type AdminUser, type TaskStatus } from '../types';
import { Spinner } from './Spinner';

interface TaskEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<boolean>;
  onDelete: (taskId: string) => Promise<boolean>;
  task: Task | null;
  adminUsers: AdminUser[];
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

const TextareaField: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <textarea {...props} rows={4} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({ isOpen, onClose, onSave, onDelete, task, adminUsers }) => {
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isNewTask = !task;

  useEffect(() => {
    if (isOpen) {
      setFormData(task ? { ...task } : {
        title: '',
        description: '',
        status: 'todo',
        dueDate: '',
        assigneeEmail: '',
      });
      setError(null);
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value || null }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      setError("Title is required.");
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    const success = await onSave({ ...task, ...formData });
    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (task) {
      setIsDeleting(true);
      const success = await onDelete(task.id);
      setIsDeleting(false);
      if (success) {
        onClose();
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-editor-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSave}>
          <div className="p-6">
            <h2 id="task-editor-title" className="text-xl font-bold text-gray-900 dark:text-white">{isNewTask ? 'Add New Task' : 'Edit Task'}</h2>
          </div>
          
          <div className="p-6 space-y-4 border-t border-b border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-y-auto">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            
            <InputField label="Title" id="title" name="title" type="text" value={formData.title || ''} onChange={handleChange} required />
            <TextareaField label="Description" id="description" name="description" value={formData.description || ''} onChange={handleChange} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="status" className="block text-sm font-medium mb-1">Status</label>
                    <select id="status" name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700">
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="assigneeEmail" className="block text-sm font-medium mb-1">Assignee</label>
                    <select id="assigneeEmail" name="assigneeEmail" value={formData.assigneeEmail || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700">
                        <option value="">Unassigned</option>
                        {adminUsers.map(user => <option key={user.id} value={user.email}>{user.email}</option>)}
                    </select>
                </div>
            </div>
             <InputField label="Due Date" id="dueDate" name="dueDate" type="date" value={formData.dueDate || ''} onChange={handleChange} />
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
            <div>
              {!isNewTask && (
                <button 
                    type="button" 
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="py-2 px-4 border border-transparent rounded-md text-sm font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center disabled:opacity-50"
                >
                  {isDeleting ? <Spinner /> : 'Delete'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
                <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Cancel</button>
                <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50">
                {isSaving ? <><Spinner /> Saving...</> : 'Save Task'}
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};