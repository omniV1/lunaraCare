import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  layoutNextLine,
  prepareWithSegments,
  layoutWithLines,
  measureLineStats,
  walkLineRanges,
  type LayoutCursor,
} from '@chenglou/pretext';
import posterPdf from './assets/lunara-showcase-poster-revised.pdf';
import {
  architectureNarrativeText,
  narrativePullQuote,
  architectureLayers,
  artifactLinks,
  brandImages,
  codeSamples,
  featureColumns,
  heroNarrative,
  highlights,
  implementationNarrative,
  portfolioStats,
  posterBoardNarrative,
  runNarrative,
  securityDetails,
  showcaseSections,
  teamLinks,
  testingDetails,
} from './siteContent';
import { usePretextFontsReady } from './usePretextFontsReady';

const DROP_CAP_LINE_SPAN = 3;
const NARRATIVE_FONT = '400 16.5px Inter, "Segoe UI", sans-serif';
const NARRATIVE_LINE_HEIGHT = 28;
const PULLQUOTE_FONT = 'italic 600 21px "Playfair Display", Georgia, serif';
const PULLQUOTE_LINE_HEIGHT = 30;

type PositionedLine = { text: string; x: number; y: number; width: number };

type EditorialLayout = {
  lines: Array<{ text: string; width: number; maxWidth: number }>;
  lineHeight: number;
  font: string;
  dropCap: { char: string; font: string; size: number; width: number };
  dropCapLines: number;
};

type NarrativeLayout = {
  col1Lines: PositionedLine[];
  col2Lines: PositionedLine[];
  pullQuoteLines: PositionedLine[];
  pullQuoteRect: { x: number; y: number; w: number; h: number } | null;
  font: string;
  lineHeight: number;
  totalHeight: number;
  colWidth: number;
  colGap: number;
};

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });

    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function getEditorialFont(columnWidth: number): { font: string; lineHeight: number } {
  if (columnWidth < 400) return { font: '500 16px "Luxurious Roman"', lineHeight: 28 };
  if (columnWidth < 600) return { font: '500 18px "Luxurious Roman"', lineHeight: 31 };
  return { font: '500 20px "Luxurious Roman"', lineHeight: 34 };
}

function buildEditorialLayout(columnWidth: number): EditorialLayout {
  const fallback: EditorialLayout = {
    lines: [],
    lineHeight: 28,
    font: '500 16px "Luxurious Roman"',
    dropCap: { char: '', font: '', size: 0, width: 0 },
    dropCapLines: 0,
  };
  if (columnWidth <= 0) return fallback;

  const { font, lineHeight } = getEditorialFont(columnWidth);
  const prepared = prepareWithSegments(heroNarrative, font);

  const dropCapChar = heroNarrative[0]!;
  const dropCapSize = lineHeight * DROP_CAP_LINE_SPAN - 4;
  const dropCapFont = `700 ${dropCapSize}px "Playfair Display"`;
  const preparedDropCap = prepareWithSegments(dropCapChar, dropCapFont);
  let dropCapRawWidth = 0;
  walkLineRanges(preparedDropCap, 9999, (line) => {
    dropCapRawWidth = line.width;
  });
  const dropCapWidth = Math.ceil(dropCapRawWidth) + 10;

  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 1 };
  const lines: EditorialLayout['lines'] = [];
  let lineIdx = 0;

  while (true) {
    const maxWidth = lineIdx < DROP_CAP_LINE_SPAN ? columnWidth - dropCapWidth : columnWidth;
    const line = layoutNextLine(prepared, cursor, maxWidth);
    if (!line) break;
    lines.push({ text: line.text, width: line.width, maxWidth });
    cursor = line.end;
    lineIdx++;
  }

  return {
    lines,
    lineHeight,
    font,
    dropCap: { char: dropCapChar, font: dropCapFont, size: dropCapSize, width: dropCapWidth },
    dropCapLines: DROP_CAP_LINE_SPAN,
  };
}

