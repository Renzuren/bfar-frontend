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

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Generated Reports</p>
          <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">Reports</h2>
          <p className="max-w-2xl text-base text-slate-300">
            View, filter, and download past narrative reports for this project.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Reports</p>
          <p className="mt-1.5 text-3xl font-bold text-slate-900">{reports.length}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Before Responses</p>
          <p className="mt-1.5 text-3xl font-bold text-indigo-600">{project?.before_form ? 'Available' : 'None'}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">After Responses</p>
          <p className="mt-1.5 text-3xl font-bold text-emerald-600">{project?.after_form ? 'Available' : 'None'}</p>
        </Card>
      </section>

      <section>
        {reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600">
              <Inbox className="h-10 w-10" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No reports yet</h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">
              Generate a Narrative Report from the comparison page, then save it here.
            </p>
            <Button
              onClick={() => navigate(`/projects/${project?.id}/narrative-report`)}
              className="bg-cyan-600 text-white hover:bg-cyan-700"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Go to Narrative Report
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card
                key={report.id}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{report.title || 'Untitled Report'}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(report.generated_at || report.created_at)}
                        </span>
                        {report.before_responses_count !== undefined && (
                          <span>{report.before_responses_count} before / {report.after_responses_count} after responses</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => navigate(`/projects/${project?.id}/narrative-report`)}
                      size="sm"
                      variant="outline"
                      className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                    </Button>
                    <Button
                      onClick={() => {
                        setDeleteReportId(report.id);
                        setDeleteDialogOpen(true);
                      }}
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The report will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReportsList;
