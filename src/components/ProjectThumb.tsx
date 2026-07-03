import React from 'react';
import { Sparkles } from 'lucide-react';

/* Live mini-preview of a generated app — renders the project's own HTML scaled
   down inside a sandboxed, non-interactive iframe (same trick as the template
   cards). Memoized: the iframe only re-renders when the code string changes. */
export const ProjectThumb = React.memo(function ProjectThumb({
  code,
  height = 140,
}: {
  code?: string;
  height?: number;
}) {
  if (!code?.trim()) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--btn-bg)' }}>
        <Sparkles className="w-8 h-8 opacity-20" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }
  return (
    <div style={{ height, position: 'relative', overflow: 'hidden', background: '#fff' }}>
      <iframe
        srcDoc={code}
        title="Project preview"
        loading="lazy"
        tabIndex={-1}
        aria-hidden="true"
        sandbox="allow-scripts"
        className="border-none pointer-events-none"
        style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
      />
    </div>
  );
});
