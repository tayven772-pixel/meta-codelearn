import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Bot, Code2, LoaderCircle, Send, ShieldCheck, Sparkles } from 'lucide-react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Project = { id: string; name: string; type?: string; files?: Record<string, string>; messages?: Array<{ role: string; content: string }> };

function loadProjects(): Project[] {
  try {
    const scope = localStorage.getItem('meta-active-account-v1') || 'guest';
    const key = scope === 'guest' ? 'meta-projects-v2' : `meta-projects-v2:${scope}`;
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
  } catch { return []; }
}

export default function MetaAIPage() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState('');
  const [projects] = useState<Project[]>(loadProjects);
  const [projectId, setProjectId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedProject = useMemo(() => projects.find(project => project.id === projectId), [projects, projectId]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/admin/ai/status', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setAccess('denied');
          setError(response.status === 401 ? 'Sign in with the Meta Code owner account to use this private test.' : 'This account is not allowed to use the private Meta AI test.');
          return;
        }
        setAccess('allowed');
        setEnabled(Boolean(data.enabled));
        setModel(typeof data.model === 'string' ? data.model : '');
      })
      .catch(() => { if (active) { setAccess('denied'); setError('Could not verify access. Check your connection and try again.'); } });
    return () => { active = false; };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy || access !== 'allowed') return;
    setInput('');
    setError('');
    const context = selectedProject ? [
      'Project context (read-only; do not assume you can edit the actual project):',
      'Name: ' + selectedProject.name,
      'Type: ' + String(selectedProject.type || 'unspecified'),
      'Files:',
      ...Object.entries(selectedProject.files || {}).slice(0, 30).map(([name, content]) => '\n--- ' + name + ' ---\n' + String(content).slice(0, 12000))
    ].join('\n').slice(0, 30000) : '';
    const next = [...messages, { role: 'user' as const, content: context ? prompt + '\n\n' + context : prompt }];
    setMessages(next);
    setBusy(true);
    try {
      const response = await fetch('/api/auth/admin/ai/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The AI request failed.');
      setMessages(current => [...current, { role: 'assistant', content: String(data.answer || '') }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI request failed.');
    } finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <Link href="/" className="brand"><span className="brand-mark"><Code2 aria-hidden="true" /></span><span>Meta Code</span></Link>
      <Link href="/projects" className="top-links">Projects</Link>
    </header>
    <main style={{ width: 'min(980px, calc(100% - 32px))', margin: '28px auto 56px' }}>
      <Link href="/projects" className="button-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20 }}><ArrowLeft size={16} /> Back to projects</Link>
      <section className="admin-publishing-guide" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="brand-mark"><Bot aria-hidden="true" /></span>
          <div><p className="section-kicker">Private owner preview</p><h1 style={{ margin: 0 }}>Meta AI</h1><p style={{ margin: '6px 0 0' }}>Coding help for your Meta Code projects.</p></div>
        </div>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}><ShieldCheck size={17} /> Only accounts listed in the server-side META_ADMIN_EMAILS setting can use this test.</p>
        {access === 'checking' && <p>Checking owner access…</p>}
        {access === 'denied' && <p role="alert">{error}</p>}
        {access === 'allowed' && !enabled && <p role="status">Access verified, but Omniroute is not configured yet. Set OMNIROUTE_MODEL in the auth service environment.</p>}
        {access === 'allowed' && enabled && <p role="status"><Sparkles size={15} style={{ verticalAlign: 'middle' }} /> Connected to Omniroute{model ? ' · ' + model : ''}</p>}
      </section>
      {access === 'allowed' && <section className="admin-publishing-guide">
        <label style={{ display: 'block', marginBottom: 12 }}><strong>Project context (optional)</strong>
          <select value={projectId} onChange={event => setProjectId(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 8, padding: 12, border: '1px solid hsl(var(--border))', borderRadius: 10, background: 'hsl(var(--card))' }}>
            <option value="">Chat without a project</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        {selectedProject && <p style={{ color: 'hsl(var(--muted-foreground))' }}>The AI will receive the selected project's locally saved files as context. It will not modify the project automatically.</p>}
        <div role="log" aria-live="polite" aria-label="AI conversation" style={{ minHeight: 280, maxHeight: '55dvh', overflowY: 'auto', padding: 14, border: '1px solid hsl(var(--border))', borderRadius: 12, marginBottom: 14 }}>
          {!messages.length && <div style={{ padding: '42px 12px', textAlign: 'center' }}><Bot size={32} style={{ margin: '0 auto 12px' }} /><h2>What are you building?</h2><p>Ask for coding help, debugging advice, or an explanation of your project.</p></div>}
          {messages.map((message, index) => <div key={index} style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: message.role === 'user' ? 'hsl(var(--secondary))' : 'hsl(var(--muted))', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>{message.role === 'user' ? 'You' : 'Meta AI'}</strong><div style={{ marginTop: 6 }}>{message.content}</div></div>)}
          {busy && <p><LoaderCircle size={16} style={{ verticalAlign: 'middle' }} /> Meta AI is thinking…</p>}
          <div ref={bottomRef} />
        </div>
        {error && access === 'allowed' && <p role="alert" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
          <textarea value={input} onChange={event => setInput(event.target.value)} maxLength={8000} rows={3} placeholder="Ask Meta AI to explain, debug, or help build something…" disabled={busy || !enabled} style={{ flex: 1, minWidth: 0, padding: 12, resize: 'vertical', border: '1px solid hsl(var(--border))', borderRadius: 10, background: 'hsl(var(--card))' }} />
          <button type="submit" className="button-primary" disabled={busy || !enabled || !input.trim()} aria-label="Send message"><Send size={17} /> Send</button>
        </form>
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>Test mode only. Conversation history stays in this page session; project files are sent to the configured model provider when you submit a message.</p>
      </section>}
    </main>
  </div>;
}
