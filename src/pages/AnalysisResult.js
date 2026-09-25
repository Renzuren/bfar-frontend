import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Trash2, CalendarDays, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MLAnalyticsPanel from '../components/MLAnalyticsPanel';
import AutoChartsReport from '../components/AutoChartsReport';
import { getSavedAnalysis, deleteAnalysis } from '../lib/analysisStore';
import { toast } from 'sonner';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return isNaN(date.getTime())
    ? 'N/A'
    : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const AnalysisResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setMissing(false);
    getSavedAnalysis(id)
      .then((result) => {
        if (cancelled) return;
        if (result) setRecord(result);
        else setMissing(true);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => { cancelled = true; };
  }, [id]);

  const handleDelete = async () => {
    try {
      await deleteAnalysis(record.id);
      toast.success('Analysis deleted');
      navigate('/dashboard');
    } catch (_) {
      toast.error('Could not delete the analysis');
    }
  };

  if (missing) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Inbox className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h1 className="text-lg font-bold text-slate-900">Analysis not found</h1>
          <p className="mt-1 text-sm text-slate-500">
            This saved analysis may have been deleted or is no longer available.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-sm text-slate-500">Loading analysis…</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const att = record.analysisResults?.att_result || {};
  const treat = record.analysisResults?.treatment_column || record.treatmentColumn || '';
  const outcome = record.analysisResults?.outcome_column || record.outcomeColumn || '';
  const rowCount =
    (Array.isArray(record.rows) ? record.rows.length : 0) ||
    (Array.isArray(record.analysisResults?.ps_output?.ps) ? record.analysisResults.ps_output.ps.length : 0);

  const statCards = [
    { label: 'Matched Pairs', value: att.matched_pairs ?? '—', accent: 'text-blue-600' },
    { label: 'Mean ATT', value: att.att_mean == null ? '—' : `₱${Number(att.att_mean).toFixed(2)}`, accent: 'text-teal-600' },
    { label: 'Outcome', value: outcome || 'Auto-detect', accent: 'text-indigo-600' },
    { label: 'Rows', value: rowCount.toLocaleString(), accent: 'text-violet-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-3 pb-12 pt-0 sm:px-4">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between px-4 py-3 sm:px-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-1.5 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <h1 className="text-sm font-semibold text-slate-900 sm:text-base">{record.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden border-slate-200 text-[10px] text-slate-400 sm:inline-flex">
                <CalendarDays className="mr-1 h-3 w-3" /> {formatDate(record.createdAt)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="gap-1.5 text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </header>

        <main className="mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                <p className={`mt-0.5 truncate text-lg font-bold tracking-tight ${stat.accent}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {record.truncated && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Large files were trimmed to fit browser storage. Key results are preserved; some
              row-level charts may be reduced.
            </div>
          )}

          <MLAnalyticsPanel
            analysisResults={record.analysisResults}
            columns={record.columns || []}
            rows={record.rows || []}
            treatmentColumn={treat}
            defaultTab="summary"
          />

          {(record.rows || []).length > 0 && (
            <AutoChartsReport columns={record.columns || []} rows={record.rows || []} treatmentColumn={treat} />
          )}
        </main>
      </div>
    </div>
  );
};

export default AnalysisResult;