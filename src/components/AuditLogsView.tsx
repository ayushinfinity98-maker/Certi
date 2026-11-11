import React, { useState, useMemo } from 'react';
import { AuditLog } from '../types';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Calendar, 
  User, 
  FileText, 
  Award, 
  Edit3, 
  Mail, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  X,
  Copy,
  Clock
} from 'lucide-react';

interface AuditLogsViewProps {
  logs: AuditLog[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, onRefresh, isLoading = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Categorize actions
  const getActionCategory = (action: string): string => {
    if (action.includes('CERTIFICATE')) return 'certificate';
    if (action.includes('SIGNATURE')) return 'signature';
    if (action.includes('EMAIL') || action.includes('TEMPLATE')) return 'template';
    if (action.includes('CA_')) return 'ca_account';
    if (action.includes('STUDENT')) return 'student';
    return 'general';
  };

  const getActionBadge = (action: string) => {
    const category = getActionCategory(action);
    switch (category) {
      case 'certificate':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Award className="w-3 h-3 mr-1 text-emerald-600" />
            {action}
          </span>
        );
      case 'signature':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Edit3 className="w-3 h-3 mr-1 text-indigo-600" />
            {action}
          </span>
        );
      case 'template':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Mail className="w-3 h-3 mr-1 text-amber-600" />
            {action}
          </span>
        );
      case 'ca_account':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <UserCheck className="w-3 h-3 mr-1 text-blue-600" />
            {action}
          </span>
        );
      case 'student':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <User className="w-3 h-3 mr-1 text-purple-600" />
            {action}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Shield className="w-3 h-3 mr-1 text-slate-500" />
            {action}
          </span>
        );
    }
  };

  const getActorBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
            Super Admin
          </span>
        );
      case 'ca':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
            Ambassador
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
            System
          </span>
        );
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor(diffMs / (1000 * 60));

      let relative = '';
      if (diffMins < 1) relative = 'Just now';
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else if (diffHours < 24) relative = `${diffHours}h ago`;
      else relative = `${Math.floor(diffHours / 24)}d ago`;

      const formattedDate = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const formattedTime = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      return { relative, full: `${formattedDate}, ${formattedTime}` };
    } catch (e) {
      return { relative: isoStr, full: isoStr };
    }
  };

  // Filter and sort
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        const matchesSearch =
          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.actorEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.targetId?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory =
          categoryFilter === 'all' || getActionCategory(log.action) === categoryFilter;

        const matchesRole = roleFilter === 'all' || log.actorRole === roleFilter;

        return matchesSearch && matchesCategory && matchesRole;
      })
      .sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      });
  }, [logs, searchQuery, categoryFilter, roleFilter, sortOrder]);

  // Pagination calculation
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedLogs = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, safeCurrentPage, pageSize]);

  // Export to CSV
  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Actor Email', 'Actor Role', 'Action', 'Target ID', 'Details'];
    const rows = filteredLogs.map((log) => [
      `"${log.timestamp}"`,
      `"${log.actorEmail || ''}"`,
      `"${log.actorRole}"`,
      `"${log.action}"`,
      `"${log.targetId || ''}"`,
      `"${log.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_logs_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                System Security & Activity Audit Trail
              </h2>
              <p className="text-xs text-gray-500">
                Immutable, timestamped record of certificate issuances, signature updates, email template modifications, and account actions.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              className="px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center disabled:opacity-50"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Export CSV
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition border border-gray-200"
              title="Refresh audit logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Search Query */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by actor, action, keyword, or target ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Action Categories</option>
              <option value="certificate">Certificate Issuance</option>
              <option value="signature">Signature Updates</option>
              <option value="template">Email Template Changes</option>
              <option value="ca_account">CA Account Changes</option>
              <option value="student">Student Operations</option>
            </select>
          </div>

          {/* Actor Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Actor Roles</option>
              <option value="admin">Super Admin Only</option>
              <option value="ca">Campus Ambassador Only</option>
              <option value="system">System Events</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <select
              value={sortOrder}
              onChange={(e: any) => {
                setSortOrder(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="py-3 px-4 w-44">Timestamp</th>
                <th className="py-3 px-4 w-48">Actor Details</th>
                <th className="py-3 px-4 w-48">Action Type</th>
                <th className="py-3 px-4">Action Details & Target</th>
                <th className="py-3 px-4 text-right w-24">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    No audit records match the current filter or search criteria.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const { relative, full } = formatTimestamp(log.timestamp);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900 flex items-center">
                          <Clock className="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0" />
                          <span>{relative}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono pl-5">
                          {full}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 mb-1">
                          {getActorBadge(log.actorRole)}
                        </div>
                        <p className="font-mono text-[11px] text-gray-700 truncate max-w-[180px]" title={log.actorEmail}>
                          {log.actorEmail || 'system'}
                        </p>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Details & Target */}
                      <td className="py-3 px-4">
                        <p className="text-gray-800 leading-snug line-clamp-2">
                          {log.details}
                        </p>
                        {log.targetId && (
                          <div className="flex items-center space-x-1 mt-1">
                            <span className="text-[10px] text-gray-400">Target ID:</span>
                            <span className="font-mono text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                              {log.targetId}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Metadata / Inspect */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2.5 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg text-[11px] font-semibold transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="p-4 bg-gray-50/70 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3 text-xs">
          {/* Entries count & Page size */}
          <div className="flex items-center space-x-3 text-gray-500">
            <span>
              Showing{' '}
              <span className="font-bold text-gray-800">
                {totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-bold text-gray-800">
                {Math.min(safeCurrentPage * pageSize, totalItems)}
              </span>{' '}
              of <span className="font-bold text-gray-800">{totalItems}</span> audit events
            </span>

            <div className="flex items-center space-x-1 border-l border-gray-300 pl-3">
              <span className="text-gray-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-gray-300 rounded-lg px-2 py-0.5 text-xs font-semibold focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Page navigation controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-3 py-1 font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg text-xs">
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Audit Event Details
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Action
                </span>
                <div className="flex items-center space-x-2">
                  {getActionBadge(selectedLog.action)}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Actor Information
                </span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-semibold text-gray-900 font-mono">{selectedLog.actorEmail}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Role:</span>
                    <div>{getActorBadge(selectedLog.actorRole)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">UID:</span>
                    <span className="font-mono text-gray-600 text-[11px]">{selectedLog.actorUid}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Description & Details
                </span>
                <p className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 leading-relaxed font-sans">
                  {selectedLog.details}
                </p>
              </div>

              {selectedLog.targetId && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Target Resource Identifier
                  </span>
                  <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="font-mono text-blue-700 font-bold">{selectedLog.targetId}</span>
                    <button
                      onClick={() => handleCopy(selectedLog.targetId || '', selectedLog.id)}
                      className="px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      {copiedId === selectedLog.id ? 'Copied!' : 'Copy ID'}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Exact Timestamp
                </span>
                <p className="font-mono text-gray-600 text-[11px]">
                  {selectedLog.timestamp} ({formatTimestamp(selectedLog.timestamp).full})
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
