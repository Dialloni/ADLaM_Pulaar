import React, { useState } from 'react';
import { Globe, RotateCcw, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

interface PreviewProps {
  code: string;
}

export const Preview: React.FC<PreviewProps> = ({ code }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="w-full h-full flex flex-col bg-[#0e0e0e] p-4 md:p-6 lg:p-8">
      <div className="flex-1 flex flex-col bg-white rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5">
        <div className="h-14 bg-zinc-50 border-b border-zinc-200 flex items-center px-6 gap-6">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/5" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-black/5" />
            <div className="w-3 h-3 rounded-full bg-[#28c840] border border-black/5" />
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <ChevronLeft className="w-4 h-4 cursor-not-allowed opacity-30" />
            <ChevronRight className="w-4 h-4 cursor-not-allowed opacity-30" />
            <RotateCcw
              className="w-4 h-4 hover:text-zinc-900 transition-colors cursor-pointer active:rotate-180 duration-500"
              onClick={handleRefresh}
            />
          </div>

          <div className="flex-1 max-w-2xl mx-auto h-9 bg-white rounded-xl border border-zinc-200 flex items-center px-4 gap-2 text-zinc-500 shadow-sm group focus-within:border-zinc-400 transition-all ring-offset-2 focus-within:ring-2 ring-zinc-200">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px] font-medium truncate select-none tracking-tight">gando-preview.app</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <Globe className="w-4 h-4 hover:text-zinc-900 transition-colors cursor-pointer" />
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
