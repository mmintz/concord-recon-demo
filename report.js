/* report.js — Concord reconciliation report generator (shared by the live demo + the Dashboard).
   buildReconReportDoc(data) -> a self-contained, print-to-PDF-ready HTML document (string).
   openReconReport(data)     -> opens it in a new tab (falls back to download if popups are blocked).
   The report runs in the visitor's browser; nothing is uploaded. */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function nf(n) { return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // group flagged absolute amounts by currency -> "€ 12,400 · $ 3,100"
  function exposure(rows) {
    const by = {};
    rows.forEach(r => { if (r.flagged) { by[r.ccy] = (by[r.ccy] || 0) + Math.abs(+r.amount || 0); } });
    const sym = { EUR: '€', USD: '$', GBP: '£' };
    const parts = Object.keys(by).map(c => `${sym[c] || ''}${c && !sym[c] ? c + ' ' : ''}${nf(by[c])}`);
    return parts.length ? parts.join('  ·  ') : '—';
  }

  function buildReconReportDoc(d) {
    const now = d.generated || new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const tone = { green: '#1a7d43', amber: '#9a6410', red: '#c0392b', violet: '#6d4aff', grey: '#5b6573' };  // AA-contrast on white
    const rows = d.rows || [];
    const exc = rows.filter(r => r.flagged).sort((a, b) => (a.sevRank - b.sevRank) || (a.confidence - b.confidence));
    const high = exc.filter(r => r.severity === 'high');

    const kpiCard = (n, l, sub, col) =>
      `<div class="kpi"><div class="kn" style="color:${col || '#14181f'}">${n}</div><div class="kl">${l}</div>${sub ? `<div class="ks">${sub}</div>` : ''}</div>`;

    const bucketRows = (d.buckets || []).filter(b => b.count > 0).map(b =>
      `<tr><td><span class="dot" style="background:${tone[b.tone] || tone.grey}"></span>${esc(b.label)}</td>
        <td class="r mono">${b.count}</td><td class="r mono">${b.pct}%</td><td class="mut">${esc(b.meaning)}</td></tr>`).join('');

    const sysDots = r => {
      const present = [r.psp && 'payment provider', r.crm && 'CRM', r.ct && 'cTrader'].filter(Boolean);
      const lbl = 'Present in ' + (present.join(', ') || 'no system') + (present.length < 3 ? '; missing elsewhere' : '');
      return `<span class="sys" role="img" aria-label="${esc(lbl)}" title="payment provider · CRM · cTrader"><i class="${r.psp ? 'on' : ''}"></i><i class="${r.crm ? 'on' : ''}"></i><i class="${r.ct ? 'on' : ''}"></i></span>`;
    };

    const excCards = exc.map(r => `
      <div class="exc ${r.severity === 'high' ? 'hi' : ''}">
        <div class="exh">
          <span class="sev" style="background:${tone[r.tone] || tone.grey}">${esc(r.verdictLabel)}${r.severity === 'high' ? ' · HIGH' : ''}</span>
          <span class="eref mono">${esc(r.ref)}</span>
          <span class="ecl">${esc(r.client)}</span>
          <span class="eam mono">${esc(r.amountText)}</span>
          ${sysDots(r)}
        </div>
        <div class="why">${esc(r.why)}</div>
        <div class="act"><b>Action:</b> ${esc(r.action)}</div>
      </div>`).join('');

    const ledger = rows.map(r => `
      <tr>
        <td class="mono">${esc(r.ref)}</td>
        <td>${esc(r.client)}</td>
        <td class="r mono">${esc(r.amountText)}</td>
        <td>${sysDots(r)}</td>
        <td><span class="tag" style="color:${tone[r.tone] || tone.grey};border-color:${tone[r.tone] || tone.grey}33">${esc(r.verdictLabel)}</span></td>
        <td class="r mono">${r.confidence == null ? '<span class="mut">n/a</span>' : r.confidence + '%'}</td>
      </tr>`).join('');

    const srcLine = (d.sources || []).map(s => `${esc(s.label)} <b>${esc(s.name)}</b> · ${s.rows} rows`).join('&nbsp;&nbsp;|&nbsp;&nbsp;');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Reconciliation Report · Concord · ${esc(now)}</title>
<style>
  :root{--ink:#14181f;--mut:#5b6573;--ln:#e3e7ec;--grn:#1a7d43;--bg:#f6f8fa}
  .bar button:focus-visible,a:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;font-size:14px}
  .mono{font-variant-numeric:tabular-nums;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
  .sheet{max-width:880px;margin:0 auto;background:#fff;padding:34px 40px 56px;box-shadow:0 1px 40px #000000010}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--ink);padding-bottom:14px}
  .brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.14em;font-size:13px}
  .brand .sq{width:18px;height:18px;border-radius:5px;background:var(--grn);position:relative}
  .brand .sq:after{content:"";position:absolute;inset:4px;border:2px solid #06351c;border-radius:2px}
  h1{font-size:23px;margin:10px 0 2px;letter-spacing:-.01em}
  .when{text-align:right;font-size:12px;color:var(--mut)}
  .tag-demo{display:inline-block;margin-top:6px;font-size:10.5px;font-weight:700;letter-spacing:.08em;color:var(--grn);background:#1f8f4d14;border:1px solid #1f8f4d40;padding:2px 8px;border-radius:20px}
  .meta{font-size:12px;color:var(--mut);margin:14px 0 22px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 26px}
  .kpi{border:1px solid var(--ln);border-radius:11px;padding:14px 15px;background:#fcfdfe}
  .kn{font-size:27px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
  .kl{font-size:12px;font-weight:600;margin-top:6px}
  .ks{font-size:11px;color:var(--mut);margin-top:1px}
  h2{font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);margin:30px 0 11px;border-bottom:1px solid var(--ln);padding-bottom:7px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);font-weight:700;padding:6px 9px;border-bottom:1px solid var(--ln)}
  td{padding:8px 9px;border-bottom:1px solid #eef1f4;vertical-align:top}
  td.r,th.r{text-align:right}
  .mut{color:var(--mut)}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:middle}
  .sys{display:inline-flex;gap:3px}
  .sys i{width:8px;height:8px;border-radius:50%;border:1.4px solid #c2c9d2;display:inline-block}
  .sys i.on{background:var(--ink);border-color:var(--ink)}
  .tag{font-size:11px;font-weight:700;border:1px solid;border-radius:5px;padding:1px 7px;white-space:nowrap}
  .expo{display:flex;gap:8px;align-items:baseline;margin:2px 0 4px;font-size:13px}
  .expo b{font-size:16px}
  .exc{border:1px solid var(--ln);border-left:3px solid var(--mut);border-radius:9px;padding:11px 14px;margin:9px 0;background:#fcfdfe;page-break-inside:avoid}
  .exc.hi{border-left-color:var(--red,#c0392b);background:#c0392b07}
  .exh{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
  .sev{color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:2px 8px;border-radius:5px}
  .eref{font-weight:700}.ecl{color:var(--mut)}.eam{margin-left:auto;font-weight:700}
  .exc .why{margin:8px 0 4px;font-size:13px}
  .exc .act{font-size:12.5px;color:#2c3a2f}
  .foot{margin-top:34px;border-top:1px solid var(--ln);padding-top:14px;font-size:11.5px;color:var(--mut)}
  .foot b{color:var(--ink)}
  .bar{position:sticky;top:0;z-index:5;background:#0e1320;color:#fff;display:flex;gap:10px;align-items:center;justify-content:center;padding:11px;font-size:13px}
  .bar button{background:var(--grn);color:#fff;border:0;border-radius:8px;padding:9px 18px;font-weight:700;font-size:13.5px;cursor:pointer}
  .bar span{color:#9fb0c4}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  @media print{
    @page{size:A4;margin:13mm}
    body{background:#fff;font-size:11.5px}
    .sheet{box-shadow:none;max-width:none;padding:0}
    .bar{display:none}
    thead{display:table-header-group}
    .exc,tr{page-break-inside:avoid}
    .kn{font-size:22px}
  }
</style></head><body>
<div class="bar"><button onclick="window.print()">⤓ Print / Save as PDF</button><span>Generated in your browser — nothing was uploaded.</span></div>
<div class="sheet">
  <div class="top">
    <div>
      <div class="brand"><span class="sq"></span> CONCORD</div>
      <h1>Reconciliation Report</h1>
      <div class="tag-demo">${d.live ? 'LIVE RUN · YOUR DATA, IN YOUR BROWSER' : 'ILLUSTRATIVE SAMPLE · TOPFX DEMO DATA'}</div>
    </div>
    <div class="when">Generated<br><b>${esc(now)}</b><br><span style="color:#6b7682">Concord · reconciliation</span></div>
  </div>
  <div class="meta">Sources reconciled:&nbsp;&nbsp;${srcLine || '—'}</div>

  <div class="kpis">
    ${kpiCard(d.kpis.rate + '%', 'Reconciled', 'matched + in tolerance', 'var(--grn)')}
    ${kpiCard(d.kpis.reconciled, 'Transactions cleared', 'across all three systems')}
    ${kpiCard(d.kpis.exceptions, 'Exceptions to review', high.length ? high.length + ' high-severity' : 'none high-severity', d.kpis.exceptions ? '#c0392b' : 'var(--grn)')}
    ${kpiCard((d.sources || []).reduce((a, s) => a + (s.rows || 0), 0).toLocaleString('en-GB'), 'Source rows examined', rows.length + ' reconciliation units')}
  </div>

  ${exc.length ? `<div class="expo"><span class="mut">Value flagged for review:</span> <b class="mono">${exposure(rows)}</b></div>` : ''}

  <h2>Status breakdown</h2>
  <table><thead><tr><th>Result</th><th class="r">Count</th><th class="r">Share</th><th>What it means</th></tr></thead>
  <tbody>${bucketRows}</tbody></table>

  ${exc.length ? `<h2>Exceptions requiring action${high.length ? ` — <span style="color:#c0392b">${high.length} urgent</span>` : ''}</h2>
  ${excCards}` : '<h2>Exceptions</h2><p class="mut">No exceptions — every record reconciled across all three systems.</p>'}

  <h2>Full ledger — ${rows.length} records</h2>
  <table><thead><tr><th>Reference</th><th>Client</th><th class="r">Amount</th><th>Systems</th><th>Result</th><th class="r">Conf.</th></tr></thead>
  <tbody>${ledger}</tbody></table>

  <div class="foot">
    <b>How this was produced.</b> Each source is normalized to one shape, then matched through a cascade — exact reference → composite (amount + account) → tolerance (fee, FX, settlement lag) → duplicate &amp; suspicious detection → unmatched residue. <b>Systems</b> dots show which of the three (payment provider · CRM · cTrader) hold each record. Confidence is a rule-based score, not a guarantee.<br><br>
    <b>This is a working concept, not a finished system.</b> It reconciles the sample data loaded in your browser; nothing is uploaded. In production Concord connects to cTrader (Open API), your PSPs, bank statements (MT940 / camt.053) and GL, with four-eyes controls and a full audit trail. &nbsp;·&nbsp; Generated by <b>Concord</b>.
  </div>
</div>
</body></html>`;
  }

  function openReconReport(d) {
    const html = buildReconReportDoc(d);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const w = window.open(url, '_blank');
    if (!w) { const a = document.createElement('a'); a.href = url; a.download = 'concord-reconciliation-report.html'; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  window.buildReconReportDoc = buildReconReportDoc;
  window.openReconReport = openReconReport;
})();
