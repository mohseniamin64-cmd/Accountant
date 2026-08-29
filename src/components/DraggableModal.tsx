import React, { useState, useEffect } from 'react';
import { motion, useDragControls } from 'motion/react';
import { X, Move } from 'lucide-react';

interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
  headerExtra?: React.ReactNode;
  className?: string;
  showOverlay?: boolean;
}

export const DraggableModal: React.FC<DraggableModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  maxWidthClass = 'max-w-md',
  headerExtra,
  className = '',
  showOverlay = true,
}) => {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const dragControls = useDragControls();

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 pointer-events-auto">
      {/* Background Overlay */}
      {showOverlay && (
        <div 
          className="fixed inset-0 bg-black/35 md:bg-black/20 backdrop-blur-[1px] transition-opacity" 
          onClick={onClose} 
        />
      )}

      {/* Draggable Modal Container */}
      <motion.div
        drag={isDesktop}
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.05}
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className={`bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full ${maxWidthClass} overflow-hidden shadow-2xl relative z-10 text-right flex flex-col max-h-[90vh] ${className}`}
      >
        {/* Modal Header - Draggable on PC */}
        <div 
          onPointerDown={(e) => {
            if (isDesktop) dragControls.start(e);
          }}
          className={`bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80 px-4 md:px-5 py-3 flex justify-between items-center shrink-0 ${
            isDesktop ? 'cursor-move select-none hover:bg-slate-100/90 dark:hover:bg-slate-800 transition-colors' : ''
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {icon}
            <div className="text-xs md:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
              {title}
            </div>
            {isDesktop && (
              <span className="mr-1 px-2 py-0.5 text-[10px] font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 rounded-md inline-flex items-center gap-1 shrink-0" title="برای جابجایی این پنجره، هدر را با موش کشیده و جابجا کنید">
                <Move className="w-3 h-3 text-slate-500" />
                <span>قابل جابجایی</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
};