function buildNarrativeLayout(containerWidth: number): NarrativeLayout | null {
  if (containerWidth <= 0) return null;

  const colGap = containerWidth > 700 ? 48 : 32;
  const isSingleCol = containerWidth < 560;
  const colWidth = isSingleCol
    ? containerWidth
    : Math.floor((containerWidth - colGap) / 2);

  if (colWidth < 180) return null;

  const prepared = prepareWithSegments(architectureNarrativeText, NARRATIVE_FONT);

  if (isSingleCol) {
    const result = layoutWithLines(prepared, colWidth, NARRATIVE_LINE_HEIGHT);
    const col1Lines: PositionedLine[] = result.lines.map((line, i) => ({
      text: line.text,
      x: 0,
      y: i * NARRATIVE_LINE_HEIGHT,
      width: line.width,
    }));
    return {
      col1Lines,
      col2Lines: [],
      pullQuoteLines: [],
      pullQuoteRect: null,
      font: NARRATIVE_FONT,
      lineHeight: NARRATIVE_LINE_HEIGHT,
      totalHeight: result.lineCount * NARRATIVE_LINE_HEIGHT,
      colWidth,
      colGap: 0,
    };
  }

  const pqPrepared = prepareWithSegments(narrativePullQuote, PULLQUOTE_FONT);
  const pqInnerWidth = colWidth - 32;
  const pqResult = layoutWithLines(pqPrepared, pqInnerWidth, PULLQUOTE_LINE_HEIGHT);
  const pqPadding = 20;
  const pqHeight = pqResult.lineCount * PULLQUOTE_LINE_HEIGHT + pqPadding * 2;

  const stats = measureLineStats(prepared, colWidth);
  const targetCol1Lines = Math.ceil(stats.lineCount / 2);
  const col1Height = targetCol1Lines * NARRATIVE_LINE_HEIGHT;

  const pqStartLine = Math.floor(targetCol1Lines * 0.35);
  const pqY = pqStartLine * NARRATIVE_LINE_HEIGHT;
  const col2X = colWidth + colGap;
  const pqRect = { x: col2X, y: pqY, w: colWidth, h: pqHeight };

  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  const col1Lines: PositionedLine[] = [];
  let y = 0;

  while (y + NARRATIVE_LINE_HEIGHT <= col1Height) {
    const line = layoutNextLine(prepared, cursor, colWidth);
    if (!line) break;
    col1Lines.push({ text: line.text, x: 0, y, width: line.width });
    cursor = line.end;
    y += NARRATIVE_LINE_HEIGHT;
  }

  const col2Lines: PositionedLine[] = [];
  y = 0;

  while (true) {
    const bandTop = y;
    const bandBottom = y + NARRATIVE_LINE_HEIGHT;
    let lineWidth = colWidth;

    if (bandBottom > pqRect.y && bandTop < pqRect.y + pqRect.h) {
      y += NARRATIVE_LINE_HEIGHT;
      continue;
    }

    const line = layoutNextLine(prepared, cursor, lineWidth);
    if (!line) break;
    col2Lines.push({ text: line.text, x: col2X, y, width: line.width });
    cursor = line.end;
    y += NARRATIVE_LINE_HEIGHT;
  }

  const pullQuoteLines: PositionedLine[] = pqResult.lines.map((line, i) => ({
    text: line.text,
    x: col2X + 16,
    y: pqY + pqPadding + i * PULLQUOTE_LINE_HEIGHT,
    width: line.width,
  }));

  const totalHeight = Math.max(
    col1Lines.length > 0 ? col1Lines[col1Lines.length - 1]!.y + NARRATIVE_LINE_HEIGHT : 0,
    col2Lines.length > 0 ? col2Lines[col2Lines.length - 1]!.y + NARRATIVE_LINE_HEIGHT : 0,
    pqY + pqHeight,
  );

  return {
    col1Lines,
    col2Lines,
    pullQuoteLines,
    pullQuoteRect: { x: col2X, y: pqY, w: colWidth, h: pqHeight },
    font: NARRATIVE_FONT,
    lineHeight: NARRATIVE_LINE_HEIGHT,
    totalHeight,
    colWidth,
    colGap,
  };
}

