import {CircleHelp, X} from 'lucide-react';
import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {HelpDefinition} from './help-content.js';

interface ContextHelpButtonProps {
  help: HelpDefinition;
}

export function ContextHelpButton({help}: ContextHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      triggerButtonRef.current?.focus();
    };
  }, [isOpen]);

  const dialog = isOpen ? createPortal(
    <div
      className="context-help-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) setIsOpen(false);
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="context-help-dialog"
        role="dialog"
      >
        <header className="context-help-dialog-header">
          <div>
            <span>{'\u0631\u0627\u0647\u0646\u0645\u0627\u06cc \u0627\u06cc\u0646 \u0628\u062e\u0634'}</span>
            <h2 id={titleId}>{help.title}</h2>
          </div>
          <button
            aria-label={'\u0628\u0633\u062a\u0646 \u0631\u0627\u0647\u0646\u0645\u0627'}
            className="context-help-close"
            onClick={() => setIsOpen(false)}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden />
          </button>
        </header>
        <div className="context-help-content">
          <p>{help.intro}</p>
          <ul>
            {help.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`\u0631\u0627\u0647\u0646\u0645\u0627\u06cc ${help.title}`}
        className="context-help-trigger"
        onClick={() => setIsOpen(true)}
        title={`\u0631\u0627\u0647\u0646\u0645\u0627\u06cc ${help.title}`}
        ref={triggerButtonRef}
        type="button"
      >
        <CircleHelp aria-hidden />
      </button>
      {dialog}
    </>
  );
}
