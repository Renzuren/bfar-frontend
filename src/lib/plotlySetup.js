// Custom Plotly bundle: registers only the trace types used by Auto Charts,
// plus a tiny React wrapper (avoids react-plotly.js peer-dep issues on React 19).
import PlotlyCore from 'plotly.js/lib/core';
import scatterTrace from 'plotly.js/lib/scatter';
import barTrace from 'plotly.js/lib/bar';
import boxTrace from 'plotly.js/lib/box';
import violinTrace from 'plotly.js/lib/violin';
import heatmapTrace from 'plotly.js/lib/heatmap';
import histogramTrace from 'plotly.js/lib/histogram';
import { useEffect, useRef } from 'react';

PlotlyCore.register([scatterTrace, barTrace, boxTrace, violinTrace, heatmapTrace, histogramTrace]);

const BASE_CONFIG = { displayModeBar: false, responsive: true, doubleClick: 'reset' };

export const Plot = ({ data = [], layout = {}, config = {} }) => {
  const ref = useRef(null);
  const sig = JSON.stringify({ data, layout });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    PlotlyCore.react(el, data, { autosize: true, ...layout }, { ...BASE_CONFIG, ...config });
    const ro = new ResizeObserver(() => {
      if (el.parentNode) PlotlyCore.Plots.resize(el);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      PlotlyCore.purge(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, config]);

  return <div ref={ref} className="h-full w-full" />;
};
