 for Android</strong>
                    <span>Get the latest APK build. Android may ask you to allow installs from your browser.</span>
                  </div>
                  <a className="button-primary" href="/downloads/Meta-latest.apk" download="Meta.apk">
                    <Download aria-hidden="true" /> Download APK
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>

        {toast && <div className="settings-toast" role="status" aria-live="polite">{toast}</div>}
      </main>
    </AppShell>
  );
}

function PricingTeaser() {
  return (
    <section className="section pricing-teaser" id="plans" aria-labelledby="pricing-teaser-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Plans &amp; pricing</p>
          <h2 id="pricing-teaser-heading">Learning is free. AI help scales with you.</h2>
          <p className="section-sub">Every lesson, quiz, and build track stays open on the free plan. Upgrade only when you want more AI credits and more active projects.</p>
        </div>
        <Link href="/pricing" className="text-link" data-testid="link-open-pricing">Compare all plans <ArrowRight aria-hidden="true" /></Link>
      </div>
      <div className="teaser-grid">
        {aiPlans.map((plan) => (
          <Link href="/pricing" key={plan.id} className={`teaser-card${plan.featured ? ' featured' : ''}`} data-testid={`teaser-plan-${plan.id}`}>
            {plan.featured && <span className="teaser-flag">Most popular</span>}
            <strong>{plan.name}</strong>
            <span className="teaser-price">{plan.price}<small>{plan.cadence}</small></span>
            <span className="teaser-desc">{plan.description}</span>
            <span className="teaser-meta"><Zap aria-hidden="true" /> {plan.aiCredits.toLocaleString()} AI credits / month</span>
            <span className="teaser-meta"><FolderKanban aria-hidden="true" /> {plan.projects < 0 ? 'Unlimited projects' : `${plan.projects} active projects`}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const PLAN_MATRIX: { label: string; free: string | boolean; builder: string | boolean; pro: string | boolean; highlight?: boolean }[] = [
  { label: 'Foundation lessons & quizzes', free: `All ${lessons.length}`, builder: `All ${lessons.length}`, pro: `All ${lessons.length}` },
  { label: 'Lesson Play build tracks', free: 'All 7', builder: 'All 7', pro: 'All 7' },
  { label: 'AI credits per month', free: '40', builder: '500', pro: '2,000', highlight: true },
  { label: 'Active projects', free: '3', builder: '25', pro: 'Unlimited' },
  { label: 'Project-aware AI context', free: true, builder: true, pro: true },
  { label: 'Priority AI queue', free: false, builder: false, pro: true },
  { label: 'Support', free: 'Community', builder: 'Email', pro: 'Priority email' },
];

const PLAN_FAQ: { q: string; a: string }[] = [
  { q: 'Do I have to pay to learn?', a: 'No. Every foundation lesson, quiz, and Lesson Play build track is free forever. Paid plans only add AI credits and more active projects — the teaching itself is never behind a paywall.' },
  { q: 'What exactly is an AI credit?', a: 'Roughly one AI request inside a project: asking the project agent to write, explain, or fix code. Credits are shared across your whole account, while each project keeps its own conversation context.' },
  { q: 'What happens when I run out of credits?', a: 'Nothing is lost. Your projects, files, and progress stay exactly where they are. AI requests simply pause until your credits refresh at the start of the next month, or until you move to a larger plan.' },
  { q: 'Can I cancel any time?', a: 'Yes. Cancel from Settings → Plan & billing and you keep full access until the end of the period you already paid for. There is no cancellation fee and no lock-in.' },
  { q: 'Is there an annual option?', a: 'Annual billing is being finalised. Monthly checkout is available right now, and the annual price is shown above so you can see the saving before you decide.' },
];

function matrixCell(value: string | boolean) {
  if (typeof value === 'boolean') {
    return value ? <Check aria-label="Included" /> : <span className="cell-none" aria-label="Not included">—</span>;
  }
  return value;
}

function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const yearlySaving = (plan: Plan) => (plan.annual && plan.monthly ? Math.round((1 - plan.annual / (plan.monthly * 12)) * 100) : 0);

  return (
    <AppShell>
      <main className="workspace-page pricing-page">
        <section className="pricing-hero" aria-labelledby="pricing-heading">
          <p className="section-kicker">Plans &amp; pricing</p>
          <h1 id="pricing-heading">Pay for AI usage.<br /><em>Never for learning.</em></h1>
          <p className="pricing-lede">Every lesson, quiz, and build track is free forever. Paid plans only add AI credits and more active projects — and you can cancel any time.</p>
          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button type="button" className={annual ? '' : 'is-active'} aria-pressed={!annual} onClick={() => setAnnual(false)} data-testid="toggle-monthly">Monthly</button>
            <button type="button" className={annual ? 'is-active' : ''} aria-pressed={annual} onClick={() => setAnnual(true)} data-testid="toggle-annual">
              Annual <span className="save-pill">Save ~17%</span>
            </button>
          </div>
          <ul className="pricing-trust">
            <li><Check aria-hidden="true" /> No card needed for Free</li>
            <li><Check aria-hidden="true" /> Cancel any time</li>
            <li><Check aria-hidden="true" /> Lessons stay free forever</li>
          </ul>
        </section>

        <section className="plan-grid" aria-label="Plan comparison">
          {aiPlans.map((plan) => (
            <article className={`plan-card${plan.featured ? ' featured' : ''}`} key={plan.id} data-testid={`plan-card-${plan.id}`}>
              {plan.featured && <span className="plan-flag"><Star aria-hidden="true" /> Most popular</span>}
              <header className="plan-head">
                <h2>{plan.name}</h2>
                <p>{plan.bestFor}</p>
              </header>
              <div className="plan-price">
                <strong>{annual && plan.annual ? `$${(plan.annual / 12).toFixed(2)}` : plan.price}</strong>
                <span>{plan.id === 'free' ? 'forever' : '/ month'}</span>
              </div>
              {annual && plan.annual ? (
                <p className="plan-billing">Billed ${plan.annual} once a year — you save {yearlySaving(plan)}%</p>
              ) : plan.monthly ? (
                <p className="plan-billing">Billed monthly, cancel any time.</p>
              ) : (
                <p className="plan-billing">No payment details required.</p>
              )}
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}><Check aria-hidden="true" /> {feature}</li>
                ))}
              </ul>
              {plan.id === 'free' ? (
                <Link href="/sign-up" className="plan-cta secondary" data-testid="plan-cta-free">Start free</Link>
              ) : annual ? (
                <button type="button" className="plan-cta secondary" disabled title="Annual checkout opens soon — monthly billing is available now.">Annual opens soon</button>
              ) : (
                <a className="plan-cta primary" href={META_STRIPE_TEST_LINKS[plan.id]} target="_blank" rel="noreferrer" data-testid={`plan-cta-${plan.id}`}>{plan.cta}</a>
              )}
              <p className="plan-foot">{plan.description}</p>
            </article>
          ))}
        </section>

        <section className="pricing-explainer" aria-label="How plans work">
          <article className="explainer-card">
            <Zap aria-hidden="true" />
            <h3>Credits are account-wide</h3>
            <p>Your monthly AI allowance is shared across every project you own, so a quiet week leaves more credits for a busy one.</p>
          </article>
          <article className="explainer-card">
            <FolderKanban aria-hidden="true" />
            <h3>Context stays per project</h3>
            <p>Each project keeps its own conversation and files, so the AI always answers with the right code in front of it.</p>
          </article>
          <article className="explainer-card">
            <Shield aria-hidden="true" />
            <h3>Your work is never held hostage</h3>
            <p>If a plan lapses, your projects and progress stay intact. Nothing is deleted and no lesson is ever locked.</p>
          </article>
        </section>

        <section className="compare-section" aria-labelledby="compare-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Side by side</p>
              <h2 id="compare-heading">Compare every plan.</h2>
              <p className="section-sub">The full breakdown, with no asterisks.</p>
            </div>
          </div>
          <div className="compare-scroll">
            <table className="compare-table">
              <caption className="sr-only">Feature comparison of the Free, Builder, and Pro plans</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Free</th>
                  <th scope="col">Builder</th>
                  <th scope="col">Pro</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_MATRIX.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{matrixCell(row.free)}</td>
                    <td className={row.highlight ? 'is-featured' : undefined}>{matrixCell(row.builder)}</td>
                    <td>{matrixCell(row.pro)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">Monthly price</th>
                  <td>$0</td>
                  <td className="is-featured">$4.99</td>
                  <td>$9.99</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="faq-section" aria-labelledby="faq-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Questions</p>
              <h2 id="faq-heading">Plans, answered.</h2>
            </div>
          </div>
          <div className="faq-list">
            {PLAN_FAQ.map((item) => (
              <details className="faq-item" key={item.q}>
                <summary>{item.q} <ArrowRight aria-hidden="true" /></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="pricing-note">AI credits are account-wide, while each project keeps its own AI context. Stripe checkout is connected in test mode right now; live charging will be enabled only after the live Stripe account is connected and verified.</p>
      </main>
    </AppShell>
  );
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(window.location.pathname.startsWith('/sign-up'));
  const [busy, setBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).get('account') === 'deleted'
      ? 'Your Meta account data has been deleted.'
      : ''
  );
  const [messageType, setMessageType] = useState<'success' | 'error'>(() =>
    new URLSearchParams(window.location.search).get('account') === 'deleted' ? 'success' : 'error'
  );

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(isRegistering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setShowResend(!isRegistering && response.status === 403 && String(data.error || '').toLowerCase().includes('verify'));
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      setShowResend(false);
      setMessageType('success');
      setMessage(data.message || (isRegistering ? 'Account created. Check your email for a verification link.' : 'Signed in successfully. Opening Meta CodeLearn…'));
      if (!isRegistering) {
        const requestedNext = new URLSearchParams(window.location.search).get('next');
        const destination = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
          ? requestedNext
          : '/user-portal';
        window.setTimeout(() => window.location.assign(destination), 700);
      }
    } catch (error) {
      setMessageType('error');
      setMessage(error instanceof Error ? error.message : 'Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not resend the verification email.');
      setMessageType('success');
      setMessage(data.message || 'A new verification email has been sent.');
      setShowResend(false);
    } catch (error) {
      setMessageType('error');
      setMessage(error instanceof Error ? error.message : 'Could not resend the verification email.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(registering: boolean) {
    setIsRegistering(registering);
    setShowResend(false);
    setMessage('');
    window.history.replaceState(null, '', registering ? '/sign-up' : '/sign-in');
  }

  return (
    <main className="login-page">
      <Link href="/" className="brand login-brand" aria-label="Meta home">
        <img className="brand-image" src="/meta-logo.svg" alt="Meta" />
      </Link>
      <section className="login-layout">
        <div className="login-intro">
          <p className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1>
            Build{' '}
            <span className="hero-typewriter-visual login-typewriter-visual">
              <span className="hero-typewriter-sr-only">games, websites, apps, AI tools, Roblox games, and Minecraft mods.</span>
              <span className="hero-typewriter-rotator" aria-hidden="true">
                <span className="hero-typewriter-word typewriter-games">games</span>
                <span className="hero-typewriter-word typewriter-websites">websites</span>
                <span className="hero-typewriter-word typewriter-apps">apps</span>
                <span className="hero-typewriter-word typewriter-ai-tools">AI tools</span>
                <span className="hero-typewriter-word typewriter-roblox">Roblox games</span>
                <span className="hero-typewriter-word typewriter-minecraft">Minecraft mods</span>
              </span>
            </span>
            <span aria-hidden="true">.</span>
          </h1>
          <p>Sign in to pick up where you left off, keep your projects close, and continue learning with Meta.</p>
          <div className="login-intro-note"><Code2 aria-hidden="true" /><span>Project-based learning, built around you.</span></div>
        </div>
        <section className="login-card" aria-labelledby="login-title">
          <p className="section-kicker">{isRegistering ? 'GET STARTED' : 'WELCOME BACK'}</p>
          <h2 id="login-title">{isRegistering ? 'Create your account' : 'Sign in to meta'}</h2>
          <p className="login-card-subtitle">{isRegistering ? 'Create an account and verify your email to get started.' : 'Use your account to continue learning.'}</p>
          <form className="login-form" onSubmit={handleEmailSubmit}>
            <label htmlFor="login-email">Email address</label>
            <div className="login-input-wrap">
              <Mail aria-hidden="true" />
              <input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} />
            </div>
            <div className="login-password-heading">
              <label htmlFor="login-password">Password</label>
              {!isRegistering && <Link href="/delete-account" className="login-help-link">Need help?</Link>}
            </div>
            <div className="login-input-wrap">
              <LockKeyhole aria-hidden="true" />
              <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} placeholder={isRegistering ? 'Use at least 10 characters' : 'Enter your password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={isRegistering ? 10 : 1} maxLength={128} />
              <button className="login-password-toggle" type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
            </div>
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'} <ArrowRight aria-hidden="true" /></button>
          </form>
          {!isRegistering && showResend && <p className="login-create-copy">Email not verified or link expired? <button type="button" className="login-text-button" onClick={resendVerification} disabled={busy}>Resend verification email</button></p>}
          <p className="login-create-copy">
            {isRegistering ? 'Already have an account? ' : 'New to meta? '}
            <button type="button" className="login-text-button" onClick={() => switchMode(!isRegistering)}>{isRegistering ? 'Sign in' : 'Create an account'}</button>
          </p>
          {!isRegistering && <>
            <div className="login-divider"><span>OR CONTINUE WITH</span></div>
            <a className="login-provider login-discord" href="/api/auth/discord">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.7 5.2a18.2 18.2 0 0 0-4.5-1.4l-.6 1.2a16.6 16.6 0 0 0-5.2 0l-.6-1.2a18.2 18.2 0 0 0-4.5 1.4C1.5 9.4.7 13.5 1.1 17.5a18.3 18.3 0 0 0 5.5 2.8l1.2-2a11.8 11.8 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.8 1.7 11.5 0l.5.4a11.8 11.8 0 0 1-1.9.9l1.2 2a18.3 18.3 0 0 0 5.5-2.8c.5-4.6-.8-8.7-3.5-12.3ZM8.8 14.9c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.4 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/></svg>
              <span>Continue with Discord</span><ArrowRight aria-hidden="true" />
            </a>
            <a className="login-provider login-google" href="/api/auth/google">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.7V7.5H3.1a10 10 0 0 0 0 8.9l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z"/></svg>
              <span>Continue with Google</span><ArrowRight aria-hidden="true" />
            </a>
          </>}
          {message && <p className="login-status" data-status={messageType} role="status">{message}</p>}
          <p className="login-legal">By continuing, you agree to Meta's <Link href="/privacy">Privacy Policy</Link>.</p>
        </section>
      </section>
    </main>
  );
}

function VerifyEmailPage() {
  const [message, setMessage] = useState('Verifying your email address…');
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setMessage('This verification link is missing its token. Please use the full link from your email.'); return; }
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Verification failed.');
        setSuccess(true);
        setMessage(data.message || 'Email verified. You can now sign in.');
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Verification failed. Please try again.'));
  }, []);
  return <main className="login-page"><section className="login-card" style={{ maxWidth: 560, margin: '12vh auto' }}><p className="section-kicker">META CODELEARN</p><h2>{success ? 'Email verified' : 'Verify your email'}</h2><p className="login-card-subtitle" role="status">{message}</p>{success ? <Link className="login-submit" href="/sign-in">Continue to sign in <ArrowRight aria-hidden="true" /></Link> : <Link className="login-submit" href="/sign-in">Back to sign in <ArrowRight aria-hidden="true" /></Link>}</section></main>;
}

