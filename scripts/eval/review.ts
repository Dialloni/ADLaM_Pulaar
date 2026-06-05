// Generates a self-contained review.html for grading outputs BY EAR, side-by-side.
// Each model's app renders in an iframe; you score ADLaM quality + app quality and add notes.
// Grades persist in localStorage and export to JSON. Automated check flags shown as hints.

import type { CheckResult } from './checks.js';

export interface ReviewRow {
  id: string;
  category: string;
  expect: string;
  prompt: string;
  preferredLanguage?: string;
  models: {
    model: string;          // label e.g. "gemini" / "claude"
    ok: boolean;
    error?: string;
    ms: number;
    name?: string;
    explanation?: string;
    file?: string;          // relative path to rendered .html (iframe src)
    checks?: CheckResult;
  }[];
}

export function generateReviewHtml(runId: string, rows: ReviewRow[]): string {
  const data = JSON.stringify(rows).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Gando Eval — ${runId}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Adlam&display=swap" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-900">
<div class="max-w-7xl mx-auto p-4">
  <div class="flex items-center justify-between mb-4 sticky top-0 bg-slate-100 py-3 z-10">
    <h1 class="text-2xl font-bold">Gando Eval — ${runId}</h1>
    <div class="flex gap-2">
      <button id="export" class="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">Download grades JSON</button>
      <span id="progress" class="px-3 py-2 text-sm text-slate-600"></span>
    </div>
  </div>
  <div id="rows" class="space-y-8"></div>
</div>
<script>
const ROWS = JSON.parse(${JSON.stringify(data)});
const KEY = 'gando-eval-${runId}';
const grades = JSON.parse(localStorage.getItem(KEY) || '{}');

function save() {
  localStorage.setItem(KEY, JSON.stringify(grades));
  const total = ROWS.reduce((n,r)=>n+r.models.length,0);
  const done = Object.keys(grades).filter(k=>grades[k] && (grades[k].adlam||grades[k].app)).length;
  document.getElementById('progress').textContent = done+' / '+total+' graded';
}

function gradeBox(rowId, m) {
  const gk = rowId+'::'+m.model;
  const g = grades[gk] || (grades[gk] = {});
  const wrap = document.createElement('div');
  wrap.className = 'mt-2 p-3 bg-slate-50 border rounded-lg text-sm space-y-2';
  const stars = (field,label) => {
    let h = '<div class="flex items-center gap-2"><span class="w-28 text-slate-600">'+label+'</span>';
    for (let i=1;i<=5;i++) h += '<button data-f="'+field+'" data-v="'+i+'" class="star w-8 h-8 rounded border '+(g[field]>=i?'bg-amber-400':'bg-white')+'">'+i+'</button>';
    return h+'</div>';
  };
  wrap.innerHTML =
    stars('adlam','ADLaM quality') +
    stars('app','App quality') +
    '<label class="flex items-center gap-2"><input type="checkbox" class="wrong" '+(g.wrongLang?'checked':'')+'/> wrong / mixed language</label>' +
    '<textarea class="notes w-full border rounded p-2" rows="2" placeholder="notes...">'+(g.notes||'')+'</textarea>';
  wrap.querySelectorAll('.star').forEach(b=>b.onclick=()=>{
    g[b.dataset.f]=+b.dataset.v; save(); render();
  });
  wrap.querySelector('.wrong').onchange=e=>{ g.wrongLang=e.target.checked; save(); };
  wrap.querySelector('.notes').oninput=e=>{ g.notes=e.target.value; save(); };
  return wrap;
}

function render() {
  const root = document.getElementById('rows');
  root.innerHTML = '';
  ROWS.forEach(r => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow p-4';
    card.innerHTML = '<div class="mb-3"><span class="text-xs font-mono px-2 py-1 bg-slate-200 rounded">'+r.id+'</span> '+
      '<span class="text-xs px-2 py-1 bg-indigo-100 rounded ml-1">expect: '+r.expect+'</span>'+
      '<p class="mt-2 text-slate-700">'+r.prompt+'</p></div>';
    const grid = document.createElement('div');
    grid.className = 'grid md:grid-cols-2 gap-4';
    r.models.forEach(m => {
      const col = document.createElement('div');
      col.className = 'border rounded-lg p-2';
      let head = '<div class="flex items-center justify-between"><b class="uppercase">'+m.model+'</b>'+
        '<span class="text-xs text-slate-500">'+m.ms+'ms</span></div>';
      if (!m.ok) {
        col.innerHTML = head + '<div class="mt-2 text-red-600 text-sm">ERROR: '+(m.error||'failed')+'</div>';
        grid.appendChild(col); return;
      }
      const c = m.checks || {};
      const flags = (c.flags||[]);
      head += '<div class="text-xs text-slate-500 mt-1">'+(m.name||'')+'</div>';
      head += '<div class="text-xs mt-1 flex flex-wrap gap-1">'+
        'ADLaM '+Math.round((c.adlamRatio||0)*100)+'% · corpus '+Math.round((c.corpusMatchRatio||0)*100)+'% · sections '+(c.sectionCount||0)+
        '</div>';
      if (flags.length) head += '<div class="text-xs text-amber-700 mt-1">⚠ '+flags.join(' · ')+'</div>';
      col.innerHTML = head;
      const frame = document.createElement('iframe');
      frame.src = m.file;
      frame.className = 'w-full h-96 mt-2 border rounded bg-white';
      col.appendChild(frame);
      col.appendChild(gradeBox(r.id, m));
      grid.appendChild(col);
    });
    card.appendChild(grid);
    root.appendChild(card);
  });
  save();
}

document.getElementById('export').onclick = () => {
  const blob = new Blob([JSON.stringify({runId:'${runId}', grades}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'grades-${runId}.json';
  a.click();
};

render();
</script>
</body>
</html>`;
}
