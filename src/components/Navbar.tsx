import React, { useRef } from 'react';
import {
  FileArchive,
  Upload,
  Download,
  Play,
  Bot,
  Search,
  Sun,
  Moon,
  Globe,
  Sparkles,
  FilePlus,
  Plus
} from 'lucide-react';
import { IDETheme, LanguageMode } from '../types';

interface NavbarProps {
  projectName: string;
  onUploadZip: (file: File) => void;
  onExportZip: () => void;
  onLoadSample: () => void;
  onToggleAI: () => void;
  isAIOpen: boolean;
  onTogglePreview: () => void;
  isPreviewOpen: boolean;
  onOpenSearch: () => void;
  onNewFile: () => void;
  theme: IDETheme;
  onToggleTheme: () => void;
  lang: LanguageMode;
  onToggleLang: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  projectName,
  onUploadZip,
  onExportZip,
  onLoadSample,
  onToggleAI,
  isAIOpen,
  onTogglePreview,
  isPreviewOpen,
  onOpenSearch,
  onNewFile,
  theme,
  onToggleTheme,
  lang,
  onToggleLang,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadZip(e.target.files[0]);
      e.target.value = '';
    }
  };

  const isFa = lang === 'fa';

  return (
    <header
      id="main-navbar"
      className="h-14 bg-slate-900 border-b border-slate-800 text-slate-100 px-4 flex items-center justify-between select-none z-30 flex-shrink-0"
    >
      {/* Left section: App Title & Project Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 text-white px-2.5 py-1 rounded-lg shadow-sm font-semibold text-sm">
          <FileArchive className="w-5 h-5" />
          <span className="hidden sm:inline">
            {isFa ? 'محیط توسعه و پردازش فایل زیپ' : 'Web IDE & Zip Explorer'}
          </span>
        </div>

        {projectName && (
          <div className="hidden md:flex items-center gap-2 bg-slate-800/80 text-sky-300 text-xs px-2.5 py-1 rounded-md border border-slate-700/60 max-w-[180px] truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="truncate">{projectName}</span>
          </div>
        )}
      </div>

      {/* Middle section: Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Upload Zip Hidden Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".zip"
          onChange={handleFileChange}
          className="hidden"
          id="zip-upload-input"
        />

        <button
          id="btn-upload-zip"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer"
          title={isFa ? 'بارگذاری و بازکردن فایل ZIP' : 'Upload & Extract ZIP file'}
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">{isFa ? 'بازکردن زیپ' : 'Upload ZIP'}</span>
        </button>

        <button
          id="btn-export-zip"
          onClick={onExportZip}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer"
          title={isFa ? 'دانلود پروژه به صورت فایل ZIP' : 'Download Project as ZIP'}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{isFa ? 'دانلود زیپ' : 'Export ZIP'}</span>
        </button>

        <button
          id="btn-load-sample"
          onClick={onLoadSample}
          className="hidden lg:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
          title={isFa ? 'بارگذاری پروژه نمونه' : 'Load Sample Web Project'}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{isFa ? 'پروژه نمونه' : 'Sample Project'}</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-700 mx-1 hidden sm:block"></div>

        <button
          id="btn-add-file-nav"
          onClick={onNewFile}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
          title={isFa ? 'ایجاد فایل جدید' : 'New File'}
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">{isFa ? 'فایل جدید' : 'New File'}</span>
        </button>

        <button
          id="btn-global-search"
          onClick={onOpenSearch}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
          title={isFa ? 'جستجو در تمام فایل‌ها' : 'Search in files'}
        >
          <Search className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">{isFa ? 'جستجو' : 'Search'}</span>
        </button>

        <button
          id="btn-toggle-preview"
          onClick={onTogglePreview}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            isPreviewOpen
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
          title={isFa ? 'پیش‌نمایش زنده وب / خروجی' : 'Toggle Live Preview Sandbox'}
        >
          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span>{isFa ? 'پیش‌نمایش' : 'Preview'}</span>
        </button>

        <button
          id="btn-toggle-ai"
          onClick={onToggleAI}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            isAIOpen
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
          title={isFa ? 'دستیار هوش مصنوعی کد' : 'AI Coding Assistant'}
        >
          <Bot className="w-4 h-4 text-purple-300" />
          <span className="hidden sm:inline">{isFa ? 'هوش مصنوعی' : 'AI Assistant'}</span>
        </button>
      </div>

      {/* Right section: Language & Theme Toggles */}
      <div className="flex items-center gap-2">
        <button
          id="btn-toggle-language"
          onClick={onToggleLang}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
          title={isFa ? 'تغییر زبان به انگلیسی' : 'Switch Language to Persian'}
        >
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold">{isFa ? 'FA' : 'EN'}</span>
        </button>

        <button
          id="btn-toggle-theme"
          onClick={onToggleTheme}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition-colors cursor-pointer"
          title={isFa ? 'تغییر تم (تیره / روشن)' : 'Toggle Theme'}
        >
          {theme === 'vs-dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>
      </div>
    </header>
  );
};