function getJustifySpacing(lineWidth: number, maxWidth: number, text: string): string | undefined {
  const gap = maxWidth - lineWidth;
  if (gap <= 0 || gap / maxWidth > 0.2) return undefined;
  const spaces = text.split(' ').length - 1;
  if (spaces <= 0) return undefined;
  return `${gap / spaces}px`;
}

function useScrollReveal<T extends HTMLElement>(threshold = 0.08) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -32px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

const KEYWORD_SET = new Set([
  'const', 'let', 'var', 'import', 'export', 'from', 'async', 'await',
  'return', 'if', 'else', 'new', 'function', 'type', 'interface', 'class',
  'extends', 'true', 'false', 'null', 'undefined', 'void',
]);

const TOKEN_RE =
  /(\/\/[^\n]*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b(?:const|let|var|import|export|from|async|await|return|if|else|new|function|type|interface|class|extends|true|false|null|undefined|void)\b|\b\d+(?:\.\d+)?\b)/g;

function highlightLine(line: string): React.ReactNode[] {
  const parts = line.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('//'))
      return <span key={i} className="tok-comment">{part}</span>;
    if (part[0] === "'" || part[0] === '"' || part[0] === '`')
      return <span key={i} className="tok-string">{part}</span>;
    if (/^\d/.test(part))
      return <span key={i} className="tok-number">{part}</span>;
    if (KEYWORD_SET.has(part))
      return <span key={i} className="tok-keyword">{part}</span>;
    return <span key={i}>{part}</span>;
  });
}

function CodeShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  const tabBarRef = useRef<HTMLDivElement>(null);

  const scrollTabIntoView = useCallback((idx: number) => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const btn = bar.children[idx] as HTMLElement | undefined;
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, []);

  const sample = codeSamples[activeIdx]!;
  const lines = sample.snippet.split('\n');

  return (
    <div ref={ref} className={`code-showcase${visible ? ' code-showcase--visible' : ''}`}>
      <div className="code-tab-bar" ref={tabBarRef}>
        {codeSamples.map((s, i) => (
          <button
            key={s.title}
            className={`code-tab${i === activeIdx ? ' code-tab--active' : ''}`}
            onClick={() => { setActiveIdx(i); scrollTabIntoView(i); }}
          >
            <span className="code-tab-label">{s.title}</span>
            <span className="code-tab-lang">{s.language}</span>
          </button>
        ))}
      </div>
      <div key={activeIdx} className="code-panel">
        <div className="code-lines">
          {lines.map((line, i) => (
            <div key={i} className="code-line">
              <span className="code-line-num">{i + 1}</span>
              <span className="code-line-content">{highlightLine(line)}</span>
            </div>
          ))}
        </div>
        <span className="code-cursor" />
      </div>
    </div>
  );
}

function PretextNarrative() {
  const fontsReady = usePretextFontsReady();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const layout = useMemo(
    () => (fontsReady ? buildNarrativeLayout(width) : null),
    [fontsReady, width]
  );

  if (!layout) {
    return (
      <div ref={ref} className="pretext-narrative">
        <p className="narrative-paragraph">{architectureNarrativeText}</p>
      </div>
    );
  }

  const allLines = [...layout.col1Lines, ...layout.col2Lines];
  const isReady = fontsReady && width > 0;

  return (
    <div
      ref={ref}
      className={`pretext-narrative${isReady ? ' pretext-narrative--ready' : ''}`}
      style={{ height: layout.totalHeight }}
    >
      {layout.colGap > 0 && (
        <div
          className="pretext-divider"
          style={{ left: layout.colWidth + layout.colGap / 2 }}
        />
      )}

      {allLines.map((line, i) => (
        <span
          key={i}
          className="pretext-line"
          style={{
            left: line.x,
            top: line.y,
            font: layout.font,
            lineHeight: `${layout.lineHeight}px`,
            wordSpacing: getJustifySpacing(line.width, layout.colWidth, line.text),
          }}
        >
          {line.text}
        </span>
      ))}

      {layout.pullQuoteRect && (
        <blockquote
          className="pretext-pull-quote"
          style={{
            left: layout.pullQuoteRect.x,
            top: layout.pullQuoteRect.y,
            width: layout.pullQuoteRect.w,
            height: layout.pullQuoteRect.h,
          }}
        >
          {layout.pullQuoteLines.map((line, i) => (
            <span
              key={i}
              className="pretext-pull-quote-line"
              style={{
                left: line.x - layout.pullQuoteRect!.x,
                top: line.y - layout.pullQuoteRect!.y,
                font: PULLQUOTE_FONT,
                lineHeight: `${PULLQUOTE_LINE_HEIGHT}px`,
              }}
            >
              {line.text}
            </span>
          ))}
        </blockquote>
      )}
    </div>
  );
}

