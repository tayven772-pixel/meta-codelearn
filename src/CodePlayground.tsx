import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Code2, Download, Play, RotateCcw, Save, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

type EditorTab = 'html' | 'css' | 'js';

const STORAGE_KEY = 'meta-playground-v1';
const STARTER = {
  html: '<main class="card">\n  <span class="eyebrow">YOUR FIRST BUILD</span>\n  <h1>Hello, world.</h1>\n  <p>Change the code, then run it to see your changes.</p>\n  <button id="try-button">Try me</button>\n  <p id="message" aria-live="polite"></p>\n</main>',
  css: 'body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #101827;\n  color: #f7f8fb;\n  font-family: system-ui, sans-serif;\n}\n.card {\n  width: min(440px, calc(100% - 40px));\n  padding: 32px;\n  border: 1px solid #344155;\n  border-radius: 22px;\n  background: #192538;\n  box-shadow: 0 24px 70px #0004;\n}\n.eyebrow { color: #8fb6ff; font-size: 12px; letter-spacing: .12em; }\nh1 { margin: 12px 0; }\nbutton { padding: 10px 16px; border: 0; border-radius: 10px; background: #8fb6ff; color: #101827; font-weight: 700; cursor: pointer; }',
  js: 'const button = document.querySelector("#try-button");\nconst message = document.querySelector("#message");\n\nbutton.addEventListener("click", () => {\n  message.textContent = "Nice work — your JavaScript is running!";\n});',
};

function loadStarter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return STARTER;
    const parsed = JSON.parse(raw);
    return {
      html: typeof parsed.html === 'string' ? parsed.html : STARTER.html,
      css: typeof parsed.css === 'string' ? parsed.css : STARTER.css,
      js: typeof parsed.js === 'string' ? parsed.js : STARTER.js,
    };
  } catch {
    return STARTER;
  }
}

export default function CodePlaygroundPage() {
  const [code, setCode] = useState(loadStarter);
  const [activeTab, setActiveTab] = useState<EditorTab>('html');
  const [runVersion, setRunVersion] = useState(0);
  const [saved, setSaved] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [code]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        setRunVersion((version) => version + 1);
        setPreviewKey((key) => key + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const preview = useMemo(() => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${code.css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
${code.html.replace(/<\/script/gi, '<\\/script')}
<script>
try {
${code.js.replace(/<\/script/gi, '<\\/script')}
} catch (error) {
  const notice = document.createElement('pre');
  notice.style.cssText = 'white-space:pre-wrap;margin:16px;padding:12px;border:1px solid #b91c1c;border-radius:8px;background:#fee2e2;color:#7f1d1d;font:13px monospace';
  notice.textContent = 'JavaScript error: ' + (error && error.message ? error.message : String(error));
  document.body.appendChild(notice);
}
</script>
</body>
</html>`, [code, runVersion]);

  const runCode = () => {
    setRunVersion((version) => version + 1);
    setPreviewKey((key) => key + 1);
  };

  const resetCode = () => {
    setCode({ ...STARTER });
    runCode();
  };

  const downloadCode = () => {
    const blob = new Blob([preview], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'meta-playground.html';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="playground-page">
      <header className="playground-heading">
        <div>
          <Link href="/play" className="playground-back"><ArrowLeft aria-hidden="true" /> Learning paths</Link>
          <p className="playground-kicker"><Code2 aria-hidden="true" /> META CODE PLAYGROUND</p>
          <h1>Make it. <em>Run it.</em></h1>
          <p className="playground-intro">A small, safe place to experiment with HTML, CSS, and JavaScript. Your work is saved in this browser.</p>
        </div>
        <div className="playground-heading-actions">
          <span className={saved ? 'playground-save-state is-saved' : 'playground-save-state'}><Save aria-hidden="true" /> {saved ? 'Saved locally' : 'Storage unavailable'}</span>
          <button type="button" className="playground-secondary" onClick={resetCode}><RotateCcw aria-hidden="true" /> Reset</button>
          <button type="button" className="playground-primary" onClick={downloadCode}><Download aria-hidden="true" /> Export HTML</button>
        </div>
      </header>

      <section className="playground-workspace" aria-label="Code editor and live preview">
        <div className="playground-editor-panel">
          <div className="playground-panel-head">
            <div><span className="playground-live-dot" /> <strong>Editor</strong><span className="playground-file-count">3 files</span></div>
            <button type="button" className="playground-run" onClick={runCode}><Play aria-hidden="true" fill="currentColor" /> Run <kbd>Ctrl ↵</kbd></button>
          </div>
          <div className="playground-tabs" role="tablist" aria-label="Code files">
            {(['html', 'css', 'js'] as EditorTab[]).map((tab) => (
              <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                <span className={`playground-file-dot ${tab}`} /> {tab === 'js' ? 'script.js' : `index.${tab}`}
              </button>
            ))}
          </div>
          <label className="playground-code-label" htmlFor={`playground-${activeTab}`}>{activeTab.toUpperCase()} source</label>
          <textarea
            id={`playground-${activeTab}`}
            className="playground-code-input"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label={`${activeTab.toUpperCase()} code editor`}
            value={code[activeTab]}
            onChange={(event) => setCode((current) => ({ ...current, [activeTab]: event.target.value }))}
          />
          <div className="playground-editor-foot"><span>Plain-text editor</span><span>{code[activeTab].split('\n').length} lines · {code[activeTab].length} chars</span></div>
        </div>

        <div className="playground-preview-panel">
          <div className="playground-panel-head">
            <div><span className="playground-preview-icon"><Sparkles aria-hidden="true" /></span><strong>Live preview</strong><span className="playground-file-count">Isolated frame</span></div>
            <button type="button" className="playground-refresh" onClick={runCode} aria-label="Refresh preview"><RotateCcw aria-hidden="true" /></button>
          </div>
          <div className="playground-browser-bar"><span /><span /><span /><div>preview.local</div></div>
          <iframe key={previewKey} title="Your live code preview" className="playground-preview-frame" sandbox="allow-scripts" srcDoc={preview} />
          <div className="playground-preview-foot"><span><span className="playground-live-dot" /> Preview ready</span><span>Run to refresh output</span></div>
        </div>
      </section>

      <aside className="playground-tip"><Sparkles aria-hidden="true" /><div><strong>Quick tip</strong><p>Start by changing the heading in <code>index.html</code>. Add a color in <code>index.css</code>, then edit <code>script.js</code> to make the button do something new.</p></div></aside>
    </main>
  );
}
