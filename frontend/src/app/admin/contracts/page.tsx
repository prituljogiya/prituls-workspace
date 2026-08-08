'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import {
  FileSignature,
  Plus,
  Search,
  Pencil,
  Trash2,
  XCircle,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = ['DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'ENDED', 'CANCELLED'] as const;
const PAYMENT_TYPES = ['HOURLY', 'MONTHLY', 'FIXED', 'MILESTONE'] as const;

type ContractForm = {
  title: string;
  status: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companySignatoryName: string;
  companySignatoryTitle: string;
  freelancerName: string;
  freelancerEmail: string;
  freelancerPhone: string;
  freelancerAddress: string;
  freelancerTaxId: string;
  freelancerBankDetails: string;
  freelancerUserId: string;
  projectId: string;
  scopeOfWork: string;
  deliverables: string;
  techStack: string;
  paymentType: string;
  rateOrAmount: string;
  currency: string;
  paymentTerms: string;
  paymentSchedule: string;
  startDate: string;
  endDate: string;
  signedAt: string;
  intellectualProperty: string;
  confidentiality: string;
  terminationTerms: string;
  noticePeriodDays: string;
  workingHours: string;
  locationOrRemote: string;
  additionalTerms: string;
  notes: string;
  companySigned: boolean;
  freelancerSigned: boolean;
};

const emptyForm = (): ContractForm => ({
  title: '',
  status: 'DRAFT',
  companyName: "Pritul's workspace",
  companyEmail: '',
  companyPhone: '',
  companyAddress: '',
  companySignatoryName: '',
  companySignatoryTitle: '',
  freelancerName: '',
  freelancerEmail: '',
  freelancerPhone: '',
  freelancerAddress: '',
  freelancerTaxId: '',
  freelancerBankDetails: '',
  freelancerUserId: '',
  projectId: '',
  scopeOfWork: '',
  deliverables: '',
  techStack: '',
  paymentType: 'MONTHLY',
  rateOrAmount: '',
  currency: 'INR',
  paymentTerms: 'Net 15',
  paymentSchedule: '',
  startDate: '',
  endDate: '',
  signedAt: '',
  intellectualProperty:
    'All work product and intellectual property created under this engagement shall belong to the Company upon full payment, unless otherwise agreed in writing.',
  confidentiality:
    'Freelancer agrees to keep all confidential information private during the engagement and for 2 years after termination.',
  terminationTerms:
    'Either party may terminate with written notice as per the notice period. Outstanding approved work will be paid.',
  noticePeriodDays: '15',
  workingHours: '',
  locationOrRemote: 'Remote',
  additionalTerms: '',
  notes: '',
  companySigned: false,
  freelancerSigned: false,
});

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white';
const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';
const sectionTitle =
  'text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-3';

function toDateInput(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
    case 'SIGNED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
    case 'SENT':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'ENDED':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  }
}

