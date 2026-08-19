import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  CalendarDays,
  Inbox,
  Trash2,
  BarChart3,
  Eye,
  ClipboardList,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';

const ReportsList = () => {
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReportId, setDeleteReportId] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      if (!project) return;
      try {
        const response = await api.get(`/reports?project_id=${project.id}`);
        setReports(response.data || []);
      } catch (error) {
        toast.error('Failed to fetch reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [project]);

  const handleDelete = async () => {
    if (!deleteReportId) return;
    try {
      await api.delete(`/reports/${deleteReportId}`);
      setReports((prev) => prev.filter((r) => r.id !== deleteReportId));
      toast.success('Report deleted');
    } catch (error) {
      toast.error('Failed to delete report');
    }
    setDeleteDialogOpen(false);
    setDeleteReportId(null);
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    let date;
    if (typeof value === 'object' && typeof value._seconds === 'number') {
      date = new Date(value._seconds * 1000);
    } else {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString([], {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'processing':
        return 'bg-amber-100 text-amber-700';
      case 'failed':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-8 px-6 lg:px-8">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-8 py-10 text-white shadow-2xl shadow-slate-900/20 sm:px-12 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative text-left">
          <div className="mb-4 flex items-center gap-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <ClipboardList className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Generated Reports</h2>
              <p className="mt-1 text-sm font-medium text-blue-300">Report Management</p>
            </div>
          </div>
          <p className="max-w-2xl text-left text-base text-slate-300">
            View, manage, and download narrative reports generated for this project. 
            Track before and after response data with comprehensive insights.
          </p>
        </div>
      </section>

      {/* Stats Row */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">Total Reports</p>
              <p className="mt-1 text-left text-3xl font-bold text-slate-900">{reports.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50">
              <Clock className="h-6 w-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">Before Responses</p>
              <p className="mt-1 text-left text-3xl font-bold text-cyan-600">
                {project?.before_form ? 'Available' : 'None'}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
              <AlertCircle className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <p className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">After Responses</p>
              <p className="mt-1 text-left text-3xl font-bold text-violet-600">
                {project?.after_form ? 'Available' : 'None'}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Report Cards */}
      <section>
        {reports.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-blue-50">
              <Inbox className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="mb-3 text-2xl font-bold text-slate-900">No Reports Yet</h3>
            <p className="mx-auto mb-8 max-w-md text-base text-slate-500">
              Generate your first narrative report to see it here. Reports are automatically saved for future reference.
            </p>
            <Button
              onClick={() => navigate(`/projects/${project?.id}/narrative-report`)}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30"
            >
              <BarChart3 className="mr-2 h-5 w-5" />
              Generate First Report
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <Card
                key={report.id}
                className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
              >
                <div className="p-6">
                  {/* Report Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-blue-50 text-slate-600 transition-colors group-hover:from-blue-50 group-hover:to-indigo-50 group-hover:text-blue-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    {report.status && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    )}
                  </div>
                  
                  {/* Report Title */}
                  <h3 className="mb-2 text-left text-lg font-bold text-slate-900 transition-colors group-hover:text-blue-900">
                    {report.title || 'Untitled Report'}
                  </h3>
                  
                  {/* Report Date */}
                  <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                    <CalendarDays className="h-4 w-4" />
                    <span>{formatDate(report.generated_at || report.created_at)}</span>
                  </div>
                  
                  {/* Response Counts */}
                  {report.before_responses_count !== undefined && (
                    <div className="mb-4 rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Responses</span>
                        <span className="font-semibold text-slate-700">
                          {report.before_responses_count} before / {report.after_responses_count} after
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => navigate(`/projects/${project?.id}/narrative-report`)}
                      size="sm"
                      className="flex-1 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Eye className="mr-1.5 h-4 w-4" /> View
                    </Button>
                    
                    <Button
                      onClick={() => {
                        setDeleteReportId(report.id);
                        setDeleteDialogOpen(true);
                      }}
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              Delete Report
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              Are you sure you want to delete this report? This action cannot be undone and all data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl px-6">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="rounded-xl bg-rose-600 px-6 text-white hover:bg-rose-700" 
              onClick={handleDelete}
            >
              Delete Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReportsList;