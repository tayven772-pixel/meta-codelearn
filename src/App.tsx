
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import JSZip from 'jszip';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Code2,
  Compass,
  Lightbulb,
  LockKeyhole,
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
  Sun,
} from 'lucide-react';
import { languageFor, languages, lessonFor, lessons, type LearnerSkillLevel, type Lesson, type Progress } from './data/academy';
import { getProgressionStats, learnerSkillLevels } from './data/progression';

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
    description: 'Learn loops, input, state, collisions, scoring, and game logic by building small playable projects.',
    outcome: 'Build a playable browser game from a blank project.',
    skills: ['Game loops', 'Input', 'State', 'Collision logic'],
    projects: ['Clicker challenge', 'Dodge game', 'Top-down arena'],
  },
  {
    id: 'websites',
    title: 'Website Development',
    shortTitle: 'Websites',
    description: 'Build responsive pages while learning HTML, CSS, JavaScript, layout, components, and accessibility.',
    outcome: 'Publish a responsive multi-section website.',
    skills: ['HTML', 'CSS', 'Responsive design', 'JavaScript'],
    projects: ['Profile page', 'Landing page', 'Interactive dashboard'],
  },
  {
    id: 'apps',
    title: 'App Development',
    shortTitle: 'Apps',
    description: 'Turn ideas into useful apps with interfaces, navigation, saved data, validation, and mobile-first design.',
    outcome: 'Build an installable app-style project with persistent data.',
    skills: ['UI state', 'Navigation', 'Forms', 'Persistence'],
    projects: ['To-do app', 'Study tracker', 'Habit dashboard'],
  },
  {
    id: 'roblox',
    title: 'Roblox Studio',
    shortTitle: 'Roblox',
    description: 'Learn Luau through Roblox-style gameplay systems, interactions, UI, events, and reusable modules.',
    outcome: 'Build a small Roblox gameplay system you understand line by line.',
    skills: ['Luau', 'Events', 'Parts', 'ModuleScripts'],
    projects: ['Coin pickup', 'Checkpoint system', 'Round manager'],
  },
  {
    id: 'mcbe',
    title: 'Minecraft Bedrock Add-ons',
    shortTitle: 'MCBE',
    description: 'Learn Bedrock behavior/resource pack structure, JSON, Script API basics, custom items, entities, and gameplay systems.',
    outcome: 'Build a working .mcaddon-ready project structure.',
    skills: ['Manifests', 'JSON', 'Script API', 'Behavior packs'],
    projects: ['Custom item', 'Queue command', 'Practice utility'],
  },
  {
    id: 'mcje',
    title: 'Minecraft Java Edition',
    shortTitle: 'MCJE',
    description: 'Learn Java Edition commands, datapacks, resource packs, and the concepts behind server-side gameplay systems.',
    outcome: 'Build a reusable Java Edition datapack project.',
    skills: ['Datapacks', 'Functions', 'Predicates', 'Resource packs'],
    projects: ['Custom advancement', 'Arena functions', 'Utility datapack'],
  },
  {
    id: 'mcje-mods',
    title: 'Minecraft Java Mods',
    shortTitle: 'MCJE Mods',
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

function readProjects(): MetaProject[] {
  try {
    const next = localStorage.getItem(PROJECTS_KEY);
    if (next) return JSON.parse(next) as MetaProject[];
    const legacy = localStorage.getItem('meta-projects-v1');
    if (!legacy) return [];
    const migrated = (JSON.parse(legacy) as Array<{ id: string; name: string; type: string }>).map((project) => ({
      ...project,
      files: {},
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function writeProjects(projects: MetaProject[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Keep projects in memory when storage is unavailable.
  }
}

const META_STRIPE_TEST_LINKS: Record<string, string> = {
  builder: 'https://buy.stripe.com/test_bJedR1cBEfOo2Yx3fzeEo00',
  pro: 'https://buy.stripe.com/test_00w14f4580Tu8iRg2leEo01',
};

const aiPlans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    aiCredits: 40,
    projects: 3,
    description: 'Learn, try the agent, and keep a few active projects.',
  },
  {
    id: 'builder',
    name: 'Builder',
    price: '$4.99',
    cadence: 'per month',
    aiCredits: 500,
    projects: 25,
    description: 'For learners building websites, games, apps, and Minecraft projects regularly.',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    cadence: 'per month',
    aiCredits: 2000,
    projects: -1,
    description: 'For heavier project work with a much larger AI allowance.',
  },
] as const;



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
  const storageKey = `${PROGRESS_KEY}:guest`;
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

  const setSkillLevel = (skillLevel: LearnerSkillLevel) => setSnapshot((current) => {
    const currentProgress = current.storageKey === storageKey
      ? current.progress
      : readProgress(storageKey);
    return currentProgress.skillLevel === skillLevel
      ? current
      : { storageKey, progress: { ...currentProgress, skillLevel } };
  });

  return { progress, complete, setSkillLevel };
}

function Header({ progressCount }: { progressCount: number }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand" data-testid="link-academy-home">
        <span className="brand-mark"><Code2 aria-hidden="true" /></span>
        <span>meta</span>
      </Link>
      <nav className="top-links" aria-label="Main navigation">
        <Link href="/" data-testid="link-explore">Explore</Link>
        <span className="top-progress" data-testid="status-lessons-completed">
          <span className="progress-dot" />
          {progressCount} / {lessons.length} lessons
        </span>
        <ThemeToggle />
      </nav>
    </header>
  );
}

function AppShell({ children, showBottomNav = true, showHeader = true }: { children: ReactNode; showBottomNav?: boolean; showHeader?: boolean }) {
  const { progress } = useProgress();
  return (
    <div className="app-shell">
      {showHeader && <Header progressCount={progress.completedLessonIds.length} />}
      {children}
      {showBottomNav && (
        <nav className="bottom-workspace-nav" aria-label="Main navigation">
          <Link href="/projects" className="bottom-workspace-button" aria-label="Projects" data-testid="button-projects">
            <FolderKanban aria-hidden="true" />
            <span>Projects</span>
          </Link>
          <Link href="/play" className="bottom-workspace-button" aria-label="Lessons" data-testid="button-lessons">
            <BookOpen aria-hidden="true" />
            <span>Lessons</span>
          </Link>
          <Link href="/settings" className="bottom-workspace-button" aria-label="Settings" data-testid="button-settings">
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
  const completedCount = progress.completedLessonIds.length;
  const completion = Math.min(100, (completedCount / lessons.length) * 100);

  return (
    <AppShell>
      <main className="home-main">
        <section className="hero" aria-labelledby="home-heading">
          <div className="hero-copy-block">
            <div className="eyebrow"><span className="eyebrow-line" /> A hands-on academy for curious minds</div>
            <h1 id="home-heading">Learn the idea.<br /><em>Then the code.</em></h1>
            <p className="hero-copy">Programming makes more sense when you can see the same idea in different languages. Start with the shared foundations, then follow the syntax wherever your curiosity goes.</p>
            <div className="hero-actions">
              <a href="#learning-path" className="button-primary" data-testid="button-start-learning">Start with lesson one <ArrowRight aria-hidden="true" /></a>
              <a href="#language-library" className="text-link" data-testid="link-browse-languages">Browse languages <ArrowRight aria-hidden="true" /></a>
            </div>
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


        <LessonPlaySection />

        <section className="pathway" id="learning-path" aria-labelledby="path-heading">
          <div className="pathway-intro">
            <p className="section-kicker">Your first six steps</p>
            <h2 id="path-heading">A little progress<br />adds up.</h2>
            <p>Short, guided lessons make the big ideas feel small enough to try. No setup, no pressure — just one useful concept at a time.</p>
            <div className="path-progress" data-testid="status-path-progress">
              <span>{completedCount} of {lessons.length} complete</span>
              <span className="progress-track" aria-hidden="true"><span className="progress-fill" style={{ width: `${completion}%` }} /></span>
            </div>
          </div>
          <div className="lesson-list">
            {lessons.map((lesson, index) => {
              const done = progress.completedLessonIds.includes(lesson.id);
              return (
                <Link href={`/learn/${lesson.id}`} className={`lesson-link${done ? ' done' : ''}`} key={lesson.id} data-testid={`link-lesson-${lesson.id}`}>
                  <span className="lesson-index">{done ? <Check aria-label="Complete" /> : String(index + 1).padStart(2, '0')}</span>
                  <span className="lesson-link-text"><strong>{lesson.title}</strong><small>{lesson.concept} · {lesson.duration}</small></span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
        <ProgressionSection progress={progress} onSkillLevelChange={setSkillLevel} />
        <footer className="footer">
          <span>META — LEARN THE IDEA, THEN THE CODE.</span>
          <span className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/delete-account">Delete account</Link><a href="mailto:metasupport43@gmail.com">Support</a></span>
        </footer>
      </main>
    </AppShell>
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
      <main className="lesson-main play-page">
        <div className="lesson-head">
          <Link href="/user-portal" className="back-link"><ArrowLeft aria-hidden="true" /> Back to Meta</Link>
          <div className="lesson-heading-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> Lesson Play</div>
              <h1>{selected ? selected.title : 'Build something real.'}</h1>
              <p className="lesson-sub">
                {selected
                  ? selected.description
                  : 'Pick a project track. Meta teaches the concept first, then gives you a guided build mission.'}
              </p>
            </div>
            <div className="lesson-meta"><Play aria-hidden="true" /> Project-based learning</div>
          </div>
        </div>

        {!selected ? (
          <section className="play-hub-grid" aria-label="Lesson Play tracks">
            {playTracks.map((track) => (
              <Link href={`/play/${track.id}`} className="play-hub-card" key={track.id}>
                <span className="play-hub-kicker">{track.shortTitle}</span>
                <h2>{track.title}</h2>
                <p>{track.description}</p>
                <span className="play-outcome">{track.outcome}</span>
                <span className="play-open">Start track <ArrowRight aria-hidden="true" /></span>
              </Link>
            ))}
          </section>
        ) : (
          <section className="play-track-layout">
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
    setProjects((current) => [...current, project]);
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
  const [error, setError] = useState('');
  const [showProjectHints] = useState(() => {
    try {
      return localStorage.getItem('meta-project-hints') !== 'false';
    } catch {
      return true;
    }
  });

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

  const htmlFile = currentFiles['index.html'] || currentFiles['src/index.html'] || '';
  const cssFile = currentFiles['style.css'] || currentFiles['styles.css'] || currentFiles['src/index.css'] || '';
  const jsFile = currentFiles['script.js'] || currentFiles['src/main.js'] || currentFiles['src/main.ts'] || '';
  const previewDocument = htmlFile
    ? htmlFile
        .replace('</head>', `<style>${cssFile}</style></head>`)
        .replace('</body>', `<script>${jsFile.replace(/<\/script>/gi, '<\\/script>')}</script></body>`)
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
                        <button type="button" className="editor-text-button danger-text" onClick={deleteActiveFile}>Delete</button>
                      </div>
                    </div>
                    <textarea
                      className="manual-code-editor"
                      value={currentFiles[activeFile] || ''}
                      onChange={(event) => updateActiveFile(event.target.value)}
                      spellCheck={false}
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
                  {showProjectHints && <p>Browser preview appears when this project has an index.html file. Other project types can still be edited and downloaded.</p>}
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
      return localStorage.getItem('meta-editor-font-size') || 'medium';
    } catch {
      return 'medium';
    }
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    try {
      return localStorage.getItem('meta-reduced-motion') === 'true';
    } catch {
      return false;
    }
  });
  const [showProjectHints, setShowProjectHints] = useState(() => {
    try {
      return localStorage.getItem('meta-project-hints') !== 'false';
    } catch {
      return true;
    }
  });

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
    localStorage.setItem('meta-editor-font-size', editorSize);
  }, [editorSize]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    localStorage.setItem('meta-reduced-motion', String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem('meta-default-project-tab', defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    localStorage.setItem('meta-project-hints', String(showProjectHints));
  }, [showProjectHints]);

  return (
    <AppShell>
      <main className="workspace-page settings-page">
        <section className="workspace-head">
          <div>
            <p className="section-kicker">Settings</p>
            <h1>Make Meta yours</h1>
            <p>Control appearance, project behavior, editor preferences, and account options.</p>
          </div>
        </section>

        <section className="settings-group profile-settings">
          <div className="settings-group-head">
            <h2>Your profile</h2>
            <p>Update the details shown on your Meta account.</p>
          </div>
          {profileLoading ? (
            <div className="profile-editor-body"><p>Loading your profile…</p></div>
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
            <div className="profile-editor-body">
              <p className="profile-status" role="status">{profileMessage || 'Please sign in with your Meta email account to edit this profile.'}</p>
              <Link href="/sign-in" className="button-secondary">Go to sign in</Link>
              <p className="profile-help">If you signed in with Discord, profile editing through Discord is not connected yet.</p>
            </div>
          )}
        </section>
        <section className="settings-group">
          <div className="settings-group-head">
            <h2>Appearance</h2>
            <p>Change how Meta looks and feels.</p>
          </div>

          <div className="settings-row">
            <div>
              <strong>Dark mode</strong>
              <span>Use the darker Meta theme.</span>
            </div>
            <label className="settings-switch">
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} aria-label="Dark mode" />
              <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
            </label>
          </div>

          <div className="settings-row">
            <div>
              <strong>Reduced motion</strong>
              <span>Reduce animations and movement across the site.</span>
            </div>
            <label className="settings-switch">
              <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} aria-label="Reduced motion" />
              <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
            </label>
          </div>
        </section>

        <section className="settings-group">
          <div className="settings-group-head">
            <h2>Projects & editor</h2>
            <p>Choose how your coding workspace opens and behaves.</p>
          </div>

          <div className="settings-row">
            <div>
              <strong>Open projects on</strong>
              <span>Choose the first tab you see when opening a project.</span>
            </div>
            <select className="settings-select" value={defaultTab} onChange={(event) => setDefaultTab(event.target.value as 'files' | 'preview' | 'chat')}>
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
            <select className="settings-select" value={editorSize} onChange={(event) => setEditorSize(event.target.value)}>
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
              <input type="checkbox" checked={showProjectHints} onChange={(event) => setShowProjectHints(event.target.checked)} aria-label="Project helper hints" />
              <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
            </label>
          </div>
        </section>

        <section className="settings-group">
          <div className="settings-group-head">
            <h2>Android app</h2>
            <p>Install Meta directly on your Android phone.</p>
          </div>
          <div className="settings-row">
            <div>
              <strong>Download Meta APK</strong>
              <span>Get the latest Android build. Android may ask you to allow installs from your browser.</span>
            </div>
            <a className="button-primary" href="/downloads/Meta-latest.apk" download="Meta.apk">
              <Download aria-hidden="true" /> Download APK
            </a>
          </div>
        </section>

        <section className="settings-group">
          <div className="settings-group-head">
            <h2>Account & billing</h2>
            <p>Manage your plan, account, and privacy options.</p>
          </div>

          <div className="settings-row">
            <div><strong>AI plan</strong><span>View AI credits, project limits, and upgrade options.</span></div>
            <Link href="/pricing" className="button-secondary">View plans</Link>
          </div>

          <div className="settings-row">
            <div>
              <strong>Account & privacy</strong>
              <span>Manage your profile, privacy, sign-in, and account deletion.</span>
            </div>
            <Link href="/account" className="button-secondary">Account settings</Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function PricingPage() {
  return (
    <AppShell>
      <main className="workspace-page">
        <section className="workspace-head pricing-head">
          <div>
            <p className="section-kicker">Meta AI plans</p>
            <h1>Pay for AI usage, not basic learning.</h1>
            <p>Lessons stay available. Paid plans increase AI project credits and the number of projects you can keep active.</p>
          </div>
        </section>
        <section className="pricing-grid">
          {aiPlans.map((plan) => (
            <article className={`pricing-card${plan.id === 'builder' ? ' featured' : ''}`} key={plan.id}>
              {plan.id === 'builder' && <span className="pricing-badge">Recommended</span>}
              <h2>{plan.name}</h2>
              <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div>
              <p>{plan.description}</p>
              <ul>
                <li><Check aria-hidden="true" /> {plan.aiCredits.toLocaleString()} AI credits / month</li>
                <li><Check aria-hidden="true" /> {plan.projects < 0 ? 'Unlimited projects' : `${plan.projects} active projects`}</li>
                <li><Check aria-hidden="true" /> Project-aware AI context</li>
                <li><Check aria-hidden="true" /> Lessons and Lesson Play included</li>
              </ul>
              {plan.id === 'free' ? (
                <button type="button" className="button-secondary">Current/free plan</button>
              ) : (
                <a
                  className="button-primary"
                  href={META_STRIPE_TEST_LINKS[plan.id]}
                  target="_blank"
                  rel="noreferrer"
                >
                  Choose {plan.name}
                </a>
              )}
            </article>
          ))}
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
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('error');

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
      if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
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

  function switchMode(registering: boolean) {
    setIsRegistering(registering);
    setMessage('');
    window.history.replaceState(null, '', registering ? '/sign-up' : '/sign-in');
  }

  return (
    <main className="login-page">
      <Link href="/" className="brand login-brand" aria-label="Meta home">
        <span className="brand-mark"><Code2 aria-hidden="true" /></span>
        <span>meta</span>
      </Link>
      <section className="login-layout">
        <div className="login-intro">
          <p className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1>Build something real.</h1>
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
  return <main className="login-page"><section className="login-card" style={{ maxWidth: 560, margin: '12vh auto' }}><p className="section-kicker">META CODELEARN</p><h2>{success ? 'Email verified' : 'Verify your email'}</h2><p className="login-card-subtitle" role="status">{message}</p>{success && <Link className="login-submit" href="/sign-in">Continue to sign in <ArrowRight aria-hidden="true" /></Link>}</section></main>;
}

function AccountSettingsPage() {
  const [discordUser, setDiscordUser] = useState<{ id: string; username: string; displayName: string; avatar: string | null; avatarUrl: string | null } | null>(null);
  const [emailUser, setEmailUser] = useState<{ id: string; email: string; verified: boolean; displayName?: string | null; profilePicture?: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
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
      setAuthMessage('You have signed out.');
      window.location.assign('/sign-in');
    } catch {
      setAuthMessage('Could not sign out right now. Please try again.');
    }
  }
  async function deleteAccount() {
    const confirmed = window.confirm(
      'Delete your Meta account data and clear saved learning progress and projects on this browser? This cannot be undone and does not delete your Google or Discord account.'
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
      for (const key of ['meta-progress-v1', 'code-atlas-progress-v1', 'meta-projects-v2', 'meta-projects-v1']) {
        localStorage.removeItem(key);
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
            <h2>Your local data</h2>
            <p>Lesson progress and project data currently remain on this browser. Discord sign-in does not yet sync learning data between devices.</p>
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
        <span className="brand-mark"><Code2 aria-hidden="true" /></span>
        <span>meta</span>
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
      <Link href="/" className="brand policy-brand">
        <span className="brand-mark"><Code2 aria-hidden="true" /></span>
        <span>meta</span>
      </Link>
      <article className="policy-card">
        <p className="section-kicker">Privacy</p>
        <h1>Meta privacy overview</h1>
        <p>Meta is a coding-learning app. Meta is currently transitioning to its own account system. Lesson progress and project data may be stored locally on your device during this transition.</p>
        <h2>What the app may store</h2>
        <p>Account identifiers, profile details supplied during sign-in, selected learning settings, and lesson progress. The app should only request data needed for learning and account functionality.</p>
        <h2>Device permissions</h2>
        <p>The core learning experience does not require contacts, call logs, SMS, precise location, microphone, camera, or background location.</p>
        <h2>Children and families</h2>
        <p>Store listing age targeting and any child-directed features must be configured accurately in Google Play Console. Features and data practices should match the audience selected there.</p>
        <h2>Account deletion and data requests</h2>
        <p>Signed-in users can delete their account from the Account page. Users who cannot access the app can use the public <Link className="policy-link" href="/delete-account">account deletion page</Link> or contact <a className="policy-link" href="mailto:metasupport43@gmail.com">metasupport43@gmail.com</a>. Account deletion is intended to remove the account and associated Meta-controlled learning/account data, subject only to any retention that is legally or security-required.</p>
        <h2>Support contact</h2>
        <p>Privacy, account, and app-support questions can be sent to <a className="policy-link" href="mailto:metasupport43@gmail.com">metasupport43@gmail.com</a>.</p>
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
  const { progress, complete } = useProgress();
  const [languageId, setLanguageId] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_KEY) ?? localStorage.getItem('code-atlas-language-v1') ?? 'python';
    } catch {
      return 'python';
    }
  });
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'try-again' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const activeLanguage = languageFor(languageId);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setShowHint(false);
  }, [params.lessonId]);

  if (!lesson) return <NotFound />;

  const currentIndex = lessons.findIndex((item) => item.id === lesson.id);
  const previous = lessons[currentIndex - 1];
  const next = lesson.nextLessonId ? lessonFor(lesson.nextLessonId) : undefined;
  const isComplete = progress.completedLessonIds.includes(lesson.id);
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
              <div className="eyebrow"><span className="eyebrow-line" /> Lesson {String(currentIndex + 1).padStart(2, '0')} / 06</div>
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
  };
  return tips[lessonId] ?? 'Build one small piece at a time.';
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
      .then(response => response.ok)
      .catch(() => false);

    const discordCheck = fetch('/api/auth/discord/me', { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(data => Boolean(data?.authenticated))
      .catch(() => false);

    Promise.all([emailCheck, discordCheck]).then(([emailSignedIn, discordSignedIn]) => {
      if (active) setStatus(emailSignedIn || discordSignedIn ? 'signed-in' : 'signed-out');
    });

    return () => {
      active = false;
    };
  }, []);

  if (status === 'checking') {
    return <main className="page-container"><p>Checking sign-in…</p></main>;
  }

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
      <Route path="/user-portal" component={() => <ProtectedRoute><UserPortal /></ProtectedRoute>} />
      <Route path="/learn/:lessonId" component={() => <ProtectedRoute><LessonPage /></ProtectedRoute>} />
      <Route path="/play" component={() => <ProtectedRoute><PlayPage /></ProtectedRoute>} />
      <Route path="/play/:track" component={() => <ProtectedRoute><PlayPage /></ProtectedRoute>} />
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
