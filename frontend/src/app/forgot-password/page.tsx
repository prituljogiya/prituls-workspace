'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, FolderKanban, Copy, Check } from 'lucide-react';
import api from '@/lib/api';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError('');
      setResetUrl('');
      const res = await api.post('/auth/forgot-password', { email: data.email });
      if (res.data.resetUrl) {
        // Prefer current site origin so a wrong FRONTEND_URL env still works
        try {
          const u = new URL(res.data.resetUrl);
          u.protocol = window.location.protocol;
          u.host = window.location.host;
          setResetUrl(u.toString());
        } catch {
          setResetUrl(res.data.resetUrl);
        }
      } else {
        setError(
          res.data.message ||
            'If that email exists, a reset link was sent. (Email sending may be disabled — try again or contact admin.)'
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!resetUrl) return;
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <div className="mx-auto w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
            <FolderKanban className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Forgot password</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your email and we&apos;ll generate a reset link (shown below for testing).
          </p>
        </div>

        {!resetUrl ? (
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Get reset link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded text-sm">
              Reset link ready (expires in 1 hour). Open it or copy it below.
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 break-all text-xs text-gray-700 dark:text-gray-300">
              {resetUrl}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <Link
                href={(() => {
                  try {
                    const u = new URL(resetUrl);
                    return `${u.pathname}${u.search}`;
                  } catch {
                    return resetUrl;
                  }
                })()}
                className="flex-1 inline-flex items-center justify-center py-2 px-4 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                Reset now
              </Link>
            </div>
          </div>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
