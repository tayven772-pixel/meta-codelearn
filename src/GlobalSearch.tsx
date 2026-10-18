import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Code2, Command, FolderKanban, Home, Search, Settings, Tag, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { lessons } from './data/academy';

const destinations = [
  { label: 'Explore dashboard', detail: 'Your progress and learning paths', href: '/', keywords: 'home dashboard progress', icon: Home },
  { label: 'Learning paths', detail: 'Browse coding tracks and lessons', href: '/play', keywords: 'learn courses tracks lessons', icon: BookOpen },
  { label: 'Code playground', detail: 'Run HTML, CSS, and JavaScript', href: '/playground', keywords: 'editor code run html css javascript', icon: Code2 },
  { label: 'Your projects', detail: 'Create and continue building', href: '/projects', keywords: 'files projects website game app', icon: FolderKanban },
  { label: 'Settings', detail: 'Preferences and account controls', href: '/settings', keywords: 'theme accessibility preferences', icon: Settings },
  { label: 'Plans and pricing', detail: 'Compare available plans', href: '/pricing', keywords: 'billing credits pro price', icon: Tag },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setOpen(false), [location]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const pages = destinations
      .filter((item) => !normalized || `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(normalized))
      .map((item) => ({ ...item, key: item.href, group: 'Pages' }));
    const lessonResults = lessons
      .filter((lesson) => normalized && `${lesson.title} ${lesson.description} ${lesson.languageId}`.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((lesson) => ({
        label: lesson.title,
        detail: `Lesson · ${lesson.languageId}`,
        href: `/learn/${lesson.id}`,
        key: `lesson-${lesson.id}`,
        group: 'Lessons',
        icon: BookOpen,
      }));
    return [...pages, ...lessonResults].slice(0, 9);
  }, [query]);

  const goTo = (href: string) => {
    setOpen(false);
    setLocation(href);
  };

  return (
    <>
      <button type="button" className="global-search-trigger" onClick={() => setOpen(true)} aria-label="Search Meta Code" title="Search Meta Code (Ctrl+K)">
        <Search aria-hidden="true" /><span>Search</span><kbd><Command aria-hidden="true" /> K</kbd>
      </button>
      {open && (
        <div className="global-search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
            <h2 id="global-search-title" className="global-search-sr-only">Search Meta Code</h2>
            <div className="global-search-input-row">
              <Search aria-hidden="true" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and lessons…" aria-label="Search pages and lessons" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search"><X aria-hidden="true" /></button>
            </div>
            <div className="global-search-results" role="listbox" aria-label="Search results">
              {results.length ? results.map((result) => {
                const Icon = result.icon;
                return (
                  <button type="button" key={result.key} role="option" aria-selected="false" className="global-search-result" onClick={() => goTo(result.href)}>
                    <span className="global-search-result-icon"><Icon aria-hidden="true" /></span>
                    <span className="global-search-result-copy"><strong>{result.label}</strong><small>{result.detail}</small></span>
                    <ArrowRight aria-hidden="true" className="global-search-result-arrow" />
                  </button>
                );
              }) : <p className="global-search-empty">No matches. Try a page name or lesson topic.</p>}
            </div>
            <footer className="global-search-footer"><span>Navigate anywhere in Meta Code</span><span><kbd>Esc</kbd> to close</span></footer>
          </section>
        </div>
      )}
    </>
  );
}
