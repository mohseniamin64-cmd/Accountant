import React, { useState } from 'react';
import { Search, X, FileCode, ArrowRight } from 'lucide-react';
import { FileItem, LanguageMode } from '../types';

interface GlobalSearchModalProps {
  filesMap: Record<string, FileItem>;
  onSelectResult: (path: string) => void;
  onClose: () => void;
  lang: LanguageMode;
}

interface MatchResult {
  path: string;
  filename: string;
  lineNum: number;
  lineText: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  filesMap,
  onSelectResult,
  onClose,
  lang,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchResult[]>([]);

  const isFa = lang === 'fa';

  const handleSearch = (text: string) => {
    setQuery(text);
    if (!text.trim() || text.length < 2) {
      setResults([]);
      return;
    }

    const matches: MatchResult[] = [];
    const qLower = text.toLowerCase();

    for (const path in filesMap) {
      const file = filesMap[path];
      if (file.isFolder || file.isBinary || !file.content) continue;

      const lines = file.content.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(qLower)) {
          matches.push({
            path,
            filename: file.name,
            lineNum: index + 1,
            lineText: line.trim(),
          });
        }
      });
    }

    setResults(matches.slice(0, 100)); // cap at 100 matches
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-800 flex items-center gap-3 bg-slate-950">
          <Search className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={
              isFa
                ? 'جستجو عبارات و کد در تمام فایل‌های ZIP...'
                : 'Search text or code across all files...'
            }
            className="w-full bg-transparent text-slate-100 text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {query.trim().length >= 2 && results.length === 0 && (
            <div className="text-center text-slate-500 text-xs py-10">
              {isFa ? 'عبارت مورد نظر در فایل‌ها پیدا نشد.' : 'No matches found.'}
            </div>
          )}

          {results.map((item, idx) => (
            <div
              key={`${item.path}-${item.lineNum}-${idx}`}
              onClick={() => {
                onSelectResult(item.path);
                onClose();
              }}
              className="group p-2.5 rounded-lg hover:bg-slate-800/80 cursor-pointer border border-transparent hover:border-slate-700/60 transition-colors flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 mb-1">
                  <FileCode className="w-3.5 h-3.5" />
                  <span className="truncate">{item.path}</span>
                  <span className="text-[10px] text-slate-500">
                    (Line {item.lineNum})
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono truncate bg-slate-950/60 p-1 rounded border border-slate-800/80">
                  {item.lineText}
                </p>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors ml-2 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
