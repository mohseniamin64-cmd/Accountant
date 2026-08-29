import React from 'react';
import { X, Code, FileText, Check, Wand2 } from 'lucide-react';
import { OpenTab, LanguageMode } from '../types';

interface EditorTabsProps {
  tabs: OpenTab[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onCloseAll: () => void;
  onFormatCode?: () => void;
  lang: LanguageMode;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  tabs,
  activePath,
  onSelectTab,
  onCloseTab,
  onCloseAll,
  onFormatCode,
  lang,
}) => {
  const isFa = lang === 'fa';

  if (tabs.length === 0) return null;

  return (
    <div
      id="editor-tabs-bar"
      className="h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-2 overflow-x-auto flex-shrink-0 select-none custom-scrollbar"
    >
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {tabs.map((tab) => {
          const isActive = tab.path === activePath;
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer transition-all border-t-2 ${
                isActive
                  ? 'bg-slate-900 text-sky-400 border-sky-500 shadow-sm'
                  : 'bg-slate-950/80 hover:bg-slate-900/60 text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <span className="truncate max-w-[140px]">{tab.name}</span>

              {tab.isDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400"
                  title={isFa ? 'تغییرات ذخیره‌نشده' : 'Unsaved changes'}
                ></span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.path);
                }}
                className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={isFa ? 'بستن تب' : 'Close Tab'}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-2 flex-shrink-0">
        {onFormatCode && (
          <button
            onClick={onFormatCode}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-sky-300 hover:bg-slate-900 px-2 py-1 rounded border border-slate-800 transition-colors cursor-pointer"
            title={isFa ? 'مرتب‌سازی و فرمت کدها' : 'Format Document'}
          >
            <Wand2 className="w-3 h-3 text-sky-400" />
            <span className="hidden md:inline">{isFa ? 'مرتب‌سازی کد' : 'Format'}</span>
          </button>
        )}

        <button
          onClick={onCloseAll}
          className="text-[11px] text-slate-500 hover:text-rose-400 hover:bg-slate-900 px-2 py-1 rounded transition-colors cursor-pointer"
          title={isFa ? 'بستن همه تب‌ها' : 'Close All Tabs'}
        >
          {isFa ? 'بستن همه' : 'Close All'}
        </button>
      </div>
    </div>
  );
};
