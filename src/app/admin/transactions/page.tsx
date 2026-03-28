'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Download, DollarSign, CreditCard, Clock, AlertTriangle, Search, X, Printer, RefreshCw, Video, BookOpen, Smartphone, ChevronUp, ChevronDown } from 'lucide-react';
import { TransactionFirestoreService } from '@/apiservices/transactionFirestoreService';
import { AppTransactionFirestoreService, ParentAppTransaction } from '@/apiservices/appTransactionFirestoreService';
import {
  TransactionDisplayData,
  transactionDocumentToDisplay,
  getTransactionTypeDisplayName,
} from '@/models/transactionSchema';

type Tab = 'sales' | 'app';
type SortField = 'parentName' | 'studentNames' | 'platform' | 'amount' | 'status' | 'startDate' | 'expiryDate';
type SortDir = 'asc' | 'desc';

export default function TransactionManager() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');

  // --- Sales tab state ---
  const [transactions, setTransactions] = useState<TransactionDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDisplayData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    totalRefunds: 0,
    netRevenue: 0,
    videoSales: 0,
    classSales: 0,
    pendingAmount: 0
  });

  // --- App tab state ---
  const [appTransactions, setAppTransactions] = useState<ParentAppTransaction[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [appPlatformFilter, setAppPlatformFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appSortField, setAppSortField] = useState<SortField>('startDate');
  const [appSortDir, setAppSortDir] = useState<SortDir>('desc');
  const [selectedAppTx, setSelectedAppTx] = useState<ParentAppTransaction | null>(null);
  const [appModalOpen, setAppModalOpen] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const [transactionDocs, stats] = await Promise.all([
        TransactionFirestoreService.getAllTransactions(),
        TransactionFirestoreService.getRevenueStats()
      ]);
      const displayTransactions = transactionDocs.map(doc => transactionDocumentToDisplay(doc));
      setTransactions(displayTransactions);
      setRevenueStats(stats);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppTransactions = async () => {
    try {
      setAppLoading(true);
      const data = await AppTransactionFirestoreService.getAllParentSubscriptions();
      setAppTransactions(data);
    } catch (error) {
      console.error('Error fetching app transactions:', error);
    } finally {
      setAppLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (activeTab === 'app' && appTransactions.length === 0) {
      fetchAppTransactions();
    }
  }, [activeTab]);

  // Sales filter
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      transaction.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.status.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    if (dateRange.start && dateRange.end) {
      const transactionDate = new Date(transaction.createdAt);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      matchesDate = transactionDate >= startDate && transactionDate <= endDate;
    }

    const matchesType = !typeFilter || transaction.type === typeFilter;
    const matchesStatus = !statusFilter || transaction.status === statusFilter;

    return matchesSearch && matchesDate && matchesType && matchesStatus;
  });

  // App transactions filter + sort
  const filteredAppTransactions = useMemo(() => {
    let list = appTransactions.filter(tx => {
      const studentNames = tx.linkedStudents.map(s => s.name).join(' ').toLowerCase();
      const matchesSearch =
        !appSearchTerm ||
        tx.parentName.toLowerCase().includes(appSearchTerm.toLowerCase()) ||
        tx.parentEmail.toLowerCase().includes(appSearchTerm.toLowerCase()) ||
        studentNames.includes(appSearchTerm.toLowerCase());

      const matchesPlatform = !appPlatformFilter || tx.subscription.platform === appPlatformFilter;
      const matchesStatus = !appStatusFilter || tx.subscription.status === appStatusFilter;

      return matchesSearch && matchesPlatform && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (appSortField) {
        case 'parentName':
          valA = a.parentName.toLowerCase();
          valB = b.parentName.toLowerCase();
          break;
        case 'studentNames':
          valA = a.linkedStudents.map(s => s.name).join(', ').toLowerCase();
          valB = b.linkedStudents.map(s => s.name).join(', ').toLowerCase();
          break;
        case 'platform':
          valA = a.subscription.platform;
          valB = b.subscription.platform;
          break;
        case 'amount':
          valA = a.subscription.totalAmount;
          valB = b.subscription.totalAmount;
          break;
        case 'status':
          valA = a.subscription.status;
          valB = b.subscription.status;
          break;
        case 'startDate':
          valA = a.subscription.startDate;
          valB = b.subscription.startDate;
          break;
        case 'expiryDate':
          valA = a.subscription.expiryDate;
          valB = b.subscription.expiryDate;
          break;
      }

      if (valA < valB) return appSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return appSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [appTransactions, appSearchTerm, appPlatformFilter, appStatusFilter, appSortField, appSortDir]);

  const toggleSort = (field: SortField) => {
    if (appSortField === field) {
      setAppSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAppSortField(field);
      setAppSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (appSortField !== field) return <ChevronUp className="h-3 w-3 text-gray-300" />;
    return appSortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-blue-500" />
      : <ChevronDown className="h-3 w-3 text-blue-500" />;
  };

  const handleOpenModal = (transaction: TransactionDisplayData) => {
    setSelectedTransaction(transaction);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedTransaction(null);
    setModalOpen(false);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAppStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getTransactionTypeColorFn = (type: string) => {
    switch (type) {
      case 'Payment': return 'text-green-600';
      case 'Refund': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-AU');
  };

  const PlatformBadge = ({ platform }: { platform: string }) => {
    if (platform === 'ios') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-900 text-white">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          iOS
        </span>
      );
    }
    if (platform === 'android') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-600 text-white">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.523 15.341a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-6.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v6.5zm-9.5-9.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v.5h-8v-.5zM6 5.841l-1.5-2.598a.5.5 0 0 1 .866-.5L7 5.341H6zm13.634-2.598L18 5.341h-1l1.634-2.598a.5.5 0 0 1 .866.5zM3.5 9.341a.5.5 0 0 1 .5-.5h.5v5.5H4a.5.5 0 0 1-.5-.5v-4.5zm17 0v4.5a.5.5 0 0 1-.5.5h-.5v-5.5h.5a.5.5 0 0 1 .5.5zM8.5 16.841v2a.5.5 0 0 0 1 0v-2h-1zm6 0v2a.5.5 0 0 0 1 0v-2h-1z" />
          </svg>
          Android
        </span>
      );
    }
    if (platform === 'dev') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Dev/Test
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
        <Smartphone className="h-3 w-3" />
        {platform}
      </span>
    );
  };

  // App stats (exclude dev/test from revenue)
  const appStats = useMemo(() => {
    const realSubs = appTransactions.filter(t => t.subscription.platform !== 'dev');
    const active = appTransactions.filter(t => t.subscription.status === 'active').length;
    const ios = appTransactions.filter(t => t.subscription.platform === 'ios').length;
    const android = appTransactions.filter(t => t.subscription.platform === 'android').length;
    const devCount = appTransactions.filter(t => t.subscription.platform === 'dev').length;
    const totalRevenue = realSubs.reduce((sum, t) => sum + (t.subscription.totalAmount || 0), 0);
    return { active, ios, android, devCount, totalRevenue };
  }, [appTransactions]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sales transactions and mobile app subscriptions
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2">
            <button
              onClick={activeTab === 'sales' ? fetchTransactions : fetchAppTransactions}
              disabled={activeTab === 'sales' ? loading : appLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:bg-gray-400"
            >
              <span className="flex items-center">
                <RefreshCw className={`h-4 w-4 mr-1 ${(activeTab === 'sales' ? loading : appLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </span>
            </button>
            <button
              onClick={() => {}}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <span className="flex items-center">
                <Download className="h-4 w-4 mr-1" />
                Export Report
              </span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-6 flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'sales'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Sales &amp; Transactions
            </span>
          </button>
          <button
            onClick={() => setActiveTab('app')}
            className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'app'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              App Transactions
              {appTransactions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full dark:bg-blue-900 dark:text-blue-300">
                  {appTransactions.length}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* ===== SALES TAB ===== */}
      {activeTab === 'sales' && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Revenue</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {loading ? 'Loading...' : formatCurrency(revenueStats.netRevenue)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Video className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Video Sales</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {loading ? 'Loading...' : formatCurrency(revenueStats.videoSales)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                  <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Class Sales</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {loading ? 'Loading...' : formatCurrency(revenueStats.classSales)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {loading ? 'Loading...' : transactions.filter(t => t.status === 'pending').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out sm:text-sm"
                  placeholder="Search by transaction ID, student name, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">All Types</option>
                  <option value="video_purchase">Video Purchase</option>
                  <option value="class_enrollment">Class Enrollment</option>
                  <option value="refund">Refund</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Transaction ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item/Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {transaction.transactionId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{transaction.studentName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {transaction.studentId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{transaction.itemName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {transaction.metadata?.subjectName || transaction.metadata?.centerName || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(transaction.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={getTransactionTypeColorFn(transaction.type)}>
                          {getTransactionTypeDisplayName(transaction.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${transaction.type === 'refund' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {transaction.type === 'refund' ? '- ' : ''}{formatCurrency(transaction.amount)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{transaction.paymentMethod.replace('_', ' ')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(transaction.status)}`}>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleOpenModal(transaction)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filteredTransactions.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400">No transactions found matching your search criteria.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== APP TRANSACTIONS TAB ===== */}
      {activeTab === 'app' && (
        <>
          {/* App Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Subscription Revenue</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {appLoading ? 'Loading...' : formatCurrency(appStats.totalRevenue)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Subscriptions</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {appLoading ? '...' : appStats.active}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700">
                  <svg className="h-5 w-5 text-gray-800 dark:text-gray-200" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">iOS</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {appLoading ? '...' : appStats.ios}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                  <svg className="h-5 w-5 text-green-600 dark:text-green-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 15.341a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-6.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v6.5zm-9.5-9.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v.5h-8v-.5zM6 5.841l-1.5-2.598a.5.5 0 0 1 .866-.5L7 5.341H6zm13.634-2.598L18 5.341h-1l1.634-2.598a.5.5 0 0 1 .866.5zM3.5 9.341a.5.5 0 0 1 .5-.5h.5v5.5H4a.5.5 0 0 1-.5-.5v-4.5zm17 0v4.5a.5.5 0 0 1-.5.5h-.5v-5.5h.5a.5.5 0 0 1 .5.5zM8.5 16.841v2a.5.5 0 0 0 1 0v-2h-1zm6 0v2a.5.5 0 0 0 1 0v-2h-1z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Android</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {appLoading ? '...' : appStats.android}
                  </p>
                  {!appLoading && appStats.devCount > 0 && (
                    <p className="text-xs text-orange-500 mt-0.5">{appStats.devCount} dev/test</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* App Filters */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search by parent name, email, or student name..."
                  value={appSearchTerm}
                  onChange={(e) => setAppSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={appPlatformFilter}
                  onChange={(e) => setAppPlatformFilter(e.target.value)}
                  className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">All Platforms</option>
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                  <option value="dev">Dev/Test</option>
                </select>
                <select
                  value={appStatusFilter}
                  onChange={(e) => setAppStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* App Transactions Table */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => toggleSort('parentName')}
                    >
                      <span className="flex items-center gap-1">Parent <SortIcon field="parentName" /></span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => toggleSort('studentNames')}
                    >
                      <span className="flex items-center gap-1">Students <SortIcon field="studentNames" /></span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => toggleSort('platform')}
                    >
                      <span className="flex items-center gap-1">Platform <SortIcon field="platform" /></span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => toggleSort('amount')}
                    >
                      <span className="flex items-center gap-1">Amount <SortIcon field="amount" /></span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => toggleSort('status')}
                    >
                      <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => toggleSort('startDate')}
                    >
                      <span className="flex items-center gap-1">Start Date <SortIcon field="startDate" /></span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => toggleSort('expiryDate')}
                    >
                      <span className="flex items-center gap-1">Expiry <SortIcon field="expiryDate" /></span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {appLoading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Loading app transactions...
                      </td>
                    </tr>
                  ) : filteredAppTransactions.map((tx) => (
                    <tr key={tx.parentId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{tx.parentName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{tx.parentEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {tx.linkedStudents.length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            tx.linkedStudents.map((s, i) => (
                              <span key={s.id}>
                                {s.name}{i < tx.linkedStudents.length - 1 ? ', ' : ''}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {tx.subscription.studentCount} student{tx.subscription.studentCount !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PlatformBadge platform={tx.subscription.platform} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(tx.subscription.totalAmount)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">per year</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getAppStatusBadgeColor(tx.subscription.status)}`}>
                          {tx.subscription.status.charAt(0).toUpperCase() + tx.subscription.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(tx.subscription.startDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(tx.subscription.expiryDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => { setSelectedAppTx(tx); setAppModalOpen(true); }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!appLoading && filteredAppTransactions.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400">
                  {appTransactions.length === 0
                    ? 'No app subscriptions found.'
                    : 'No results match your filters.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Sales Transaction Details Modal */}
      {modalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transaction Details</h3>
                <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Transaction ID</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedTransaction.transactionId}</span>
                </div>
                <div className="flex items-center mt-2">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(selectedTransaction.status)}`}>
                    {selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                  </span>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{formatDate(selectedTransaction.createdAt)}</span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{selectedTransaction.itemName}</span>
                  <span className={`text-lg font-bold ${selectedTransaction.type === 'refund' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {selectedTransaction.type === 'refund' ? '- ' : ''}{formatCurrency(selectedTransaction.amount)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Payment Method</span>
                  <span className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300">{selectedTransaction.paymentMethod.replace('_', ' ')}</span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Type</span>
                  <span className={`ml-2 text-xs font-medium ${getTransactionTypeColorFn(selectedTransaction.type)}`}>
                    {getTransactionTypeDisplayName(selectedTransaction.type)}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">Student Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedTransaction.studentName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedTransaction.studentId}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {selectedTransaction.type === 'video_purchase' ? 'Video' : 'Class'} Information
                </h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {selectedTransaction.type === 'video_purchase' ? 'Video Title:' : 'Class Name:'}
                    </span>
                    <span className="text-gray-900 dark:text-white ml-2">{selectedTransaction.itemName}</span>
                  </p>
                  {selectedTransaction.metadata?.subjectName && (
                    <p className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Subject: </span>
                      <span className="text-gray-900 dark:text-white">{selectedTransaction.metadata.subjectName}</span>
                    </p>
                  )}
                  {selectedTransaction.metadata?.centerName && (
                    <p className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Center: </span>
                      <span className="text-gray-900 dark:text-white">{selectedTransaction.metadata.centerName}</span>
                    </p>
                  )}
                  {selectedTransaction.metadata?.teacherName && (
                    <p className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Teacher: </span>
                      <span className="text-gray-900 dark:text-white">{selectedTransaction.metadata.teacherName}</span>
                    </p>
                  )}
                  {selectedTransaction.notes && (
                    <p className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Notes: </span>
                      <span className="text-gray-900 dark:text-white">{selectedTransaction.notes}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {}}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Print Receipt
                </button>
                {selectedTransaction.status === 'pending' && (
                  <button onClick={() => {}} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Process Transaction
                  </button>
                )}
                {selectedTransaction.status === 'failed' && (
                  <button onClick={() => {}} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Retry Transaction
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* App Transaction Details Modal */}
      {appModalOpen && selectedAppTx && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">App Subscription Details</h3>
                <button onClick={() => { setSelectedAppTx(null); setAppModalOpen(false); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Parent info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Parent</h4>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppTx.parentName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedAppTx.parentEmail}</p>
              </div>

              {/* Students */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Linked Students ({selectedAppTx.subscription.studentCount})
                </h4>
                {selectedAppTx.linkedStudents.length === 0 ? (
                  <p className="text-sm text-gray-400">No students linked</p>
                ) : (
                  <ul className="space-y-1">
                    {selectedAppTx.linkedStudents.map(s => (
                      <li key={s.id} className="text-sm text-gray-900 dark:text-white">
                        {s.name} <span className="text-xs text-gray-400">({s.id})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Subscription info */}
              <div className="space-y-3 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subscription</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Platform</p>
                    <div className="mt-1"><PlatformBadge platform={selectedAppTx.subscription.platform} /></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <span className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getAppStatusBadgeColor(selectedAppTx.subscription.status)}`}>
                      {selectedAppTx.subscription.status.charAt(0).toUpperCase() + selectedAppTx.subscription.status.slice(1)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Product ID</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppTx.subscription.productId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Amount</p>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(selectedAppTx.subscription.totalAmount)}/yr</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Start Date</p>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedAppTx.subscription.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Expiry Date</p>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedAppTx.subscription.expiryDate)}</p>
                  </div>
                </div>
              </div>

              {/* Transaction history */}
              {selectedAppTx.subscription.transactions && selectedAppTx.subscription.transactions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Transaction History</h4>
                  <div className="space-y-2">
                    {selectedAppTx.subscription.transactions.map((t, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">{formatDate(t.purchaseDate)}</span>
                          <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(t.amount)}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 truncate">{t.transactionId}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => { setSelectedAppTx(null); setAppModalOpen(false); }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
