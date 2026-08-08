'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Mail, Lock, LogIn } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const { login, logout } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      setLoading(true);
      setError('');

      const user = await login(data.email, data.password);
      if (
        user.role === 'SUPER_ADMIN' ||
        user.role === 'WORKSPACE_OWNER' ||
        user.role === 'PROJECT_MANAGER'
      ) {
        window.location.assign('/dashboard');
        return;
      }

      logout();
      setError(
        'Access denied. Admin privileges required. You need SUPER_ADMIN, WORKSPACE_OWNER, or PROJECT_MANAGER role.'
      );
      submittingRef.current = false;
      setLoading(false);
    } catch (err: any) {
      submittingRef.current = false;
      setError(
        err.message ||
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Login failed. Please check your credentials.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border-2 border-purple-200 text-gray-900 dark:text-white">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Login</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in with admin credentials</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  {...register('email')}
                  type="email"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="admin@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  {...register('password')}
                  type="password"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Signing in...' : 'Sign in as Admin'}
          </button>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Link href="/login" className="text-purple-600 hover:text-purple-500 font-medium">
                Regular User Login
              </Link>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Need admin access? Contact your system administrator
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

