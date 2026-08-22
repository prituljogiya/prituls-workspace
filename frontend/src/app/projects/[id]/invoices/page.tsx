'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { FileText, Plus, Download, DollarSign, Calendar, XCircle, Landmark, Settings, Trash2, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { RoleGuard } from '@/components/RoleGuard';
import { currentBillingMonth, formatBillingMonthLabel } from '@/utils/billingMonth';

const emptyItem = { description: '', quantity: '1', unitPrice: '0', taxRate: '0' };

const emptyForm = {
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
};

const emptyPaymentForm = {
  status: 'PAID',
  paymentMethod: 'UPI',
  transactionId: '',
  transactionAmount: '',
  transactionDate: new Date().toISOString().split('T')[0],
  transactionNotes: '',
};

export default function InvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTimeEntryModal, setShowTimeEntryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const [monthFilter, setMonthFilter] = useState('');
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.id) {
      fetchInvoices();
      fetchProjectWorkspace();
    }
  }, [user, authLoading, params.id, router]);

  const fetchInvoices = async () => {
    try {
      const response = await api.get(`/invoices/project/${params.id}`);
      setInvoices(response.data.invoices || []);
      setAccessError(null);
    } catch (error: any) {
      console.error('Failed to fetch invoices:', error);
      setAccessError(error.response?.data?.error || 'Unable to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectWorkspace = async () => {
    try {
      const response = await api.get(`/projects/${params.id}`);
      const project = response.data.project;
      const ws = project?.workspace;
      if (ws?.id) {
        setWorkspaceId(ws.id);
        setWorkspaceName(ws.name || '');
        // Load full workspace for bank defaults
        const wsRes = await api.get(`/workspaces/${ws.id}`);
        applyWorkspaceBankDefaults(wsRes.data.workspace);
      }
    } catch (error) {
      console.error('Failed to fetch project workspace:', error);
    }
  };

  const applyWorkspaceBankDefaults = (ws: any) => {
    if (!ws) return;
    setFormData((prev) => ({
      ...prev,
      companyName: ws.companyName || prev.companyName || ws.name || '',
      companyAddress: ws.companyAddress || prev.companyAddress || '',
      bankName: ws.bankName || prev.bankName || '',
      accountName: ws.accountName || prev.accountName || '',
      accountNumber: ws.accountNumber || prev.accountNumber || '',
      ifscCode: ws.ifscCode || prev.ifscCode || '',
      branchName: ws.branchName || prev.branchName || '',
      iban: ws.iban || prev.iban || '',
      swiftBic: ws.swiftBic || prev.swiftBic || '',
      upiId: ws.upiId || prev.upiId || '',
    }));
  };

  const openCreateModal = async () => {
    if (workspaceId) {
      try {
        const wsRes = await api.get(`/workspaces/${workspaceId}`);
        applyWorkspaceBankDefaults(wsRes.data.workspace);
      } catch (error) {
        console.error('Failed to refresh workspace bank details:', error);
      }
    }
    setShowCreateModal(true);
  };

  const fetchTimeEntries = async () => {
    try {
      const response = await api.get(`/time-tracking/project/${params.id}`);
      setTimeEntries(response.data.entries?.filter((e: any) => e.isBillable) || []);
    } catch (error) {
      console.error('Failed to fetch time entries:', error);
    }
  };

  const createInvoice = async () => {
    try {
      const items = formData.items.filter((item) => {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        return (
          !!item.description?.trim() &&
          !Number.isNaN(qty) &&
          qty > 0 &&
          !Number.isNaN(price) &&
          price >= 0
        );
      });
      if (items.length === 0) {
        alert('Add at least one line item with description, quantity, and unit price');
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
      await api.post('/invoices', {
        projectId: params.id,
        dueDate: new Date(formData.dueDate).toISOString(),
        billingMonth: formData.billingMonth,
        currency: formData.currency,
        taxRate: formData.taxRate,
        notes: formData.notes,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientAddress: formData.clientAddress,
        companyName: formData.companyName,
        companyAddress: formData.companyAddress,
        bankName: formData.bankName,
        accountName: formData.accountName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode,
        branchName: formData.branchName,
        iban: formData.iban,
        swiftBic: formData.swiftBic,
        upiId: formData.upiId,
        saveBankDetailsToWorkspace: formData.saveBankDetailsToWorkspace,
        items: items.map((item) => ({
          ...item,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          taxRate: parseFloat(item.taxRate || '0'),
        })),
      });
      try {
        window.dispatchEvent(
          new CustomEvent('pms:invoices-enabled', {
            detail: { projectId: params.id, enabled: true },
          })
        );
        sessionStorage.setItem(`pms:invoicesEnabled:${params.id}`, '1');
      } catch {
        /* ignore */
      }
      setShowCreateModal(false);
      setFormData({
        ...emptyForm,
        companyName: formData.companyName,
        companyAddress: formData.companyAddress,
        bankName: formData.bankName,
        accountName: formData.accountName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode,
        branchName: formData.branchName,
        iban: formData.iban,
        swiftBic: formData.swiftBic,
        upiId: formData.upiId,
        items: [{ ...emptyItem }],
      });
      fetchInvoices();
    } catch (error: any) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.errors?.[0]?.msg ||
        'Failed to create invoice';
      alert(msg);
    }
  };

  const createInvoiceFromTimeEntries = async () => {
    try {
      const selectedEntries = timeEntries.filter((e: any) => e.selected);
      if (selectedEntries.length === 0) {
        alert('Please select at least one time entry');
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
      await api.post('/invoices/from-time-entries', {
        projectId: params.id,
        timeEntryIds: selectedEntries.map((e: any) => e.id),
        dueDate: new Date(formData.dueDate).toISOString(),
        billingMonth: formData.billingMonth,
        currency: formData.currency,
        taxRate: formData.taxRate,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientAddress: formData.clientAddress,
        notes: formData.notes,
        companyName: formData.companyName,
        companyAddress: formData.companyAddress,
        bankName: formData.bankName,
        accountName: formData.accountName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode,
        branchName: formData.branchName,
        iban: formData.iban,
        swiftBic: formData.swiftBic,
        upiId: formData.upiId,
      });
      setShowTimeEntryModal(false);
      fetchInvoices();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create invoice');
    }
  };

  const downloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });
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

  const openPaymentModal = (invoice: any) => {
    const total = calculateTotal(invoice);
    setSelectedInvoice(invoice);
    setPaymentForm({
      status: 'PAID',
      paymentMethod: invoice.paymentMethod || 'UPI',
      transactionId: invoice.transactionId || '',
      transactionAmount: invoice.transactionAmount != null ? String(invoice.transactionAmount) : total.toFixed(2),
      transactionDate: invoice.transactionDate
        ? new Date(invoice.transactionDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      transactionNotes: invoice.transactionNotes || '',
    });
    setShowPaymentModal(true);
  };

  const submitPayment = async () => {
    if (!selectedInvoice) return;
    try {
      await api.post(`/invoices/${selectedInvoice.id}/payment`, {
        status: paymentForm.status,
        paymentMethod: paymentForm.paymentMethod,
        transactionId: paymentForm.transactionId,
        transactionAmount: paymentForm.transactionAmount
          ? parseFloat(paymentForm.transactionAmount)
          : undefined,
        transactionDate: paymentForm.transactionDate
          ? new Date(paymentForm.transactionDate).toISOString()
          : undefined,
        transactionNotes: paymentForm.transactionNotes,
      });
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update payment status');
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await api.delete(`/invoices/${invoiceId}`);
      fetchInvoices();
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
    const tax = subtotal * (invoice.taxRate / 100);
    return subtotal + tax;
  };

  const updateBankField = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value });
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
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Invoices</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create and manage project invoices
                {workspaceName ? ` for ${workspaceName}` : ''}
              </p>
            </div>
            <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
              <div className="flex gap-3 flex-wrap justify-end">
                {workspaceId && (
                  <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER']}>
                    <Link
                      href={`/workspaces/${workspaceId}/settings`}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Settings className="h-4 w-4" />
                      Workspace Bank Details
                    </Link>
                  </RoleGuard>
                )}
                <button
                  onClick={() => {
                    fetchTimeEntries();
                    setShowTimeEntryModal(true);
                  }}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <DollarSign className="h-4 w-4" />
                  From Time Entries
                </button>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Manual Invoice
                </button>
              </div>
            </RoleGuard>
          </div>

          {/* Invoices List */}
          {accessError ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-700 dark:text-gray-200 font-medium">{accessError}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                If invoices are scheduled, they will appear here on the date set by the project admin. You will also get a notification.
              </p>
            </div>
          ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                All Invoices
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Billing month</label>
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
                  <p className="mb-4">
                    {monthFilter
                      ? `No invoices for ${formatBillingMonthLabel(monthFilter) || monthFilter}.`
                      : 'No invoices yet. Create one with your own line items.'}
                  </p>
                  {!monthFilter && (
                  <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Create Manual Invoice
                    </button>
                  </RoleGuard>
                  )}
                </div>
              ) : (
                invoices
                  .filter((inv) => !monthFilter || inv.billingMonth === monthFilter)
                  .map((invoice) => {
                  const total = calculateTotal(invoice);
                  const billingLabel = formatBillingMonthLabel(invoice.billingMonth);
                  const hasBank = Boolean(
                    invoice.bankName || invoice.accountNumber || invoice.ifscCode || invoice.upiId
                  );
                  const canPay = ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'VIEWER'].includes(
                    user?.role || ''
                  );
                  const canDelete = ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(
                    user?.role || ''
                  );
                  return (
                    <div
                      key={invoice.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {invoice.invoiceNumber}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(invoice.status)}`}
                            >
                              {invoice.status}
                            </span>
                            {billingLabel && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                                {billingLabel}
                              </span>
                            )}
                            {hasBank && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 flex items-center gap-1">
                                <Landmark className="h-3 w-3" />
                                Bank details
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Due: {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                            </span>
                            {invoice.clientName && <span>{invoice.clientName}</span>}
                            {invoice.bankName && <span>{invoice.bankName}</span>}
                          </div>
                          {(invoice.transactionId || invoice.paymentMethod || invoice.paidAt) && (
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                              {invoice.paymentMethod && (
                                <p>Payment: {invoice.paymentMethod}</p>
                              )}
                              {invoice.transactionId && (
                                <p>Txn ID: {invoice.transactionId}</p>
                              )}
                              {invoice.transactionAmount != null && (
                                <p>
                                  Paid amount: {invoice.currency}{' '}
                                  {Number(invoice.transactionAmount).toFixed(2)}
                                </p>
                              )}
                              {invoice.paidBy && (
                                <p>
                                  Marked paid by {invoice.paidBy.firstName} {invoice.paidBy.lastName}
                                  {invoice.paidAt
                                    ? ` · ${format(new Date(invoice.paidAt), 'MMM d, yyyy')}`
                                    : ''}
                                </p>
                              )}
                              {invoice.transactionNotes && (
                                <p className="text-gray-500">Note: {invoice.transactionNotes}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {invoice.currency} {total.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {canPay && invoice.status !== 'CANCELLED' && (
                              <button
                                onClick={() => openPaymentModal(invoice)}
                                className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                title="Update status / payment"
                              >
                                <CreditCard className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => downloadPdf(invoice.id, invoice.invoiceNumber)}
                              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => deleteInvoice(invoice.id)}
                                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Delete invoice"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          )}
        </div>

        {/* Create Invoice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Manual Invoice
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Billing Month *
                    </label>
                    <input
                      type="month"
                      value={formData.billingMonth}
                      onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Month this invoice covers</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Due Date *
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {/* Bank / payment details */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Bank / Payment Details
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Prefills from workspace settings. Shown on the invoice PDF.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => updateBankField('companyName', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Address
                      </label>
                      <textarea
                        value={formData.companyAddress}
                        onChange={(e) => updateBankField('companyAddress', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => updateBankField('bankName', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={formData.accountName}
                        onChange={(e) => updateBankField('accountName', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => updateBankField('accountNumber', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={formData.ifscCode}
                        onChange={(e) => updateBankField('ifscCode', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Branch
                      </label>
                      <input
                        type="text"
                        value={formData.branchName}
                        onChange={(e) => updateBankField('branchName', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        UPI ID
                      </label>
                      <input
                        type="text"
                        value={formData.upiId}
                        onChange={(e) => updateBankField('upiId', e.target.value)}
                        placeholder="name@upi"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        IBAN
                      </label>
                      <input
                        type="text"
                        value={formData.iban}
                        onChange={(e) => updateBankField('iban', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SWIFT / BIC
                      </label>
                      <input
                        type="text"
                        value={formData.swiftBic}
                        onChange={(e) => updateBankField('swiftBic', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER']}>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.saveBankDetailsToWorkspace}
                        onChange={(e) => updateBankField('saveBankDetailsToWorkspace', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      Save these bank details as workspace defaults for future invoices
                    </label>
                  </RoleGuard>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
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
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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
                            const newItems = [...formData.items];
                            newItems[index].description = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="col-span-5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].quantity = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].unitPrice = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          placeholder="Tax %"
                          value={item.taxRate}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].taxRate = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={() => {
                            const newItems = formData.items.filter((_, i) => i !== index);
                            setFormData({
                              ...formData,
                              items: newItems.length ? newItems : [{ ...emptyItem }],
                            });
                          }}
                          className="col-span-1 p-2 text-red-600 hover:text-red-700 dark:hover:text-red-400"
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createInvoice}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create from Time Entries Modal */}
        {showTimeEntryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create Invoice from Time Entries
                </h2>
                <button
                  onClick={() => setShowTimeEntryModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Billing Month *
                    </label>
                    <input
                      type="month"
                      value={formData.billingMonth}
                      onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Workspace bank details will be applied automatically to this invoice.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Time Entries
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-96 overflow-y-auto">
                    {timeEntries.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        No billable time entries found.
                      </div>
                    ) : (
                      timeEntries.map((entry: any) => (
                        <label
                          key={entry.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 last:border-0 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={entry.selected || false}
                            onChange={(e) => {
                              const updated = timeEntries.map((te: any) =>
                                te.id === entry.id ? { ...te, selected: e.target.checked } : te
                              );
                              setTimeEntries(updated);
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {entry.task?.title || 'Unknown Task'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(entry.date), 'MMM d, yyyy')} • {entry.hours.toFixed(2)}h
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {entry.hours.toFixed(2)}h
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowTimeEntryModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createInvoiceFromTimeEntries}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment / status modal (viewers can mark paid + add txn details) */}
        {showPaymentModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Payment Status — {selectedInvoice.invoiceNumber}
                </h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={paymentForm.status}
                    onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="PAID">PAID</option>
                    <option value="SENT">SENT</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Transaction ID
                  </label>
                  <input
                    type="text"
                    value={paymentForm.transactionId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                    placeholder="UPI ref / bank txn id"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Amount Paid
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.transactionAmount}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, transactionAmount: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={paymentForm.transactionDate}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, transactionDate: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Transaction Notes
                  </label>
                  <textarea
                    value={paymentForm.transactionNotes}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, transactionNotes: e.target.value })
                    }
                    rows={2}
                    placeholder="Optional notes for admin"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPayment}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Save Payment Status
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
