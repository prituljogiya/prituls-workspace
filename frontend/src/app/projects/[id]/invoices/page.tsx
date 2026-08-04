'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { FileText, Plus, Download, Calendar, Rocket } from 'lucide-react';
import { format } from 'date-fns';
import { RoleGuard } from '@/components/RoleGuard';

export default function InvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({
    mode: 'timeline' as 'timeline' | 'sprint',
    startDate: '',
    endDate: '',
    sprintId: '',
    dueDate: '',
    currency: 'USD',
    hourlyRate: '50',
    taxRate: '0',
    clientName: '',
    notes: '',
  });
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace(`/projects/${params.id}`);
      return;
    }
    if (user && params.id) {
      fetchInvoices();
      fetchSprints();
    }
  }, [user, authLoading, params.id, router]);

  const fetchInvoices = async () => {
    try {
      const response = await api.get(`/invoices/project/${params.id}`);
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSprints = async () => {
    try {
      const response = await api.get(`/sprints/project/${params.id}`);
      setSprints(response.data.sprints || []);
    } catch (error) {
      console.error('Failed to fetch sprints:', error);
    }
  };

  const runPreview = async () => {
    if (!genForm.dueDate) {
      alert('Due date is required');
      return;
    }
    if (!genForm.hourlyRate || parseFloat(genForm.hourlyRate) <= 0) {
      alert('Enter a rate per hour greater than 0');
      return;
    }
    if (genForm.mode === 'timeline' && (!genForm.startDate || !genForm.endDate)) {
      alert('Select a start and end date');
      return;
    }
    if (genForm.mode === 'sprint' && !genForm.sprintId) {
      alert('Select a sprint');
      return;
    }
    try {
      setGenerating(true);
      const response = await api.post('/invoices/generate', {
        projectId: params.id,
        mode: genForm.mode,
        startDate: genForm.startDate || undefined,
        endDate: genForm.endDate || undefined,
        sprintId: genForm.sprintId || undefined,
        dueDate: genForm.dueDate,
        currency: genForm.currency,
        hourlyRate: genForm.hourlyRate ? parseFloat(genForm.hourlyRate) : undefined,
        taxRate: genForm.taxRate,
        clientName: genForm.clientName,
        notes: genForm.notes,
        preview: true,
      });
      setPreview(response.data);
    } catch (error: any) {
      setPreview(null);
      alert(error.response?.data?.error || 'Failed to preview invoice');
    } finally {
      setGenerating(false);
    }
  };

  const createFromGenerate = async () => {
    if (!genForm.dueDate) {
      alert('Due date is required');
      return;
    }
    if (!genForm.hourlyRate || parseFloat(genForm.hourlyRate) <= 0) {
      alert('Enter a rate per hour greater than 0');
      return;
    }
    try {
      setGenerating(true);
      await api.post('/invoices/generate', {
        projectId: params.id,
        mode: genForm.mode,
        startDate: genForm.startDate || undefined,
        endDate: genForm.endDate || undefined,
        sprintId: genForm.sprintId || undefined,
        dueDate: genForm.dueDate,
        currency: genForm.currency,
        hourlyRate: parseFloat(genForm.hourlyRate),
        taxRate: genForm.taxRate,
        clientName: genForm.clientName,
        notes: genForm.notes,
        preview: false,
      });
      setShowGenerate(false);
      setPreview(null);
      fetchInvoices();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create invoice');
    } finally {
      setGenerating(false);
    }
  };

  const openPdf = async (invoice: any) => {
    try {
      setOpeningPdfId(invoice.id);
      const response = await api.get(`/invoices/${invoice.id}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Revoke later so the tab can load the blob
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to open PDF');
    } finally {
      setOpeningPdfId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'SENT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'CANCELLED':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const calculateTotal = (invoice: any) => {
    const subtotal = invoice.items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unitPrice,
      0
    );
    const tax = subtotal * (invoice.taxRate / 100);
    return subtotal + tax;
  };

  if (loading || authLoading) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Invoices</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Super Admin — generate invoices from a date range or a sprint’s logged time
              </p>
            </div>
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <button
                onClick={() => {
                  setPreview(null);
                  setShowGenerate(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Generate Invoice
              </button>
            </RoleGuard>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                All Invoices
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No invoices yet. Generate one from a timeline or sprint.</p>
                </div>
              ) : (
                invoices.map((invoice) => {
                  const total = calculateTotal(invoice);
                  return (
                    <div
                      key={invoice.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {invoice.invoiceNumber}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span>Due: {format(new Date(invoice.dueDate), 'MMM d, yyyy')}</span>
                            {invoice.clientName && <span>{invoice.clientName}</span>}
                            {invoice.notes && (
                              <span className="truncate max-w-xs">{invoice.notes}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {invoice.currency} {total.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {invoice.items.length} line{invoice.items.length !== 1 ? 's' : ''}
                          </p>
                          <button
                            type="button"
                            onClick={() => openPdf(invoice)}
                            disabled={openingPdfId === invoice.id}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1 hover:underline disabled:opacity-50"
                          >
                            <Download className="h-3 w-3" />
                            {openingPdfId === invoice.id ? 'Opening…' : 'Open PDF'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Generate Invoice</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Pull logged hours by calendar range or by sprint, then create the invoice.
            </p>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setGenForm({ ...genForm, mode: 'timeline' });
                  setPreview(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
                  genForm.mode === 'timeline'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                <Calendar className="h-4 w-4" />
                Timeline
              </button>
              <button
                type="button"
                onClick={() => {
                  setGenForm({ ...genForm, mode: 'sprint' });
                  setPreview(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
                  genForm.mode === 'sprint'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                <Rocket className="h-4 w-4" />
                Sprint
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {genForm.mode === 'timeline' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={genForm.startDate}
                      onChange={(e) => setGenForm({ ...genForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      End date
                    </label>
                    <input
                      type="date"
                      value={genForm.endDate}
                      onChange={(e) => setGenForm({ ...genForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Sprint
                  </label>
                  <select
                    value={genForm.sprintId}
                    onChange={(e) => setGenForm({ ...genForm, sprintId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select sprint…</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Due date *
                </label>
                <input
                  type="date"
                  value={genForm.dueDate}
                  onChange={(e) => setGenForm({ ...genForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Tax rate %
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={genForm.taxRate}
                  onChange={(e) => setGenForm({ ...genForm, taxRate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Currency *
                </label>
                <select
                  value={genForm.currency}
                  onChange={(e) => {
                    setGenForm({ ...genForm, currency: e.target.value });
                    setPreview(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="JPY">JPY — Japanese Yen</option>
                  <option value="AED">AED — UAE Dirham</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Rate per hour * ({genForm.currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={genForm.hourlyRate}
                  onChange={(e) => {
                    setGenForm({ ...genForm, hourlyRate: e.target.value });
                    setPreview(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Client name
                </label>
                <input
                  type="text"
                  value={genForm.clientName}
                  onChange={(e) => setGenForm({ ...genForm, clientName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={genForm.notes}
                  onChange={(e) => setGenForm({ ...genForm, notes: e.target.value })}
                  placeholder="Optional note on the invoice"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {preview && (
              <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/40">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Preview — {preview.periodLabel}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {preview.entryCount} entries · {preview.totalHours?.toFixed(2)}h
                  {preview.hourlyRate != null ? ` · ${genForm.currency} ${preview.hourlyRate}/hr` : ''}
                </p>
                <div className="space-y-2 mb-3">
                  {preview.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm text-gray-800 dark:text-gray-200">
                      <span>{item.description}</span>
                      <span>
                        {item.quantity}h × {genForm.currency} {item.unitPrice} ={' '}
                        {genForm.currency} {(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>Total</span>
                  <span>
                    {genForm.currency} {preview.total?.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={runPreview}
                disabled={generating}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {generating ? 'Working…' : 'Preview'}
              </button>
              <button
                onClick={createFromGenerate}
                disabled={generating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Create Invoice
              </button>
              <button
                onClick={() => {
                  setShowGenerate(false);
                  setPreview(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
