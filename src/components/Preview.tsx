import React, { useState } from 'react';
import { Globe, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface PreviewProps {
  code: string;
}

export const Preview: React.FC<PreviewProps> = ({ code }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="w-full h-full flex flex-col bg-[#0e0e0e] p-4 md:p-6 lg:p-8">
      <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8)' }}>
        <div style={{ height: 46, background: 'rgba(19,19,19,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16, gap: 12 }}>
          <div className="flex gap-1.5">
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
          </div>

          <div className="flex items-center gap-3" style={{ color: '#52525b' }}>
            <ChevronLeft className="w-4 h-4 cursor-not-allowed opacity-30" />
            <ChevronRight className="w-4 h-4 cursor-not-allowed opacity-30" />
            <RotateCcw
              className="w-4 h-4 cursor-pointer hover:text-zinc-300 transition-colors active:rotate-180 duration-500"
              onClick={handleRefresh}
            />
          </div>

          <div style={{ flex: 1, maxWidth: 400, margin: '0 auto', height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10, gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#767575', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>gando-preview.app</span>
          </div>

          <div className="flex items-center gap-3" style={{ color: '#52525b' }}>
            <Globe className="w-4 h-4 hover:text-zinc-300 transition-colors cursor-pointer" />
          </div>
        </div>

        <div className="flex-1 bg-white relative">
          <iframe
            key={refreshKey}
            srcDoc={code}
            title="Gando AI Preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
          />
        </div>
      </div>
    </div>
  );
};