function App() {
  const fontsReady = usePretextFontsReady();
  const { ref, width } = useElementWidth<HTMLDivElement>();

  const editorialLayout = useMemo(
    () => (fontsReady ? buildEditorialLayout(width) : buildEditorialLayout(0)),
    [fontsReady, width]
  );

  const editorialReady = fontsReady && width > 0;

  const resolvedArtifactLinks = useMemo(
    () =>
      artifactLinks.map((artifact) =>
        artifact.title === 'Showcase poster' ? { ...artifact, href: posterPdf } : artifact
      ),
    []
  );

  const editorialTextStyle = useMemo(
    () =>
      ({
        ['--editorial-font']: editorialLayout.font,
        ['--editorial-line-height']: `${editorialLayout.lineHeight}px`,
      }) as CSSProperties,
    [editorialLayout.font, editorialLayout.lineHeight]
  );

  return (
    <div className="page-shell">
      <header className="hero-shell">
        <div className="topbar">
          <div className="topbar-wordmark">
            <span className="topbar-script">Lunara</span>
            <span className="topbar-divider" />
            <span className="topbar-label">Senior Project</span>
          </div>
          <nav className="topbar-nav">
            <a href="https://www.lunaracare.org" target="_blank" rel="noreferrer">
              Live App
            </a>
            <a href="https://github.com/omniV1/lunaraCare" target="_blank" rel="noreferrer">
              Repository
            </a>
            <a href="https://lunara.onrender.com/api-docs" target="_blank" rel="noreferrer">
              API Docs
            </a>
          </nav>
        </div>

        <div className="hero-stage">
          <div className="hero-backdrop">
            <img src={brandImages.hero} alt="" />
          </div>
          <div className="hero-overlay" />
          <div className="hero-stage-content">
            <div className="hero-copy">
              <p className="eyebrow">LUNARA PROJECT PORTFOLIO</p>
              <h1>Postpartum care continuity, packaged as a production-ready full-stack platform.</h1>
              <p className="hero-summary">
                LUNARA unifies the public brand experience, provider operations, and client recovery
                workflows into one coordinated platform built for secure communication, sustained
                support, and long-term maintainability.
              </p>
              <div className="hero-links">
                <a href="https://www.lunaracare.org" target="_blank" rel="noreferrer">
                  Open the live application
                </a>
                <a href="https://github.com/omniV1/lunaraCare" target="_blank" rel="noreferrer">
                  Browse the repository
                </a>
                <a href="https://lunara.onrender.com/api-docs" target="_blank" rel="noreferrer">
                  Review the API surface
                </a>
              </div>
            </div>

            <div className="hero-stats">
              {portfolioStats.map((stat) => (
                <article key={stat.label} className="stat-pill">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="editorial-shell">
          <div className="editorial-stage">
            <div
              className={`editorial-text-layer${editorialReady ? ' editorial-text-layer--ready' : ''}`}
              ref={ref}
              style={editorialTextStyle}
            >
              {editorialLayout.dropCap.char && (
                <span
                  className="editorial-drop-cap"
                  style={{
                    font: editorialLayout.dropCap.font,
                    lineHeight: `${editorialLayout.dropCap.size}px`,
                    width: editorialLayout.dropCap.width,
                    height: editorialLayout.dropCap.size,
                  }}
                >
                  {editorialLayout.dropCap.char}
                </span>
              )}
              {editorialLayout.lines.map((line, i) => (
                <span
                  key={i}
                  className={`editorial-line${i < editorialLayout.dropCapLines ? ' editorial-line--indented' : ''}`}
                  style={{
                    ...(i < editorialLayout.dropCapLines
                      ? { paddingLeft: `${editorialLayout.dropCap.width}px` }
                      : undefined),
                    wordSpacing: getJustifySpacing(line.width, line.maxWidth, line.text),
                  }}
                >
                  {line.text}
                </span>
              ))}
            </div>

            <aside className="editorial-obstacle">
              <img className="editorial-seal" src={brandImages.seal} alt="Lunara seal" />
              <p className="obstacle-label">Operational snapshot</p>
              <h2>A single product surface for recovery, scheduling, messaging, and care planning.</h2>
              <p>
                The application ties together public discovery, provider coordination, and client
                engagement without breaking the emotional tone of the brand. Providers and clients
                each get role-aware dashboards with realtime messaging, appointment management, and
                document workflows — alongside content, care plans, and recovery context — all
                unified in one system.
              </p>
            </aside>
          </div>
        </div>
      </header>

      <main className="content-shell">
        <ShowcaseRail />

        <Section
          title="Project overview"
          description="A coordinated postpartum platform across public, provider, and client experiences."
        >
          <PretextNarrative />
          <div className="highlight-list highlight-list--wide">
            {highlights.map((item) => (
              <article key={item.title} className="highlight-item">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <section className="poster-board">
          <div className="poster-board-frame">
            <iframe
              src={`${posterPdf}#view=FitH`}
              title="LUNARA showcase poster"
              className="poster-iframe"
            />
            <a
              href={posterPdf}
              target="_blank"
              rel="noreferrer"
              className="poster-fallback"
            >
              <img className="editorial-seal" src={brandImages.seal} alt="" />
              <span className="poster-fallback-label">Showcase poster</span>
              <span className="poster-fallback-action">Tap to open full poster (PDF)</span>
            </a>
          </div>
          <div className="poster-board-copy">
            <p className="eyebrow">Presentation artifact</p>
            <h2>A visual summary of the architecture, workflows, and delivery evidence behind the release.</h2>
            <p>
              The showcase poster captures the full product story in a single presentation-ready
              format: system architecture, provider and client workflows, testing coverage, deployment
              topology, and the technology decisions that shaped the build.
            </p>
            {posterBoardNarrative.split('\n\n').map((paragraph, i) => (
              <p key={i} className="narrative-paragraph">{paragraph}</p>
            ))}
            <div className="hero-links poster-actions">
              <a href={posterPdf} target="_blank" rel="noreferrer">
                Open the poster
              </a>
              <a href="https://www.lunaracare.org" target="_blank" rel="noreferrer">
                Compare with the live product
              </a>
            </div>
          </div>
        </section>

        <Section
          title="Architecture in one view"
          description="Application flow, coordination services, persistence, and operations are all deliberate parts of the release story."
        >
          <div className="architecture-stack">
            {architectureLayers.map((layer, index) => (
              <div key={layer.name} className="architecture-row">
                <div className="architecture-node">
                  <p className="architecture-name">{layer.name}</p>
                  <p>{layer.detail}</p>
                </div>
                {index < architectureLayers.length - 1 ? <div className="architecture-arrow" /> : null}
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Feature coverage"
          description="Provider and client flows were designed as parallel workspaces with different responsibilities but the same source of truth."
        >
          <div className="column-grid">
            {featureColumns.map((column) => (
              <article key={column.heading} className="content-card">
                <h3>{column.heading}</h3>
                <p>{column.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          title="Security posture"
          description="Authentication, transport security, rate limiting, and data safety are deliberate architecture decisions, not afterthoughts."
        >
          <div className="column-grid">
            {securityDetails.map((item) => (
              <article key={item.title} className="content-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          title="Testing and quality assurance"
          description="Every layer of the stack is covered by automated tests, and every merge is gated by CI checks and static analysis."
        >
          <div className="column-grid">
            {testingDetails.map((item) => (
              <article key={item.title} className="content-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          title="Code excerpts"
          description="Implementation slices showing how the product handles seeded access, guarded workflows, and realtime communication."
        >
          <CodeShowcase />
        </Section>

        <Section
          title="Artifacts and evidence"
          description="Everything a reviewer needs to validate the build, from docs to presentation materials."
        >
          <div className="artifact-list">
            {resolvedArtifactLinks.map((artifact) => (
              <a
                key={artifact.title}
                className="artifact-card"
                href={artifact.href}
                target="_blank"
                rel="noreferrer"
              >
                <div>
                  <p className="artifact-meta">{artifact.meta}</p>
                  <h3>{artifact.title}</h3>
                  <p>{artifact.description}</p>
                </div>
                <span className="artifact-arrow">Open</span>
              </a>
            ))}
          </div>
        </Section>

        <Section
          title="Implementation notes"
          description="Access details, deployment footprint, and demo setup matter because this system was built to be reviewed and run."
        >
          <div className="column-grid">
            <article className="content-card">
              <h3>Access and demo setup</h3>
              {implementationNarrative.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </article>
            <article className="content-card">
              <h3>Run locally</h3>
              {runNarrative.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </article>
          </div>
        </Section>

        <Section
          title="Team references"
          description="Developer portfolios linked below showcase the individuals behind LUNARA."
        >
          <div className="team-grid">
            {teamLinks.map((member) => (
              <article key={member.name} className="content-card">
                <h3>{member.name}</h3>
                <p className="team-role">{member.role}</p>
                <p>{member.note}</p>
                {member.href ? (
                  <a href={member.href} target="_blank" rel="noreferrer">
                    Visit site
                  </a>
                ) : (
                  <span className="team-unavailable">No public site linked</span>
                )}
              </article>
            ))}
          </div>
        </Section>

        <footer className="portfolio-footer">
          <div className="portfolio-footer-copy">
            <span className="topbar-script">Lunara</span>
            <p>
              A senior project showcase anchored by the live application at{' '}
              <a href="https://www.lunaracare.org" target="_blank" rel="noreferrer">
                lunaracare.org
              </a>
              .
            </p>
          </div>
          <div className="portfolio-footer-links">
            <a href="https://www.lunaracare.org" target="_blank" rel="noreferrer">
              Live app
            </a>
            <a href="https://github.com/omniV1/lunaraCare" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://lunara.onrender.com/api-docs" target="_blank" rel="noreferrer">
              API docs
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ShowcaseRail() {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  return (
    <section ref={ref} className={`showcase-rail${visible ? ' showcase-rail--visible' : ''}`}>
      {showcaseSections.map((section, i) => (
        <article
          key={section.title}
          className={`showcase-card ${
            section.align === 'image-left' ? 'showcase-card--reverse' : ''
          }`}
          style={{ transitionDelay: `${i * 150}ms` }}
        >
          <div className="showcase-media">
            <img src={section.image} alt={section.title} />
          </div>
          <div className="showcase-copy">
            <p className="eyebrow">{section.kicker}</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

type SectionProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function Section({ title, description, children }: SectionProps) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  return (
    <section ref={ref} className={`section-block scroll-reveal${visible ? ' scroll-reveal--visible' : ''}`}>
      <div className="section-heading">
        <p className="eyebrow">{title}</p>
        <h2>{description}</h2>
      </div>
      {children}
    </section>
  );
}

export default App;