function AccountSettingsPage() {
  const [discordUser, setDiscordUser] = useState<{ id: string; username: string; displayName: string; avatar: string | null; avatarUrl: string | null } | null>(null);
  const [emailUser, setEmailUser] = useState<{ id: string; email: string; verified: boolean; displayName?: string | null; profilePicture?: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  useEffect(() => {
    let active = true;
    async function checkSessions() {
      const [discordResult, emailResult] = await Promise.allSettled([
        fetch('/api/auth/discord/me', { credentials: 'same-origin' }),
        fetch('/api/auth/me', { credentials: 'same-origin' }),
      ]);
      let nextDiscordUser = null;
      let nextEmailUser = null;
      if (discordResult.status === 'fulfilled' && discordResult.value.ok) {
        const data = await discordResult.value.json().catch(() => ({}));
        if (data.authenticated && data.user) nextDiscordUser = data.user;
      }
      if (emailResult.status === 'fulfilled' && emailResult.value.ok) {
        const data = await emailResult.value.json().catch(() => ({}));
        if (data.user) nextEmailUser = data.user;
      }
      if (active) {
        setDiscordUser(nextDiscordUser);
        setEmailUser(nextEmailUser);
        setAuthLoading(false);
      }
    }
    checkSessions().catch(() => { if (active) setAuthLoading(false); });
    const params = new URLSearchParams(window.location.search);
    if (params.get('discord') === 'connected') setAuthMessage('Discord sign-in successful.');
    if (params.get('discord') === 'cancelled') setAuthMessage('Discord sign-in was cancelled.');
    return () => { active = false; };
  }, []);
  async function signOut() {
    try {
      const responses = await Promise.all([
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }),
        fetch('/api/auth/discord/logout', { method: 'POST', credentials: 'same-origin' }),
      ]);
      if (responses.some(response => !response.ok)) {
        throw new Error('One or more sign-out requests failed.');
      }
      setDiscordUser(null);
      setEmailUser(null);
      try { localStorage.removeItem(ACTIVE_ACCOUNT_KEY); } catch { /* ignore unavailable storage */ }
      setAuthMessage('You have signed out.');
      window.location.assign('/sign-in');
    } catch {
      setAuthMessage('Could not sign out right now. Please try again.');
    }
  }
  function importBrowserWork() {
    const scope = currentAccountScope();
    if (scope === 'guest') {
      setImportStatus('Sign in first, then choose which account should receive a copy of your existing browser work.');
      return;
    }
    try {
      const progressTargetKey = `${PROGRESS_KEY}:${scope}`;
      const progressTarget = readProgress(progressTargetKey);
      const sourceProgress = ['meta-progress-v1:guest', 'meta-progress-v1', LEGACY_PROGRESS_KEY]
        .map(key => {
          try { return JSON.parse(localStorage.getItem(key) || 'null') as Progress | null; } catch { return null; }
        })
        .filter((value): value is Progress => Boolean(value && Array.isArray(value.completedLessonIds)));
      const completedLessonIds = Array.from(new Set([
        ...progressTarget.completedLessonIds,
        ...sourceProgress.flatMap(value => value.completedLessonIds || []),
      ]));
      const completedQuizLessonIds = Array.from(new Set([
        ...(progressTarget.completedQuizLessonIds || []),
        ...sourceProgress.flatMap(value => value.completedQuizLessonIds || []),
      ]));
      const importedProgress: Progress = {
        ...(sourceProgress[0] || {}),
        ...progressTarget,
        completedLessonIds,
        completedQuizLessonIds,
        skillLevel: progressTarget.skillLevel || sourceProgress.find(value => value.skillLevel)?.skillLevel,
      };
      localStorage.setItem(progressTargetKey, JSON.stringify(importedProgress));

      const projectTargetKey = projectsStorageKey();
      const existingTargetProjects = (() => {
        try { return JSON.parse(localStorage.getItem(projectTargetKey) || '[]') as MetaProject[]; } catch { return []; }
      })();
      const sourceProjects = ['meta-projects-v2', 'meta-projects-v1'].flatMap(key => {
        try {
          const value = JSON.parse(localStorage.getItem(key) || '[]');
          return Array.isArray(value) ? value as MetaProject[] : [];
        } catch { return []; }
      });
      const mergedProjects = [...existingTargetProjects];
      const knownIds = new Set(existingTargetProjects.map(project => project.id));
      for (const project of sourceProjects) {
        if (!knownIds.has(project.id)) {
          mergedProjects.push({
            ...project,
            files: project.files || {},
            messages: project.messages || [],
            createdAt: project.createdAt || Date.now(),
            updatedAt: project.updatedAt || Date.now(),
          });
          knownIds.add(project.id);
        }
      }
      localStorage.setItem(projectTargetKey, JSON.stringify(mergedProjects));
      setImportStatus(`Copied ${completedLessonIds.length} completed lessons and ${mergedProjects.length} projects into this account. Your original browser data was kept unchanged.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setImportStatus('Could not copy the browser data. Check available device storage and try again.');
    }
  }

  async function deleteAccount() {
    const scope = currentAccountScope();
    const confirmed = window.confirm(
      'Delete this Meta account and its saved learning progress/projects on this browser? Other accounts and the original guest/browser data will be left untouched. This cannot be undone and does not delete your Google or Discord account.'
    );
    if (!confirmed || isDeleting) return;
    setIsDeleting(true);
    setAuthMessage('');
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not delete your Meta account.');
      }
      try {
        localStorage.removeItem(`${PROGRESS_KEY}:${scope}`);
        if (scope === 'guest') {
          for (const key of ['meta-progress-v1', 'code-atlas-progress-v1', 'meta-projects-v2', 'meta-projects-v1']) localStorage.removeItem(key);
        } else {
          localStorage.removeItem(`${PROJECTS_KEY}:${scope}`);
        }
        localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      } catch {
        // The server account is already deleted even if browser storage is unavailable.
      }
      window.location.assign('/sign-in?account=deleted');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Could not delete your Meta account. Please try again.');
      setIsDeleting(false);
    }
  }
  return (
    <AppShell>
      <main className="account-page">
        <section className="account-card">
          <p className="section-kicker">Account & privacy</p>
          <h1>Meta account</h1>
          <p className="account-email">Manage your Meta CodeLearn sign-in and privacy settings.</p>
          {authMessage && <p role="status" className="account-email">{authMessage}</p>}
          {authLoading ? <p>Checking sign-in status…</p> : (discordUser || emailUser) ? (
            <div className="account-setting-block">
              <h2>{discordUser ? 'Signed in with Discord' : 'Signed in with email or Google'}</h2>
              {discordUser ? (
                <div className="account-provider-identity">
                  {discordUser.avatarUrl && <img src={discordUser.avatarUrl} alt="Discord profile picture" referrerPolicy="no-referrer" />}
                  <p>Welcome, {discordUser.displayName || discordUser.username} (@{discordUser.username}).</p>
                </div>
              ) : (
                <div className="account-provider-identity">
                  {emailUser?.profilePicture && <img src={emailUser.profilePicture} alt="Google profile picture" referrerPolicy="no-referrer" />}
                  <p>{emailUser?.displayName && <>Welcome, {emailUser.displayName}. </>}Signed in as {emailUser?.email}{emailUser?.verified ? ' · Email verified' : ' · Email not verified'}.</p>
                </div>
              )}
              <button type="button" className="button-secondary" onClick={signOut}>Sign out</button>
              {emailUser?.email.trim().toLowerCase() === 'metasupport43@gmail.com' && (
                <Link href="/admin" className="button-secondary">Open content publishing</Link>
              )}
            </div>
          ) : (
            <div className="account-setting-block">
              <h2>Sign in to your Meta account</h2>
              <p>Sign in to manage your account, or connect Discord to verify your identity.</p>
              <div className="account-setting-links">
                <Link className="button-secondary" href="/sign-in">Continue to sign in</Link>
                <a className="button-secondary" href="/api/auth/discord">Continue with Discord</a>
              </div>
            </div>
          )}
          <section className="danger-zone">
            <h2>Delete Meta account</h2>
            <p>Delete your Meta email/Google account data, or clear your Discord sign-in session, and remove saved learning progress and projects from this browser. This does not delete your Google or Discord account.</p>
            <button type="button" className="danger-button" onClick={deleteAccount} disabled={isDeleting || authLoading || (!discordUser && !emailUser)}>
              {isDeleting ? 'Deleting account…' : 'Delete Meta account'}
            </button>
          </section>
          <div className="account-setting-block">
            <h2>Your learning data</h2>
            <p>Projects and lesson progress are kept in separate browser storage for each signed-in Meta account. Your old browser data remains untouched until you choose to copy it.</p>
            {(discordUser || emailUser) && currentAccountScope() !== 'guest' && (
              <div className="account-data-import">
                <p>Have projects or completed lessons from before account separation? Copy them into the account you are signed into now. This merges data without deleting the original browser copy.</p>
                <button type="button" className="button-secondary" onClick={importBrowserWork}>Copy existing browser work into this account</button>
                {importStatus && <p role="status" className="account-email">{importStatus}</p>}
              </div>
            )}
            <div className="account-setting-links">
              <Link href="/privacy" className="button-secondary">Read privacy policy</Link>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function DeleteAccountPage() {
  return (
    <main className="policy-page">
      <Link href="/" className="brand policy-brand">
        <img className="brand-image" src="/meta-logo.svg" alt="Meta" />
      </Link>
      <article className="policy-card">
        <p className="section-kicker">Account deletion</p>
        <h1>Delete your Meta account</h1>
        <p>Meta users can start account deletion from inside the app under <strong>Account → Delete account</strong>.</p>
        <h2>If you cannot access the app</h2>
        <p>You can request deletion by emailing <a className="policy-link" href="mailto:metasupport43@gmail.com?subject=Meta%20account%20deletion%20request">metasupport43@gmail.com</a> with the subject “Meta account deletion request”. Include the email address used for your Meta account so the request can be matched to the correct account.</p>
        <h2>What gets deleted</h2>
        <p>The request covers the Meta account and associated learning/account data controlled by Meta. If any information must be kept for a legitimate security, fraud-prevention, or legal reason, that retention should be disclosed in the privacy policy.</p>
        <h2>Need help?</h2>
        <p><a className="policy-link" href="mailto:metasupport43@gmail.com?subject=Meta%20support">Contact Meta Support</a> for account or privacy questions.</p>
      </article>
    </main>
  );
}

function PrivacyPage() {
  return (
    <main className="policy-page">
      <Link href="/" className="brand policy-brand" aria-label="Meta Code home">
        <img className="brand-image" src="/meta-logo.svg" alt="Meta" />
      </Link>
      <article className="policy-card">
        <p className="section-kicker">Privacy &amp; cookies</p>
        <h1>Privacy Policy</h1>
        <p><strong>Last updated: October 18, 2026</strong></p>
        <p>This policy explains how Meta Code (also referred to as “Meta” or “we”) handles information when you use the Meta Code website, learning tools, project workspace, account features, and AI coding features. The policy describes the current implementation and may change when features or service providers change.</p>

        <h2>1. Information we collect</h2>
        <ul>
          <li><strong>Account information.</strong> When you register with email, we process your email address, a salted password hash, account creation and email-verification status, and any profile information you choose to provide, such as a display name, username, or PNG profile image. We do not store your password as plain text.</li>
          <li><strong>Google sign-in.</strong> If you choose Google sign-in, Google provides account details needed for sign-in, such as a Google account identifier, email address, verification status, display/profile information, and profile picture where available. Meta does not receive your Google password.</li>
          <li><strong>Discord sign-in.</strong> If you choose Discord sign-in, Meta receives the Discord identity information permitted by the sign-in flow, including your Discord user ID, username, display name, and avatar information where available. The current Discord flow requests identity access, not access to your Discord messages.</li>
          <li><strong>Learning and project data.</strong> The browser can store selected coding language, theme, lesson and quiz progress, editor preferences, project names and types, project files, and project-agent conversation history. This information is generally saved in browser storage on the device you use, rather than automatically synced to your account across devices.</li>
          <li><strong>AI requests.</strong> When you use Meta Coach or the AI Project Builder, the prompt you submit and relevant context—such as your selected track, project files, and recent project conversation—are sent to the AI endpoint configured for the service and onward to OpenAI to generate a response. Do not include passwords, API keys, private keys, payment details, or other sensitive personal information in prompts or project files.</li>
          <li><strong>Technical and security information.</strong> The website, host, and server infrastructure may generate logs containing information such as IP address, browser/request details, timestamps, requested pages or endpoints, response status, and security or error events. These records help operate the service, diagnose failures, limit abuse, and protect accounts.</li>
          <li><strong>Support and email.</strong> If you contact support, we receive the information you include in your message. Email is also used to send account-verification messages.</li>
        </ul>

        <h2>2. How we use information</h2>
        <p>We use information to provide and secure sign-in; verify email addresses; maintain profiles; remember learning progress and preferences on your device; save and export projects; generate requested AI responses; answer support requests; prevent abuse and troubleshoot problems; and comply with applicable legal obligations. We do not intentionally sell personal information or use third-party behavioural-advertising trackers in the current website implementation.</p>

        <h2>3. Cookies and similar technologies</h2>
        <p>Cookies are small pieces of data stored by your browser. The current site uses first-party cookies needed for account sessions and secure sign-in flows:</p>
        <ul>
          <li><strong>meta_session</strong> — keeps an email/Google account signed in. It is configured to expire after up to 7 days and uses HttpOnly, SameSite=Lax, and the Secure attribute when the site is configured for HTTPS.</li>
          <li><strong>meta_discord_session</strong> — keeps a Discord sign-in session. It is configured to expire after up to 7 days and uses HttpOnly, Secure, and SameSite=Lax.</li>
          <li><strong>meta_google_oauth_state</strong> and <strong>meta_discord_oauth_state</strong> — temporary security cookies used to verify a Google or Discord sign-in callback. They last about 10 minutes and are cleared as the sign-in flow completes.</li>
        </ul>
        <p>These cookies support authentication and protection against forged sign-in callbacks; they are not used by Meta for advertising. The current first-party website code does not intentionally set optional analytics or advertising cookies. If we add optional cookies or tracking in the future, we will update this notice and provide any choices or consent required by applicable law before enabling them.</p>
        <p>Google, Discord, Stripe, or another provider may use its own technologies on its own website when you leave Meta or use a third-party sign-in or checkout flow. Those providers control their own practices; see their privacy information below.</p>

        <h2>4. Browser storage is not a cookie</h2>
        <p>Meta also uses browser local storage to remember settings such as your theme, selected language, editor preferences, learning progress, projects, files, and project-agent conversation history. This information may remain on that browser after you close it and is not automatically available on another device. You can clear Meta's site data in your browser settings, but doing so may sign you out and erase locally saved progress, preferences, projects, and conversations. The Account page also provides account-data deletion controls for the active account and its associated local data on that browser.</p>

        <h2>5. AI features and third-party services</h2>
        <p>When you ask for AI help, relevant prompts, code, files, and recent conversation context are sent to OpenAI through the configured API so it can produce the requested response. Meta's current AI endpoint does not save those prompts or responses in the Meta account database, but the project content and conversation history may remain in your browser storage. OpenAI processes API requests under its own applicable terms and data-use practices. Please review <a className="policy-link" href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noreferrer">OpenAI’s API data guidance</a> and <a className="policy-link" href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noreferrer">OpenAI’s privacy policy</a>.</p>
        <p>The service also relies on service providers for infrastructure and email delivery. Google is used for Google sign-in, Google-hosted fonts, and delivery of account-verification email through the configured email service. Discord is used when you choose Discord sign-in. These providers may receive information needed to deliver their service and are governed by their own policies: <a className="policy-link" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> and <a className="policy-link" href="https://discord.com/privacy/policy/" target="_blank" rel="noreferrer">Discord Privacy Policy</a>.</p>
        <p>The Builder and Pro checkout links currently point to Stripe's test environment and are not configured for real purchases. Do not enter real payment card details through those test links. If you follow a checkout link, Stripe controls the information it collects on its own pages; see <a className="policy-link" href="https://stripe.com/privacy" target="_blank" rel="noreferrer">Stripe's privacy policy</a>. This notice should be updated before live payments are enabled.</p>

        <h2>6. When information may be shared</h2>
        <p>Information may be handled by providers described above when needed to operate a feature you request, by support or infrastructure providers that help run Meta, or where disclosure is required to comply with law, respond to a valid legal request, protect the safety or security of users or the service, investigate misuse, or protect legal rights. We do not intentionally sell personal information.</p>

        <h2>7. Storage, retention, and security</h2>
        <p>Account information is retained while needed to operate your account and for legitimate security, operational, or legal purposes. Authentication sessions are designed to expire after 7 days; email-verification links expire after 30 minutes; and OAuth state cookies are short-lived. Browser-stored projects, progress, and preferences can remain until you delete them or clear the browser's site data. Technical logs and backup copies may have different retention periods depending on the system and may be kept where reasonably needed for security, recovery, or legal obligations.</p>
        <p>We use safeguards in the current implementation that include salted password hashing, hashed server-side session tokens for email accounts, protected session cookies, HTTPS security attributes where configured, and request rate limiting. No website or storage system can be guaranteed completely secure, so avoid storing secrets or sensitive personal details in your projects or AI prompts.</p>

        <h2>8. International processing</h2>
        <p>Meta and its service providers may process information in more than one country, depending on where the service and its infrastructure operate. Privacy laws in those places may differ from the laws where you live. Third-party providers' own policies explain their processing and any applicable safeguards.</p>

        <h2>9. Children, teens, and families</h2>
        <p>Meta provides coding-learning features and may be used by younger learners. Parents and guardians should help younger users understand what information is saved in the browser and what is sent to third-party services when AI or sign-in features are used. Do not submit sensitive personal information about yourself or someone else in a prompt, project, or support message. If you believe personal information has been provided inappropriately or without a consent required by applicable law, contact us using the email below.</p>

        <h2>10. Your choices and requests</h2>
        <p>You can choose whether to use Google or Discord sign-in and whether to submit content to AI features. You can clear browser site data to remove local settings and project data; be aware that this may remove work you have not exported. You can request access to, correction of, or deletion of account information by contacting us. We may need to verify your identity before handling a request and may retain information where required or permitted by law.</p>
        <p>To delete a Meta account, use the Account page when available or visit the <Link className="policy-link" href="/delete-account">account deletion page</Link>. Deleting your Meta account does not delete your Google or Discord account, remove information held independently by those providers, or necessarily erase existing provider logs and backups immediately.</p>

        <h2>11. Changes to this policy</h2>
        <p>We may update this policy when the service, providers, or legal requirements change. We will update the date above when we publish a revised version. Significant changes should be highlighted where appropriate.</p>

        <h2>12. Contact</h2>
        <p>For privacy, account, or data requests, email <a className="policy-link" href="mailto:metasupport43@gmail.com">metasupport43@gmail.com</a>.</p>
        <p><strong>Launch note:</strong> This policy describes the current code and is not a substitute for jurisdiction-specific legal advice. Before a broad public launch, confirm the responsible operator's legal name/contact details, exact hosting/log retention settings, and whether any new analytics or advertising tools have been enabled.</p>
      </article>
    </main>
  );
}

function ProgressionSection({
  progress,
  onSkillLevelChange,
}: {
  progress: Progress;
  onSkillLevelChange: (skillLevel: LearnerSkillLevel) => void;
}) {
  const stats = getProgressionStats(progress);
  const skillLevel = progress.skillLevel ?? 'beginner';
  const skillAdvice: Record<LearnerSkillLevel, string> = {
    beginner: 'Recommended pace: follow the lessons in order and use hints whenever you need them.',
    intermediate: 'Recommended pace: try each exercise before opening its hint.',
    pro: 'Recommended pace: use the trail as a quick fundamentals refresher.',
  };

  return (
    <section className="progression-section" aria-labelledby="progression-heading" data-testid="section-progression">
      <div className="progression-summary">
        <p className="section-kicker">Your progression / 01—10</p>
        <div className="progression-level-heading">
          <span className="level-badge" data-testid="text-current-rank">LEVEL {String(stats.level).padStart(2, '0')}</span>
          <div>
            <h2 id="progression-heading">{stats.levelName}</h2>
            <p>{stats.xp} XP earned</p>
          </div>
        </div>
        <div className="level-progress-meta">
          <span>{stats.level === 10 ? 'Top level reached' : `${stats.xpToNextLevel} XP to level ${stats.level + 1}`}</span>
          <span>{stats.levelProgress} / 100 XP</span>
        </div>
        <div
          className="level-progress-track"
          role="progressbar"
          aria-label={stats.level === 10 ? 'Top level reached' : `Progress to level ${stats.level + 1}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.levelProgress}
          data-testid="status-level-progress"
        >
          <span className="level-progress-fill" style={{ width: `${stats.levelProgress}%` }} />
        </div>

        <fieldset className="skill-level-fieldset">
          <legend>Your coding experience</legend>
          <div className="skill-level-options">
            {learnerSkillLevels.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`skill-level-option${skillLevel === option.id ? ' selected' : ''}`}
                onClick={() => onSkillLevelChange(option.id)}
                aria-pressed={skillLevel === option.id}
                data-testid={`button-skill-level-${option.id}`}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
          <p className="skill-level-advice" data-testid="text-skill-level-advice">{skillAdvice[skillLevel]}</p>
        </fieldset>
      </div>

      <div className="rewards-panel">
        <div className="rewards-heading">
          <div>
            <p className="section-kicker">Milestone challenges</p>
            <h3>Earn digital rewards</h3>
          </div>
          <span className="reward-count" data-testid="text-rewards-earned">{stats.earnedRewardCount} / {stats.rewards.length}</span>
        </div>
        <div className="reward-list">
          {stats.rewards.map((reward) => (
            <article
              className={`reward-card${reward.earned ? ' earned' : ''}`}
              key={reward.id}
              data-testid={`card-reward-${reward.id}`}
              aria-label={`${reward.title}: ${reward.earned ? 'earned' : `${reward.progress} of ${reward.lessonsRequired} lessons complete`}`}
            >
              <span className="reward-status" aria-hidden="true">
                {reward.earned ? <CheckCircle2 /> : <CircleHelp />}
              </span>
              <div className="reward-copy">
                <strong>{reward.title}</strong>
                <span>{reward.description}</span>
                <small>{reward.progress} / {reward.lessonsRequired} lessons · +{reward.xpReward} XP</small>
              </div>
              <span className="reward-state">{reward.earned ? 'Earned' : 'Locked'}</span>
            </article>
          ))}
        </div>
        <p className="reward-note">Complete lessons to earn XP and virtual badges. Rewards are digital, not cash or gift cards.</p>
      </div>
    </section>
  );
}

function tileHue(id: string): string {
  const hues: Record<string, string> = {
    python: '209 37% 39%', javascript: '46 61% 43%', typescript: '216 52% 49%', 'html-css': '13 73% 52%',
    java: '4 60% 48%', c: '219 25% 43%', cpp: '214 48% 48%', csharp: '272 29% 47%',
    go: '183 44% 36%', rust: '21 49% 45%', sql: '160 34% 38%', ruby: '350 43% 45%',
  };
  return hues[id] ?? '160 34% 38%';
}

function isAnswerCorrect(answer: string, lesson: Lesson): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '').replace(/;+/g, '');
  const submitted = normalize(answer);
  return submitted.length > 0 && lesson.acceptedAnswers.some((candidate) => normalize(candidate) === submitted);
}

function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const lesson = lessonFor(params.lessonId);
  const { progress, complete, completeQuiz } = useProgress();
  const [languageId, setLanguageId] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_KEY) ?? localStorage.getItem('code-atlas-language-v1') ?? 'python';
    } catch {
      return 'python';
    }
  });
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'try-again' | null>(null);
  const [showHint, setShowHint] = useState(() => readFlag('meta-auto-show-lesson-hints', false));
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const activeLanguage = languageFor(languageId);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setShowHint(readFlag('meta-auto-show-lesson-hints', false));
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  }, [params.lessonId]);

  if (!lesson) return <NotFound />;

  const currentIndex = lessons.findIndex((item) => item.id === lesson.id);
  const previous = lessons[currentIndex - 1];
  const next = lesson.nextLessonId ? lessonFor(lesson.nextLessonId) : undefined;
  const isComplete = progress.completedLessonIds.includes(lesson.id);
  const quizPassed = progress.completedQuizLessonIds?.includes(lesson.id) ?? false;
  const example = lesson.examplesByLanguage[languageId];
  const displayExample = example?.replace(/\\n/g, '\n');

  const checkAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAnswerCorrect(answer, lesson)) {
      setFeedback('correct');
      complete(lesson.id);
    } else {
      setFeedback('try-again');
    }
  };

  const submitQuiz = () => {
    const score = lesson.quiz.reduce((total, question, index) => total + (quizAnswers[index] === question.answerIndex ? 1 : 0), 0);
    setQuizScore(score);
    setQuizSubmitted(true);
    if (score >= 2) completeQuiz(lesson.id);
  };

  const updateLanguage = (value: string) => {
    setLanguageId(value);
    localStorage.setItem(LANGUAGE_KEY, value);
  };

  return (
    <AppShell>
      <main className="lesson-main">
        <div className="lesson-head">
          <Link href="/" className="back-link" data-testid="link-back-to-academy"><ArrowLeft aria-hidden="true" /> Back to the academy</Link>
          <div className="lesson-heading-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> Lesson {String(currentIndex + 1).padStart(2, '0')} / {String(lessons.length).padStart(2, '0')}</div>
              <h1 data-testid="heading-lesson-title">{lesson.title}</h1>
              <p className="lesson-sub">{lesson.concept} · A shared foundation in {activeLanguage.name}</p>
            </div>
            <div className="lesson-meta"><Clock3 aria-hidden="true" /> {lesson.duration} <span>·</span> <BookOpen aria-hidden="true" /> Hands-on</div>
          </div>
        </div>

        <div className="lesson-layout">
          <article className="lesson-content">
            <p className="concept-intro" data-testid="text-lesson-explanation">
              {lesson.explanation.split('**').map((part, index) => index % 2 === 1 ? <strong key={index}>{part}</strong> : part)}
            </p>
            <blockquote className="concept-quote">{quoteFor(lesson.id)}</blockquote>
            <section className="code-panel" aria-label={`${lesson.concept} example in ${activeLanguage.name}`}>
              <div className="code-panel-head">
                <span className="code-language">{activeLanguage.name} / example</span>
                <label>
                  <span className="sr-only">Choose a language</span>
                  <select value={languageId} onChange={(event) => updateLanguage(event.target.value)} className="language-select" data-testid="select-lesson-language">
                    {languages.map((language) => <option value={language.id} key={language.id}>{language.name}</option>)}
                  </select>
                </label>
              </div>
              <pre className="code-block" data-testid="code-lesson-example"><code>{displayExample ?? `${activeLanguage.name} approaches this idea in its own way. Start with the shared concept, then notice what feels different.`}</code></pre>
              {languageId === 'html-css' && ['conditions', 'loops', 'functions'].includes(lesson.id) && (
                <div className="code-caption">HTML and CSS describe page structure and style; behavior like this is usually handled by JavaScript.</div>
              )}
              {languageId === 'html-css' && ['strings', 'objects', 'input', 'score-check'].includes(lesson.id) && (
                <div className="code-caption">HTML can display or collect information, but dynamic text, object logic, and score decisions need JavaScript or another programming language. Switch to JavaScript to see executable logic.</div>
              )}
              {languageId === 'sql' && lesson.id === 'loops' && <div className="code-caption">SQL works with sets of rows rather than repeating a block line by line.</div>}
            </section>
            <section className="explain-block">
              <h2>What to notice</h2>
              <p>{noticeFor(lesson.id, activeLanguage.name)}</p>
              <div className="tip-row"><Lightbulb aria-hidden="true" /><span><strong>Keep this in your pocket:</strong> {tipFor(lesson.id)}</span></div>
            </section>
            <form className="exercise" onSubmit={checkAnswer}>
              <div className="exercise-heading"><Sparkles aria-hidden="true" /> Your turn</div>
              <h2>Try a tiny exercise.</h2>
              <p>{lesson.exercisePrompt} Use {activeLanguage.name} syntax. Your answer is checked right here on the page.</p>
              <textarea
                className="answer-input"
                value={answer}
                onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }}
                placeholder="Write your answer here..."
                aria-label="Your code answer"
                data-testid="input-exercise-answer"
              />
              <div className="exercise-actions">
                <button type="submit" className="button-primary" data-testid="button-check-answer">Check my answer <ArrowRight aria-hidden="true" /></button>
                <button type="button" className="button-secondary" onClick={() => setShowHint((visible) => !visible)} aria-expanded={showHint} data-testid="button-toggle-hint"><CircleHelp aria-hidden="true" /> {showHint ? 'Hide hint' : 'Need a hint?'}</button>
              </div>
              {showHint && <div className="hint-box" data-testid="text-exercise-hint"><strong>Small nudge:</strong> {lesson.hint}</div>}
              {feedback === 'correct' && (
                <div className="feedback correct" role="status" data-testid="status-exercise-feedback"><CheckCircle2 aria-hidden="true" /><span><strong>That works.</strong> {lesson.solutionExplanation}</span></div>
              )}
              {feedback === 'try-again' && (
                <div className="feedback try-again" role="status" data-testid="status-exercise-feedback"><CircleHelp aria-hidden="true" /><span><strong>Not quite yet.</strong> Check the spelling, punctuation, and shape of the example. A hint can help you find the next step.</span></div>
              )}
              {isComplete && feedback !== 'correct' && <div className="feedback correct" role="status" data-testid="status-already-complete"><CheckCircle2 aria-hidden="true" /><span>You’ve completed this lesson before. Feel free to practice again.</span></div>}
            </form>
            {(isComplete || feedback === 'correct') && (
              <section className="quiz-section" aria-labelledby="quiz-heading" data-testid="section-lesson-checkpoint">
                <div className="quiz-heading"><ClipboardCheck aria-hidden="true" /> Lesson checkpoint</div>
                <h2 id="quiz-heading">Quick knowledge check</h2>
                <p className="quiz-intro">Answer these three short questions to check what stuck. You need 2 out of 3 to pass, and you can retry whenever you like.</p>
                {lesson.quiz.map((question, questionIndex) => (
                  <fieldset className="quiz-question" key={question.question}>
                    <legend>{questionIndex + 1}. {question.question}</legend>
                    <div className="quiz-options">
                      {question.options.map((option, optionIndex) => {
                        const selected = quizAnswers[questionIndex] === optionIndex;
                        const correct = quizSubmitted && question.answerIndex === optionIndex;
                        const incorrect = quizSubmitted && selected && question.answerIndex !== optionIndex;
                        return (
                          <label className={`quiz-option${correct ? ' is-correct' : ''}${incorrect ? ' is-incorrect' : ''}`} key={option}>
                            <input
                              type="radio"
                              name={`quiz-${lesson.id}-${questionIndex}`}
                              value={optionIndex}
                              checked={selected}
                              onChange={() => {
                                setQuizAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
                                setQuizSubmitted(false);
                                setQuizScore(null);
                              }}
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                    {quizSubmitted && <p className="quiz-explanation"><strong>Why:</strong> {question.explanation}</p>}
                  </fieldset>
                ))}
                <div className="exercise-actions">
                  <button type="button" className="button-primary" onClick={submitQuiz} disabled={Object.keys(quizAnswers).length < lesson.quiz.length} data-testid="button-submit-checkpoint">
                    {quizSubmitted ? 'Check again' : 'Check my answers'} <ArrowRight aria-hidden="true" />
                  </button>
                  {quizPassed && quizScore === null && <span className="level-label">Checkpoint already passed</span>}
                </div>
                {quizScore !== null && (
                  <div className={`quiz-result ${quizScore >= 2 ? 'passed' : 'retry'}`} role="status" data-testid="status-checkpoint-result">
                    {quizScore >= 2 ? <CheckCircle2 aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
                    <span><strong>{quizScore >= 2 ? 'Checkpoint passed!' : 'Nearly there — try again.'}</strong> You scored {quizScore} out of {lesson.quiz.length}. {quizScore >= 2 ? 'You can move on with confidence, or review the explanations above.' : 'Review the explanations, change your answers, and check again.'}</span>
                  </div>
                )}
              </section>
            )}
            <nav className="lesson-nav" aria-label="Lesson navigation">
              {previous ? <Link href={`/learn/${previous.id}`} className="button-secondary" data-testid="button-previous-lesson"><ArrowLeft aria-hidden="true" /> Previous</Link> : <span className="lesson-nav-spacer" />}
              {next ? (
                <Link href={`/learn/${next.id}`} className="button-primary" data-testid="button-next-lesson">Next: {next.concept} <ArrowRight aria-hidden="true" /></Link>
              ) : (
                <Link href="/" className="button-primary" data-testid="button-finish-path">Back to Meta <Compass aria-hidden="true" /></Link>
              )}
            </nav>
          </article>

          <aside className="lesson-sidebar" aria-label="Course lessons">
            <div className="sidebar-title"><span>Foundation trail</span><span>{currentIndex + 1} / {lessons.length}</span></div>
            <div className="sidebar-lessons">
              {lessons.map((item, index) => {
                const done = progress.completedLessonIds.includes(item.id);
                return (
                  <Link href={`/learn/${item.id}`} key={item.id} className={`sidebar-lesson${item.id === lesson.id ? ' active' : ''}${done ? ' done' : ''}`} aria-current={item.id === lesson.id ? 'step' : undefined} data-testid={`sidebar-lesson-${item.id}`}>
                    <span className="lesson-index">{done ? <Check aria-label="Complete" /> : String(index + 1).padStart(2, '0')}</span>
                    <span>{item.concept}</span>
                    {item.id === lesson.id && <ArrowRight aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
            <div className="sidebar-language"><strong>{activeLanguage.name}</strong> is selected. Choose another language above to compare the same idea in a new syntax.</div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function quoteFor(lessonId: string): string {
  const quotes: Record<string, string> = {
    output: '“The first sign of life from a program is a message back.”',
    values: '“Give information a name, and it becomes something you can work with.”',
    conditions: '“A condition is a question. The answer decides which path comes next.”',
    loops: '“Describe the repetition once; let the computer do it carefully.”',
    functions: '“A good function turns a useful idea into a tool you can reuse.”',
    collections: '“One name can hold a whole handful of related values.”',
    strings: '“A clear message is data arranged for a human to understand.”',
    objects: '“Related facts become easier to work with when they travel together.”',
    input: '“A program becomes interactive when it can listen as well as speak.”',
    debugging: '“Change one thing, test it, and let evidence lead the way.”',
    'score-check': '“A small project turns separate ideas into one working result.”',
  };
  return quotes[lessonId] ?? '“Small ideas connect into bigger programs.”';
}

function noticeFor(lessonId: string, languageName: string): string {
  const observations: Record<string, string> = {
    output: `Look for the instruction that sends text somewhere visible. In ${languageName}, that may be called print, println, puts, or a console method — the job is the same.`,
    values: 'Notice the name on the left and its value on the right. Some languages make the type explicit; others let the value suggest it.',
    conditions: 'The comparison produces a yes-or-no result. The indented or bracketed block belongs to the condition above it.',
    loops: 'Find the start, the stopping point, and the repeated action. Pay attention to whether the end of a range is included.',
    functions: 'The function name makes the action easy to call again. The parameter is a placeholder for the value that will arrive later.',
    collections: 'The brackets group several values, and the comma separates them. Many languages count positions starting at zero.',
    strings: 'Look for the text value and the operation that combines it with name. Some languages also provide interpolation syntax.',
    objects: 'Find the key and value pairs in the example. They describe one profile, even if your language uses a struct or record instead of an object.',
    input: `Identify where the value enters the program. In ${languageName}, that might be a prompt, a terminal read, or a form field.`,
    debugging: 'Compare the opening and closing quotes or tags, then make the smallest repair you can test.',
    'score-check': 'Follow the score into the comparison, then trace which message runs when the condition is true or false.',
  };
  return observations[lessonId] ?? `Notice how ${languageName} expresses the same underlying idea.`;
}

function tipFor(lessonId: string): string {
  const tips: Record<string, string> = {
    output: 'Quotes hold the message; the command decides where it goes.',
    values: 'Names make values easier to reuse and easier to understand.',
    conditions: 'Use == to compare equality in most languages; a single = usually assigns a value.',
    loops: 'A loop needs a clear stopping point so it knows when to move on.',
    functions: 'A parameter is the function’s input; return is its output.',
    collections: 'The first item is often item zero, not item one.',
    strings: 'Keep text inside matching quotes and join it with the value you want to show.',
    objects: 'Use a structure that names each field so it is clear which value is which.',
    input: 'Do not assume the user entered a valid value; check it before relying on it.',
    debugging: 'Read the error, reproduce it, make one small edit, and test again.',
    'score-check': 'Try scores below 50, exactly 50, and above 50 to test both branches.',
  };
  return tips[lessonId] ?? 'Build one small piece at a time.';
}


function AdminPublishingPage() {
  type ContentItem = { id?: number; title: string; slug: string; content_type: 'announcement' | 'lesson'; summary: string; body: string; status: 'draft' | 'published'; updated_at?: string };
  const empty: ContentItem = { title: '', slug: '', content_type: 'announcement', summary: '', body: '', status: 'draft' };
  const [items, setItems] = useState<ContentItem[]>([]);
  const [draft, setDraft] = useState<ContentItem | typeof empty>(empty);
  const [adminStatus, setAdminStatus] = useState('Checking administrator access…');
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/admin/content', { credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not verify administrator access.');
        if (!active) return;
        setAllowed(true);
        setItems(Array.isArray(data.items) ? data.items : []);
        setAdminStatus('Drafts are private. Published items appear in the public Meta updates section.');
      })
      .catch(error => { if (active) setAdminStatus(error instanceof Error ? error.message : 'Could not verify administrator access.'); });
    return () => { active = false; };
  }, []);
  function editItem(item: ContentItem) { setDraft({ ...item }); }
  function startNew() { setDraft({ ...empty }); }
  function updateField<K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function saveContent(publish: boolean) {
    if (!draft.title.trim() || !draft.slug.trim() || !draft.body.trim() || saving) {
      setAdminStatus('Add a title, URL slug, and body before saving.');
      return;
    }
    setSaving(true);
    setAdminStatus('');
    const payload = { ...draft, status: publish ? 'published' : 'draft' };
    try {
      const response = await fetch('/api/auth/admin/content', {
        method: draft.id ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save content.');
      setItems(current => [data.item, ...current.filter(item => item.id !== data.item.id)]);
      setDraft(data.item);
      setAdminStatus(publish ? 'Content published.' : 'Draft saved.');
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not save content.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <AppShell>
      <main className="admin-publishing-page">
        <div className="admin-publishing-heading">
          <p className="section-kicker">Meta administration</p>
          <h1>Content publishing</h1>
          <p>Create drafts, preview your writing, and publish announcements or learning resources without editing source code.</p>
        </div>
        <section className="admin-publishing-guide" aria-label="How to publish content">
          <h2>How to publish</h2>
          <ol>
            <li>Choose <strong>New draft</strong> in the Content library.</li>
            <li>Add a title and a short URL slug, using lowercase letters and hyphens (for example, <code>new-course-update</code>).</li>
            <li>Choose <strong>Announcement</strong> for news, or <strong>Learning resource</strong> for a tip or guide. Add a short summary and the full body.</li>
            <li>Select <strong>Save draft</strong> to keep it private, or <strong>Publish content</strong> to show it in the Updates &amp; new learning section on the home page.</li>
          </ol>
          <p>Publishing here adds a home-page update; it does not create or edit a lesson inside the structured lesson tracks.</p>
        </section>
        <p className="admin-publishing-status" role="status">{adminStatus}</p>
        {allowed && (
          <div className="admin-publishing-layout">
            <aside className="admin-content-list">
              <div className="admin-list-heading"><h2>Content library</h2><button type="button" className="admin-small-button" onClick={startNew}>New draft</button></div>
              {items.length === 0 && <p className="admin-muted">Your content library is empty. Create your first draft.</p>}
              {items.map(item => (
                <button type="button" key={item.id} className={draft.id === item.id ? 'admin-content-list-item selected' : 'admin-content-list-item'} onClick={() => editItem(item)}>
                  <strong>{item.title}</strong><span>{item.content_type} · {item.status}</span>
                </button>
              ))}
            </aside>
            <section className="admin-content-editor">
              <div className="admin-editor-head"><h2>{draft.id ? 'Edit content' : 'Create content'}</h2><span className={draft.status === 'published' ? 'admin-status-pill published' : 'admin-status-pill'}>{draft.status}</span></div>
              <label>Title<input value={draft.title} maxLength={120} onChange={e => updateField('title', e.target.value)} placeholder="A clear, useful title" /></label>
              <label>URL slug<input value={draft.slug} maxLength={100} onChange={e => updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="getting-started" /><small>Used as a stable content identifier.</small></label>
              <label>Content type<select value={draft.content_type} onChange={e => updateField('content_type', e.target.value as 'announcement' | 'lesson')}><option value="announcement">Announcement</option><option value="lesson">Learning resource</option></select></label>
              <label>Short summary<textarea rows={2} maxLength={280} value={draft.summary} onChange={e => updateField('summary', e.target.value)} placeholder="A short preview shown on the home page" /></label>
              <label>Body<textarea rows={10} maxLength={12000} value={draft.body} onChange={e => updateField('body', e.target.value)} placeholder="Write the content you want learners to see…" /></label>
              <div className="admin-editor-actions"><button type="button" className="admin-secondary-button" disabled={saving} onClick={() => saveContent(false)}>Save draft</button><button type="button" className="button-primary" disabled={saving} onClick={() => saveContent(true)}>{saving ? 'Saving…' : 'Publish content'}</button></div>
              <p className="admin-muted">Publishing makes this content visible on the public home page. Saving a draft keeps it private.</p>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function BotControlPage() {
  const [discordReady, setDiscordReady] = useState(false);
  const [discordChecked, setDiscordChecked] = useState(false);
  const [status, setStatus] = useState('Checking Discord connection…');
  const [allowed, setAllowed] = useState(false);
  const [owner, setOwner] = useState('');
  const [servers, setServers] = useState<Array<{id:string;name:string;icon:string|null;owner:boolean;botPresent:boolean}>>([]);
  const [guildId, setGuildId] = useState('');
  const [commands, setCommands] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [partners, setPartners] = useState<Array<{id:number;name:string;invite_url:string;description:string;created_at:string}>>([]);
  const [templateText, setTemplateText] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerInvite, setPartnerInvite] = useState('');
  const [partnerDescription, setPartnerDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [messageChannelId, setMessageChannelId] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const defaultTemplate = JSON.stringify({
    roles: [
      { name: 'Founder', color: 16042333 }, { name: 'Administrator', color: 9289215 },
      { name: 'Moderator', color: 7391137 }, { name: 'Support Team', color: 9091048 },
      { name: 'Mentor', color: 12100084 }, { name: 'Developer', color: 11786657 },
      { name: 'Community Member', color: 14148836 }
    ],
    categories: [
      { name: '📍 GET STARTED', channels: [['text','welcome'],['text','rules'],['text','announcements'],['text','official-links'],['text','choose-roles']] },
      { name: '💬 COMMUNITY', channels: [['text','general-chat'],['text','introductions'],['text','questions'],['text','ideas-and-feedback'],['text','project-showcase']] },
      { name: '💻 LEARN AND BUILD', channels: [['text','learning-resources'],['text','web-development'],['text','discord-bots'],['text','coding-challenges'],['text','github-and-projects']] },
      { name: '🛟 META SUPPORT', channels: [['text','open-a-ticket'],['text','bug-reports'],['text','suggestions']] },
      { name: '🔊 VOICE LOUNGE', channels: [['voice','Community Lounge'],['voice','Coding Together'],['voice','AFK']] },
      { name: '🔐 STAFF HQ', private: true, channels: [['text','staff-chat'],['text','staff-applications'],['text','ticket-logs'],['text','moderation-logs']] }
    ]
  }, null, 2);
  useEffect(() => {
    let active = true;
    setStatus('Checking Meta owner account…');
    fetch('/api/auth/admin/bot-control', { credentials: 'same-origin', cache: 'no-store' })
      .then(async ownerResponse => {
        const ownerData = await ownerResponse.json().catch(() => ({}));
        if (!active) return;
        setDiscordChecked(true);
        // This endpoint checks the actual Meta email session and owner allowlist.
        // Do not use /api/auth/me here because deployments may route that URL to Discord OAuth.
        if (ownerResponse.status === 401) {
          setDiscordReady(false);
          setStatus('Sign in with the authorized Meta owner email to manage bot settings.');
          return;
        }
        if (!ownerResponse.ok) {
          setDiscordReady(true);
          throw new Error(ownerData.error || 'This account is not authorized to manage Meta bot settings.');
        }
        setDiscordReady(true);
        setOwner(String(ownerData.owner || 'Meta owner'));
        setCommands(Array.isArray(ownerData.commands) ? ownerData.commands : []);
        // Owner authorization is sufficient for global settings. A temporary
        // Discord presence lookup failure must not hide or disable the editor.
        setAllowed(true);
        try {
          const serverResponse = await fetch('/api/auth/admin/bot-control/servers', { credentials: 'same-origin', cache: 'no-store' });
          const serverData = await serverResponse.json().catch(() => ({}));
          if (!serverResponse.ok) throw new Error(serverData.error || 'Could not load the Meta home server.');
          if (!active) return;
          const availableServers = Array.isArray(serverData.servers) ? serverData.servers : [];
          setServers(availableServers);
          const homeServer = availableServers[0];
          setGuildId(homeServer?.id || '');
          setStatus(homeServer
            ? (homeServer.botPresent
              ? 'Owner verified. Global Meta bot settings are ready.'
              : (serverData.message || 'Owner verified. Settings can be saved while the bot reconnects.'))
            : 'Owner verified. Global settings are available, but the Meta home server could not be identified.');
        } catch (serverError) {
          if (!active) return;
          setServers([]);
          setGuildId('');
          const detail = serverError instanceof Error ? serverError.message : 'Discord status is temporarily unavailable.';
          setStatus('Owner verified. The global settings editor is still available. Server status: ' + detail);
        }
      })
      .catch(error => { if (active) setStatus(error instanceof Error ? error.message : 'Could not check Meta owner access.'); });
    return () => { active = false; };
  }, []);
  const loadSettings = async () => {
    const id = guildId.trim();
    setBusy(true);
    try {
      const response = await fetch('/api/auth/admin/bot-control/settings' + (id ? '?guildId=' + encodeURIComponent(id) : ''), { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load settings.');
      setSettings(data.settings || {});
      setPartners(Array.isArray(data.partners) ? data.partners : []);
      setTemplateText(data.settings?.server_setup_template || defaultTemplate);
      setStatus(id ? 'Loaded global Meta bot settings for home server ' + id + '.' : 'Loaded global Meta bot settings.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not load settings.'); }
    finally { setBusy(false); }
  };
  const setValue = (key: string, value: string) => setSettings(current => ({ ...current, [key]: value }));
  const sendBotMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingMessage || !guildId || !messageChannelId.trim() || !messageContent.trim()) return;
    setSendingMessage(true);
    setStatus('Sending message through Meta bot…');
    try {
      const response = await fetch('/api/auth/admin/bot-control/messages', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, channelId: messageChannelId.trim(), content: messageContent.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not send the message.');
      setMessageContent('');
      setStatus('Message queued for delivery by Meta bot. It should appear in Discord shortly.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not send the message.'); }
    finally { setSendingMessage(false); }
  };
  const saveSettings = async () => {
    setStatus('Saving bot settings…');
    let template = templateText;
    try {
      const parsed = JSON.parse(template);
      if (!Array.isArray(parsed.roles) || !Array.isArray(parsed.categories) ||
          parsed.roles.length > 40 || parsed.categories.length > 30 ||
          parsed.roles.some((role: {name?: unknown}) => typeof role?.name !== 'string' || !role.name.trim() || role.name.length > 100) ||
          parsed.categories.some((group: {name?: unknown; channels?: unknown}) => typeof group?.name !== 'string' || !group.name.trim() ||
            !Array.isArray(group.channels) || group.channels.length > 50 ||
            group.channels.some((channel: unknown) => !Array.isArray(channel) || !['text','voice'].includes(channel[0] as string) ||
              typeof channel[1] !== 'string' || !channel[1].trim() || channel[1].length > 100))) {
        throw new Error('Use roles and categories arrays. Each channel must be ["text" or "voice", "channel-name"]. Limits: 40 roles, 30 categories, 50 channels each.');
      }
    } catch (error) { setStatus('Setup template JSON is invalid: ' + (error instanceof Error ? error.message : 'check the JSON')); return; }
    const editableKeys = new Set(['autopartner_enabled','autopartner_channel_id','autopartner_interval_hours','autopartner_template','bot_welcome_message','bot_rules_text','bot_status_text','bot_response:meta','bot_response:lessons','bot_response:ping','bot_response:help','ticket_panel_style','ticket_categories','ticket_form_questions','ticket_panel_title','ticket_panel_description','ticket_category_id','ticket_staff_role_id','ticket_log_channel_id','community_welcome_channel_id','community_welcome_message','community_autorole_id','community_log_channel_id','community_xp_enabled']);
    const payload = Object.fromEntries(Object.entries(settings).filter(([key]) => editableKeys.has(key) || key.startsWith('bot_command_enabled:')));
    payload.server_setup_template = template;
    setBusy(true);
    try {
      const response = await fetch('/api/auth/admin/bot-control/settings', {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(guildId.trim() ? { guildId: guildId.trim() } : {}), settings: payload })
      });
      const responseText = await response.text();
      let data: { error?: string; settings?: Record<string, string>; saved?: number } = {};
      if (responseText) {
        try { data = JSON.parse(responseText); }
        catch {
          if (response.ok) throw new Error('The server returned an unreadable response while saving settings.');
        }
      }
      if (!response.ok) {
        const detail = typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : (responseText ? responseText.slice(0, 240) : response.statusText || 'No error details returned.');
        throw new Error(`Save failed (HTTP ${response.status}): ${detail}`);
      }
      setSettings(data.settings || payload);
      setStatus('Saved ' + String(data.saved || 0) + ' bot settings. Command toggles apply immediately. Discord may still show disabled commands in the command picker, but the bot will reject them.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setStatus(detail === 'Failed to fetch'
        ? 'Could not reach the save API. Check the site connection and try again. (Network error: Failed to fetch)'
        : 'Save error: ' + detail);
    }
    finally { setBusy(false); }
  };
  const addPartner = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/auth/admin/bot-control/partners', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: guildId.trim(), name: partnerName, invite_url: partnerInvite, description: partnerDescription })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not add partner.');
      setPartnerName(''); setPartnerInvite(''); setPartnerDescription('');
      await loadSettings();
      setStatus('Partner added to the approved rotation.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not add partner.'); }
    finally { setBusy(false); }
  };
  const updatePartner = async (partner: {id:number;name:string;invite_url:string;description:string;created_at:string}) => {
    setBusy(true);
    try {
      const response = await fetch('/api/auth/admin/bot-control/partners/' + partner.id, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: guildId.trim(), name: partner.name, invite_url: partner.invite_url, description: partner.description })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update partner.');
      setStatus('Updated partner ' + partner.name + '.');
      await loadSettings();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not update partner.'); }
    finally { setBusy(false); }
  };
  const removePartner = async (id: number) => {
    if (!window.confirm('Remove this approved partner?')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/auth/admin/bot-control/partners/' + id + '?guildId=' + encodeURIComponent(guildId.trim()), { method: 'DELETE', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not remove partner.');
      await loadSettings();
      setStatus('Partner removed.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not remove partner.'); }
    finally { setBusy(false); }
  };
  const toggleCommand = (name: string, enabled: boolean) => setValue('bot_command_enabled:' + name, enabled ? 'true' : 'false');
  const isEnabled = (name: string) => settings['bot_command_enabled:' + name] !== 'false';
  useEffect(() => {
    if (editorOpen) document.getElementById('bot-settings-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editorOpen]);
  const fieldStyle: CSSProperties = { width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border, #d1d5db)', background: 'var(--surface, #fff)', color: 'var(--text, #111827)' };
  return (
    <AppShell>
      <main className="admin-publishing-page">
        <div className="admin-publishing-heading">
          <p className="section-kicker">Private · owner access only</p>
          <h1>Meta Code bot control</h1>
          <p>Manage Meta bot globally from one private control panel: commands, partnership rotation, server setup templates, tickets, and bot messages. Settings apply to the bot as a whole, not separate servers. Bot tokens and secrets are never displayed.</p>
        </div>
        <p className="admin-publishing-status" role="status">{status}</p>
        {discordChecked && !discordReady && <section className="admin-publishing-guide">
          <h2>Sign in to manage Meta bot</h2>
          <p>Discord sign-in is not needed. Sign in to the website using the authorized Meta owner email account.</p>
          <a className="button-primary" href="/sign-in?next=%2Fbot-control">Sign in to Meta Code</a>
        </section>}
        {discordReady && !allowed && discordChecked && <section className="admin-publishing-guide">
          <h2>Owner access required</h2>
          <p>{status}</p>
          <a className="button-primary" href="/sign-in?next=%2Fbot-control">Switch Meta account</a>
        </section>}
        {allowed && discordReady && <section className="admin-publishing-guide">
          <h2>Meta owner access</h2>
          <p>Authorized account: <strong>{owner}</strong></p>
          <p>Discord OAuth is not required to edit global bot settings.</p>
        </section>}
        {allowed && discordReady && <>
          <section className="admin-publishing-guide">
            <h2>Owner session</h2>
            <p>Authorized account: <strong>{owner}</strong></p>
            <p>Global Meta bot settings. The configured bot is selected automatically; you don't need to connect Discord or choose a server here.</p>
            <div className="admin-publishing-actions">
              <button type="button" className="button-primary" onClick={() => { setEditorOpen(true); setStatus('Opening the bot settings editor…'); void loadSettings(); }} disabled={busy}><Settings aria-hidden="true" /> {editorOpen ? 'Editor open' : 'Edit bot settings'}</button>
              {editorOpen && <button type="button" className="button-secondary" onClick={() => { void saveSettings(); }} disabled={busy}>{busy ? 'Saving…' : 'Save all settings'}</button>}
            </div>
            {editorOpen && <p className="admin-publishing-status" role="status" aria-live="polite">{status}</p>}
            <p>Settings can be edited while the bot is offline and will take effect when it reconnects.</p>
          </section>
          {editorOpen && <>
            <section id="bot-settings-editor" className="admin-publishing-guide">
              <h2>Bot settings editor</h2>
              <p>The editor is open. Change any fields below, then choose Save all settings.</p>
              <h3>Command controls</h3>
              <p>Turn commands off here without editing code. Staff-only permissions are still enforced by Discord and the bot.</p>
              <div className="admin-content-list">
                {commands.map(command => <label className="admin-content-list-item" key={command} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <strong>/{command}</strong>
                  <input type="checkbox" checked={isEnabled(command)} onChange={event => toggleCommand(command, event.target.checked)} aria-label={'Enable /' + command} />
                </label>)}
              </div>
            </section>
            <section className="admin-publishing-guide">
              <h2>Editable bot responses</h2>
              <p>Use <code>{'{siteUrl}'}</code> as a placeholder in messages. Leave a field empty to use the built-in default.</p>
              {(['meta','lessons','ping','help'] as const).map(name => <label key={name} style={{ display: 'block', marginTop: 14 }}>
                <strong>/{name} response override</strong>
                <textarea value={settings['bot_response:' + name] || ''} onChange={event => setValue('bot_response:' + name, event.target.value)} placeholder="Built-in default" rows={3} style={fieldStyle} />
              </label>)}
              <label style={{ display: 'block', marginTop: 14 }}>
                <strong>Bot activity status</strong>
                <input value={settings.bot_status_text || ''} onChange={event => setValue('bot_status_text', event.target.value)} placeholder="Meta Code · Building cool things" maxLength={128} style={fieldStyle} />
              </label>
              <label style={{ display: 'block', marginTop: 14 }}>
                <strong>Welcome message override</strong>
                <textarea value={settings.bot_welcome_message || ''} onChange={event => setValue('bot_welcome_message', event.target.value)} placeholder="Leave blank to use the default welcome embed" rows={3} style={fieldStyle} />
              </label>
              <label style={{ display: 'block', marginTop: 14 }}>
                <strong>Rules text override</strong>
                <textarea value={settings.bot_rules_text || ''} onChange={event => setValue('bot_rules_text', event.target.value)} placeholder="Leave blank to use the default rules" rows={5} style={fieldStyle} />
              </label>
            </section>
            <section className="admin-publishing-guide">
              <h2>Ticket system builder</h2>
              <p>Choose how members select a ticket category, customize the panel text, and configure the form they must complete before a private ticket channel is created. Save all settings, then run <code>/ticket panel</code> again to post the updated panel.</p>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Discord category ID for ticket channels</strong>
                <input value={settings.ticket_category_id || ''} onChange={event => setValue('ticket_category_id', event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Discord category ID" style={fieldStyle} inputMode="numeric" />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Ticket staff role ID</strong>
                <input value={settings.ticket_staff_role_id || ''} onChange={event => setValue('ticket_staff_role_id', event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Discord role ID" style={fieldStyle} inputMode="numeric" />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Ticket log channel ID</strong>
                <input value={settings.ticket_log_channel_id || ''} onChange={event => setValue('ticket_log_channel_id', event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Discord text channel ID" style={fieldStyle} inputMode="numeric" />
              </label>
              <p>These IDs can be copied in Discord with Developer Mode enabled. The bot needs permission to view and manage the selected channels.</p>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Category picker style</strong>
                <select value={settings.ticket_panel_style || 'dropdown'} onChange={event => setValue('ticket_panel_style', event.target.value)} style={fieldStyle}>
                  <option value="dropdown">Dropdown menu</option>
                  <option value="buttons">Buttons</option>
                </select>
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Ticket panel title</strong>
                <input value={settings.ticket_panel_title || ''} onChange={event => setValue('ticket_panel_title', event.target.value)} maxLength={256} placeholder="Meta Code Support" style={fieldStyle} />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Ticket panel description</strong>
                <textarea value={settings.ticket_panel_description || ''} onChange={event => setValue('ticket_panel_description', event.target.value)} maxLength={4000} rows={3} placeholder="Explain how members should open a ticket" style={fieldStyle} />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Ticket categories (JSON list)</strong>
                <textarea value={settings.ticket_categories || '["General Support","Bug Report","Website Help","Partnership","Other"]'} onChange={event => setValue('ticket_categories', event.target.value)} rows={5} spellCheck={false} style={{ ...fieldStyle, fontFamily: 'monospace' }} />
                <small>Use 1–25 category names, for example ["General Support","Bug Report","Partnership"].</small>
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Required form questions (JSON list)</strong>
                <textarea value={settings.ticket_form_questions || '["Briefly describe what you need help with."]'} onChange={event => setValue('ticket_form_questions', event.target.value)} rows={5} spellCheck={false} style={{ ...fieldStyle, fontFamily: 'monospace' }} />
                <small>Use 1–5 questions. Each question becomes a required field shown before the bot creates the ticket channel. Each question must be 45 characters or fewer.</small>
              </label>
              <p>Important: the ticket category and staff role used for channel permissions still need to be configured with <code>/ticket setup</code>. This editor controls the categories members choose on the panel. The channel category, staff role, and log channel can be set here or with `/ticket setup`.</p>
            </section>
            <section className="admin-publishing-guide">
              <h2>Send a message as Meta</h2>
              <p>Post directly to a text channel in the configured Meta home server. Discord will show the message as sent by the bot.</p>
              <form onSubmit={sendBotMessage}>
                <label style={{ display: 'block', marginTop: 12 }}>
                  <strong>Discord channel ID</strong>
                  <input required value={messageChannelId} onChange={event => setMessageChannelId(event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Right-click a channel and copy its ID" style={fieldStyle} inputMode="numeric" />
                </label>
                <label style={{ display: 'block', marginTop: 12 }}>
                  <strong>Message</strong>
                  <textarea required value={messageContent} onChange={event => setMessageContent(event.target.value)} maxLength={2000} rows={5} placeholder="Write the message Meta should send…" style={fieldStyle} />
                  <small>{messageContent.length}/2000 characters. Mentions will not ping members.</small>
                </label>
                <button type="submit" className="button-primary" disabled={sendingMessage || !guildId || !messageChannelId.trim() || !messageContent.trim()} style={{ marginTop: 12 }}>
                  {sendingMessage ? 'Sending…' : 'Send as Meta'}
                </button>
              </form>
            </section>
            <section className="admin-publishing-guide">
              <h2>Community features</h2>
              <p>Configure welcome messages, automatic roles, event logging, and activity XP for the Meta home server. Use Discord Developer Mode to copy channel and role IDs. The bot's role must be above any role it assigns.</p>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Welcome channel ID</strong>
                <input value={settings.community_welcome_channel_id || ''} onChange={event => setValue('community_welcome_channel_id', event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Discord text channel ID" style={fieldStyle} inputMode="numeric" />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Welcome message</strong>
                <textarea value={settings.community_welcome_message || ''} onChange={event => setValue('community_welcome_message', event.target.value)} maxLength={1500} rows={4} placeholder="Welcome {user} to {server}! You are member #{membercount}." style={fieldStyle} />
                <small>Placeholders: {'{user}'}, {'{server}'}, {'{membercount}'}. Leave blank to use the built-in welcome message.</small>
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Automatic join role ID</strong>
                <input value={settings.community_autorole_id || ''} onChange={event => setValue('community_autorole_id', event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Discord role ID (optional)" style={fieldStyle} inputMode="numeric" />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>
                <strong>Event log channel ID</strong>
                <input value={settings.community_log_channel_id || ''} onChange={event => setValue('community_log_channel_id', event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Discord text channel ID" style={fieldStyle} inputMode="numeric" />
                <small>Logs member joins/leaves, deleted messages, and channel creation/deletion.</small>
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
                <input type="checkbox" checked={settings.community_xp_enabled !== 'false'} onChange={event => setValue('community_xp_enabled', event.target.checked ? 'true' : 'false')} />
                Enable message activity XP and leveling
              </label>
              <p>Members can use <code>/level</code> and <code>/leaderboard</code>. XP is awarded at most once per minute per member.</p>
            </section>
            <section className="admin-publishing-guide">
              <h2>Automatic partnerships</h2>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                <input type="checkbox" checked={settings.autopartner_enabled === 'true'} onChange={event => setValue('autopartner_enabled', event.target.checked ? 'true' : 'false')} />
                Enable automatic approved-partner posts
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>Announcement channel ID<input value={settings.autopartner_channel_id || ''} onChange={event => setValue('autopartner_channel_id', event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="Discord channel ID" style={fieldStyle} /></label>
              <label style={{ display: 'block', marginTop: 12 }}>Interval (6–168 hours)<input type="number" min={6} max={168} value={settings.autopartner_interval_hours || '24'} onChange={event => setValue('autopartner_interval_hours', event.target.value)} style={fieldStyle} /></label>
              <label style={{ display: 'block', marginTop: 12 }}>Partner message template<textarea value={settings.autopartner_template || ''} onChange={event => setValue('autopartner_template', event.target.value)} placeholder="Use {name}, {invite}, and {description}" rows={4} style={fieldStyle} /></label>
              <p>Automatic posting stays disabled until you enable it, choose a channel, and add at least one partner.</p>
              <h3>Approved partners</h3>
              <div className="admin-content-list">
                {partners.map(partner => <div className="admin-content-list-item" key={partner.id}>
                  <strong>Approved partner</strong>
                  <label style={{ display: 'block', marginTop: 8 }}>Name<input value={partner.name} maxLength={80} onChange={event => setPartners(current => current.map(item => item.id === partner.id ? { ...item, name: event.target.value } : item))} style={fieldStyle} /></label>
                  <label style={{ display: 'block', marginTop: 8 }}>Invite URL<input type="url" value={partner.invite_url} onChange={event => setPartners(current => current.map(item => item.id === partner.id ? { ...item, invite_url: event.target.value } : item))} style={fieldStyle} /></label>
                  <label style={{ display: 'block', marginTop: 8 }}>Description<input value={partner.description} maxLength={300} onChange={event => setPartners(current => current.map(item => item.id === partner.id ? { ...item, description: event.target.value } : item))} style={fieldStyle} /></label>
                  <div className="admin-publishing-actions">
                    <button type="button" className="button-primary" onClick={() => updatePartner(partner)} disabled={busy}>Save partner</button>
                    <button type="button" className="button-secondary" onClick={() => removePartner(partner.id)} disabled={busy}>Remove partner</button>
                  </div>
                </div>)}
                {!partners.length && <p>No approved partners yet.</p>}
              </div>
              <form onSubmit={addPartner} style={{ marginTop: 18 }}>
                <label style={{ display: 'block' }}>Partner name<input required maxLength={80} value={partnerName} onChange={event => setPartnerName(event.target.value)} style={fieldStyle} /></label>
                <label style={{ display: 'block', marginTop: 10 }}>Discord invite URL<input required type="url" value={partnerInvite} onChange={event => setPartnerInvite(event.target.value)} placeholder="https://discord.gg/..." style={fieldStyle} /></label>
                <label style={{ display: 'block', marginTop: 10 }}>Description<input maxLength={300} value={partnerDescription} onChange={event => setPartnerDescription(event.target.value)} style={fieldStyle} /></label>
                <button type="submit" className="button-primary" disabled={busy} style={{ marginTop: 12 }}>Add approved partner</button>
              </form>
            </section>
            <section className="admin-publishing-guide">
              <h2>Server setup template editor</h2>
              <p>Edit the JSON that <code>/setup-server</code> uses. This setup now only creates missing roles, categories, and channels; it does not delete existing channels or message history.</p>
              <textarea value={templateText} onChange={event => setTemplateText(event.target.value)} rows={20} spellCheck={false} style={{ ...fieldStyle, fontFamily: 'monospace' }} />
              <button type="button" className="button-secondary" onClick={() => setTemplateText(defaultTemplate)} style={{ marginTop: 10 }}>Reset editor to built-in template</button>
            </section>
          </>}
          <section className="admin-publishing-guide">
            <h2>More commands added</h2>
            <p><code>/thread</code> starts a public discussion, <code>/topic</code> updates a channel topic with staff permission, <code>/randomcolor</code> creates a hex color, and <code>/remindme</code> DMs a reminder (reminders are temporary and are lost if the bot restarts).</p>
            <p>Changes save to the bot's local database shared with the running bot. Some slash-command visibility changes may require a bot restart to refresh Discord's command list.</p>
          </section>
        </>}
      </main>
    </AppShell>
  );
}

function NotFound() {
  return (
    <AppShell>
      <main className="not-found">
        <div className="not-found-inner">
          <span className="not-found-mark"><Compass aria-hidden="true" /></span>
          <p className="section-kicker">Off the map</p>
          <h1>That path isn’t here.</h1>
          <p>The page may have moved, or this lesson is still waiting to be added. Your next useful step is right back at Meta.</p>
          <Link href="/" className="button-primary" data-testid="button-return-home">Return to the academy <ArrowRight aria-hidden="true" /></Link>
        </div>
      </main>
    </AppShell>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'signed-in' | 'signed-out'>('checking');

  useEffect(() => {
    let active = true;
    const emailCheck = fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) return null;
        const data = await response.json().catch(() => ({}));
        return data?.user?.id != null ? `email-${String(data.user.id)}` : null;
      })
      .catch(() => null);
    const discordCheck = fetch('/api/auth/discord/me', { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) return null;
        const data = await response.json().catch(() => ({}));
        return data?.authenticated && data?.user?.id != null ? `discord-${String(data.user.id)}` : null;
      })
      .catch(() => null);

    Promise.all([emailCheck, discordCheck]).then(([emailScope, discordScope]) => {
      if (!active) return;
      const scope = emailScope || discordScope;
      const previousScope = currentAccountScope();
      try {
        if (scope) localStorage.setItem(ACTIVE_ACCOUNT_KEY, scope);
        else localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      } catch {
        // If storage is blocked, the page still works with guest-only local state.
      }
      if ((scope || 'guest') !== previousScope) window.dispatchEvent(new CustomEvent(ACCOUNT_SCOPE_EVENT));
      setStatus(scope ? 'signed-in' : 'signed-out');
    });
    return () => { active = false; };
  }, []);

  if (status === 'checking') return <main className="page-container"><p>Checking sign-in…</p></main>;
  if (status === 'signed-out') {
    const next = window.location.pathname + window.location.search;
    return <Redirect to={`/sign-in?next=${encodeURIComponent(next)}`} />;
  }
  return <>{children}</>;
}

function UserPortal() {
  return <HomePage />;
}
function MainRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/admin" component={AdminPublishingPage} />
      <Route path="/ai" component={() => <ProtectedRoute><MetaAIPage /></ProtectedRoute>} />
      <Route path="/bot-control" component={BotControlPage} />
      <Route path="/user-portal" component={() => <ProtectedRoute><UserPortal /></ProtectedRoute>} />
      <Route path="/learn/:lessonId" component={() => <ProtectedRoute><LessonPage /></ProtectedRoute>} />
      <Route path="/play" component={() => <ProtectedRoute><PlayPage /></ProtectedRoute>} />
      <Route path="/play/:track" component={() => <ProtectedRoute><PlayPage /></ProtectedRoute>} />
      <Route path="/playground" component={() => <AppShell><CodePlaygroundPage /></AppShell>} />
      <Route path="/account" component={() => <ProtectedRoute><AccountSettingsPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId" component={() => <ProtectedRoute><ProjectPage /></ProtectedRoute>} />
      <Route path="/projects" component={() => <ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/settings" component={() => <ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/delete-account" component={DeleteAccountPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/sign-in/*?" component={LoginPage} />
      <Route path="/sign-up/*?" component={LoginPage} />
      <Route component={NotFound} />
    </Switch>
  );
}
function Router() {
  return (
    <WouterRouter base={basePath}>
      <MainRoutes />
    </WouterRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router />
    </ThemeProvider>
  );
}

export default App;