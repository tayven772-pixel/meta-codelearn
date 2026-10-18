
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import JSZip from 'jszip';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ClipboardCheck,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Code2,
  Compass,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  EyeOff,
  Moon,
  FolderKanban,
  Settings,
  CreditCard,
  Download,
  Eye,
  FileCode2,
  MessageSquare,
  Pause,
  Plus,
  Send,
  Play,
  Search,
  Sparkles,
  Crown,
  Menu,
  Palette,
  Shield,
  Star,
  Sun,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { languageFor, languages, lessonFor, lessons, type LearnerSkillLevel, type Lesson, type Progress } from './data/academy';
import { getProgressionStats, learnerSkillLevels } from './data/progression';
import CodePlaygroundPage from './CodePlayground';
import GlobalSearch from './GlobalSearch';
import './code-playground.css';
import './global-search.css';

const PROGRESS_KEY = 'meta-progress-v1';
const LEGACY_PROGRESS_KEY = 'code-atlas-progress-v1';
const PROGRESS_EVENT = 'meta-progress-sync';
const LANGUAGE_KEY = 'meta-language-v1';
const THEME_KEY = 'meta-theme-v1';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

type PlayTrack = {
  id: string;
  title: string;
  shortTitle: string;
  codeLabel: string;
  usedFor: string;
  mainFunctions: string[];
  description: string;
  outcome: string;
  skills: string[];
  projects: string[];
};

const playTracks: PlayTrack[] = [
  {
    id: 'games',
    title: 'Game Development',
    shortTitle: 'Games',
    codeLabel: 'JavaScript / HTML / CSS',
    usedFor: 'Browser games and interactive web projects.',
    mainFunctions: ['Input and controls', 'Game state and scoring', 'Collision checks', 'Loops and timers'],
    description: 'Learn loops, input, state, collisions, scoring, and game logic by building small playable projects.',
    outcome: 'Build a playable browser game from a blank project.',
    skills: ['Game loops', 'Input', 'State', 'Collision logic'],
    projects: ['Clicker challenge', 'Dodge game', 'Top-down arena'],
  },
  {
    id: 'websites',
    title: 'Website Development',
    shortTitle: 'Websites',
    codeLabel: 'HTML / CSS / JavaScript',
    usedFor: 'Web pages, layouts, forms, and interactive interfaces.',
    mainFunctions: ['Page structure', 'Responsive styling', 'Events and buttons', 'Form validation'],
    description: 'Build responsive pages while learning HTML, CSS, JavaScript, layout, components, and accessibility.',
    outcome: 'Publish a responsive multi-section website.',
    skills: ['HTML', 'CSS', 'Responsive design', 'JavaScript'],
    projects: ['Profile page', 'Landing page', 'Interactive dashboard'],
  },
  {
    id: 'apps',
    title: 'App Development',
    shortTitle: 'Apps',
    codeLabel: 'JavaScript / TypeScript (plus HTML and CSS)',
    usedFor: 'App-style interfaces, navigation, and saved user data.',
    mainFunctions: ['UI state', 'Navigation', 'Input validation', 'Local persistence'],
    description: 'Turn ideas into useful apps with interfaces, navigation, saved data, validation, and mobile-first design.',
    outcome: 'Build an installable app-style project with persistent data.',
    skills: ['UI state', 'Navigation', 'Forms', 'Persistence'],
    projects: ['To-do app', 'Study tracker', 'Habit dashboard'],
  },
  {
    id: 'roblox',
    title: 'Roblox Studio',
    shortTitle: 'Roblox',
    codeLabel: 'Luau (Roblox Studio)',
    usedFor: 'Roblox game scripts, parts, player actions, and gameplay systems.',
    mainFunctions: ['Variables and functions', 'Events such as Touched', 'Players and characters', 'Parts, UI, and ModuleScripts'],
    description: 'Learn Luau through Roblox-style gameplay systems, interactions, UI, events, and reusable modules.',
    outcome: 'Build a small Roblox gameplay system you understand line by line.',
    skills: ['Luau', 'Events', 'Parts', 'ModuleScripts'],
    projects: ['Coin pickup', 'Checkpoint system', 'Round manager'],
  },
  {
    id: 'mcbe',
    title: 'Minecraft Bedrock Add-ons',
    shortTitle: 'MCBE',
    codeLabel: 'JSON + JavaScript (Bedrock Script API)',
    usedFor: 'Bedrock add-ons: behavior/resource packs, item and entity definitions, and supported scripting.',
    mainFunctions: ['Pack manifests', 'JSON definitions', 'Events and commands through supported APIs', 'Custom items and entities'],
    description: 'Learn Bedrock behavior/resource pack structure, JSON, Script API basics, custom items, entities, and gameplay systems.',
    outcome: 'Build a working .mcaddon-ready project structure.',
    skills: ['Manifests', 'JSON', 'Script API', 'Behavior packs'],
    projects: ['Custom item', 'Queue command', 'Practice utility'],
  },
  {
    id: 'mcje',
    title: 'Minecraft Java Edition',
    shortTitle: 'MCJE',
    codeLabel: 'Minecraft Java commands + JSON',
    usedFor: 'Java Edition datapacks, functions, predicates, loot tables, and resource packs.',
    mainFunctions: ['Functions and commands', 'Predicates', 'Loot tables', 'Advancements and resource-pack JSON'],
    description: 'Learn Java Edition commands, datapacks, resource packs, and the concepts behind server-side gameplay systems.',
    outcome: 'Build a reusable Java Edition datapack project.',
    skills: ['Datapacks', 'Functions', 'Predicates', 'Resource packs'],
    projects: ['Custom advancement', 'Arena functions', 'Utility datapack'],
  },
  {
    id: 'mcje-mods',
    title: 'Minecraft Java Mods',
    shortTitle: 'MCJE Mods',
    codeLabel: 'Java (mod loader APIs)',
    usedFor: 'Minecraft Java mods with a compatible loader and game version.',
    mainFunctions: ['Registries', 'Events', 'Custom items and blocks', 'Mod configuration'],
    description: 'Learn Java mod structure, registries, events, items, blocks, and gameplay features with a guided modding path.',
    outcome: 'Build a small Java mod with a custom gameplay feature.',
    skills: ['Java', 'Registries', 'Events', 'Items & blocks'],
    projects: ['Custom item', 'Custom block', 'Simple combat mechanic'],
  },
];

type MetaProjectMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type MetaProject = {
  id: string;
  name: string;
  type: string;
  files?: Record<string, string>;
  messages?: MetaProjectMessage[];
  createdAt?: number;
  updatedAt?: number;
};

const PROJECTS_KEY = 'meta-projects-v2';
const ACTIVE_ACCOUNT_KEY = 'meta-active-account-v1';
const ACCOUNT_SCOPE_EVENT = 'meta-account-scope-change';

function currentAccountScope(): string {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || 'guest';
  } catch {
    return 'guest';
  }
}

function projectsStorageKey(): string {
  const scope = currentAccountScope();
  return scope === 'guest' ? PROJECTS_KEY : `${PROJECTS_KEY}:${scope}`;
}

function readProjects(): MetaProject[] {
  const storageKey = projectsStorageKey();
  try {
    const next = localStorage.getItem(storageKey);
    if (next) return JSON.parse(next) as MetaProject[];
    // Only migrate the old v1 project format for guest data. Signed-in accounts
    // never silently inherit another account's or the browser's existing projects.
    if (currentAccountScope() !== 'guest') return [];
    const legacy = localStorage.getItem('meta-projects-v1');
    if (!legacy) return [];
    const migrated = (JSON.parse(legacy) as Array<{ id: string; name: string; type: string }>).map((project) => ({
      ...project,
      files: {},
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    localStorage.setItem(storageKey, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function writeProjects(projects: MetaProject[]) {
  try {
    localStorage.setItem(projectsStorageKey(), JSON.stringify(projects));
  } catch {
    // Keep projects in memory when storage is unavailable.
  }
}

const META_STRIPE_TEST_LINKS: Record<string, string> = {
  builder: 'https://buy.stripe.com/test_bJedR1cBEfOo2Yx3fzeEo00',
  pro: 'https://buy.stripe.com/test_00w14f4580Tu8iRg2leEo01',
};

type Plan = {
  id: 'free' | 'builder' | 'pro';
  name: string;
  price: string;
  cadence: string;
  monthly: number;
  annual: number | null;
  aiCredits: number;
  projects: number;
  description: string;
  bestFor: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const aiPlans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    monthly: 0,
    annual: 0,
    aiCredits: 40,
    projects: 3,
    description: 'Learn, try the agent, and keep a few active projects.',
    bestFor: 'Trying Meta out and learning the foundations.',
    features: [
      `All ${lessons.length} foundation lessons with quizzes`,
      'All 7 Lesson Play build tracks',
      '40 AI credits every month',
      'Up to 3 active projects',
      'Levels, XP, and milestone rewards',
      'Progress saved to your account',
    ],
    cta: 'Start free',
  },
  {
    id: 'builder',
    name: 'Builder',
    price: '$4.99',
    cadence: 'per month',
    monthly: 4.99,
    annual: 49,
    aiCredits: 500,
    projects: 25,
    description: 'For learners building websites, games, apps, and Minecraft projects regularly.',
    bestFor: 'Weekly project work with room to experiment.',
    features: [
      'Everything in Free',
      '500 AI credits every month',
      'Up to 25 active projects',
      'Project-aware AI context',
      'Faster AI responses',
      'Email support',
    ],
    cta: 'Choose Builder',
    featured: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    cadence: 'per month',
    monthly: 9.99,
    annual: 99,
    aiCredits: 2000,
    projects: -1,
    description: 'For heavier project work with a much larger AI allowance.',
    bestFor: 'Shipping real projects and long AI sessions.',
    features: [
      'Everything in Builder',
      '2,000 AI credits every month',
      'Unlimited active projects',
      'Largest AI context window',
      'Priority AI queue',
      'Priority support',
    ],
    cta: 'Choose Pro',
  },
];



type ThemeMode = 'light' | 'dark';
type ThemeContextValue = { theme: ThemeMode; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => undefined,
});

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Keep the selected theme for this session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    async function resolveAccountScope() {
      const [emailScope, discordScope] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'same-origin' })
          .then(async response => {
            if (!response.ok) return null;
            const data = await response.json().catch(() => ({}));
            return data?.user?.id != null ? `email-${String(data.user.id)}` : null;
          }).catch(() => null),
        fetch('/api/auth/discord/me', { credentials: 'same-origin' })
          .then(async response => {
            if (!response.ok) return null;
            const data = await response.json().catch(() => ({}));
            return data?.authenticated && data?.user?.id != null ? `discord-${String(data.user.id)}` : null;
          }).catch(() => null),
      ]);
      if (!active) return;
      const nextScope = emailScope || discordScope || 'guest';
      const previousScope = currentAccountScope();
      try {
        if (nextScope === 'guest') localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
        else localStorage.setItem(ACTIVE_ACCOUNT_KEY, nextScope);
      } catch { /* The site can still be browsed if local storage is unavailable. */ }
      if (previousScope !== nextScope) window.dispatchEvent(new CustomEvent(ACCOUNT_SCOPE_EVENT));
    }
    resolveAccountScope();
    return () => { active = false; };
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  return useContext(ThemeContext);
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Use ${nextTheme} theme`}
      aria-pressed={theme === 'dark'}
      title={`Use ${nextTheme} theme`}
      data-testid="button-theme-toggle"
    >
      {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      <span className="theme-toggle-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}

function readProgress(storageKey: string): Progress {
  try {
    const legacyProgress = storageKey === `${PROGRESS_KEY}:guest`
      ? localStorage.getItem(LEGACY_PROGRESS_KEY)
      : null;
    const stored = localStorage.getItem(storageKey) ?? legacyProgress;
    const parsed = stored ? JSON.parse(stored) as Progress : null;
    if (parsed && Array.isArray(parsed.completedLessonIds)) {
      if (legacyProgress && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
      return parsed;
    }
    return { completedLessonIds: [] };
  } catch {
    return { completedLessonIds: [] };
  }
}

function useProgress() {
  const isLoaded = true;
  const [storageKey, setStorageKey] = useState(() => `${PROGRESS_KEY}:${currentAccountScope()}`);
  useEffect(() => {
    const refreshScope = () => setStorageKey(`${PROGRESS_KEY}:${currentAccountScope()}`);
    const onStorage = (event: StorageEvent) => { if (event.key === ACTIVE_ACCOUNT_KEY) refreshScope(); };
    window.addEventListener(ACCOUNT_SCOPE_EVENT, refreshScope);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(ACCOUNT_SCOPE_EVENT, refreshScope); window.removeEventListener('storage', onStorage); };
  }, []);
  const [snapshot, setSnapshot] = useState(() => ({
    storageKey,
    progress: readProgress(storageKey),
  }));
  const progress = snapshot.storageKey === storageKey
    ? snapshot.progress
    : readProgress(storageKey);

  useEffect(() => {
    if (snapshot.storageKey !== storageKey) {
      setSnapshot({ storageKey, progress: readProgress(storageKey) });
    }
  }, [snapshot.storageKey, storageKey]);

  useEffect(() => {
    if (!isLoaded || snapshot.storageKey !== storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(snapshot.progress));
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { storageKey } }));
  }, [isLoaded, snapshot, storageKey]);

  useEffect(() => {
    const syncProgress = (event: Event) => {
      if (event.type === 'storage' && (event as StorageEvent).key !== storageKey) return;
      const eventKey = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey;
      if (event.type === PROGRESS_EVENT && eventKey !== storageKey) return;
      const next = readProgress(storageKey);
      setSnapshot((current) => (
        current.storageKey === storageKey &&
        current.progress.completedLessonIds.join('|') === next.completedLessonIds.join('|') &&
        (current.progress.completedQuizLessonIds ?? []).join('|') === (next.completedQuizLessonIds ?? []).join('|') &&
        current.progress.skillLevel === next.skillLevel
          ? current
          : { storageKey, progress: next }
      ));
    };
    window.addEventListener(PROGRESS_EVENT, syncProgress);
    window.addEventListener('storage', syncProgress);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, syncProgress);
      window.removeEventListener('storage', syncProgress);
    };
  }, [storageKey]);

  const complete = (lessonId: string) => setSnapshot((current) => {
    const currentProgress = current.storageKey === storageKey
      ? current.progress
      : readProgress(storageKey);
    return currentProgress.completedLessonIds.includes(lessonId)
      ? current
      : {
          storageKey,
          progress: {
            ...currentProgress,
            completedLessonIds: [...currentProgress.completedLessonIds, lessonId],
          },
        };
  });

  const completeQuiz = (lessonId: string) => setSnapshot((current) => {
    const currentProgress = current.storageKey === storageKey
      ? current.progress
      : readProgress(storageKey);
    const completedQuizLessonIds = currentProgress.completedQuizLessonIds ?? [];
    return completedQuizLessonIds.includes(lessonId)
      ? current
      : {
          storageKey,
          progress: {
            ...currentProgress,
            completedQuizLessonIds: [...completedQuizLessonIds, lessonId],
          },
        };
  });

  const setSkillLevel = (skillLevel: LearnerSkillLevel) => setSnapshot((current) => {
    const currentProgress = current.storageKey === storageKey
      ? current.progress
      : readProgress(storageKey);
    return currentProgress.skillLevel === skillLevel
      ? current
      : { storageKey, progress: { ...currentProgress, skillLevel } };
  });

  return { progress, complete, completeQuiz, setSkillLevel };
}

const NAV_LINKS = [
  { href: '/', label: 'Explore', icon: Compass },
  { href: '/play', label: 'Lessons', icon: BookOpen },
  { href: '/playground', label: 'Playground', icon: Code2 },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/pricing', label: 'Pricing', icon: Tag },
];

function Header({ progressCount }: { progressCount: number }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const completion = Math.round((progressCount / lessons.length) * 100);

  useEffect(() => { setMenuOpen(false); }, [location]);

  useEffect(() => {
    let active = true;
    async function checkHeaderSession() {
      const [emailResult, discordResult] = await Promise.allSettled([
        fetch('/api/auth/me', { credentials: 'same-origin' }),
        fetch('/api/auth/discord/me', { credentials: 'same-origin' }),
      ]);
      let emailSignedIn = false;
      let discordSignedIn = false;
      if (emailResult.status === 'fulfilled' && emailResult.value.ok) {
        const data = await emailResult.value.json().catch(() => ({}));
        emailSignedIn = Boolean(data?.user);
      }
      if (discordResult.status === 'fulfilled' && discordResult.value.ok) {
        const data = await discordResult.value.json().catch(() => ({}));
        discordSignedIn = Boolean(data?.authenticated && data?.user);
      }
      if (active) {
        setSignedIn(emailSignedIn || discordSignedIn);
        setAuthChecked(true);
      }
    }
    checkHeaderSession().catch(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, [location]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      const responses = await Promise.all([
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }),
        fetch('/api/auth/discord/logout', { method: 'POST', credentials: 'same-origin' }),
      ]);
      if (responses.some((response) => !response.ok)) {
        throw new Error('One or more sign-out requests failed.');
      }
      setSignedIn(false);
      setMenuOpen(false);
      try { localStorage.removeItem(ACTIVE_ACCOUNT_KEY); } catch { /* storage may be unavailable */ }
      window.dispatchEvent(new CustomEvent(ACCOUNT_SCOPE_EVENT));
      setLocation('/sign-in');
    } catch {
      setSignOutError('Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const isActive = (href: string) => (href === '/' ? location === '/' : location.startsWith(href));

  return (
    <header className="topbar">
      <Link href="/" className="brand" data-testid="link-academy-home" aria-label="Meta home">
        <img className="brand-image" src="/meta-logo.svg" alt="Meta" />
      </Link>

      <nav className="top-nav" aria-label="Primary">
        {NAV_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`top-nav-link${isActive(item.href) ? ' is-active' : ''}`}
            aria-current={isActive(item.href) ? 'page' : undefined}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="top-actions">
        <span className="top-progress" data-testid="status-lessons-completed" title={`${progressCount} of ${lessons.length} lessons complete`}>
          <span className="progress-dot" />
          <span className="top-progress-text">{progressCount} / {lessons.length} lessons</span>
          <span className="top-progress-track" aria-hidden="true"><span className="top-progress-fill" style={{ width: `${completion}%` }} /></span>
        </span>
        <GlobalSearch />
        <ThemeToggle />
        {authChecked && signedIn && (
          <button type="button" className="header-signout-button" onClick={() => void handleSignOut()} disabled={signingOut} data-testid="button-header-sign-out">
            <LogOut aria-hidden="true" />
            <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        )}
        <Link href="/pricing" className="nav-cta" data-testid="link-nav-upgrade">Get Meta Pro</Link>
        <button
          type="button"
          className="mobile-menu-button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          data-testid="button-mobile-menu"
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-nav-panel">
          <div className="mobile-nav-tools" aria-label="Mobile quick controls">
            <GlobalSearch />
            <ThemeToggle />
          </div>
          <nav className="mobile-nav-links" aria-label="Mobile navigation">
            {NAV_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
            {authChecked && (signedIn ? (
              <button type="button" className="mobile-nav-link mobile-nav-action" onClick={() => void handleSignOut()} disabled={signingOut} data-testid="button-menu-sign-out">
                <LogOut aria-hidden="true" />
                <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
                <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <Link href="/sign-in" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                <LockKeyhole aria-hidden="true" />
                <span>Sign in</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
            {signOutError && <p className="header-signout-error" role="alert">{signOutError}</p>}
          </nav>
        </div>
      )}
    </header>
  );
}

function AppShell({ children, showBottomNav = true, showHeader = true }: { children: ReactNode; showBottomNav?: boolean; showHeader?: boolean }) {
  const { progress } = useProgress();
  const [location] = useLocation();
  const isActiveDestination = (href: string) => {
    if (href === '/') return location === '/';
    if (href === '/play') return location.startsWith('/play') || location.startsWith('/learn');
    return location === href || location.startsWith(`${href}/`);
  };
  return (
    <div className="app-shell">
      {showHeader && <Header progressCount={progress.completedLessonIds.length} />}
      {children}
      {showBottomNav && (
        <nav className="bottom-workspace-nav" aria-label="Main navigation">
          <Link href="/" className={`bottom-workspace-button${isActiveDestination('/') ? ' active' : ''}`} aria-current={isActiveDestination('/') ? 'page' : undefined} aria-label="Explore" data-testid="button-home">
            <Compass aria-hidden="true" />
            <span>Explore</span>
          </Link>
          <Link href="/play" className={`bottom-workspace-button${isActiveDestination('/play') ? ' active' : ''}`} aria-current={isActiveDestination('/play') ? 'page' : undefined} aria-label="Lessons" data-testid="button-lessons">
            <BookOpen aria-hidden="true" />
            <span>Lessons</span>
          </Link>
          <Link href="/projects" className={`bottom-workspace-button${isActiveDestination('/projects') ? ' active' : ''}`} aria-current={isActiveDestination('/projects') ? 'page' : undefined} aria-label="Projects" data-testid="button-projects">
            <FolderKanban aria-hidden="true" />
            <span>Projects</span>
          </Link>
          <Link href="/pricing" className={`bottom-workspace-button${isActiveDestination('/pricing') ? ' active' : ''}`} aria-current={isActiveDestination('/pricing') ? 'page' : undefined} aria-label="Plans and pricing" data-testid="button-pricing">
            <Tag aria-hidden="true" />
            <span>Plans</span>
          </Link>
          <Link href="/settings" className={`bottom-workspace-button${isActiveDestination('/settings') ? ' active' : ''}`} aria-current={isActiveDestination('/settings') ? 'page' : undefined} aria-label="Settings" data-testid="button-settings">
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </Link>
        </nav>
      )}
    </div>
  );
}

function HomePage() {
  const { progress, setSkillLevel } = useProgress();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All paths');
  const [level, setLevel] = useState('All levels');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return languages.filter((language) => {
      const matchesSearch = !query || `${language.name} ${language.category} ${language.description}`.toLowerCase().includes(query);
      const matchesCategory = category === 'All paths' || language.category === category;
      const matchesLevel = level === 'All levels' || language.level === level;
      return matchesSearch && matchesCategory && matchesLevel;
    });
  }, [search, category, level]);
  const completedLessonIds = new Set(progress.completedLessonIds);
  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const nextLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.id));
  const nextLessonIndex = nextLesson ? lessons.findIndex((lesson) => lesson.id === nextLesson.id) : -1;
  const completion = Math.min(100, (completedCount / lessons.length) * 100);
  const resetLanguageFilters = () => {
    setSearch('');
    setCategory('All paths');
    setLevel('All levels');
  };

  return (
    <AppShell>
      <main className="home-main">
        <section className="hero" aria-labelledby="home-heading">
          <div className="hero-copy-block">
            <div className="eyebrow"><span className="eyebrow-line" /> A hands-on academy for curious minds</div>
            <h1 id="home-heading">Learn the idea.<br /><em>Then the code.</em></h1>
            <p className="hero-typewriter">
              <span className="hero-typewriter-sr-only">Make games, websites, apps, AI tools, Roblox games, and Minecraft mods.</span>
              <span className="hero-typewriter-visual" aria-hidden="true">
                <span>Make </span>
                <span className="hero-typewriter-rotator">
                  <span className="hero-typewriter-word typewriter-games">games</span>
                  <span className="hero-typewriter-word typewriter-websites">websites</span>
                  <span className="hero-typewriter-word typewriter-apps">apps</span>
                  <span className="hero-typewriter-word typewriter-ai-tools">AI tools</span>
                  <span className="hero-typewriter-word typewriter-roblox">Roblox games</span>
                  <span className="hero-typewriter-word typewriter-minecraft">Minecraft mods</span>
                </span>
              </span>
            </p>
            <p className="hero-copy">Programming makes more sense when you can see the same idea in different languages. Start with the shared foundations, then follow the syntax wherever your curiosity goes.</p>
            <div className="hero-actions">
              <Link
                href={nextLesson ? `/learn/${nextLesson.id}` : '/play'}
                className="button-primary"
                data-testid="button-start-learning"
              >
                {nextLesson ? (completedCount > 0 ? 'Continue learning' : 'Start learning') : 'Explore build tracks'}
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="/pricing" className="button-ghost" data-testid="link-hero-pricing">See plans &amp; pricing <Tag aria-hidden="true" /></Link>
              <a href="#language-library" className="text-link" data-testid="link-browse-languages">Browse languages <ArrowRight aria-hidden="true" /></a>
            </div>
            <p className="hero-progress-note" role="status">
              {nextLesson ? (
                <>
                  <span className="progress-dot" aria-hidden="true" />
                  <span>{completedCount > 0 ? 'Up next' : 'Your first step'} · <strong>Lesson {String(nextLessonIndex + 1).padStart(2, '0')}: {nextLesson.title}</strong> · {completedCount} of {lessons.length} complete
                </span>
                </>
              ) : (
                <>
                  <CheckCircle2 aria-hidden="true" />
                  <span><strong>Foundation complete.</strong> You finished all {lessons.length} lessons. Ready to build something?</span>
                </>
              )}
            </p>
            <ul className="hero-trust">
              <li><Check aria-hidden="true" /> Free lessons, no card required</li>
              <li><Check aria-hidden="true" /> 12 language paths &amp; 7 build tracks</li>
              <li><Check aria-hidden="true" /> AI plans from $4.99/month</li>
            </ul>
          </div>
          <div className="hero-visual" aria-label="A sample code card showing a greeting in Python">
            <span className="hero-note">FIG. 01 / THE FIRST OUTPUT</span>
            <div className="atlas-card">
              <div className="code-window-head">
                <span className="window-dots"><i /><i /><i /></span>
                <span>hello_world.py</span>
                <span>PY</span>
              </div>
              <div className="code-row"><span className="line-no">01</span><span><span className="code-comment"># A tiny program, a big first step</span></span></div>
              <div className="code-row"><span className="line-no">02</span><span><span className="code-key">print</span>(<span className="code-string">"Hello, world!"</span>)</span></div>
              <div className="code-row"><span className="line-no">03</span><span>&nbsp;</span></div>
              <div className="code-row"><span className="line-no">04</span><span><span className="code-comment"># One idea. Many ways to write it.</span></span></div>
            </div>
            <div className="visual-stamp"><span><b>12</b><br />ways to begin</span></div>
          </div>
        </section>

        <section className="momentum-panel" aria-labelledby="momentum-heading">
          <div className="momentum-intro">
            <p className="section-kicker">Your learning dashboard</p>
            <h2 id="momentum-heading">Small steps. <em>Real progress.</em></h2>
            <p>Keep your momentum going. Every completed foundation lesson adds 25 XP and unlocks milestones.</p>
            <div className="momentum-progress-copy"><span>{completedCount} of {lessons.length} lessons</span><strong>{Math.round(completion)}%</strong></div>
            <div className="momentum-progress-track" role="progressbar" aria-label="Lesson completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(completion)}><span style={{ width: `${completion}%` }} /></div>
          </div>
          <div className="momentum-stats">
            <article className="momentum-xp-card"><span className="momentum-stat-icon"><Zap aria-hidden="true" /></span><span className="momentum-stat-label">Total XP</span><strong>{completedCount * 25}</strong><small>Earned from lessons</small></article>
            <article className={completedCount >= 1 ? 'momentum-badge unlocked' : 'momentum-badge'}><span className="momentum-badge-icon"><Star aria-hidden="true" /></span><strong>First step</strong><small>{completedCount >= 1 ? 'Unlocked · First lesson complete' : 'Complete one lesson to unlock'}</small></article>
            <article className={completedCount >= 5 ? 'momentum-badge unlocked' : 'momentum-badge'}><span className="momentum-badge-icon"><Zap aria-hidden="true" /></span><strong>Momentum</strong><small>{completedCount >= 5 ? 'Unlocked · Five lessons complete' : `${Math.max(0, 5 - completedCount)} more lesson${5 - completedCount === 1 ? '' : 's'} to unlock`}</small></article>
            <article className={completedCount >= lessons.length ? 'momentum-badge unlocked' : 'momentum-badge'}><span className="momentum-badge-icon"><CheckCircle2 aria-hidden="true" /></span><strong>Foundation graduate</strong><small>{completedCount >= lessons.length ? 'Unlocked · Foundation complete' : 'Finish every foundation lesson'}</small></article>
          </div>
          <Link href="/playground" className="momentum-playground-link"><Code2 aria-hidden="true" /><span><strong>Ready to build something?</strong><small>Try your ideas in the interactive code playground.</small></span><ArrowRight aria-hidden="true" /></Link>
        </section>

        <PublishedContentSection />

        <section className="section" id="language-library" aria-labelledby="library-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">The language library / 01—12</p>
              <h2 id="library-heading">Pick a path to explore.</h2>
              <p className="section-sub">One shared foundation, expressed in the language you want to learn.</p>
            </div>
            <div className="catalog-tools">
              <label className="search-wrap">
                <Search aria-hidden="true" />
                <input
                  className="search-input"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a language..."
                  aria-label="Search languages"
                  data-testid="input-search-languages"
                />
              </label>
              <select aria-label="Filter by category" className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)} data-testid="select-language-category">
                <option>All paths</option><option>Web</option><option>General</option><option>Systems</option><option>Data</option>
              </select>
              <select aria-label="Filter by level" className="filter-select" value={level} onChange={(event) => setLevel(event.target.value)} data-testid="select-language-level">
                <option>All levels</option><option>Beginner friendly</option><option>Beginner</option><option>Foundational</option>
              </select>
            </div>
          </div>
          <div className="catalog-result-summary" role="status" aria-live="polite">
            <span>Showing <strong>{filtered.length}</strong> of {languages.length} language paths</span>
            {(search || category !== 'All paths' || level !== 'All levels') && (
              <button type="button" className="catalog-reset-button" onClick={resetLanguageFilters}>Clear filters <X aria-hidden="true" /></button>
            )}
          </div>
          <div className="language-grid" data-testid="list-language-catalog" aria-live="polite">
            {filtered.map((language, index) => (
              <Link
                href="/learn/output"
                key={language.id}
                className="language-card"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms`, '--tile-color': tileHue(language.id) } as CSSProperties}
                onClick={() => localStorage.setItem(LANGUAGE_KEY, language.id)}
                data-testid={`card-language-${language.id}`}
                aria-label={`Start learning in ${language.name}`}
              >
                <span className="language-card-top">
                  <span className="language-name">{language.name}</span>
                  <span className="language-initial">{language.name.slice(0, 2).toUpperCase()}</span>
                </span>
                <span className="language-description">{language.description}</span>
                <span className="language-meta">
                  <span className="level-label">{language.level}</span>
                  <code className="mini-code">{language.sampleCode}</code>
                </span>
              </Link>
            ))}
            {filtered.length === 0 && (
              <div className="empty-results" data-testid="empty-language-results">
                <strong>No paths found just yet.</strong>
                Try another search, or reset the filters to see the full library.
              </div>
            )}
          </div>
          <div className="library-note" data-testid="text-growing-library">
            <Compass aria-hidden="true" />
            <span><strong>These are twelve good places to begin, not the whole map.</strong> Meta teaches the foundations shared across programming and keeps adding new language paths as the library grows.</span>
          </div>
        </section>

        <PricingTeaser />

        <LessonPlaySection />

        <section className="pathway" id="learning-path" aria-labelledby="path-heading">
          <div className="pathway-intro">
            <p className="section-kicker">Your learning path · {lessons.length} lessons</p>
            <h2 id="path-heading">A little progress<br />adds up.</h2>
            <p>Short, guided lessons make the big ideas feel small enough to try. No setup, no pressure — just one useful concept at a time.</p>
            <div className="path-progress" data-testid="status-path-progress">
              <span>{completedCount} of {lessons.length} complete</span>
              <span className="progress-track" aria-hidden="true"><span className="progress-fill" style={{ width: `${completion}%` }} /></span>
            </div>
          </div>
          <div className="lesson-list">
            {lessons.map((lesson, index) => {
              const done = completedLessonIds.has(lesson.id);
              const isNext = nextLesson?.id === lesson.id;
              return (
                <Link href={`/learn/${lesson.id}`} className={`lesson-link${done ? ' done' : ''}${isNext ? ' next-up' : ''}`} key={lesson.id} data-testid={`link-lesson-${lesson.id}`}>
                  <span className="lesson-index">{done ? <Check aria-label="Complete" /> : String(index + 1).padStart(2, '0')}</span>
                  <span className="lesson-link-text"><strong>{lesson.title}</strong><small>{lesson.concept} · {lesson.duration}{isNext ? ' · UP NEXT' : ''}</small></span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
        <ProgressionSection progress={progress} onSkillLevelChange={setSkillLevel} />
        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link href="/" className="brand" aria-label="Meta home">
                <img className="brand-image" src="/meta-logo.svg" alt="Meta" />
              </Link>
              <p>Learn the idea, then the code. Free, hands-on programming lessons for games, websites, apps, Roblox, and Minecraft.</p>
              <Link href="/pricing" className="footer-cta" data-testid="link-footer-pricing">Compare plans <ArrowRight aria-hidden="true" /></Link>
            </div>
            <nav className="footer-col" aria-label="Learn">
              <h3>Learn</h3>
              <Link href="/play">Lesson Play</Link>
              <a href="/#language-library">Language library</a>
              <a href="/#learning-path">Foundation lessons</a>
              <Link href="/projects">Projects</Link>
            </nav>
            <nav className="footer-col" aria-label="Account">
              <h3>Account</h3>
              <Link href="/pricing">Plans &amp; pricing</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/account">Account &amp; privacy</Link>
              <Link href="/sign-in">Sign in</Link>
            </nav>
            <nav className="footer-col" aria-label="Company">
              <h3>Company</h3>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/delete-account">Delete account</Link>
              <a href="/downloads/Meta-latest.apk" download="Meta.apk">Android app (APK)</a>
              <a href="mailto:metasupport43@gmail.com">Support</a>
            </nav>
          </div>
          <div className="footer-base">
            <span>© {new Date().getFullYear()} Meta — Learn the idea, then the code.</span>
            <span>Built for curious minds.</span>
          </div>
        </footer>
      </main>
    </AppShell>
  );
}



function PublishedContentSection() {
  const [items, setItems] = useState<Array<{ id: number; title: string; content_type: string; summary: string; body: string; published_at: string | null }>>([]);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/content', { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : { items: [] })
      .then(data => { if (active && Array.isArray(data.items)) setItems(data.items); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  return (
    <section className="published-content-section" aria-labelledby="published-content-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">From the Meta team</p>
          <h2 id="published-content-heading">Updates & new learning</h2>
          <p className="section-sub">New notes, announcements, and learning resources published by Meta.</p>
        </div>
      </div>
      <div className="published-content-grid">
        {items.map(item => (
          <article className="published-content-card" key={item.id}>
            <span className="published-content-type">{item.content_type === 'lesson' ? 'Learning resource' : 'Announcement'}</span>
            <h3>{item.title}</h3>
            {item.summary && <p className="published-content-summary">{item.summary}</p>}
            <p className="published-content-body">{item.body}</p>
            {item.published_at && <time dateTime={item.published_at}>{new Date(item.published_at).toLocaleDateString()}</time>}
          </article>
        ))}
      </div>
    </section>
  );
}

function LessonPlaySection() {
  return (
    <section className="play-section" id="lesson-play" aria-labelledby="lesson-play-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Lesson Play / build to learn</p>
          <h2 id="lesson-play-heading">Choose what you want to make.</h2>
          <p className="section-sub">Each track teaches the coding idea, then turns it into a real project instead of stopping at a quiz.</p>
        </div>
        <Link href="/play" className="text-link" data-testid="link-open-lesson-play">
          Open Lesson Play <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <div className="play-grid">
        {playTracks.map((track) => (
          <Link href={`/play/${track.id}`} className="play-card" key={track.id} data-testid={`card-play-${track.id}`}>
            <span className="play-card-icon" aria-hidden="true">{track.shortTitle.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{track.title}</strong>
              <p>{track.description}</p>
            </div>
            <ArrowRight aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function PlayPage() {
  const params = useParams<{ track?: string }>();
  const selected = playTracks.find((track) => track.id === params.track);

  return (
    <AppShell>
      <main className="home-main play-page-main">
        <section className="hero" aria-labelledby="play-heading">
          <div className="hero-copy-block">
            <div className="eyebrow"><span className="eyebrow-line" /> {selected ? `Your build path / ${selected.shortTitle}` : 'Lesson Play / build to learn'}</div>
            <h1 id="play-heading">
              {selected ? <>Build with <em>{selected.shortTitle}.</em></> : <>Choose a path.<br /><em>Build something real.</em></>}
            </h1>
            <p className="hero-copy">
              {selected
                ? selected.description
                : 'Learn programming by making games, websites, apps, and more. Start with a small idea, practice the concept, then build something you can call your own.'}
            </p>
            <div className="hero-actions">
              {selected ? (
                <>
                  <a href="#your-mission" className="button-primary">See your mission <ArrowRight aria-hidden="true" /></a>
                  <Link href="/play" className="text-link"><ArrowLeft aria-hidden="true" /> All learning paths</Link>
                </>
              ) : (
                <>
                  <a href="#play-tracks" className="button-primary">Explore learning paths <ArrowRight aria-hidden="true" /></a>
                  <Link href="/#learning-path" className="text-link">Foundation lessons <ArrowRight aria-hidden="true" /></Link>
                </>
              )}
              <Link href="/playground" className="button-ghost"><Code2 aria-hidden="true" /> Open code playground</Link>
            </div>
          </div>
          <div className="hero-visual" aria-label="A sample code card showing a small programming project">
            <span className="hero-note">FIG. 02 / LEARN BY MAKING</span>
            <div className="atlas-card">
              <div className="code-window-head">
                <span className="window-dots"><i /><i /><i /></span>
                <span>{selected ? `${selected.shortTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_project.js` : 'first_project.js'}</span>
                <span>JS</span>
              </div>
              <div className="code-row"><span className="line-no">01</span><span><span className="code-comment">// Start with one small idea</span></span></div>
              <div className="code-row"><span className="line-no">02</span><span><span className="code-key">const</span> project = <span className="code-string">"your idea"</span>;</span></div>
              <div className="code-row"><span className="line-no">03</span><span><span className="code-key">learn</span>(project);</span></div>
              <div className="code-row"><span className="line-no">04</span><span><span className="code-comment">// Then make it your own</span></span></div>
            </div>
            <div className="visual-stamp"><span><b>{selected ? selected.projects.length : playTracks.length}</b><br />{selected ? 'build steps' : 'paths to build'}</span></div>
          </div>
        </section>

        {!selected ? (
          <section className="section play-track-library" id="play-tracks" aria-labelledby="play-tracks-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">The project library / build your skills</p>
                <h2 id="play-tracks-heading">What do you want to make?</h2>
                <p className="section-sub">Choose a track and turn the ideas into a real project, one checkpoint at a time.</p>
              </div>
            </div>
            <div className="play-hub-grid" aria-label="Lesson Play tracks">
              {playTracks.map((track) => (
                <Link href={`/play/${track.id}`} className="play-hub-card" key={track.id}>
                  <span className="play-hub-kicker">{track.shortTitle}</span>
                  <h2>{track.title}</h2>
                  <p className="play-code-label">[{track.codeLabel}]</p>
                  <p>{track.description}</p>
                  <p className="play-track-purpose"><strong>For:</strong> {track.usedFor}</p>
                  <span className="play-outcome">{track.outcome}</span>
                  <span className="play-open">Start track <ArrowRight aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="play-track-layout" id="your-mission">
            <article className="play-track-main">
              <p className="section-kicker">Your mission</p>
              <h2>{selected.outcome}</h2>
              <p className="concept-intro">
                You will move through short explain → try → build steps. Every project is broken into small checkpoints so you learn why the code works instead of only copying it.
              </p>
              <div className="mission-steps">
                {selected.projects.map((project, index) => (
                  <div className="mission-step" key={project}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{project}</strong>
                      <p>{index === 0 ? 'Starter mission — learn the core idea.' : index === 1 ? 'Practice mission — change and extend the idea.' : 'Build mission — combine the skills into your own version.'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/learn/output" className="button-primary">Start with the coding foundation <ArrowRight aria-hidden="true" /></Link>
            </article>
            <aside className="play-track-sidebar">
              <p className="sidebar-title"><span>Code and purpose</span></p>
              <p className="play-code-label">[{selected.codeLabel}]</p>
              <p><strong>What it is for:</strong> {selected.usedFor}</p>
              <p className="sidebar-title"><span>Main functions</span></p>
              {selected.mainFunctions.map((item) => <span className="skill-chip" key={item}>{item}</span>)}
              <p className="sidebar-title"><span>Skills in this track</span></p>
              {selected.skills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}
              <div className="play-note">
                <strong>Build-first rule</strong>
                <span>Hints explain the next move, but Meta does not hand you the full final project before you try it.</span>
              </div>
            </aside>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function ProjectsPage() {
  const templates = [
    ['Website', 'HTML, CSS, and JavaScript starter'],
    ['Game', 'Browser game starter'],
    ['App', 'App-style starter'],
    ['Roblox', 'Luau / Roblox Studio starter'],
    ['MCBE', 'Minecraft Bedrock add-on starter'],
    ['MCJE', 'Java Edition datapack starter'],
    ['MCJE Mod', 'Java mod starter'],
  ];

  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<MetaProject[]>(() => readProjects());
  const [showCreator, setShowCreator] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('Blank');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectTypeFilter, setProjectTypeFilter] = useState('All');
  const visibleProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(projectSearch.trim().toLowerCase());
    const matchesType = projectTypeFilter === 'All' || project.type === projectTypeFilter;
    return matchesSearch && matchesType;
  });
  const projectTypes = Array.from(new Set(projects.map((project) => project.type))).sort((a, b) => a.localeCompare(b));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => writeProjects(projects), [projects]);

  const createProject = (name = projectName, type = projectType) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const cleanName = name.trim() || `Untitled ${type} project`;
    const project: MetaProject = {
      id,
      name: cleanName,
      type,
      files: {},
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const nextProjects = [...projects, project];
    // Persist before navigating: ProjectPage initializes from localStorage on mount.
    writeProjects(nextProjects);
    setProjects(nextProjects);
    setProjectName('');
    setProjectType('Blank');
    setShowCreator(false);
    setLocation(`/projects/${id}`);
  };

  const startWithAi = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt || sending) return;
    setSending(true);
    setAiError('');

    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          track: 'Project Builder',
          project: null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Meta AI could not start the project.');

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const project: MetaProject = {
        id,
        name: payload.project?.name || 'AI Project',
        type: payload.project?.type || 'Blank',
        files: payload.project?.files || {},
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: payload.reply || 'Project created.' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const next = [...projects, project];
      setProjects(next);
      writeProjects(next);
      setMessage('');
      setLocation(`/projects/${id}`);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Meta AI could not respond.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell>
      <main className="projects-page">
        <section className="projects-intro">
          <p className="section-kicker">Projects</p>
          <h1>What are you building?</h1>
          <p>Ask Meta to create the starting project for you, or scroll down and create one yourself.</p>
          {aiError && <p className="project-ai-error" role="alert">{aiError}</p>}
        </section>

        <section className="project-list-section">
          <div className="project-list-head">
            <div>
              <p className="section-kicker">Your projects</p>
              <h2>Pick up where you left off.</h2>
            </div>
            <button type="button" className="project-plus-button" onClick={() => setShowCreator(true)} aria-label="Create project" title="Create project">
              <Plus aria-hidden="true" />
            </button>
          </div>

          {projects.length ? (
            <>
              <div className="project-list-filters">
                <label>
                  <span className="sr-only">Search your projects</span>
                  <input
                    type="search"
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder="Search projects…"
                    aria-label="Search your projects"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter by project type</span>
                  <select
                    value={projectTypeFilter}
                    onChange={(event) => setProjectTypeFilter(event.target.value)}
                    aria-label="Filter by project type"
                  >
                    <option value="All">All types</option>
                    {projectTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
              </div>
              {visibleProjects.length ? (
                <div className="simple-project-grid">
                  {visibleProjects.map((project) => (
                    <button
                      type="button"
                      className="simple-project-card"
                      key={project.id}
                      onClick={() => setLocation(`/projects/${project.id}`)}
                      aria-label={`Open ${project.name}`}
                    >
                      <span className="simple-project-icon"><FolderKanban aria-hidden="true" /></span>
                      <strong>{project.name}</strong>
                      <small>{project.type}</small>
                      {project.updatedAt && <small>Updated {new Date(project.updatedAt).toLocaleDateString()}</small>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="projects-empty-minimal">
                  <Search aria-hidden="true" />
                  <span>No projects match those filters. Try another search or choose All types.</span>
                  <button type="button" className="button-secondary" onClick={() => { setProjectSearch(''); setProjectTypeFilter('All'); }}>Clear filters</button>
                </div>
              )}
            </>
          ) : (
            <div className="projects-empty-minimal">
              <FolderKanban aria-hidden="true" />
              <span>No projects yet. Ask Meta below or tap + to make one without AI.</span>
            </div>
          )}
        </section>

        <details className="template-drawer">
          <summary>
            <span>Templates</span>
            <small>Start from one of the guided project types</small>
          </summary>
          <div className="template-grid">
            {templates.map(([name, detail]) => (
              <button type="button" className="template-card" key={name} onClick={() => createProject(`Untitled ${name}`, name)}>
                <span className="new-project-icon"><Code2 aria-hidden="true" /></span>
                <strong>{name}</strong>
                <small>{detail}</small>
              </button>
            ))}
          </div>
        </details>

        {showCreator && (
          <div className="project-create-sheet" role="dialog" aria-modal="true" aria-label="Create project">
            <div className="project-create-card">
              <div className="project-create-title">
                <div>
                  <p className="section-kicker">New project</p>
                  <h2>Create without AI</h2>
                </div>
                <button type="button" className="sheet-close" onClick={() => setShowCreator(false)} aria-label="Close">×</button>
              </div>
              <label>
                <span>Name</span>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="My project" autoFocus />
              </label>
              <label>
                <span>Type</span>
                <select value={projectType} onChange={(event) => setProjectType(event.target.value)}>
                  <option>Blank</option>
                  {templates.map(([name]) => <option key={name}>{name}</option>)}
                </select>
              </label>
              <button type="button" className="button-primary" onClick={() => createProject()}>Create project</button>
            </div>
          </div>
        )}

        <form className="project-ai-composer" onSubmit={startWithAi}>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={sending ? 'Meta is creating your project…' : 'Ask Meta to create a project…'}
            aria-label="Message Meta AI"
            disabled={sending}
          />
          <button type="submit" aria-label="Send message" disabled={!message.trim() || sending}>
            <Send aria-hidden="true" />
          </button>
        </form>
      </main>
    </AppShell>
  );
}

function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<MetaProject[]>(() => readProjects());
  const project = projects.find((item) => item.id === params.projectId);
  const [activeTab, setActiveTab] = useState<'files' | 'preview' | 'chat'>(() => {
    try {
      const saved = localStorage.getItem('meta-default-project-tab');
      return saved === 'files' || saved === 'preview' || saved === 'chat' ? saved : 'chat';
    } catch {
      return 'chat';
    }
  });
  const [activeFile, setActiveFile] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [fileCreateError, setFileCreateError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [autoCorrecting, setAutoCorrecting] = useState(false);
  const [error, setError] = useState('');
  const [showProjectHints] = useState(() => {
    try {
      return localStorage.getItem('meta-project-hints') !== 'false';
    } catch {
      return true;
    }
  });
  const [wordWrap] = useState(() => readFlag('meta-editor-word-wrap', true));

  useEffect(() => writeProjects(projects), [projects]);

  const currentFiles = project?.files || {};
  const fileEntries = Object.entries(currentFiles);

  useEffect(() => {
    if (!activeFile && fileEntries.length) setActiveFile(fileEntries[0][0]);
    if (activeFile && !Object.prototype.hasOwnProperty.call(currentFiles, activeFile) && fileEntries.length) {
      setActiveFile(fileEntries[0][0]);
    }
  }, [activeFile, fileEntries.length, project?.id]);

  if (!project) {
    return (
      <AppShell>
        <main className="project-detail-page">
          <Link href="/projects" className="back-link"><ArrowLeft aria-hidden="true" /> Back to projects</Link>
          <div className="projects-empty-minimal">
            <FolderKanban aria-hidden="true" />
            <span>This project could not be found.</span>
          </div>
        </main>
      </AppShell>
    );
  }

  const updateFiles = (files: Record<string, string>) => {
    setProjects((current) => current.map((item) =>
      item.id === project.id ? { ...item, files, updatedAt: Date.now() } : item
    ));
  };

  const updateActiveFile = (content: string) => {
    if (!activeFile) return;
    updateFiles({ ...currentFiles, [activeFile]: content });
  };

  const createFile = (requestedPath = newFileName) => {
    const path = requestedPath.trim().replace(/^\/+/, '').replace(/\\/g, '/');
    setFileCreateError('');

    if (!path) {
      setFileCreateError('Enter a file name first.');
      return;
    }
    if (path.endsWith('/')) {
      setFileCreateError('Use a file name such as index.html or src/main.js.');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(currentFiles, path)) {
      setFileCreateError('That file already exists.');
      setActiveFile(path);
      return;
    }

    const nextFiles = { ...currentFiles, [path]: '' };
    const nextProjects = projects.map((item) =>
      item.id === project.id ? { ...item, files: nextFiles, updatedAt: Date.now() } : item
    );

    setProjects(nextProjects);
    writeProjects(nextProjects);
    setActiveFile(path);
    setNewFileName('');
    setShowNewFile(false);
    setActiveTab('files');
  };

  const deleteActiveFile = () => {
    if (!activeFile) return;
    const next = { ...currentFiles };
    delete next[activeFile];
    updateFiles(next);
    setActiveFile(Object.keys(next)[0] || '');
  };

  const downloadFile = (path: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = path.split('/').pop() || 'file.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadProject = async () => {
    const zip = new JSZip();
    Object.entries(currentFiles).forEach(([path, content]) => zip.file(path, content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '-') || 'meta-project'}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const sendToAi = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt || sending) return;
    setSending(true);
    setError('');

    setProjects((current) => current.map((item) =>
      item.id === project.id
        ? { ...item, messages: [...(item.messages || []), { role: 'user' as const, content: prompt }], updatedAt: Date.now() }
        : item
    ));
    setMessage('');

    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          track: 'Project Builder',
          project: { ...project, files: currentFiles },
          history: project.messages || [],
          activeFile,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Meta AI could not respond.');

      setProjects((current) => current.map((item) =>
        item.id === project.id
          ? {
              ...item,
              name: payload.project?.name || item.name,
              type: payload.project?.type || item.type,
              files: payload.project?.files || item.files || {},
              messages: [...(item.messages || []), { role: 'assistant' as const, content: payload.reply || 'Done.' }],
              updatedAt: Date.now(),
            }
          : item
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Meta AI could not respond.');
    } finally {
      setSending(false);
    }
  };

  const autoCorrectActiveFile = async () => {
    if (!activeFile || autoCorrecting || sending) return;
    const originalCode = currentFiles[activeFile] || '';
    setAutoCorrecting(true);
    setError('');
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: [
            'AUTO-CORRECT REQUEST. Inspect only the active file listed below and automatically correct errors you can confidently identify.',
            'Preserve the intended behavior, style, and existing features.',
            'Return the full corrected active file in project.files. Keep every other file byte-for-byte unchanged.',
            'Do not make speculative rewrites. If you cannot confidently fix an issue, leave that part unchanged and explain it in reply.',
            'In reply, briefly list what you corrected. Do not wrap file contents in markdown fences.',
            'Active file: ' + activeFile,
            'Project type: ' + project.type,
          ].join('\n'),
          track: 'Project Builder',
          project: { ...project, files: currentFiles },
          history: [],
          activeFile,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Auto-correct could not complete.');
      const correctedCode = payload?.project?.files?.[activeFile];
      if (typeof correctedCode !== 'string') {
        throw new Error('Meta could not return a corrected version of this file. Your original code was kept.');
      }
      if (correctedCode === originalCode) {
        setError(payload.reply || 'No confident corrections were found. Your file was not changed.');
        return;
      }
      updateFiles({ ...currentFiles, [activeFile]: correctedCode });
      const note = typeof payload.reply === 'string' && payload.reply.trim()
        ? payload.reply.trim()
        : 'Auto-correct applied. Review the changes before continuing.';
      setProjects((current) => current.map((item) =>
        item.id === project.id
          ? { ...item, messages: [...(item.messages || []), { role: 'assistant' as const, content: note }], updatedAt: Date.now() }
          : item
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-correct could not complete. Your original file was kept.');
    } finally {
      setAutoCorrecting(false);
    }
  };

  const htmlEntries = fileEntries.filter(([path]) => /\.html?$/i.test(path));
  const preferredHtmlPath = /\.html?$/i.test(activeFile) && currentFiles[activeFile] !== undefined
    ? activeFile
    : currentFiles['index.html'] !== undefined
      ? 'index.html'
      : currentFiles['src/index.html'] !== undefined
        ? 'src/index.html'
        : htmlEntries[0]?.[0] || '';
  const htmlFile = preferredHtmlPath ? currentFiles[preferredHtmlPath] || '' : '';
  const previewDocument = htmlFile
    ? (() => {
        const resolveAssetPath = (htmlPath: string, assetUrl: string) => {
          const cleanUrl = assetUrl.split(/[?#]/, 1)[0].replace(/^\.\//, '');
          if (!cleanUrl || /^(?:[a-z]+:|\/|#)/i.test(cleanUrl)) return '';
          const directory = htmlPath.includes('/') ? htmlPath.slice(0, htmlPath.lastIndexOf('/') + 1) : '';
          const candidates = [
            directory + cleanUrl,
            cleanUrl,
            cleanUrl.split('/').pop() || '',
          ];
          return candidates.find((candidate) => Object.prototype.hasOwnProperty.call(currentFiles, candidate)) || '';
        };
        let documentHtml = htmlFile;
        let linkedCssCount = 0;
        let linkedJsCount = 0;
        documentHtml = documentHtml.replace(
          /<link\b([^>]*?)href=(["'])([^"']+\.css(?:\?[^"']*)?(?:#[^"']*)?)\2([^>]*)>/gi,
          (tag, _before: string, _quote: string, href: string, _after: string) => {
            const assetPath = resolveAssetPath(preferredHtmlPath, href);
            const css = assetPath ? currentFiles[assetPath] : undefined;
            if (css === undefined) return tag;
            linkedCssCount += 1;
            return '<style data-preview-source="' + assetPath + '">' + css.replace(/<\/style/gi, '<\\/style') + '</style>';
          },
        );
        documentHtml = documentHtml.replace(
          /<script\b([^>]*?)src=(["'])([^"']+\.(?:m?js)(?:\?[^"']*)?(?:#[^"']*)?)\2([^>]*)>\s*<\/script>/gi,
          (tag, _before: string, _quote: string, src: string, _after: string) => {
            const assetPath = resolveAssetPath(preferredHtmlPath, src);
            const js = assetPath ? currentFiles[assetPath] : undefined;
            if (js === undefined) return tag;
            linkedJsCount += 1;
            return '<script>' + js.replace(/<\/script/gi, '<\\/script') + '</script>';
          },
        );
        const cssFallbackPath = [
          preferredHtmlPath.replace(/\.html?$/i, '.css'),
          'style.css',
          'styles.css',
          'src/index.css',
        ].find((path) => Object.prototype.hasOwnProperty.call(currentFiles, path));
        const jsFallbackPath = [
          preferredHtmlPath.replace(/\.html?$/i, '.js'),
          'script.js',
          'src/main.js',
        ].find((path) => Object.prototype.hasOwnProperty.call(currentFiles, path));
        const cssFallback = linkedCssCount === 0 && cssFallbackPath
          ? '<style>' + (currentFiles[cssFallbackPath] || '').replace(/<\/style/gi, '<\\/style') + '</style>'
          : '';
        const jsFallback = linkedJsCount === 0 && jsFallbackPath
          ? '<script>' + (currentFiles[jsFallbackPath] || '').replace(/<\/script/gi, '<\\/script') + '</script>'
          : '';
        if (cssFallback) {
          documentHtml = documentHtml.includes('</head>')
            ? documentHtml.replace('</head>', cssFallback + '</head>')
            : cssFallback + documentHtml;
        }
        if (jsFallback) {
          documentHtml = documentHtml.includes('</body>')
            ? documentHtml.replace('</body>', jsFallback + '</body>')
            : documentHtml + jsFallback;
        }
        return documentHtml;
      })()
    : '';

  return (
    <AppShell showBottomNav={false} showHeader={false}>
      <main className="project-editor-page">
        <header className="project-editor-head">
          <button type="button" className="project-back-button icon-only-button" onClick={() => setLocation('/projects')} aria-label="Back to projects">
            <ArrowLeft aria-hidden="true" />
          </button>
          <div className="project-editor-title">
            <strong>{project.name}</strong>
            <span>{project.type}</span>
          </div>
          <button type="button" className="project-download-button" onClick={() => void downloadProject()} disabled={!fileEntries.length} aria-label="Download project as ZIP">
            <Download aria-hidden="true" />
            <span>Download</span>
          </button>
        </header>

        <section className="project-editor-body">
          {error && <p className="project-auto-correct-status" role="status">{error}</p>}
          {activeTab === 'files' && (
            <div className="code-workspace">
              <aside className="file-sidebar">
                <div className="file-sidebar-head">
                  <span>Files</span>
                  <button type="button" className="icon-only-button" onClick={() => { setFileCreateError(''); setNewFileName(''); setShowNewFile(true); }} aria-label="New file">
                    <Plus aria-hidden="true" />
                  </button>
                </div>
                <div className="file-list">
                  {fileEntries.map(([path]) => (
                    <button type="button" key={path} className={`file-list-item${activeFile === path ? ' active' : ''}`} onClick={() => setActiveFile(path)}>
                      <FileCode2 aria-hidden="true" />
                      <span>{path}</span>
                    </button>
                  ))}
                  {!fileEntries.length && <p className="file-list-empty">No files yet. Tap + to create one.</p>}
                </div>
              </aside>

              <section className="code-editor-panel">
                {activeFile ? (
                  <>
                    <div className="code-editor-toolbar">
                      <span>{activeFile}</span>
                      <div>
                        <button type="button" className="editor-text-button" onClick={() => downloadFile(activeFile, currentFiles[activeFile] || '')}>Download file</button>
                        <button type="button" className="editor-text-button" onClick={() => { setMessage(`Review ${activeFile} in my ${project.type} project. First explain what this code does. Check for bugs, errors, missing pieces, and improvements. If something is wrong, show a corrected code example and explain exactly what to change and why, step by step. Do not modify or replace any project files yet; wait for me to approve a fix.`); setError(''); setActiveTab('chat'); }} title="Get a code review and step-by-step fix instructions"><Lightbulb aria-hidden="true" /> Explain / fix</button>
                        <button type="button" className="editor-text-button" onClick={() => void autoCorrectActiveFile()} disabled={autoCorrecting || sending} title="Automatically fix confidently identified errors in this file"><Sparkles aria-hidden="true" /> {autoCorrecting ? 'Correcting…' : 'Auto-correct'}</button>
                        <button type="button" className="editor-text-button danger-text" onClick={deleteActiveFile}>Delete</button>
                      </div>
                    </div>
                    <textarea
                      className="manual-code-editor"
                      value={currentFiles[activeFile] || ''}
                      onChange={(event) => updateActiveFile(event.target.value)}
                      spellCheck={false}
                      wrap={wordWrap ? 'soft' : 'off'}
                      aria-label={`Edit ${activeFile}`}
                    />
                  </>
                ) : (
                  <div className="editor-empty">
                    <FileCode2 aria-hidden="true" />
                    <h2>Code it yourself.</h2>
                    {showProjectHints && <p>Create a file with the + button, then type directly in the editor.</p>}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'preview' && (
            <section className="project-preview-panel">
              {previewDocument ? (
                <iframe title="Project preview" sandbox="allow-scripts" srcDoc={previewDocument} />
              ) : (
                <div className="editor-empty">
                  <Eye aria-hidden="true" />
                  <h2>Preview</h2>
                  {showProjectHints && <p>Browser preview works with any .html file in this project. Open Files and select an HTML file, then tap Preview. Local CSS and JavaScript files are included when they are linked from the page.</p>}
                </div>
              )}
            </section>
          )}

          {activeTab === 'chat' && (
            <section className="project-chat-tab">
              <div className="project-conversation" aria-live="polite">
                {(project.messages || []).length ? (
                  (project.messages || []).map((entry, index) => (
                    <div className={`project-message ${entry.role}`} key={`${entry.role}-${index}`}>
                      <span>{entry.role === 'user' ? 'You' : 'Meta'}</span>
                      <p>{entry.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="project-chat-empty">
                    <Sparkles aria-hidden="true" />
                    <h2>Chat with Meta.</h2>
                    {showProjectHints && <p>Ask for help when you want it. You can still code everything yourself in Files.</p>}
                  </div>
                )}
                {sending && <div className="project-message assistant"><span>Meta</span><p>Working on your project…</p></div>}
                {error && <p className="project-ai-error" role="alert">{error}</p>}
              </div>
              <form className="project-tab-chat-composer" onSubmit={sendToAi}>
                <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={sending ? 'Meta is working…' : 'Message Meta about this project…'} disabled={sending} />
                <button type="submit" aria-label="Send" disabled={!message.trim() || sending}><Send aria-hidden="true" /></button>
              </form>
            </section>
          )}
        </section>

        {showNewFile && (
          <div className="file-create-overlay" role="dialog" aria-modal="true" aria-label="Create a new file" onMouseDown={(event) => {
            if (event.currentTarget === event.target) setShowNewFile(false);
          }}>
            <form className="file-create-dialog" onSubmit={(event) => { event.preventDefault(); createFile(); }}>
              <div className="file-create-dialog-head">
                <div>
                  <span className="section-kicker">New file</span>
                  <h2>Create a file</h2>
                </div>
                <button type="button" className="icon-only-button" onClick={() => setShowNewFile(false)} aria-label="Close">×</button>
              </div>

              <label className="file-create-label">
                <span>File path</span>
                <input
                  value={newFileName}
                  onChange={(event) => { setNewFileName(event.target.value); setFileCreateError(''); }}
                  placeholder="index.html"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>

              <div className="file-quick-options" aria-label="Quick file choices">
                <button type="button" onClick={() => createFile('index.html')}>index.html</button>
                <button type="button" onClick={() => createFile('style.css')}>style.css</button>
                <button type="button" onClick={() => createFile('script.js')}>script.js</button>
              </div>

              {fileCreateError && <p className="file-create-error" role="alert">{fileCreateError}</p>}

              <button type="submit" className="button-primary file-create-submit" disabled={!newFileName.trim()}>
                <Plus aria-hidden="true" /> Create file
              </button>
            </form>
          </div>
        )}

        <nav className="project-bottom-tabs" aria-label="Project tools">
          <button type="button" className={activeTab === 'files' ? 'active' : ''} onClick={() => setActiveTab('files')}>
            <FileCode2 aria-hidden="true" /><span>Files</span>
          </button>
          <button type="button" className={activeTab === 'preview' ? 'active' : ''} onClick={() => setActiveTab('preview')}>
            <Eye aria-hidden="true" /><span>Preview</span>
          </button>
          <button type="button" className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
            <MessageSquare aria-hidden="true" /><span>Chat</span>
          </button>
        </nav>
      </main>
    </AppShell>
  );
}

function readFlag(key: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, keywords: 'account display name username email picture avatar photo' },
  { id: 'plan', label: 'Plan & billing', icon: CreditCard, keywords: 'subscription ai credits allowance usage invoices receipts payment card upgrade pricing free paid' },
  { id: 'notifications', label: 'Notifications', icon: Bell, keywords: 'reminders updates new lessons features product community discord billing email' },
  { id: 'learning', label: 'Learning', icon: BookOpen, keywords: 'language coding python javascript typescript html css java c c++ c# go rust sql ruby hints exercises lessons beginner' },
  { id: 'appearance', label: 'Appearance', icon: Palette, keywords: 'theme dark light mode reduced motion animation accessibility' },
  { id: 'editor', label: 'Editor & projects', icon: Settings, keywords: 'code editor project tab files preview chat text size font word wrap wrapping workspace helper hints' },
  { id: 'privacy', label: 'Privacy & data', icon: Shield, keywords: 'export download backup reset progress completed quizzes xp delete account policy storage' },
  { id: 'support', label: 'Support', icon: CircleHelp, keywords: 'help contact support bug android app apk version email' },
];

function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [defaultTab, setDefaultTab] = useState<'files' | 'preview' | 'chat'>(() => {
    try {
      const saved = localStorage.getItem('meta-default-project-tab');
      return saved === 'files' || saved === 'preview' || saved === 'chat' ? saved : 'chat';
    } catch {
      return 'chat';
    }
  });
  const [editorSize, setEditorSize] = useState(() => {
    try {
      const saved = localStorage.getItem('meta-editor-font-size');
      return saved === 'small' || saved === 'large' ? saved : 'medium';
    } catch {
      return 'medium';
    }
  });
  const [defaultLanguage, setDefaultLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      return languages.some((language) => language.id === saved) ? saved as string : 'python';
    } catch {
      return 'python';
    }
  });
  const [autoShowLessonHints, setAutoShowLessonHints] = useState(() => readFlag('meta-auto-show-lesson-hints', false));
  const [wordWrap, setWordWrap] = useState(() => readFlag('meta-editor-word-wrap', true));
  const [settingsSearch, setSettingsSearch] = useState('');
  const visibleSettingsSections = useMemo(() => {
    const terms = settingsSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS.filter((section) => {
      const searchableText = `${section.label} ${section.keywords}`.toLowerCase();
      return terms.every((term) => searchableText.includes(term));
    });
  }, [settingsSearch]);
  const visibleSettingsSectionIds = useMemo(() => new Set(visibleSettingsSections.map((section) => section.id)), [visibleSettingsSections]);
  const [reducedMotion, setReducedMotion] = useState(() => readFlag('meta-reduced-motion', false));
  const [showProjectHints, setShowProjectHints] = useState(() => readFlag('meta-project-hints', true));
  const [notifyLessons, setNotifyLessons] = useState(() => readFlag('meta-notify-lessons', true));
  const [notifyProduct, setNotifyProduct] = useState(() => readFlag('meta-notify-product', true));
  const [notifyCommunity, setNotifyCommunity] = useState(() => readFlag('meta-notify-community', false));
  const [notifyBilling, setNotifyBilling] = useState(() => readFlag('meta-notify-billing', true));
  const [activeSection, setActiveSection] = useState('profile');
  const [toast, setToast] = useState('');
  const [planName, setPlanName] = useState('Free');
  const [creditLimit, setCreditLimit] = useState(40);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);

  const [profile, setProfile] = useState<{
    email: string;
    displayName: string;
    username: string;
    avatarPng: string | null;
    googlePicture: string | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/profile', { credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your profile.');
        return data.profile;
      })
      .then(data => {
        if (active) setProfile(data);
      })
      .catch(error => {
        if (active) setProfileMessage(error.message || 'Could not load your profile.');
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (!active || !data?.user) return;
        const rawPlan = typeof data.user.plan === 'string' && data.user.plan ? data.user.plan : 'Free';
        setPlanName(rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1));
        if (typeof data.user.aiCredits === 'number' && data.user.aiCredits > 0) setCreditLimit(data.user.aiCredits);
        if (typeof data.user.aiCreditsUsed === 'number') setCreditsUsed(data.user.aiCreditsUsed);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const flash = (message: string) => setToast(message);

  useEffect(() => {
    const onScroll = () => {
      let current = visibleSettingsSections[0]?.id ?? SETTINGS_SECTIONS[0].id;
      for (const section of visibleSettingsSections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= 160) current = section.id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [visibleSettingsSections]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setProfileSaving(true);
    setProfileMessage('');
    const payload: {
      displayName: string;
      username?: string;
      avatarPng: string | null;
    } = {
      displayName: profile.displayName.trim(),
      avatarPng: profile.avatarPng,
    };
    if (profile.username.trim()) payload.username = profile.username.trim();

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your profile.');
      setProfile(data.profile);
      setProfileMessage('Profile saved successfully.');
      flash('Profile saved.');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  function chooseProfilePicture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png') {
      setProfileMessage('Please choose a PNG image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setProfileMessage('The PNG must be no larger than 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/png;base64,')) {
        setProfile(current => current ? { ...current, avatarPng: reader.result as string } : current);
        setProfileMessage('Picture ready. Save your profile to keep the change.');
      } else {
        setProfileMessage('Could not read that PNG. Please try another image.');
      }
    };
    reader.onerror = () => setProfileMessage('Could not read that image. Please try again.');
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    const sizes: Record<string, string> = { small: '11px', medium: '12px', large: '14px' };
    document.documentElement.style.setProperty('--meta-editor-font-size', sizes[editorSize] || sizes.medium);
    try { localStorage.setItem('meta-editor-font-size', editorSize); } catch { /* storage may be unavailable */ }
  }, [editorSize]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    try { localStorage.setItem('meta-reduced-motion', String(reducedMotion)); } catch { /* storage may be unavailable */ }
  }, [reducedMotion]);

  useEffect(() => { try { localStorage.setItem('meta-default-project-tab', defaultTab); } catch { /* storage may be unavailable */ } }, [defaultTab]);
  useEffect(() => { try { localStorage.setItem(LANGUAGE_KEY, defaultLanguage); } catch { /* storage may be unavailable */ } }, [defaultLanguage]);
  useEffect(() => { try { localStorage.setItem('meta-auto-show-lesson-hints', String(autoShowLessonHints)); } catch { /* storage may be unavailable */ } }, [autoShowLessonHints]);
  useEffect(() => { try { localStorage.setItem('meta-editor-word-wrap', String(wordWrap)); } catch { /* storage may be unavailable */ } }, [wordWrap]);
  useEffect(() => { try { localStorage.setItem('meta-project-hints', String(showProjectHints)); } catch { /* storage may be unavailable */ } }, [showProjectHints]);
  useEffect(() => { try { localStorage.setItem('meta-notify-lessons', String(notifyLessons)); } catch { /* storage may be unavailable */ } }, [notifyLessons]);
  useEffect(() => { try { localStorage.setItem('meta-notify-product', String(notifyProduct)); } catch { /* storage may be unavailable */ } }, [notifyProduct]);
  useEffect(() => { try { localStorage.setItem('meta-notify-community', String(notifyCommunity)); } catch { /* storage may be unavailable */ } }, [notifyCommunity]);
  useEffect(() => { try { localStorage.setItem('meta-notify-billing', String(notifyBilling)); } catch { /* storage may be unavailable */ } }, [notifyBilling]);

  function exportData() {
    const scope = currentAccountScope();
    const payload = {
      exportedAt: new Date().toISOString(),
      account: scope,
      progress: readProgress(`${PROGRESS_KEY}:${scope}`),
      projects: readProjects(),
      preferences: {
        theme,
        defaultTab,
        editorSize,
        reducedMotion,
        showProjectHints,
        defaultLanguage,
        autoShowLessonHints,
        wordWrap,
        notifications: { notifyLessons, notifyProduct, notifyCommunity, notifyBilling },
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meta-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    flash('Your data export has been downloaded.');
  }

  function resetLocalProgress() {
    if (!window.confirm('Reset all lesson progress stored on this device? This cannot be undone.')) return;
    const storageKey = `${PROGRESS_KEY}:${currentAccountScope()}`;
    try {
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { storageKey } }));
    } catch { /* storage may be unavailable */ }
    flash('Local progress cleared.');
  }

  const usagePercent = creditsUsed === null ? 0 : Math.min(100, Math.round((creditsUsed / Math.max(creditLimit, 1)) * 100));

  return (
    <AppShell>
      <main className="workspace-page settings-page">
        <section className="workspace-head">
          <div>
            <p className="section-kicker">Settings</p>
            <h1>Make Meta yours</h1>
            <p>Profile, plan, notifications, appearance, editor behavior, and privacy — everything in one place, grouped so you can find it fast.</p>
          </div>
          <Link href="/account" className="button-secondary" data-testid="link-account-security">Account &amp; security</Link>
        </section>

        <div className="settings-search-panel">
          <label className="settings-search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={settingsSearch}
              onChange={(event) => setSettingsSearch(event.target.value)}
              placeholder="Search settings… (e.g. language, dark mode, billing)"
              aria-label="Search settings"
              aria-describedby="settings-search-status"
              data-testid="input-search-settings"
            />
            {settingsSearch && (
              <button type="button" onClick={() => setSettingsSearch('')} aria-label="Clear settings search" className="settings-search-clear">
                <X aria-hidden="true" />
              </button>
            )}
          </label>
          <div className="settings-search-meta">
            <span id="settings-search-status" role="status" aria-live="polite">
              {settingsSearch.trim()
                ? `${visibleSettingsSections.length} section${visibleSettingsSections.length === 1 ? '' : 's'} matching “${settingsSearch.trim()}”`
                : `Search across ${SETTINGS_SECTIONS.length} settings sections`}
            </span>
            {settingsSearch.trim() && <button type="button" className="settings-search-reset" onClick={() => setSettingsSearch('')}>Clear search</button>}
          </div>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            {visibleSettingsSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`settings-nav-link${activeSection === section.id ? ' is-active' : ''}`}
                aria-current={activeSection === section.id ? 'true' : undefined}
                data-testid={`settings-nav-${section.id}`}
              >
                <section.icon aria-hidden="true" />
                <span>{section.label}</span>
              </a>
            ))}
          </nav>

          <div className="settings-panels">
            {visibleSettingsSections.length === 0 && (
              <div className="settings-empty-search" role="status">
                <Search aria-hidden="true" />
                <h2>No matching settings</h2>
                <p>Try another word such as “theme”, “language”, “font”, “privacy”, or “billing”.</p>
                <button type="button" className="button-secondary" onClick={() => setSettingsSearch('')}>Show all settings</button>
              </div>
            )}
            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('profile')} id="profile" aria-labelledby="settings-profile-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-profile-heading"><User aria-hidden="true" /> Your profile</h2>
                  <p>Update the details shown on your Meta account.</p>
                </div>
              </div>
              {profileLoading ? (
                <div className="settings-body"><p className="profile-status">Loading your profile…</p></div>
              ) : profile ? (
                <form className="profile-editor-body" onSubmit={saveProfile}>
                  <div className="profile-picture-row">
                    <div className="profile-avatar-preview">
                      {(profile.avatarPng || profile.googlePicture)
                        ? <img src={profile.avatarPng || profile.googlePicture || ''} alt="Your profile picture" referrerPolicy="no-referrer" />
                        : <span>{(profile.displayName || profile.username || profile.email || 'M').slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="profile-picture-controls">
                      <strong>Profile picture</strong>
                      <span>Google picture shown by default when available. Upload a PNG to override it (max 1 MB).</span>
                      <input className="profile-file-input" type="file" accept="image/png,.png" onChange={chooseProfilePicture} aria-label="Upload PNG profile picture" />
                      {profile.avatarPng && (
                        <button type="button" className="button-secondary" onClick={() => {
                          setProfile(current => current ? { ...current, avatarPng: null } : current);
                          setProfileMessage('Custom picture removed. Save your profile to use your Google picture or initials.');
                        }}>Remove picture</button>
                      )}
                    </div>
                  </div>
                  <label className="profile-field">
                    <span>Display name</span>
                    <input className="profile-input" type="text" required minLength={1} maxLength={40}
                      autoComplete="nickname" value={profile.displayName}
                      onChange={event => setProfile(current => current ? { ...current, displayName: event.target.value } : current)}
                      placeholder="Your display name" />
                  </label>
                  <label className="profile-field">
                    <span>Username <small>(optional)</small></span>
                    <input className="profile-input" type="text" minLength={3} maxLength={20}
                      pattern="[A-Za-z0-9_]{3,20}" title="Use 3–20 letters, numbers, or underscores."
                      autoComplete="username" value={profile.username}
                      onChange={event => setProfile(current => current ? { ...current, username: event.target.value } : current)}
                      placeholder="e.g. MetaBuilder_1" />
                    <small>3–20 characters: letters, numbers, and underscores.</small>
                  </label>
                  <label className="profile-field">
                    <span>Account email</span>
                    <input className="profile-input" type="email" value={profile.email} readOnly />
                  </label>
                  {profileMessage && <p className="profile-status" role="status">{profileMessage}</p>}
                  <div className="profile-save-row">
                    <button className="button-primary" type="submit" disabled={profileSaving}>
                      {profileSaving ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="settings-body">
                  <p className="profile-status" role="status">{profileMessage || 'Please sign in with your Meta email account to edit this profile.'}</p>
                  <div className="settings-inline-actions">
                    <Link href="/sign-in" className="button-secondary">Go to sign in</Link>
                  </div>
                  <p className="settings-note">If you signed in with Discord, profile editing through Discord is not connected yet.</p>
                </div>
              )}
            </section>

            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('plan')} id="plan" aria-labelledby="settings-plan-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-plan-heading"><CreditCard aria-hidden="true" /> Plan &amp; billing</h2>
                  <p>See what you are on, how much AI allowance is left, and where to change it.</p>
                </div>
              </div>
              <div className="settings-body">
                <div className="plan-summary">
                  <div className="plan-summary-main">
                    <span className="plan-summary-name"><Crown aria-hidden="true" /> {planName} plan</span>
                    {creditsUsed === null ? (
                      <p className="settings-note">{creditLimit.toLocaleString()} AI credits refresh every month. Usage tracking appears here once you start using the project agent.</p>
                    ) : (
                      <>
                        <div className="usage-bar" role="progressbar" aria-valuenow={usagePercent} aria-valuemin={0} aria-valuemax={100} aria-label="AI credits used this month">
                          <span className="usage-fill" style={{ width: `${usagePercent}%` }} />
                        </div>
                        <div className="usage-meta">
                          <span>{creditsUsed.toLocaleString()} used</span>
                          <span>{Math.max(creditLimit - creditsUsed, 0).toLocaleString()} left of {creditLimit.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="settings-inline-actions">
                    <Link href="/pricing" className="button-primary" data-testid="link-settings-upgrade">Compare plans</Link>
                  </div>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div>
                    <strong>Lessons and build tracks</strong>
                    <span>Always included on every plan, including Free.</span>
                  </div>
                  <span className="reward-state">Included</span>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Billing &amp; invoices</strong>
                    <span>Open Stripe to update a card, change plan, or download receipts.</span>
                  </div>
                  <a className="button-secondary" href="mailto:metasupport43@gmail.com?subject=Meta%20billing%20request">Request billing help</a>
                </div>
              </div>
            </section>

            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('notifications')} id="notifications" aria-labelledby="settings-notify-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-notify-heading"><Bell aria-hidden="true" /> Notifications</h2>
                  <p>Choose which updates you want to hear about. Everything is off until you opt in.</p>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div>
                    <strong>Learning reminders</strong>
                    <span>A nudge when you have not finished a lesson in a while.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={notifyLessons} onChange={(event) => { setNotifyLessons(event.target.checked); flash('Preference saved.'); }} aria-label="Learning reminders" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>New lessons &amp; features</strong>
                    <span>Hear when a new language path or build track lands.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={notifyProduct} onChange={(event) => { setNotifyProduct(event.target.checked); flash('Preference saved.'); }} aria-label="New lessons and features" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Community &amp; Discord</strong>
                    <span>Invites to community builds and shared project challenges.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={notifyCommunity} onChange={(event) => { setNotifyCommunity(event.target.checked); flash('Preference saved.'); }} aria-label="Community and Discord" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Billing &amp; plan changes</strong>
                    <span>Receipts, renewals, and anything that affects your credits.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={notifyBilling} onChange={(event) => { setNotifyBilling(event.target.checked); flash('Preference saved.'); }} aria-label="Billing and plan changes" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
              </div>
            </section>

            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('learning')} id="learning" aria-labelledby="settings-learning-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-learning-heading"><BookOpen aria-hidden="true" /> Learning preferences</h2>
                  <p>Choose your default coding language and how much guidance you want when a lesson opens.</p>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div>
                    <strong>Default coding language</strong>
                    <span>Preselect this language when you open a foundation lesson. You can still switch languages any time.</span>
                  </div>
                  <select className="settings-select" value={defaultLanguage} onChange={(event) => { setDefaultLanguage(event.target.value); flash('Default learning language saved.'); }} aria-label="Default coding language" data-testid="select-default-learning-language">
                    {languages.map((language) => <option key={language.id} value={language.id}>{language.name}</option>)}
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Show lesson hints automatically</strong>
                    <span>Open the small exercise hint by default in each lesson. You can hide it whenever you prefer.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={autoShowLessonHints} onChange={(event) => { setAutoShowLessonHints(event.target.checked); flash('Preference saved.'); }} aria-label="Show lesson hints automatically" data-testid="toggle-auto-lesson-hints" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
              </div>
            </section>

            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('appearance')} id="appearance" aria-labelledby="settings-appearance-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-appearance-heading"><Palette aria-hidden="true" /> Appearance</h2>
                  <p>Change how Meta looks and reads while you work.</p>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div>
                    <strong>Dark mode</strong>
                    <span>Use the darker Meta theme. Your choice is remembered on this device.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={theme === 'dark'} onChange={() => { toggleTheme(); flash('Theme updated.'); }} aria-label="Dark mode" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Reduced motion</strong>
                    <span>Reduce animations and movement across the site.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={reducedMotion} onChange={(event) => { setReducedMotion(event.target.checked); flash('Preference saved.'); }} aria-label="Reduced motion" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
              </div>
            </section>

            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('editor')} id="editor" aria-labelledby="settings-editor-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-editor-heading"><Settings aria-hidden="true" /> Editor &amp; projects</h2>
                  <p>Choose how your coding workspace opens and behaves.</p>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div>
                    <strong>Open projects on</strong>
                    <span>The first tab you see when opening a project.</span>
                  </div>
                  <select className="settings-select" value={defaultTab} onChange={(event) => { setDefaultTab(event.target.value as 'files' | 'preview' | 'chat'); flash('Preference saved.'); }} aria-label="Default project tab">
                    <option value="chat">Chat</option>
                    <option value="files">Files</option>
                    <option value="preview">Preview</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Editor text size</strong>
                    <span>Change the font size used while coding.</span>
                  </div>
                  <select className="settings-select" value={editorSize} onChange={(event) => { setEditorSize(event.target.value); flash('Preference saved.'); }} aria-label="Editor text size">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Project helper hints</strong>
                    <span>Show small hints in empty project screens and editor areas.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={showProjectHints} onChange={(event) => { setShowProjectHints(event.target.checked); flash('Preference saved.'); }} aria-label="Project helper hints" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Wrap long code lines</strong>
                    <span>Keep long lines inside the editor width instead of requiring horizontal scrolling.</span>
                  </div>
                  <label className="settings-switch">
                    <input type="checkbox" checked={wordWrap} onChange={(event) => { setWordWrap(event.target.checked); flash('Preference saved.'); }} aria-label="Wrap long code lines" data-testid="toggle-editor-word-wrap" />
                    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
                  </label>
                </div>
              </div>
            </section>

            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('privacy')} id="privacy" aria-labelledby="settings-privacy-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-privacy-heading"><Shield aria-hidden="true" /> Privacy &amp; data</h2>
                  <p>You own your work. Take a copy of it, clear it, or close your account.</p>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div>
                    <strong>Export my data</strong>
                    <span>Download your progress, projects, and preferences as a JSON file.</span>
                  </div>
                  <button type="button" className="button-secondary" onClick={exportData} data-testid="button-export-data">Export data</button>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Reset progress on this device</strong>
                    <span>Clears completed lessons, quizzes, and XP stored in this browser only.</span>
                  </div>
                  <button type="button" className="button-secondary settings-danger" onClick={resetLocalProgress} data-testid="button-reset-progress">Reset progress</button>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Privacy policy</strong>
                    <span>What Meta collects, why, and how to have it removed.</span>
                  </div>
                  <Link href="/privacy" className="button-secondary">Read policy</Link>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Delete my account</strong>
                    <span>Permanently removes your account and everything stored with it.</span>
                  </div>
                  <Link href="/delete-account" className="button-secondary settings-danger" data-testid="link-delete-account">Delete account</Link>
                </div>
              </div>
            </section>

            <section className="settings-card" hidden={!visibleSettingsSectionIds.has('support')} id="support" aria-labelledby="settings-support-heading">
              <div className="settings-card-head">
                <div>
                  <h2 id="settings-support-heading"><CircleHelp aria-hidden="true" /> Support &amp; app</h2>
                  <p>Get help, or take Meta with you on Android.</p>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div>
                    <strong>Email support</strong>
                    <span>Questions, bugs, or billing — we usually reply within a couple of days.</span>
                  </div>
                  <a className="button-secondary" href="mailto:metasupport43@gmail.com">Contact support</a>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Download Meta for Android</strong>
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
