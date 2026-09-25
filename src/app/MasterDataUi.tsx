import {CirclePlus, Search} from 'lucide-react';
import type {FormEvent, ReactNode, Ref} from 'react';
import {ContextHelpButton} from './ContextHelpButton.js';
import type {HelpDefinition} from './help-content.js';
import type {ActiveFilter} from './master-data.helpers.js';
import {masterDataText as text} from './master-data.copy.js';
import './master-data.css';

export function MasterDataHeader({
  title,
  description,
  help,
  action,
}: {
  title: string;
  description: string;
  help: HelpDefinition;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading compact">
      <ContextHelpButton help={help} />
      <div><p>{description}</p><h1>{title}</h1></div>
      {action}
    </header>
  );
}

export function DataToolbar({
  query,
  active,
  pending,
  canCreate,
  createLabel,
  onQueryChange,
  onActiveChange,
  onSearch,
  showSearchButton = true,
  partyType,
  onPartyTypeChange,
  moreOpen = false,
  onMoreFilters,
  onCreate,
  createButtonRef,
}: {
  query: string;
  active: ActiveFilter;
  pending: boolean;
  canCreate: boolean;
  createLabel: string;
  onQueryChange: (value: string) => void;
  onActiveChange: (value: ActiveFilter) => void;
  onSearch?: (event: FormEvent<HTMLFormElement>) => void;
  showSearchButton?: boolean;
  partyType?: 'all' | 'person' | 'company';
  onPartyTypeChange?: (value: 'all' | 'person' | 'company') => void;
  moreOpen?: boolean;
  onMoreFilters?: () => void;
  onCreate: () => void;
  createButtonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <form className="master-data-toolbar" onSubmit={onSearch}>
      <label className="field master-search-field">
        <span>{text.search}</span>
        <span className="master-search-input">
          <Search aria-hidden />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={text.searchPlaceholder}
            maxLength={160}
          />
        </span>
      </label>
      <label className="field party-status-filter-field">
        <span>{text.activeFilter}</span>
        <select
          value={active}
          onChange={(event) => onActiveChange(event.target.value as ActiveFilter)}
        >
          <option value="true">{text.activeOnly}</option>
          <option value="false">{text.inactiveOnly}</option>
          <option value="all">{text.allStatuses}</option>
        </select>
      </label>
      {partyType && onPartyTypeChange ? (
        <label className="field party-type-filter-field">
          <span>نوع شخص</span>
          <select
            value={partyType}
            onChange={(event) => onPartyTypeChange(event.target.value as 'all' | 'person' | 'company')}
          >
            <option value="all">همه نوع‌ها</option>
            <option value="person">حقیقی</option>
            <option value="company">حقوقی</option>
          </select>
        </label>
      ) : null}
      <div className="master-toolbar-actions">
        {showSearchButton ? (
          <button className="button secondary" disabled={pending} type="submit">
            <Search aria-hidden />{text.search}
          </button>
        ) : null}
        {onMoreFilters ? (
          <button className={'button secondary more-filters-button' + (moreOpen ? ' active' : '')} onClick={onMoreFilters} type="button">
            فیلترهای بیشتر
          </button>
        ) : null}
        {canCreate ? (
          <button className="button primary" onClick={onCreate} ref={createButtonRef} type="button">
            <CirclePlus aria-hidden />{createLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function ActionFeedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (!error && !success) return null;
  return (
    <div className={'form-message ' + (error ? 'error' : 'success')} role={error ? 'alert' : 'status'}>
      {error ?? success}
    </div>
  );
}

export function StatusPill({active}: {active: boolean}) {
  return <span className={'status-pill ' + (active ? 'status-active' : 'status-inactive')}>
    {active ? text.active : text.inactive}
  </span>;
}

export function Pager({
  offset,
  pageSize,
  returned,
  pending,
  onPage,
}: {
  offset: number;
  pageSize: number;
  returned: number;
  pending: boolean;
  onPage: (offset: number) => void;
}) {
  if (offset === 0 && returned < pageSize) return null;
  return (
    <div className="master-pager">
      <button
        className="button secondary"
        disabled={pending || offset === 0}
        onClick={() => onPage(Math.max(0, offset - pageSize))}
        type="button"
      >
        {text.previous}
      </button>
      <span>{new Intl.NumberFormat('fa-IR').format(Math.floor(offset / pageSize) + 1)}</span>
      <button
        className="button secondary"
        disabled={pending || returned < pageSize}
        onClick={() => onPage(offset + pageSize)}
        type="button"
      >
        {text.next}
      </button>
    </div>
  );
}

export function BooleanField({
  name,
  label,
  defaultChecked = false,
  hint,
  disabled = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="boolean-field">
      <input defaultChecked={defaultChecked} disabled={disabled} name={name} type="checkbox" />
      <span><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span>
    </label>
  );
}
