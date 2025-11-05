import React, { useState, useEffect } from 'react';
import { type AdminUser, type Role } from '../types';
import { getAdminUsers, getRoles, saveAdminUser, deleteAdminUser, saveRole, deleteRole } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { UserEditorModal } from './UserEditorModal';
import { RoleEditorModal } from './RoleEditorModal';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

interface UsersAndRolesDashboardProps {
  adminToken: string;
}

export const UsersAndRolesDashboard: React.FC<UsersAndRolesDashboardProps> = ({ adminToken }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
        const [usersData, rolesData] = await Promise.all([
            getAdminUsers(adminToken),
            getRoles(adminToken)
        ]);
        setUsers(usersData);
        setRoles(rolesData);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [adminToken]);

  const handleSaveUser = async (data: Partial<AdminUser> & { password?: string }): Promise<boolean> => {
    try {
        await saveAdminUser(adminToken, { ...editingUser, ...data });
        await fetchData();
        return true;
    } catch (err) {
        alert(`Error saving user: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return false;
    }
  };
  
  const handleSaveRole = async (data: Partial<Role>): Promise<boolean> => {
    try {
        await saveRole(adminToken, { ...editingRole, ...data });
        await fetchData();
        return true;
    } catch (err) {
        alert(`Error saving role: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return false;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            await deleteAdminUser(adminToken, userId);
            await fetchData();
        } catch (err) {
            alert(`Error deleting user: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
        try {
            await deleteRole(adminToken, roleId);
            await fetchData();
        } catch (err) {
            alert(`Error deleting role: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
  };

  if (isLoading) {
    return <ContentLoader text="Loading users and roles..." />;
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }
  
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Users & Roles</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage who can access and administer your events.</p>

      {/* Users Section */}
      <section className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Admin Users</h3>
          <button onClick={() => { setEditingUser(null); setUserModalOpen(true); }} className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90">Add User</button>
        </div>
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map(user => (
                <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{roles.find(r => r.id === user.roleId)?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <button onClick={() => { setEditingUser(user); setUserModalOpen(true); }} className="text-primary hover:underline">Edit</button>
                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:underline dark:text-red-500">Delete</button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Roles Section */}
      <section className="mt-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Roles</h3>
           <button onClick={() => { setEditingRole(null); setRoleModalOpen(true); }} className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90">Add Role</button>
        </div>
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {roles.map(role => (
                <tr key={role.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{role.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{role.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <button onClick={() => { setEditingRole(role); setRoleModalOpen(true); }} className="text-primary hover:underline">Edit</button>
                        <button onClick={() => handleDeleteRole(role.id)} className="text-red-600 hover:underline dark:text-red-500">Delete</button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <UserEditorModal 
        isOpen={isUserModalOpen}
        onClose={() => setUserModalOpen(false)}
        onSave={handleSaveUser}
        user={editingUser}
        roles={roles}
      />
      <RoleEditorModal
        isOpen={isRoleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        onSave={handleSaveRole}
        role={editingRole}
      />
    </div>
  );
};