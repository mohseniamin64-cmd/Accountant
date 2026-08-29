import React from 'react';
import { FileCode, Layers, Info, CheckCircle2 } from 'lucide-react';
import { FileItem, LanguageMode } from '../types';

interface StatusBarProps {
  filesCount: number;
  activeFile: FileItem | null;
  lang: LanguageMode;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  filesCount,
  activeFile,
  lang,
}) => {
  const isFa = lang === 'fa';

  return (
    <footer
      id="main-status-bar"
      className="h-6 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 px-3 flex items-center justify-between select-none z-30 flex-shrink-0"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sky-400">
          <Layers className="w-3 h-3" />
          <span>
            {filesCount} {isFa ? 'فایل استخراج شده' : 'Extracted Files'}
          </span>
        </div>

        {activeFile && (
          <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
            <FileCode className="w-3 h-3 text-amber-400" />
            <span className="truncate max-w-[200px]">{activeFile.path}</span>
            <span className="text-slate-500">
              ({activeFile.language || 'text'})
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-slate-500">
        <div className="flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span>{isFa ? 'محیط آماده پردازش ZIP' : 'ZIP Engine Ready'}</span>
        </div>
        <span className="hidden md:inline">UTF-8</span>
      </div>
    </footer>
  );
};