export default function AdminContractsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContractForm>(emptyForm());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (
      user &&
      !['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(user.role)
    ) {
      router.push('/dashboard');
      return;
    }
    if (user) loadAll();
  }, [user, authLoading, router]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [cRes, uRes, pRes] = await Promise.all([
        api.get('/contracts'),
        api.get('/users'),
        api.get('/projects'),
      ]);
      setContracts(cRes.data.contracts || []);
      setUsers(uRes.data.users || []);
      setProjects(pRes.data.projects || []);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.title?.toLowerCase().includes(q) ||
        c.freelancerName?.toLowerCase().includes(q) ||
        c.freelancerEmail?.toLowerCase().includes(q) ||
        c.contractNumber?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q)
      );
    });
  }, [contracts, search, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setEditingNumber(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setEditingNumber(c.contractNumber);
    setForm({
      title: c.title || '',
      status: c.status || 'DRAFT',
      companyName: c.companyName || '',
      companyEmail: c.companyEmail || '',
      companyPhone: c.companyPhone || '',
      companyAddress: c.companyAddress || '',
      companySignatoryName: c.companySignatoryName || '',
      companySignatoryTitle: c.companySignatoryTitle || '',
      freelancerName: c.freelancerName || '',
      freelancerEmail: c.freelancerEmail || '',
      freelancerPhone: c.freelancerPhone || '',
      freelancerAddress: c.freelancerAddress || '',
      freelancerTaxId: c.freelancerTaxId || '',
      freelancerBankDetails: c.freelancerBankDetails || '',
      freelancerUserId: c.freelancerUserId || '',
      projectId: c.projectId || '',
      scopeOfWork: c.scopeOfWork || '',
      deliverables: c.deliverables || '',
      techStack: c.techStack || '',
      paymentType: c.paymentType || 'MONTHLY',
      rateOrAmount: c.rateOrAmount != null ? String(c.rateOrAmount) : '',
      currency: c.currency || 'INR',
      paymentTerms: c.paymentTerms || '',
      paymentSchedule: c.paymentSchedule || '',
      startDate: toDateInput(c.startDate),
      endDate: toDateInput(c.endDate),
      signedAt: toDateInput(c.signedAt),
      intellectualProperty: c.intellectualProperty || '',
      confidentiality: c.confidentiality || '',
      terminationTerms: c.terminationTerms || '',
      noticePeriodDays: c.noticePeriodDays != null ? String(c.noticePeriodDays) : '',
      workingHours: c.workingHours || '',
      locationOrRemote: c.locationOrRemote || '',
      additionalTerms: c.additionalTerms || '',
      notes: c.notes || '',
      companySigned: !!c.companySigned,
      freelancerSigned: !!c.freelancerSigned,
    });
    setShowModal(true);
  };

  const setField = (key: keyof ContractForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!form.title.trim() || !form.freelancerName.trim() || !form.freelancerEmail.trim()) {
      alert('Title, freelancer name, and email are required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        rateOrAmount: form.rateOrAmount,
        noticePeriodDays: form.noticePeriodDays,
        freelancerUserId: form.freelancerUserId || null,
        projectId: form.projectId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        signedAt: form.signedAt || null,
      };
      if (editingId) {
        await api.patch(`/contracts/${editingId}`, payload);
      } else {
        await api.post('/contracts', payload);
      }
      setShowModal(false);
      setEditingId(null);
      setEditingNumber(null);
      await loadAll();
    } catch (error: any) {
      alert(
        error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          'Failed to save contract'
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this contract?')) return;
    try {
      await api.delete(`/contracts/${id}`);
      await loadAll();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete contract');
    }
  };

  const downloadPdf = async (id: string, contractNumber: string) => {
    try {
      const response = await api.get(`/contracts/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contract-${contractNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to download PDF');
    }
  };

  if (authLoading || !user || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileSignature className="h-6 w-6" />
                Freelancer Contracts
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Manage freelancer agreements and terms
              </p>
            </div>
            <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                New Contract
              </button>
            </RoleGuard>
          </div>
        </header>

        <main className="p-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, contract #"
                className={`pl-9 ${inputClass}`}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-44 ${inputClass}`}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                No contracts yet. Create one with full party, payment, and legal details.
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 flex flex-wrap items-start justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{c.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(c.status)}`}>
                          {c.status}
                        </span>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          {c.contractNumber}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {c.freelancerName} · {c.freelancerEmail}
                        {c.rateOrAmount != null
                          ? ` · ${c.currency} ${c.rateOrAmount} (${c.paymentType})`
                          : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {c.startDate ? `Start ${format(new Date(c.startDate), 'MMM d, yyyy')}` : 'No start'}
                        {c.endDate ? ` · End ${format(new Date(c.endDate), 'MMM d, yyyy')}` : ''}
                        {c.project?.name ? ` · ${c.project.workspace?.name || ''} / ${c.project.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => downloadPdf(c.id, c.contractNumber)}
                        className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="p-2 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-xl">
              <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingId ? 'Edit Contract' : 'New Freelancer Contract'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <section>
                  <h3 className={sectionTitle}>Basics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className={labelClass}>Contract title *</label>
                      <input
                        className={inputClass}
                        value={form.title}
                        onChange={(e) => setField('title', e.target.value)}
                        placeholder="Frontend development retainer"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <select
                        className={inputClass}
                        value={form.status}
                        onChange={(e) => setField('status', e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Linked project (optional)</label>
                      <select
                        className={inputClass}
                        value={form.projectId}
                        onChange={(e) => setField('projectId', e.target.value)}
                      >
                        <option value="">None</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.workspace?.name ? `${p.workspace.name} / ` : ''}
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={sectionTitle}>Company party</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Company name</label>
                      <input className={inputClass} value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Company email</label>
                      <input className={inputClass} type="email" value={form.companyEmail} onChange={(e) => setField('companyEmail', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Company phone</label>
                      <input className={inputClass} value={form.companyPhone} onChange={(e) => setField('companyPhone', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Signatory name</label>
                      <input className={inputClass} value={form.companySignatoryName} onChange={(e) => setField('companySignatoryName', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Signatory title</label>
                      <input className={inputClass} value={form.companySignatoryTitle} onChange={(e) => setField('companySignatoryTitle', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Company address</label>
                      <textarea className={inputClass} rows={2} value={form.companyAddress} onChange={(e) => setField('companyAddress', e.target.value)} />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={sectionTitle}>Freelancer party</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Full name *</label>
                      <input className={inputClass} value={form.freelancerName} onChange={(e) => setField('freelancerName', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Email *</label>
                      <input className={inputClass} type="email" value={form.freelancerEmail} onChange={(e) => setField('freelancerEmail', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input className={inputClass} value={form.freelancerPhone} onChange={(e) => setField('freelancerPhone', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Tax ID / PAN</label>
                      <input className={inputClass} value={form.freelancerTaxId} onChange={(e) => setField('freelancerTaxId', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Portal user (optional)</label>
                      <select
                        className={inputClass}
                        value={form.freelancerUserId}
                        onChange={(e) => setField('freelancerUserId', e.target.value)}
                      >
                        <option value="">None</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Address</label>
                      <textarea className={inputClass} rows={2} value={form.freelancerAddress} onChange={(e) => setField('freelancerAddress', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Bank details</label>
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={form.freelancerBankDetails}
                        onChange={(e) => setField('freelancerBankDetails', e.target.value)}
                        placeholder="Account name, number, IFSC / SWIFT, bank name"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={sectionTitle}>Scope of work</h3>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Scope</label>
                      <textarea className={inputClass} rows={3} value={form.scopeOfWork} onChange={(e) => setField('scopeOfWork', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Deliverables</label>
                      <textarea className={inputClass} rows={3} value={form.deliverables} onChange={(e) => setField('deliverables', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Tech stack</label>
                      <input className={inputClass} value={form.techStack} onChange={(e) => setField('techStack', e.target.value)} placeholder="React, Node, Postgres…" />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={sectionTitle}>Payment & dates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Payment type</label>
                      <select className={inputClass} value={form.paymentType} onChange={(e) => setField('paymentType', e.target.value)}>
                        {PAYMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Rate / amount</label>
                      <input className={inputClass} type="number" min="0" step="0.01" value={form.rateOrAmount} onChange={(e) => setField('rateOrAmount', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Currency</label>
                      <select className={inputClass} value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Payment terms</label>
                      <input className={inputClass} value={form.paymentTerms} onChange={(e) => setField('paymentTerms', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Start date</label>
                      <input className={inputClass} type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>End date</label>
                      <input className={inputClass} type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
                    </div>
                    <div className="md:col-span-3">
                      <label className={labelClass}>Payment schedule notes</label>
                      <textarea className={inputClass} rows={2} value={form.paymentSchedule} onChange={(e) => setField('paymentSchedule', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Working hours</label>
                      <input className={inputClass} value={form.workingHours} onChange={(e) => setField('workingHours', e.target.value)} placeholder="Mon–Fri, 4 hrs/day" />
                    </div>
                    <div>
                      <label className={labelClass}>Location / remote</label>
                      <input className={inputClass} value={form.locationOrRemote} onChange={(e) => setField('locationOrRemote', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Notice period (days)</label>
                      <input className={inputClass} type="number" min="0" value={form.noticePeriodDays} onChange={(e) => setField('noticePeriodDays', e.target.value)} />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={sectionTitle}>Legal terms</h3>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Intellectual property</label>
                      <textarea className={inputClass} rows={3} value={form.intellectualProperty} onChange={(e) => setField('intellectualProperty', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Confidentiality</label>
                      <textarea className={inputClass} rows={3} value={form.confidentiality} onChange={(e) => setField('confidentiality', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Termination</label>
                      <textarea className={inputClass} rows={3} value={form.terminationTerms} onChange={(e) => setField('terminationTerms', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Additional terms</label>
                      <textarea className={inputClass} rows={2} value={form.additionalTerms} onChange={(e) => setField('additionalTerms', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Internal notes</label>
                      <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={sectionTitle}>Signatures</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={form.companySigned}
                        onChange={(e) => setField('companySigned', e.target.checked)}
                      />
                      Company signed
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={form.freelancerSigned}
                        onChange={(e) => setField('freelancerSigned', e.target.checked)}
                      />
                      Freelancer signed
                    </label>
                    <div>
                      <label className={labelClass}>Signed date</label>
                      <input className={inputClass} type="date" value={form.signedAt} onChange={(e) => setField('signedAt', e.target.value)} />
                    </div>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between gap-2">
                <div>
                  {editingId && editingNumber && (
                    <button
                      type="button"
                      onClick={() => downloadPdf(editingId, editingNumber)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : editingId ? 'Update contract' : 'Create contract'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
