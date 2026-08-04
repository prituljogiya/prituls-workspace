'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, ArrowLeft, FolderKanban } from 'lucide-react';
import api from '@/lib/api';

const schema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setError('Missing reset token. Use the link from forgot password.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      });
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
      <div className="text-center">
        <div className="mx-auto w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
          <FolderKanban className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Reset password</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Choose a new password for your account.</p>
      </div>

      {!token && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded text-sm">
          No token in the URL. Go to{' '}
          <Link href="/forgot-password" className="underline font-medium">
            Forgot password
          </Link>{' '}
          first.
        </div>
      )}

      {done ? (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded text-sm text-center">
          Password updated. Redirecting to sign in…
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                {...register('password')}
                id="password"
                type="password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Confirm password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                {...register('confirmPassword')}
                id="confirmPassword"
                type="password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-950 dark:to-gray-900 px-4">
      <Suspense
        fallback={
          <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
