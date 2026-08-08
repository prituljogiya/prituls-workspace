'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import {
  FileText,
  Plus,
  Download,
  Landmark,
  Settings,
  XCircle,
  Calendar,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { currentBillingMonth, formatBillingMonthLabel } from '@/utils/billingMonth';

const emptyItem = { description: '', quantity: '1', unitPrice: '0', taxRate: '0' };

export default function AdminInvoicesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [monthFilter, setMonthFilter] = useState('');
  const [formData, setFormData] = useState({
    projectId: '',
    dueDate: '',
    billingMonth: currentBillingMonth(),
    currency: 'INR',
    taxRate: '0',
    notes: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    companyName: '',
    companyAddress: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    iban: '',
    swiftBic: '',
    upiId: '',
    saveBankDetailsToWorkspace: true,
    items: [{ ...emptyItem }],
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !['SUPER_ADMIN', 'WORKSPACE_OWNER'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    try {
      const [invRes, wsRes, projRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/workspaces'),
        api.get('/projects'),
      ]);
      setInvoices(invRes.data.invoices || []);
      setWorkspaces(wsRes.data.workspaces || []);
      setProjects(projRes.data.projects || []);
    } catch (error) {
      console.error('Failed to load admin invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyProjectWorkspaceDefaults = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project?.workspace?.id) {
      setFormData((prev) => ({ ...prev, projectId }));
      return;
    }
    try {
      const wsRes = await api.get(`/workspaces/${project.workspace.id}`);
      const ws = wsRes.data.workspace;
      setFormData((prev) => ({
        ...prev,
        projectId,
        companyName: ws.companyName || ws.name || '',
        companyAddress: ws.companyAddress || '',
        bankName: ws.bankName || '',
        accountName: ws.accountName || '',
        accountNumber: ws.accountNumber || '',
        ifscCode: ws.ifscCode || '',
        branchName: ws.branchName || '',
        iban: ws.iban || '',
        swiftBic: ws.swiftBic || '',
        upiId: ws.upiId || '',
      }));
    } catch {
      setFormData((prev) => ({ ...prev, projectId }));
    }
  };

  const createInvoice = async () => {
    try {
      if (!formData.projectId) {
        alert('Please select a project');
        return;
      }
      if (!formData.dueDate) {
        alert('Please set a due date');
        return;
      }
      if (!formData.billingMonth) {
        alert('Please select the billing month');
        return;
      }
      const items = formData.items.filter((item) => item.description && item.quantity && item.unitPrice);
      if (items.length === 0) {
        alert('Please add at least one item');
        return;
      }

      await api.post('/invoices', {
        ...formData,
        dueDate: new Date(formData.dueDate).toISOString(),
        billingMonth: formData.billingMonth,
        items: items.map((item) => ({
          ...item,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          taxRate: parseFloat(item.taxRate),
        })),
      });
      setShowCreateModal(false);
      setFormData((prev) => ({
        ...prev,
        projectId: '',
        dueDate: '',
        billingMonth: currentBillingMonth(),
        notes: '',
        clientName: '',
        clientEmail: '',
        clientAddress: '',
        items: [{ ...emptyItem }],
      }));
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create invoice');
    }
  };

  const downloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to download PDF');
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await api.delete(`/invoices/${invoiceId}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete invoice');
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
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const calculateTotal = (invoice: any) => {
    const subtotal = invoice.items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unitPrice,
      0
    );
    return subtotal + subtotal * (invoice.taxRate / 100);
  };

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER']}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                  Invoices
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Admin invoice module — create, remove, and review payment status from viewers
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Manual Create Invoice
              </button>
            </div>

            {/* Workspace bank settings */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Workspace Invoice Bank Details
                </h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {workspaces.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500 dark:text-gray-400">No workspaces found.</div>
                ) : (
                  workspaces.map((ws) => (
                    <div key={ws.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{ws.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {ws.companyName || 'No company name'}
                          {ws.bankName ? ` · ${ws.bankName}` : ''}
                          {ws.accountNumber ? ` · A/C ${ws.accountNumber}` : ' · No bank details set'}
                          {ws.ifscCode ? ` · IFSC ${ws.ifscCode}` : ''}
                        </p>
                      </div>
                      <Link
                        href={`/workspaces/${ws.id}/settings`}
                        className="px-3 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Set Bank Details
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* All invoices */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  All Invoices
                </h2>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Billing month</label>
                  <input
                    type="month"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {monthFilter && (
                    <button
                      type="button"
                      onClick={() => setMonthFilter('')}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {invoices.filter((inv) => !monthFilter || inv.billingMonth === monthFilter).length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>
                      {monthFilter
                        ? `No invoices for ${formatBillingMonthLabel(monthFilter) || monthFilter}.`
                        : 'No invoices yet. Create one manually above.'}
                    </p>
                  </div>
                ) : (
                  invoices
                    .filter((inv) => !monthFilter || inv.billingMonth === monthFilter)
                    .map((invoice) => {
                    const total = calculateTotal(invoice);
                    const billingLabel = formatBillingMonthLabel(invoice.billingMonth);
                    return (
                      <div key={invoice.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {invoice.invoiceNumber}
                            </h3>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${getStatusColor(invoice.status)}`}
                            >
                              {invoice.status}
                            </span>
                            {billingLabel && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 font-medium">
                                {billingLabel}
                              </span>
                            )}
                            {invoice.status === 'PAID' && (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200 flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                Payment recorded
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-3">
                            <span>
                              {invoice.project?.workspace?.name} / {invoice.project?.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Due {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                            </span>
                            {invoice.clientName && <span>{invoice.clientName}</span>}
                            {(invoice.bankName || invoice.accountNumber) && (
                              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                <Landmark className="h-3.5 w-3.5" />
                                Bank details
                              </span>
                            )}
                          </div>
                          {(invoice.transactionId ||
                            invoice.paymentMethod ||
                            invoice.paidAt ||
                            invoice.transactionNotes) && (
                            <div className="mt-2 p-2 rounded bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                              <p className="font-medium text-gray-900 dark:text-white">
                                Transaction details
                              </p>
                              {invoice.paymentMethod && <p>Method: {invoice.paymentMethod}</p>}
                              {invoice.transactionId && <p>Txn ID: {invoice.transactionId}</p>}
                              {invoice.transactionAmount != null && (
                                <p>
                                  Amount: {invoice.currency}{' '}
                                  {Number(invoice.transactionAmount).toFixed(2)}
                                </p>
                              )}
                              {invoice.transactionDate && (
                                <p>
                                  Date: {format(new Date(invoice.transactionDate), 'MMM d, yyyy')}
                                </p>
                              )}
                              {invoice.paidBy && (
                                <p>
                                  Marked by {invoice.paidBy.firstName} {invoice.paidBy.lastName}
                                  {invoice.paidAt
                                    ? ` · ${format(new Date(invoice.paidAt), 'MMM d, yyyy h:mm a')}`
                                    : ''}
                                </p>
                              )}
                              {invoice.transactionNotes && <p>Note: {invoice.transactionNotes}</p>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="font-semibold text-gray-900 dark:text-white mr-1">
                            {invoice.currency} {total.toFixed(2)}
                          </p>
                          <button
                            onClick={() => downloadPdf(invoice.id, invoice.invoiceNumber)}
                            className="p-2 text-gray-400 hover:text-blue-600 rounded"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteInvoice(invoice.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded"
                            title="Remove invoice"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/projects/${invoice.projectId}/invoices`}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Manual Create Invoice
                  </h2>
                  <button onClick={() => setShowCreateModal(false)} className="text-gray-400">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Project *
                    </label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => applyProjectWorkspaceDefaults(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.workspace?.name} / {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Billing Month *
                      </label>
                      <input
                        type="month"
                        value={formData.billingMonth}
                        onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Due Date *
                      </label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Client Email
                    </label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Client Address
                    </label>
                    <textarea
                      value={formData.clientAddress}
                      onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Landmark className="h-4 w-4" />
                      Bank / Payment Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ['companyName', 'Company Name'],
                          ['bankName', 'Bank Name'],
                          ['accountName', 'Account Name'],
                          ['accountNumber', 'Account Number'],
                          ['ifscCode', 'IFSC Code'],
                          ['branchName', 'Branch'],
                          ['upiId', 'UPI ID'],
                          ['iban', 'IBAN'],
                          ['swiftBic', 'SWIFT / BIC'],
                        ] as const
                      ).map(([field, label]) => (
                        <div key={field}>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={(formData as any)[field]}
                            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      ))}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Company Address
                        </label>
                        <textarea
                          value={formData.companyAddress}
                          onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formData.saveBankDetailsToWorkspace}
                        onChange={(e) =>
                          setFormData({ ...formData, saveBankDetailsToWorkspace: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      Save as workspace defaults for future invoices
                    </label>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Items
                      </label>
                      <button
                        onClick={() =>
                          setFormData({
                            ...formData,
                            items: [...formData.items, { ...emptyItem }],
                          })
                        }
                        className="text-xs text-blue-600"
                      >
                        + Add Item
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.items.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2">
                          <input
                            type="text"
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => {
                              const items = [...formData.items];
                              items[index].description = e.target.value;
                              setFormData({ ...formData, items });
                            }}
                            className="col-span-5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => {
                              const items = [...formData.items];
                              items[index].quantity = e.target.value;
                              setFormData({ ...formData, items });
                            }}
                            className="col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="number"
                            placeholder="Price"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const items = [...formData.items];
                              items[index].unitPrice = e.target.value;
                              setFormData({ ...formData, items });
                            }}
                            className="col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="number"
                            placeholder="Tax %"
                            value={item.taxRate}
                            onChange={(e) => {
                              const items = [...formData.items];
                              items[index].taxRate = e.target.value;
                              setFormData({ ...formData, items });
                            }}
                            className="col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <button
                            onClick={() => {
                              const items = formData.items.filter((_, i) => i !== index);
                              setFormData({
                                ...formData,
                                items: items.length ? items : [{ ...emptyItem }],
                              });
                            }}
                            className="col-span-1 p-2 text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createInvoice}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Create Invoice
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </RoleGuard>
    </Layout>
  );
}
