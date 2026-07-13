import React from 'react';
import {
  CheckCircle2, AlertTriangle, Zap, TrendingUp, ShieldAlert, FileText, Wrench,
} from 'lucide-react';
import { AnalysisResult } from '../views/AiStrategicAnalysis';

// ── 2. STYLE TOKENS (Tailwind arbitrary values, no config changes needed) ────
const PRIORITY = {
  High:   { bar: '#b23a32', pillBg: '#f6e3e0', pillFg: '#b23a32', label: 'High priority' },
  Medium: { bar: '#c4781f', pillBg: '#f8ebd9', pillFg: '#c4781f', label: 'Medium priority' },
  Low:    { bar: '#0088a2', pillBg: '#e2eff1', pillFg: '#055f72', label: 'Low priority' },
} as const;

// ── 3. FONTS + PRINT CSS (scoped to .sds-report) ─────────────────────────────
const PrintStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    .sds-report { font-family: 'Hanken Grotesk', system-ui, sans-serif; color:#1b1d1c; }
    .sds-report h1,.sds-report h2,.sds-report h3,.sds-report h4,.sds-display {
      font-family: 'Fraunces', serif; letter-spacing:-0.01em;
    }
    .sds-mono { font-family: 'JetBrains Mono', monospace; }

    @media print {
      /* Keep every colour/background in the report (overrides global whitening) */
      .sds-report, .sds-report * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Never split a card across pages */
      .sds-card { page-break-inside: avoid !important; break-inside: avoid !important; }
      .sds-no-print { display: none !important; }
      @page { margin: 12mm 0; }
    }
  `}</style>
);

// ── 4. SMALL PRESENTATIONAL HELPERS ──────────────────────────────────────────
const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="sds-mono text-[12px] tracking-[0.26em] uppercase text-[#055f72] mb-3 flex items-center gap-2.5">
    <span className="inline-block w-6 h-[2px] bg-[#0088a2]" />{children}
  </p>
);

const Pill = ({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) => (
  <span className="sds-mono text-[10.5px] tracking-[0.1em] uppercase font-semibold px-2.5 py-1 rounded-full"
        style={{ background: bg, color: fg }}>
    {children}
  </span>
);

// ── 5. MAIN COMPONENT ────────────────────────────────────────────────────────
interface Props {
  result: AnalysisResult;
  clientName?: string;
  propertyUrl?: string;
  period?: string;
}

export default function StrategicReportViewer({ result, clientName, propertyUrl, period }: Props) {
  const cur = result.currentMetrics ?? {};
  const prev = result.previousMetrics ?? {};
  const diag = result.crawlDiagnostics ?? {};

  // KPI list mapping matching actual data structure
  const kpis = result.currentMetrics ? [
    { label: 'GSC Clicks',      value: cur?.gsc?.clicks,      prev: prev?.gsc?.clicks },
    { label: 'GSC Impressions', value: cur?.gsc?.impressions, prev: prev?.gsc?.impressions },
    { label: 'Search CTR',      value: cur?.gsc?.ctr,         prev: prev?.gsc?.ctr, isPct: true },
    { label: 'GA4 Traffic',     value: cur?.ga4?.traffic,     prev: prev?.ga4?.traffic },
  ] : [];

  const score = Number(diag.healthScore ?? 0);
  const C = 326.7; // circumference for r=52
  const dash = `${(score / 100) * C} ${C}`;

  const exportToHTML = () => {
    const headHtml = document.head.innerHTML;
    const reportElement = document.getElementById('strategic-report-wrapper');
    if (!reportElement) return;

    const clone = reportElement.cloneNode(true) as HTMLElement;
    const noPrintElements = clone.querySelectorAll('.sds-no-print');
    noPrintElements.forEach(el => el.remove());

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Strategic SEO Analysis - ${clientName || 'Report'}</title>
        ${headHtml}
        <style>
          body { background-color: #e5e5e5; margin: 0; padding: 40px; display: flex; justify-content: center; }
          #strategic-report-wrapper { max-width: 1200px; width: 100%; margin: 0 auto; }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (clientName || 'Report').replace(/\s+/g, '_');
    a.download = `Strategic_SEO_Analysis_${safeName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="strategic-report-wrapper" className="sds-report bg-[#f6f2ea] rounded-[24px] overflow-hidden shadow-2xl">
      <PrintStyles />

      {/* Export buttons — hidden in the PDF/HTML */}
      <div className="sds-no-print sticky top-0 z-50 flex justify-end gap-3 px-6 py-3 bg-[#12201f]/95 backdrop-blur">
        <button onClick={exportToHTML}
          className="font-semibold text-[13px] text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4.5 py-2 px-5 transition-colors">
          ⤓ Export HTML
        </button>
        <button onClick={() => window.print()}
          className="font-semibold text-[13px] text-white bg-[#0088a2] hover:bg-[#06a3c2] rounded-lg px-4.5 py-2 px-5 transition-colors">
          ⤓ Export PDF
        </button>
      </div>

      {/* ── COVER ────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden text-[#f3efe6] py-16 px-8"
        style={{ background: 'radial-gradient(120% 90% at 82% -10%, rgba(0,136,162,.18), transparent 60%), linear-gradient(180deg,#0c1416,#12201f)' }}>
        <div className="max-w-[860px] mx-auto relative">
          <p className="sds-mono text-[12px] tracking-[0.32em] uppercase text-[#6fd0e0] mb-5">
            Strategic SEO Analysis
          </p>
          <h1 className="sds-display text-[clamp(34px,6vw,58px)] font-black leading-[1.1] text-[#fbf8f1] mb-3">
            {clientName ? <>{clientName}<br /></> : null}
            <span className="italic font-medium text-[#7fd6e6]">Strategic Analysis Report</span>
          </h1>
          <p className="text-[16px] max-w-[520px] text-[#cdd6d3] mb-8">
            A full performance, technical and content audit of organic search — with
            prioritised corrective directives and projected yield.
          </p>
          {(propertyUrl || period) && (
            <div className="flex flex-wrap gap-x-10 gap-y-3 border-t border-white/15 pt-5">
              {propertyUrl && (
                <div>
                  <span className="sds-mono block text-[11px] tracking-[0.16em] uppercase text-[#7d9499] mb-1">Property</span>
                  <b className="font-semibold text-[14.5px] text-[#eef3f1]">{propertyUrl}</b>
                </div>
              )}
              {period && (
                <div>
                  <span className="sds-mono block text-[11px] tracking-[0.16em] uppercase text-[#7d9499] mb-1">Period</span>
                  <b className="font-semibold text-[14.5px] text-[#eef3f1]">{period}</b>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── TRAFFIC GAP NARRATIVE ────────────────────────────────────────── */}
      {result.trafficGapAnalysis && (
        <section className="border-b border-[#ded5c5] py-12 px-8">
          <div className="max-w-[860px] mx-auto">
            <Kicker>Performance Gap Audit</Kicker>
            <h2 className="text-[clamp(24px,4vw,34px)] font-bold mb-4">
              The month, <span className="italic font-medium text-[#055f72]">at a glance</span>
            </h2>

            {kpis.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-7">
                {kpis.map((k, i) => {
                  const val = k.value ?? 0;
                  const prev = k.prev ?? 0;
                  const down = Number(val) < Number(prev);
                  return (
                    <div key={i} className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-5"
                         style={{ boxShadow: '0 12px 34px -16px rgba(20,30,30,.26)' }}>
                      <div className="sds-mono text-[10.5px] tracking-[0.14em] uppercase text-[#8a857b] mb-3">{k.label}</div>
                      <div className="sds-display text-[30px] font-extrabold leading-none text-[#1b1d1c]">
                        {k.value != null ? (k.isPct ? k.value.toFixed(1) : k.value) : '—'}{k.isPct ? '%' : ''}
                      </div>
                      {k.prev != null && (
                        <div className={`text-[13px] font-bold mt-2 ${down ? 'text-[#b23a32]' : 'text-[#3d7a4e]'}`}>
                          {down ? '▼' : '▲'} vs {k.isPct ? prev.toFixed(1) : prev}{k.isPct ? '%' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[15px] text-[#46494a] whitespace-pre-line leading-relaxed">
              {result.trafficGapAnalysis}
            </p>
          </div>
        </section>
      )}

      {/* ── TECHNICAL DIAGNOSTICS (only if provided) ─────────────────────── */}
      {result.crawlDiagnostics && (
        <section className="border-b border-[#ded5c5] py-12 px-8">
          <div className="max-w-[860px] mx-auto">
            <Kicker>On-Page Technical Diagnostics</Kicker>
            <h2 className="text-[clamp(24px,4vw,34px)] font-bold mb-6">
              Crawler <span className="italic font-medium text-[#055f72]">health check</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-3.5">
              <div className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-5 flex items-center gap-4"
                   style={{ boxShadow: '0 12px 34px -16px rgba(20,30,30,.26)' }}>
                <svg width="84" height="84" viewBox="0 0 120 120" className="flex-none">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#e8e0d2" strokeWidth="12" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#c4781f" strokeWidth="12" strokeLinecap="round"
                          strokeDasharray={dash} transform="rotate(-90 60 60)" />
                  <text x="60" y="67" textAnchor="middle" fontFamily="Fraunces,serif" fontSize="26" fontWeight="800" fill="#1b1d1c">{score}</text>
                </svg>
                <div>
                  <div className="sds-mono text-[10.5px] tracking-[0.14em] uppercase text-[#8a857b] mb-1.5">Health Score</div>
                  <div className="sds-display text-[30px] font-extrabold text-[#c4781f] leading-none">{score}<span className="text-[16px] text-[#8a857b]">/100</span></div>
                </div>
              </div>
              <Diag icon={<FileText size={18} />} label="Audited Pages" value={diag.totalPages} note="URLs scanned" color="#055f72" />
              <Diag icon={<ShieldAlert size={18} />} label="On-Page Errors" value={diag.totalIssues} note="Tags · titles · H1s · alt text" color="#b23a32" />
            </div>
          </div>
        </section>
      )}

      {/* ── GOOGLE ADS PERFORMANCE ────────────────────────────────────────── */}
      {cur?.ga4 && (
        <section className="border-b border-[#ded5c5] py-12 px-8">
          <div className="max-w-[860px] mx-auto">
            <Kicker>Google Ads Integration</Kicker>
            <h2 className="text-[clamp(24px,4vw,34px)] font-bold mb-6">
              Paid Search <span className="italic font-medium text-[#0088a2]">campaign metrics</span>
            </h2>
            
            {!(cur.ga4.adsClicks > 0 || cur.ga4.adsCost > 0 || (cur.ga4.adsCampaigns && cur.ga4.adsCampaigns.length > 0)) ? (
              <div className="sds-card bg-[#fffdf9] border border-dashed border-[#ded5c5] rounded-[15px] p-6 text-center text-[#8a857b] sds-mono text-xs">
                No active Google Ads campaign data detected in this period. 
                <div className="mt-1.5 text-[11px] text-zinc-500">
                  Ensure Google Ads is linked to your Google Analytics 4 property under Admin settings to sync campaign cost and clicks.
                </div>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-4 gap-3.5 mb-8">
                  <div className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-5 shadow-sm">
                    <div className="sds-mono text-[10.5px] tracking-[0.14em] uppercase text-[#8a857b] mb-3">Ad Spend</div>
                    <div className="sds-display text-[26px] font-extrabold leading-none text-[#1b1d1c]">
                      ${cur.ga4.adsCost ? cur.ga4.adsCost.toFixed(2) : '0.00'}
                    </div>
                    {prev?.ga4?.adsCost != null && prev.ga4.adsCost > 0 && (
                      <div className={`text-[12px] font-bold mt-2 ${cur.ga4.adsCost < prev.ga4.adsCost ? 'text-[#3d7a4e]' : 'text-[#b23a32]'}`}>
                        vs ${prev.ga4.adsCost.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  <div className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-5 shadow-sm">
                    <div className="sds-mono text-[10.5px] tracking-[0.14em] uppercase text-[#8a857b] mb-3">Ad Clicks</div>
                    <div className="sds-display text-[26px] font-extrabold leading-none text-[#1b1d1c]">
                      {cur.ga4.adsClicks || '0'}
                    </div>
                    {prev?.ga4?.adsClicks != null && prev.ga4.adsClicks > 0 && (
                      <div className={`text-[12px] font-bold mt-2 ${cur.ga4.adsClicks > prev.ga4.adsClicks ? 'text-[#3d7a4e]' : 'text-[#b23a32]'}`}>
                        vs {prev.ga4.adsClicks}
                      </div>
                    )}
                  </div>

                  <div className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-5 shadow-sm">
                    <div className="sds-mono text-[10.5px] tracking-[0.14em] uppercase text-[#8a857b] mb-3">Ad Impressions</div>
                    <div className="sds-display text-[26px] font-extrabold leading-none text-[#1b1d1c]">
                      {cur.ga4.adsImpressions || '0'}
                    </div>
                    {prev?.ga4?.adsImpressions != null && prev.ga4.adsImpressions > 0 && (
                      <div className={`text-[12px] font-bold mt-2 ${cur.ga4.adsImpressions > prev.ga4.adsImpressions ? 'text-[#3d7a4e]' : 'text-[#b23a32]'}`}>
                        vs {prev.ga4.adsImpressions}
                      </div>
                    )}
                  </div>

                  <div className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-5 shadow-sm">
                    <div className="sds-mono text-[10.5px] tracking-[0.14em] uppercase text-[#8a857b] mb-3">Ad Conversions</div>
                    <div className="sds-display text-[26px] font-extrabold leading-none text-[#1b1d1c]">
                      {cur.ga4.adsConversions || '0'}
                    </div>
                    {prev?.ga4?.adsConversions != null && prev.ga4.adsConversions > 0 && (
                      <div className={`text-[12px] font-bold mt-2 ${cur.ga4.adsConversions > prev.ga4.adsConversions ? 'text-[#3d7a4e]' : 'text-[#b23a32]'}`}>
                        vs {prev.ga4.adsConversions}
                      </div>
                    )}
                  </div>
                </div>

                {cur.ga4.adsCampaigns && cur.ga4.adsCampaigns.length > 0 && (
                  <div className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-6 shadow-sm overflow-hidden">
                    <div className="sds-mono text-[11px] tracking-[0.14em] uppercase text-[#8a857b] mb-4">Active Campaigns Breakdown</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[#ded5c5] text-[11px] uppercase tracking-wider text-[#8a857b] sds-mono">
                            <th className="py-2.5">Campaign Name</th>
                            <th className="py-2.5 text-right">Spend</th>
                            <th className="py-2.5 text-right">Clicks</th>
                            <th className="py-2.5 text-right">CTR</th>
                            <th className="py-2.5 text-right">Avg CPC</th>
                            <th className="py-2.5 text-right">Conversions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eee5d8]">
                          {cur.ga4.adsCampaigns.map((c: any, index: number) => (
                            <tr key={index} className="text-[#1b1d1c]">
                              <td className="py-3 font-medium">{c.campaignName}</td>
                              <td className="py-3 text-right font-mono">${c.cost.toFixed(2)}</td>
                              <td className="py-3 text-right font-mono">{c.clicks}</td>
                              <td className="py-3 text-right font-mono">{c.ctr.toFixed(1)}%</td>
                              <td className="py-3 text-right font-mono">${c.cpc.toFixed(2)}</td>
                              <td className="py-3 text-right font-mono">{c.conversions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── STRATEGIC DIRECTIVES ─────────────────────────────────────────── */}
      {result.actionableDirectives && result.actionableDirectives.length > 0 && (
        <section className="border-b border-[#ded5c5] py-12 px-8">
          <div className="max-w-[860px] mx-auto">
            <Kicker>Strategic Directives Registry</Kicker>
            <h2 className="text-[clamp(24px,4vw,34px)] font-bold mb-5">
              What to fix, <span className="italic font-medium text-[#055f72]">in priority order</span>
            </h2>

            <div className="space-y-4">
              {result.actionableDirectives.map((d, i) => {
                const p = PRIORITY[d.priority as keyof typeof PRIORITY] ?? PRIORITY.Medium;
                return (
                  <div key={i} className="sds-card relative overflow-hidden bg-[#fffdf9] border border-[#ded5c5] rounded-[16px] p-6"
                       style={{ boxShadow: '0 12px 34px -16px rgba(20,30,30,.26)' }}>
                    <span className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ background: p.bar }} />
                    <div className="flex gap-2 flex-wrap mb-3">
                      <Pill bg={p.pillBg} fg={p.pillFg}>{p.label}</Pill>
                      <Pill bg="#efe9dd" fg="#46494a">{d.category}</Pill>
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#1b1d1c] mb-3">{d.title}</h3>
                    <p className="text-[14.5px] text-[#46494a] mb-3 whitespace-pre-line">{d.description}</p>
                    <div className="bg-[#e3eee4] border border-[#c3ddc7] rounded-[11px] px-4 py-3">
                      <div className="sds-mono text-[10.5px] tracking-[0.12em] uppercase text-[#3d7a4e] font-bold mb-1">Projected Yield</div>
                      <p className="text-[13.5px] text-[#2f5237] m-0">{d.expectedImpact}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── IMPLEMENTATION GUIDE ─────────────────────────────────────────── */}
      {result.implementationGuide && (
        <section className="border-b border-[#ded5c5] py-12 px-8">
          <div className="max-w-[860px] mx-auto">
            <Kicker>Tactical Implementation Playbook</Kicker>
            <h2 className="text-[clamp(24px,4vw,34px)] font-bold mb-5">
              Hand-off <span className="italic font-medium text-[#055f72]">steps &amp; code</span>
            </h2>
            <pre className="sds-mono sds-card text-[12.5px] leading-[1.65] text-[#e6f1ee] bg-[#10201f] rounded-[12px] p-5 overflow-x-auto whitespace-pre-wrap">
{result.implementationGuide}
            </pre>
          </div>
        </section>
      )}

      {/* ── EXECUTIVE SUMMARY ────────────────────────────────────────────── */}
      {result.executiveSummary && (
        <section className="py-12 px-8">
          <div className="max-w-[860px] mx-auto">
            <Kicker>Executive Strategic Summary</Kicker>
            <h2 className="text-[clamp(24px,4vw,34px)] font-bold mb-6">
              The whole story, <span className="italic font-medium text-[#055f72]">on one page</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <SummaryBlock title="What's working" items={result.executiveSummary.goodThings}
                icon={<CheckCircle2 size={18} />} bg="#e3eee4" border="#c3ddc7" fg="#3d7a4e" liFg="#2f5237" />
              <SummaryBlock title="What needs fixing" items={result.executiveSummary.thingsToImprove}
                icon={<AlertTriangle size={18} />} bg="#f6e3e0" border="#e6c5c0" fg="#b23a32" liFg="#6e3029" />
              <SummaryBlock title="Actions we'll take" items={result.executiveSummary.actionsToDo}
                icon={<Wrench size={18} />} bg="#e6ecf6" border="#c4d2ea" fg="#3a5a99" liFg="#2c3f63" />
              <SummaryBlock title="Results we expect" items={result.executiveSummary.expectedResults}
                icon={<TrendingUp size={18} />} bg="#e2eff1" border="#b9d7dd" fg="#055f72" liFg="#1f4852" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ── 6. SUB-COMPONENTS ────────────────────────────────────────────────────────
function Diag({ icon, label, value, note, color }:
  { icon: React.ReactNode; label: string; value: any; note: string; color: string }) {
  return (
    <div className="sds-card bg-[#fffdf9] border border-[#ded5c5] rounded-[15px] p-5"
         style={{ boxShadow: '0 12px 34px -16px rgba(20,30,30,.26)' }}>
      <div className="sds-mono text-[10.5px] tracking-[0.14em] uppercase text-[#8a857b] mb-2 flex items-center gap-2"
           style={{ color }}>{icon}{label}</div>
      <div className="sds-display text-[32px] font-extrabold leading-none" style={{ color }}>{value ?? '—'}</div>
      <div className="text-[13px] text-[#46494a] mt-1.5">{note}</div>
    </div>
  );
}

function SummaryBlock({ title, items, icon, bg, border, fg, liFg }:
  { title: string; items: string[]; icon: React.ReactNode; bg: string; border: string; fg: string; liFg: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="sds-card rounded-[16px] p-6 border" style={{ background: bg, borderColor: border }}>
      <h3 className="text-[19px] font-semibold mb-3.5 flex items-center gap-2" style={{ color: fg }}>{icon}{title}</h3>
      <ul className="space-y-2.5 list-none p-0 m-0">
        {items.map((it, i) => (
          <li key={i} className="text-[14.5px] pl-3 border-l-2" style={{ color: liFg, borderColor: fg + '55' }}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
