'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { PageViewTracker } from '@/components/analytics/page-view-tracker';
import { WathbaFeedbackProvider } from './wathba-feedback';
import { WathbaFooter } from './wathba-footer';
import { WathbaHeader } from './wathba-header';
import { persistTheme, resolveTheme, SSR_THEME, THEME_INIT_SCRIPT } from './wathba-theme';
import { wathbaCssVars, wathbaKeyframes, type WathbaTheme } from './wathba-tokens';

/**
 * Wathba (وثبة) pillar shell — provides the design's CSS-variable theming,
 * keyframes, header + footer, and a content slot.
 *
 * The variables are inlined as React style props on the wrapper div so we
 * don't pollute global CSS for the rest of the app (the pillar-local scope
 * matches what the design itself does via [data-theme="light"|"dark"]).
 */
export function WathbaShell({
  children,
  defaultTheme = SSR_THEME,
}: {
  children: ReactNode;
  defaultTheme?: WathbaTheme;
}) {
  const [theme, setTheme] = useState<WathbaTheme>(defaultTheme);

  /**
   * HOME-REVIEW D7 — adopt the reader's real theme.
   *
   * This runs AFTER first paint, and that is fine: on a hard load
   * THEME_INIT_SCRIPT has already put the right palette on the wrapper, so
   * this only brings React's state into line with what is on screen (which is
   * what makes the header's toggle show the right icon, and toggle the right
   * way). On a client-side navigation the script does not re-run — React never
   * executes an inserted inline script — and then this IS the mechanism. Both
   * paths resolve by the same rule, so they cannot disagree.
   */
  useEffect(() => {
    setTheme(resolveTheme());
  }, []);

  const setAndPersistTheme = (next: WathbaTheme) => {
    setTheme(next);
    persistTheme(next);
  };

  const styleVars: CSSProperties = {
    ...(wathbaCssVars[theme] as unknown as CSSProperties),
    /**
     * HOME-REVIEW — the motion scale.
     *
     * The surface carried twelve ad-hoc durations (.16 .18 .2 .22 .25 .35 .4
     * .5 .62 .8 1.1 1.4s) and reached for the browser's default `ease` wherever
     * a curve was omitted. Twelve durations is not a decision, it is twelve
     * separate ones — and `ease` is the absence of a choice rather than a
     * choice, weak at both ends where the reader is actually looking.
     *
     * Four steps, named for the EVENT rather than the number, because the
     * event is what decides:
     *   press   — a button answering a finger; must feel like contact
     *   hover   — a colour or border acknowledging a cursor
     *   reveal  — something entering or leaving the page
     *   drift   — the hero's calm auto-advance, the one thing nobody asked for
     *
     * The curve is a strong ease-out for anything entering or leaving: it
     * starts fast, so the reader sees movement in the frame they are watching
     * most. ease-in is deliberately absent — it delays the opening frames and
     * reads as lag no matter how short the duration.
     */
    ['--dur-press' as string]: '120ms',
    ['--dur-hover' as string]: '180ms',
    ['--dur-reveal' as string]: '240ms',
    ['--dur-drift' as string]: '520ms',
    ['--ease-out' as string]: 'cubic-bezier(.23,1,.32,1)',
    ['--ease-in-out' as string]: 'cubic-bezier(.77,0,.175,1)',
    /**
     * HOME-REVIEW — the vertical rhythm. Two values: a new chapter, and the
     * next thing in this one.
     *
     * clamp() rather than a breakpoint, and INLINE rather than in the <style>
     * block below, for one reason each and both were measured:
     *
     *  · Inline, because that block is inside this wrapper. A section styled
     *    `margin-top: var(--gap-act)` computes to 0 while the property is still
     *    undefined and then jumps once it resolves, dragging everything beneath
     *    it. That cost 0.07 CLS on a phone — worse than the rhythm was worth.
     *  · clamp(), because an inline custom property cannot be overridden by a
     *    media query at all, so the mobile step would silently never apply.
     *
     * The ratio stays ~1.7:1 at both ends: the ratio is what a reader perceives
     * as structure, while the absolute height is what makes a rich page feel
     * endless on a 360px screen.
     */
    ['--gap-act' as string]: 'clamp(64px, 8vw, 96px)',
    ['--gap-within' as string]: 'clamp(40px, 5vw, 56px)',
    /**
     * HOME-REVIEW — the vertical rhythm, as tokens so it can breathe less on a
     * phone. Two values only: a new chapter, and the next thing in this one.
     * The mobile pair keeps roughly the same RATIO (1.6–1.7:1) because the
     * ratio is what a reader perceives as structure — while cutting the
     * absolute height, which on a 360px screen is what makes a rich page feel
     * endless rather than organised. Overridden below 760px in the CSS block.
     */
    /**
     * The brand wash — bounded to the area it actually occupies.
     *
     * This is one element and it is as tall as the whole document, so painting
     * two RADIAL gradients over it meant evaluating them across 6.1 megapixels
     * on /spotlight and 11.4 on /projects — six to eleven times the viewport —
     * for a decoration that fades out by y≈330. Measured, it was the single
     * largest cost in the pre-paint window: FCP −349ms with this bounded form,
     * faster in 11 of 12 paired runs, CLS unchanged at 0.
     *
     * Two changes, and the second one is a bug fix rather than a speed-up:
     *
     *  · `background-size` + `no-repeat` stop the gradient being evaluated
     *    below the band it is visible in. The rest of the element is the flat
     *    --bg colour, which is what it already looked like.
     *
     *  · The vertical anchor is now PIXELS, not a percentage. A percentage in
     *    `at 85% -5%` resolves against the background positioning area — this
     *    element — so `-5%` meant "minus five percent of however long this page
     *    happens to be", and the wash landed somewhere different on every
     *    route. Sampled at x=1140 with content hidden: on /spotlight (4462px)
     *    it renders, tint +17 at the top; on /projects (8371px) it was pushed
     *    entirely off-screen and the browser painted 11.4Mpx to produce
     *    nothing. -223px is exactly what -5% resolved to on /spotlight, so
     *    that page is unchanged (max channel difference 3 across the ground);
     *    the long pages now get the wash they were always meant to have.
     *
     * NOT the hero scrim, which is a separate 1366x668 layer in
     * wathba-spotlight.tsx. Ablation ruled out hydration (-96ms), the cover
     * images (noise) and layout volume (content-visibility halved the Layout
     * event and moved FCP not at all). Full write-up, including why the
     * absolute milliseconds are a no-GPU worst case, in
     * /root/spotlight-prepaint-investigation.md.
     */
    backgroundImage:
      'radial-gradient(1200px 700px at 85% -223px,rgba(var(--accent-rgb),.10),transparent 60%),radial-gradient(900px 600px at 0 0,rgba(var(--accent2-rgb),.10),transparent 55%)',
    backgroundColor: 'var(--bg)',
    backgroundRepeat: 'no-repeat',
    // Each layer bounded just past where its own colour stop reaches zero:
    // 700px radius x 60% = 420 below a centre at -223 -> 197; 600 x 55% = 330.
    backgroundSize: '100% 520px, 100% 340px',
    color: 'var(--text)',
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
    WebkitFontSmoothing: 'antialiased',
    direction: 'rtl',
    minHeight: '100vh',
    transition: 'background .4s, color .4s',
  };

  return (
    <div data-theme={theme} data-pillar="ventures" style={styleVars}>
      {/* HOME-REVIEW D7 — FIRST child, deliberately. It reads
       *  `document.currentScript.parentElement`, so it must sit inside the
       *  element it themes, and it must run before anything below it paints.
       *  See wathba-theme.ts for why it carries a palette instead of just
       *  stamping data-theme the way the ops shell does. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {/* keyframes + a couple shared utility styles scoped via :where to leak no specificity */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            ${wathbaKeyframes}
            /* STAKES/S-2 — clip residual horizontal overflow (home ticker,
               campaign hero, header slack on the smallest phones) so no page
               scrolls sideways. overflow-x clip (not hidden/auto) keeps
               position:sticky working since it creates no scroll container. */
            [data-pillar="ventures"]{overflow-x:clip}
            [data-pillar="ventures"] .wathba-ph{background-color:var(--ph-bg);background-image:repeating-linear-gradient(135deg,rgba(var(--accent-rgb),.07) 0,rgba(var(--accent-rgb),.07) 2px,transparent 2px,transparent 11px)}
            [data-pillar="ventures"] .wathba-fade{animation:wathba-fadeUp .45s ease both}

            /* ── POLISH — the account slot reserves WIDTH, not just height ──
               /api/me resolves after mount and the signed-out state renders two
               CTAs where the loading placeholder was a 42px square. The slot
               went 94px → 258px wide, which squeezed the nav until IT wrapped
               too (26px → 48px) — so the header grew and every page shifted
               ~0.11. Reserving only the height does not help: the WIDTH change
               is what drives the wrap.
               Below the mobile breakpoint the desktop login link is hidden and
               the header is tight, so the reservation is dropped there. */
            [data-pillar="ventures"] .wathba-account-slot{min-width:206px;height:42px;display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-shrink:0;white-space:nowrap}
            @media (max-width:999px){
              /* HOME-REVIEW — 59px, NOT 0.
                 Dropping the reservation entirely here left the loading state
                 0px wide, so when /api/me answered (~1.3s, measured) the
                 compact «ابدأ» button appeared, the header reflowed, and every
                 section below it moved. That was the homepage's mobile CLS:
                 a single 0.119 shift landing at the exact millisecond of the
                 /me response.
                 The desktop reservation exists for the same reason and the
                 component's own comment states the intent — the slot "reserves
                 the same box in all three states" — so mobile was the case that
                 quietly opted out of it.
                 59px is the widest mobile state (signed out: «ابدأ» at 59px;
                 signed in: the avatar at 42px; loading: empty). It costs the
                 header nothing, because the signed-out header already carries
                 that button and fits. */
              [data-pillar="ventures"] .wathba-account-slot{min-width:59px}
            }

            /* ── Batch ACCOUNT / U4 — the account panel ────────────────────
               These are CLASSES because the previous version was 21 inline
               style objects with ZERO focus styles: :hover, :focus-visible and
               :disabled cannot be expressed inline at all, so the missing focus
               ring was unreachable until the styles moved here.

               Rhythm: ONE height for every NAV row (40px), ONE nav icon size
               (20px), ONE label size (14px). The identity row and the project
               rows are deliberately taller — they carry an avatar and a 48px
               thumbnail — and the thumb's placeholder glyph is 18px. Measured:
               rows [61, 40, 56], icons [20, 18]. Stated rather than claimed as
               a single value it is not. The project ships a MOTION scale (--dur-*/--ease-*)
               and this adopts it; it ships no spacing-scale token, so the panel
               uses a plain 4px rhythm rather than inventing a token set. */
            [data-pillar="ventures"] .wathba-acct-root{position:relative}
            [data-pillar="ventures"] .wathba-acct-trigger{
              width:42px;height:42px;border-radius:13px;overflow:hidden;padding:0;
              border:1px solid rgba(var(--ink-rgb),.12);background:rgba(var(--accent-rgb),.12);
              color:var(--accent-ink);font-weight:800;font-size:17px;font-family:inherit;
              cursor:pointer;display:grid;place-items:center;
              transition:background var(--dur-hover) var(--ease-out);
            }
            [data-pillar="ventures"] .wathba-acct-trigger:hover{background:rgba(var(--accent-rgb),.2)}
            [data-pillar="ventures"] .wathba-account-panel{
              position:absolute;top:calc(100% + 8px);inset-inline-end:0;
              width:620px;max-width:calc(100vw - 24px);z-index:80;
              background:var(--card);border:1px solid rgba(var(--ink-rgb),.1);
              border-radius:16px;box-shadow:0 30px 60px -24px rgba(0,0,0,.5);padding:8px;
              animation:wathba-acct-in var(--dur-hover) var(--ease-out);
            }
            @keyframes wathba-acct-in{
              /* Never from scale(0): nothing in the world appears from nothing. */
              from{opacity:0;transform:translateY(-4px) scale(.98)}
              to{opacity:1;transform:none}
            }
            [data-pillar="ventures"] .wathba-account-cols{display:grid;grid-template-columns:1.4fr 1fr;gap:8px}
            [data-pillar="ventures"] .wathba-acct-col-b{
              border-inline-start:1px solid rgba(var(--ink-rgb),.08);padding-inline-start:8px;min-width:0;
            }

            /* The four states, on every interactive row. */
            [data-pillar="ventures"] .wathba-acct-row{
              display:flex;align-items:center;gap:10px;min-height:40px;padding:0 10px;
              border-radius:10px;text-decoration:none;color:var(--text-soft);
              font-size:14px;font-weight:500;text-align:start;width:100%;
              border:none;background:transparent;font-family:inherit;cursor:pointer;
              transition:background var(--dur-hover) var(--ease-out);
            }
            [data-pillar="ventures"] .wathba-acct-row:hover{background:rgba(var(--ink-rgb),.05)}
            [data-pillar="ventures"] .wathba-acct-row:focus-visible,
            [data-pillar="ventures"] .wathba-acct-project:focus-visible,
            [data-pillar="ventures"] .wathba-acct-identity:focus-visible,
            [data-pillar="ventures"] .wathba-acct-create:focus-visible,
            [data-pillar="ventures"] .wathba-acct-trigger:focus-visible{
              outline:2px solid var(--accent);outline-offset:2px;
            }
            [data-pillar="ventures"] .wathba-acct-row.is-destructive{color:var(--err,#dc2626)}
            [data-pillar="ventures"] .wathba-acct-row.is-destructive:hover{background:rgba(220,38,38,.08)}

            [data-pillar="ventures"] .wathba-acct-identity{
              display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;
              text-decoration:none;border-bottom:1px solid rgba(var(--ink-rgb),.08);margin-bottom:4px;
              transition:background var(--dur-hover) var(--ease-out);
            }
            [data-pillar="ventures"] .wathba-acct-identity:hover{background:rgba(var(--ink-rgb),.04)}
            [data-pillar="ventures"] .wathba-acct-avatar{
              width:40px;height:40px;border-radius:11px;flex-shrink:0;display:grid;place-items:center;
              background:rgba(var(--accent-rgb),.12);color:var(--accent-ink);font-weight:800;font-size:16px;overflow:hidden;
            }
            [data-pillar="ventures"] .wathba-acct-identity-text{min-width:0}
            [data-pillar="ventures"] .wathba-acct-identity-text strong{display:block;font-weight:700;font-size:14px;color:var(--text)}
            [data-pillar="ventures"] .wathba-acct-identity-text em{display:block;font-style:normal;font-size:12px;color:var(--muted2)}

            [data-pillar="ventures"] .wathba-acct-divider{
              height:1px;border:0;background:rgba(var(--ink-rgb),.08);margin:4px 0;
            }
            [data-pillar="ventures"] .wathba-acct-section{
              display:flex;align-items:center;gap:6px;margin:0;padding:4px 10px 8px;
              font-size:12px;font-weight:700;color:var(--muted2);
            }
            [data-pillar="ventures"] .wathba-acct-chip{
              font-size:11px;font-weight:700;color:var(--accent-ink);
              background:rgba(var(--accent-rgb),.12);border-radius:999px;padding:1px 7px;
            }
            [data-pillar="ventures"] .wathba-acct-project{
              display:flex;align-items:center;gap:9px;padding:4px 8px;border-radius:10px;text-decoration:none;
              transition:background var(--dur-hover) var(--ease-out);
            }
            [data-pillar="ventures"] .wathba-acct-project:hover{background:rgba(var(--ink-rgb),.05)}
            [data-pillar="ventures"] .wathba-acct-thumb{
              width:48px;height:48px;border-radius:9px;flex-shrink:0;display:grid;place-items:center;
              background:rgba(var(--accent-rgb),.10);overflow:hidden;
            }
            [data-pillar="ventures"] .wathba-acct-thumb img{border-radius:9px;object-fit:cover}
            [data-pillar="ventures"] .wathba-acct-project-text{min-width:0;flex:1}
            [data-pillar="ventures"] .wathba-acct-project-text strong{
              display:block;font-size:13.5px;font-weight:600;color:var(--text);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            }
            [data-pillar="ventures"] .wathba-acct-project-text em{
              display:inline-block;margin-top:3px;font-style:normal;font-size:11px;font-weight:600;
              color:var(--muted2);background:rgba(var(--ink-rgb),.06);border-radius:999px;padding:1px 8px;
            }
            [data-pillar="ventures"] .wathba-acct-empty{
              padding:2px 10px 10px;margin:0;font-size:12.5px;line-height:1.7;color:var(--muted2);
            }
            [data-pillar="ventures"] .wathba-acct-create{
              display:block;margin-top:8px;text-align:center;background:var(--grad);color:var(--on-accent);
              font-weight:700;font-size:13.5px;padding:10px;border-radius:11px;text-decoration:none;
            }
            /* Disabled carries its REASON — a refusal nobody can read is a dead click. */
            [data-pillar="ventures"] .wathba-acct-create.is-off{
              background:rgba(var(--ink-rgb),.06);color:var(--muted2);cursor:not-allowed;
            }
            [data-pillar="ventures"] .wathba-acct-create.is-off em{
              display:block;font-style:normal;font-size:11.5px;font-weight:500;margin-top:2px;
            }
            [data-pillar="ventures"] .wathba-acct-skeleton{
              display:block;height:48px;border-radius:9px;margin:2px 8px;background:rgba(var(--ink-rgb),.06);
            }
            [data-pillar="ventures"] .wathba-acct-login{
              cursor:pointer;font-size:14.5px;color:var(--muted);font-weight:500;text-decoration:none;
            }
            [data-pillar="ventures"] .wathba-acct-start{
              border:none;cursor:pointer;background:var(--grad);color:var(--on-accent);font-weight:700;
              font-size:14px;padding:11px 19px;border-radius:13px;text-decoration:none;display:inline-block;
            }

            /* ── Batch ACCOUNT / U5 — /following, /recommendations ───────── */
            [data-pillar="ventures"] .wathba-follow-page{max-width:720px;margin:0 auto;padding:28px 16px 64px}
            [data-pillar="ventures"] .wathba-follow-page h1{font-size:24px;font-weight:800;margin:0 0 4px}
            [data-pillar="ventures"] .wathba-follow-lede{
              font-size:13.5px;color:var(--muted2);margin:0 0 18px;line-height:1.8;
            }
            [data-pillar="ventures"] .wathba-follow-lede a{color:var(--accent-ink)}
            [data-pillar="ventures"] .wathba-follow-tabs{
              display:flex;gap:4px;border-bottom:1px solid rgba(var(--ink-rgb),.1);margin-bottom:14px;
            }
            [data-pillar="ventures"] .wathba-follow-tabs button{
              border:none;background:transparent;cursor:pointer;font-family:inherit;
              padding:9px 12px;font-size:14px;font-weight:500;color:var(--muted);
              border-bottom:2px solid transparent;
              transition:color var(--dur-hover) var(--ease-out);
            }
            [data-pillar="ventures"] .wathba-follow-tabs button:hover{color:var(--text)}
            [data-pillar="ventures"] .wathba-follow-tabs button.is-active{
              font-weight:700;color:var(--accent-ink);border-bottom-color:var(--accent);
            }
            [data-pillar="ventures"] .wathba-follow-tabs button:focus-visible,
            [data-pillar="ventures"] .wathba-follow-list button:focus-visible,
            [data-pillar="ventures"] .wathba-follow-empty a:focus-visible{
              outline:2px solid var(--accent);outline-offset:2px;
            }
            [data-pillar="ventures"] .wathba-follow-skeletons span{
              display:block;height:62px;border-radius:12px;background:rgba(var(--ink-rgb),.06);margin-bottom:8px;
            }
            [data-pillar="ventures"] .wathba-follow-empty{text-align:center;padding:36px 16px}
            [data-pillar="ventures"] .wathba-follow-empty p{
              font-size:14px;color:var(--muted2);line-height:1.9;margin:0 0 14px;
            }
            [data-pillar="ventures"] .wathba-follow-empty a{
              display:inline-block;background:var(--grad);color:var(--on-accent);
              font-weight:700;font-size:14px;padding:10px 20px;border-radius:12px;text-decoration:none;
            }
            [data-pillar="ventures"] .wathba-follow-list{
              list-style:none;padding:0;margin:0;display:grid;gap:8px;
            }
            [data-pillar="ventures"] .wathba-follow-list li{
              display:flex;align-items:center;gap:12px;padding:12px 14px;
              border:1px solid rgba(var(--ink-rgb),.1);border-radius:12px;
            }
            [data-pillar="ventures"] .wathba-follow-list li > div{min-width:0;flex:1}
            [data-pillar="ventures"] .wathba-follow-list li a{
              font-size:14.5px;font-weight:700;color:var(--text);text-decoration:none;
              display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            }
            [data-pillar="ventures"] .wathba-follow-list li span{font-size:12px;color:var(--muted2)}
            [data-pillar="ventures"] .wathba-follow-list li button{
              border:1px solid rgba(var(--ink-rgb),.14);background:transparent;color:var(--muted);
              font-family:inherit;font-size:13px;font-weight:600;padding:7px 14px;border-radius:10px;cursor:pointer;
              transition:background var(--dur-hover) var(--ease-out);
            }
            [data-pillar="ventures"] .wathba-follow-list li button:hover{background:rgba(var(--ink-rgb),.05)}
            [data-pillar="ventures"] .wathba-follow-list li button:disabled{opacity:.5;cursor:progress}

            /* ── Batch ACCOUNT / U6 — the request status tracker ─────────── */
            [data-pillar="ventures"] .wathba-request-page{max-width:620px;margin:0 auto;padding:32px 16px 64px}
            [data-pillar="ventures"] .wathba-request-eyebrow{font-size:12.5px;color:var(--muted2);margin:0 0 6px}
            [data-pillar="ventures"] .wathba-request-page h1{font-size:22px;font-weight:800;margin:0 0 18px}
            [data-pillar="ventures"] .wathba-request-card{
              border:1px solid rgba(var(--ink-rgb),.12);border-radius:14px;padding:18px 20px;
            }
            [data-pillar="ventures"] .wathba-request-card.is-rejected{border-color:rgba(220,38,38,.35)}
            [data-pillar="ventures"] .wathba-request-card strong{display:block;font-weight:700;font-size:15px;margin-bottom:6px}
            [data-pillar="ventures"] .wathba-request-card.is-rejected strong{color:var(--err,#dc2626)}
            [data-pillar="ventures"] .wathba-request-card p{
              font-size:13.5px;color:var(--muted2);line-height:1.9;margin:0;
            }
            [data-pillar="ventures"] .wathba-request-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
            [data-pillar="ventures"] .wathba-request-actions a{
              border:1px solid rgba(var(--ink-rgb),.14);color:var(--text-soft);font-weight:600;
              font-size:13.5px;padding:9px 18px;border-radius:11px;text-decoration:none;
            }
            [data-pillar="ventures"] .wathba-request-actions a.is-primary{
              background:var(--grad);color:var(--on-accent);font-weight:700;border-color:transparent;
            }
            [data-pillar="ventures"] .wathba-request-actions a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

            /* Motion is a courtesy, not a requirement. */
            @media (prefers-reduced-motion: reduce){
              [data-pillar="ventures"] .wathba-account-panel{animation:none}
              [data-pillar="ventures"] .wathba-acct-row,
              [data-pillar="ventures"] .wathba-acct-project,
              [data-pillar="ventures"] .wathba-acct-identity,
              [data-pillar="ventures"] .wathba-acct-trigger{transition:none}
            }

            /* ── Bottom sheet below md ──────────────────────────────────────
               The panel is PORTALLED to <body> in this mode (see the component)
               because the header is a transformed ancestor and would otherwise
               become the containing block for position:fixed — measured once at
               y=-425 on a 390x664 screen, off the top of the viewport. */
            @media (max-width:767px){
              [data-pillar="ventures"] .wathba-account-panel{
                position:fixed;inset-inline:0;inset-block-end:0;top:auto;
                width:auto;max-width:none;border-radius:18px 18px 0 0;
                padding:8px 10px 18px;max-height:82vh;overflow-y:auto;
                animation:wathba-acct-sheet-in var(--dur-reveal) var(--ease-out);
              }
              @keyframes wathba-acct-sheet-in{from{transform:translateY(12%)}to{transform:none}}
              [data-pillar="ventures"] .wathba-account-panel::before{
                content:"";display:block;width:38px;height:4px;border-radius:999px;margin:2px auto 10px;
                background:rgba(var(--ink-rgb),.18);
              }
              [data-pillar="ventures"] .wathba-account-cols{grid-template-columns:1fr;gap:0}
              /* Projects first on a phone: a creator opening this on a phone
                 wants a campaign far more often than their settings. */
              [data-pillar="ventures"] .wathba-acct-col-b{
                order:-1;border-inline-start:none;padding-inline-start:0;
                border-block-end:1px solid rgba(var(--ink-rgb),.08);
                padding-block-end:8px;margin-block-end:8px;
              }
            }

            /* ── POLISH Unit 2 — reveal-on-scroll ─────────────────────────
               The hidden state exists ONLY inside no-preference, so a
               reduced-motion reader can never end up looking at opacity:0
               content even if the JS misbehaves. And it only applies with
               data-revealed="0", which the server never emits — so no-JS and
               first paint are always the finished page. */
            @media (prefers-reduced-motion: no-preference){
              [data-pillar="ventures"] .wathba-reveal{transition:opacity .62s ease,transform .62s cubic-bezier(.22,.68,.24,1)}
              [data-pillar="ventures"] .wathba-reveal[data-revealed="0"]{opacity:.001;transform:translateY(20px)}
              [data-pillar="ventures"] .wathba-reveal[data-revealed="1"]{opacity:1;transform:none}

              /* ── SPOTLIGHT-PLUS P3 — stagger inside a chapter ─────────────
                 Every section on /spotlight arrived as one block: header and
                 all five cards on the same 620ms curve, so the page had one
                 motion note and repeated it. This gives a chapter an internal
                 order — the header, then its cards in sequence.

                 CSS, not more observers. Wrapping each card in its own Reveal
                 would mean thirteen IntersectionObservers on this page; here
                 the section's single observer flips one attribute and the
                 children read their own index off --i. It also runs off the
                 main thread, which the JS path cannot promise while the page
                 is still fetching covers.

                 A STAGGERED SECTION DOES NOT MOVE ITSELF. Without -flat the
                 parent's 20px and the child's 14px compose, so the last card
                 travels 34px and the chapter reads as drifting rather than
                 arriving. The parent fades; only the children translate.

                 The delay is capped at the 5th item. Uncapped, the band's
                 fifth card would wait 275ms after the first — past the point
                 where a reader has already looked at it, which is how stagger
                 turns into latency. This is punctuation, not choreography. */
              [data-pillar="ventures"] .wathba-reveal-flat[data-revealed="0"]{transform:none}
              [data-pillar="ventures"] .wathba-stagger-item{
                transition:opacity .48s ease,transform .48s cubic-bezier(.22,.68,.24,1);
              }
              [data-pillar="ventures"] .wathba-reveal[data-revealed="0"] .wathba-stagger-item{
                opacity:.001;transform:translateY(14px);
              }
              [data-pillar="ventures"] .wathba-reveal[data-revealed="1"] .wathba-stagger-item{
                opacity:1;transform:none;transition-delay:calc(min(var(--i,0),5) * 55ms);
              }
            }

            /* ── POLISH Unit 3 — category strip ────────────────────────────
               Hover/focus and scrollbar hiding cannot be expressed as inline
               styles, so the strip's interaction states live here. */
            [data-pillar="ventures"] .wathba-catstrip{scrollbar-width:none;-ms-overflow-style:none}
            [data-pillar="ventures"] .wathba-catstrip::-webkit-scrollbar{width:0;height:0;display:none}
            [data-pillar="ventures"] .wathba-cat-pill{transition:background-color .16s ease,color .16s ease}
            [data-pillar="ventures"] .wathba-cat-pill:hover{background-color:rgba(var(--ink-rgb),.06);color:var(--text)}
            [data-pillar="ventures"] .wathba-cat-pill[aria-expanded="true"]:hover,
            [data-pillar="ventures"] .wathba-cat-pill[aria-current="page"]:hover{background-color:rgba(var(--accent-rgb),.18)}
            [data-pillar="ventures"] .wathba-cat-pill:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
            /* Edge fades: pure decoration, so they never take pointer events. */
            [data-pillar="ventures"] .wathba-cat-fade{pointer-events:none;position:absolute;top:0;bottom:0;width:56px;z-index:2}
            [data-pillar="ventures"] .wathba-cat-arrow{transition:opacity .16s ease,background-color .16s ease}
            [data-pillar="ventures"] .wathba-cat-arrow:hover{background-color:var(--surface-3)}
            /* STAKES/S-2 — responsive toggles inlined here so they load on EVERY
               ventures page (Next route-split the globals.css copy off the pages
               that needed it). */
            [data-pillar="ventures"] .wathba-mob-only{display:none}
            [data-pillar="ventures"] .wathba-mob-sheet{display:none}
            @media (max-width:999px){
              [data-pillar="ventures"] .wathba-desk-only{display:none!important}
              [data-pillar="ventures"] .wathba-mob-only{display:inline-flex!important}
              [data-pillar="ventures"] .wathba-mob-sheet{display:flex}
            }

            /* ── The header has THREE tiers, not two ──────────────────────────
               Measured min-content cost of the header row, signed in (the
               expensive case — it carries the bell the signed-out row does not):

                 logo + nav + search + controls   1314px
                 logo + nav +  icon  + controls    998px
                 logo +              + controls    519px

               The row was showing the first configuration from 881px upward, so
               everything from 881 to 1313 overflowed — up to 433px of it. That
               is invisible to document.scrollWidth because [data-pillar] clips
               overflow-x, which is why an earlier audit called the header clean.
               What it cost in practice: the account control is the LAST child,
               so the whole overflow lands on it. It sat at a negative x, clipped
               and un-hittable, and a signed-in reader between 881 and 1280 could
               not open the account menu at all.

               So each configuration now gets the width it actually needs. The
               search field is the flexible one: everything beside it costs a
               fixed 972px, so the field gets (viewport - 972), and the tier
               boundary is simply the width below which that is too little to
               type into — measured 202px at 1200, 102px at 1100.

                 >=1200  the search field (322px at the 1320 cap, 282 at 1280,
                         202 at 1200 — the row is capped at maxWidth:1320, so
                         this tier never gets wider than 322)
                 1000..  the field would be under 200px, so it collapses to the
                  1199   icon that opens the full-screen search sheet. The nav
                         stays: losing it to a hamburger on an 1100px desktop
                         costs discoverability, whereas the icon opens the SAME
                         combobox and costs nothing.
                 <=999   the mobile sheet (was <=880; 881..999 cannot fit the
                         nav, which is what made that band overflow). */
            [data-pillar="ventures"] .wathba-wide-only{display:none}
            [data-pillar="ventures"] .wathba-narrow-only{display:inline-flex}
            @media (min-width:1200px){
              [data-pillar="ventures"] .wathba-wide-only{display:block}
              [data-pillar="ventures"] .wathba-narrow-only{display:none}
            }

            /* The smallest phones. Signed-in the row carries four 42px controls
               (search, bell, avatar, hamburger) beside the wordmark, and it ran
               over by 47px at 360 and 17px at 320. Two things give way, in the
               order of what costs the reader least: the wordmark's Latin
               tagline, which is the widest part of the logo (~59px of its 157)
               and carries no function, then the row's own breathing room.
               !important because the padding and gap are inline styles. */
            @media (max-width:420px){
              [data-pillar="ventures"] .wathba-wordmark-tag{display:none}
              [data-pillar="ventures"] .wathba-header-row{padding-inline:14px!important;gap:16px!important}
            }
            /* STAKES/S-15 (Q3) — print: strip chrome, black-on-white body,
               expand campaign links for paper readers. */
            @media print{
              [data-pillar="ventures"] header,[data-pillar="ventures"] footer,
              [data-pillar="ventures"] nav,[data-pillar="ventures"] aside{display:none!important}
              [data-pillar="ventures"]{background:#fff!important;color:#000!important}
              [data-pillar="ventures"] main *{color:#000!important;background:transparent!important;box-shadow:none!important}
              [data-pillar="ventures"] main a[href^="http"]:after{content:" (" attr(href) ")";font-size:10px}
            }
            /* Batch HOME — magazine utilities. .lift is the dc.html hover
               affordance (referenced across the port but never defined);
               the carousel track hides its scrollbar but stays swipeable;
               duo/row grids stack via CSS (no JS re-layout → zero CLS). */
            [data-pillar="ventures"] .lift{transition:transform .18s ease,box-shadow .18s ease}
            [data-pillar="ventures"] .lift:hover{transform:translateY(-3px);box-shadow:var(--card-shadow-h)}
            /* A SHADOW NEEDS A SURFACE. The full-bleed band's tiles carry no
               background, border or radius of their own — the art is the card.
               .lift's hover shadow therefore drew a soft rectangle around
               transparency, outlining the empty space beside the title as a
               ghost panel that no other tile had. The lift itself is the
               feedback; the shadow was describing a card that is not there. */
            [data-pillar="ventures"] .lift-bare:hover{box-shadow:none}
            @media (prefers-reduced-motion:reduce){
              [data-pillar="ventures"] .lift,[data-pillar="ventures"] .lift:hover{transition:none;transform:none}
            }
            [data-pillar="ventures"] .wathba-carousel-track::-webkit-scrollbar{display:none}

            /* ── Batch HERO — the rotating featured card ─────────────────────
               Three states, so the outgoing slide EXITS rather than snapping: an
               idle slide waits at the enter offset, the current one sits at
               zero, and the one just replaced drifts the other way as it fades.
               A two-state (current / not-current) rule would jump the leaving
               slide to the enter offset the instant it lost the current state.

               --hero-enter is signed by direction rather than hand-maintained:
               the next slide arrives from the side the reader moves TOWARD,
               which is the left in Arabic and the right in English.

               All motion sits inside no-preference; globals.css clamps anything
               that slips through. */
            [data-pillar="ventures"] .wathba-hero-slide{--hero-enter:-16px}
            [dir="ltr"] [data-pillar="ventures"] .wathba-hero-slide{--hero-enter:16px}
            /* visibility, not just opacity. An opacity:0 slide is still
               PAINTED — ten 70px-blur shadows and ten backdrop-filter badges
               were being prepared before the page could show anything, and
               first paint here ran ~500ms behind sibling pages using the same
               shell. visibility:hidden keeps the box in LAYOUT, so the cell
               stays as tall as the tallest slide and the no-shift contract is
               untouched, while removing it from paint entirely.

               The outgoing slide must stay visible while it fades, so its
               visibility flips only after the transition — hence the 0s
               transition delayed by the full duration. */
            [data-pillar="ventures"] .wathba-hero-slide[data-state="idle"]{opacity:0;visibility:hidden;pointer-events:none}
            [data-pillar="ventures"] .wathba-hero-slide[data-state="prev"]{opacity:0;visibility:hidden;pointer-events:none}
            [data-pillar="ventures"] .wathba-hero-slide[data-state="current"]{opacity:1;visibility:visible}
            @media (prefers-reduced-motion:no-preference){
              [data-pillar="ventures"] .wathba-hero-slide{transition:opacity var(--hero-dur,520ms) ease,transform var(--hero-dur,520ms) cubic-bezier(.22,.68,.24,1),visibility 0s linear var(--hero-dur,520ms)}
              [data-pillar="ventures"] .wathba-hero-slide[data-state="idle"]{transform:translateX(var(--hero-enter)) scale(.985)}
              [data-pillar="ventures"] .wathba-hero-slide[data-state="prev"]{transform:translateX(calc(var(--hero-enter) * -.55)) scale(.99)}
              [data-pillar="ventures"] .wathba-hero-slide[data-state="current"]{transform:none;transition-delay:0s}
              /* Promote only the two slides in flight. will-change on all ten
                 made ten composited layers at first paint, which is a cost paid
                 before anything has moved. */
              [data-pillar="ventures"] .wathba-hero-slide[data-state="current"],
              [data-pillar="ventures"] .wathba-hero-slide[data-state="prev"]{will-change:transform,opacity}
              [data-pillar="ventures"] .wathba-hero-bar,
              [data-pillar="ventures"] .wathba-bar{transition:transform var(--dur-reveal) var(--ease-out)}
            }
            /* Grows from the reading start: right in Arabic, left in English.
               .wathba-bar is the same treatment for any funding bar outside the
               hero — see the note on the motion scale above. */
            [data-pillar="ventures"] .wathba-hero-bar,
            [data-pillar="ventures"] .wathba-bar{transform-origin:right center}
            [dir="ltr"] [data-pillar="ventures"] .wathba-hero-bar,
            [dir="ltr"] [data-pillar="ventures"] .wathba-bar{transform-origin:left center}
            /* pointer-events:auto — the control ROW is pointer-events:none so
               that the transparent strip it spans does not swallow clicks on
               the card link underneath it. The controls themselves have to opt
               back in. */
            [data-pillar="ventures"] .wathba-hero-ctl{width:36px;height:36px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--card);color:var(--text);border:1px solid rgba(var(--ink-rgb),.14);transition:transform .16s ease,border-color .16s ease;pointer-events:auto;box-shadow:0 2px 10px -4px rgba(0,0,0,.5)}
            @media (hover:hover) and (pointer:fine){
              [data-pillar="ventures"] .wathba-hero-ctl:hover{border-color:rgba(var(--accent-rgb),.55)}
            }
            [data-pillar="ventures"] .wathba-hero-ctl:active{transform:scale(.94)}

            /* ── HOME-REVIEW — press feedback on pressable cards ──────────
               The hero controls already answered a press; the project cards —
               the single most-clicked thing on the page — did not. A card that
               does not move under a finger reads as a picture of a card, and
               the reader waits for the navigation to tell them it worked.

               scale(.985) and no more: these are large surfaces, and a big
               card shrinking noticeably looks like it broke rather than like
               it responded. Transform only, so nothing reflows.

               Gated on no-preference like every other transition here, and the
               :active rule sits INSIDE the gate too — a reduced-motion reader
               gets an instant, untransitioned state change rather than none at
               all, which is the point of the preference, not its removal. */
            @media (prefers-reduced-motion: no-preference){
              [data-pillar="ventures"] .wathba-pressable{transition:transform var(--dur-press) var(--ease-out)}
              [data-pillar="ventures"] .wathba-pressable:active{transform:scale(.985)}
            }
            [data-pillar="ventures"] .wathba-hero-ctl:focus-visible,
            [data-pillar="ventures"] .wathba-hero-dot:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
            /* The BUTTON is 24x24 and never changes size; the visible pill is an
               inner span. Two reasons, both real:

               WCAG 2.2 SC 2.5.8 (AA) wants a 24x24 target unless the spacing
               exception applies. These dots were 8x8 with 8px gaps — centres
               16px apart, so the 24px exception circles overlap and it failed on
               both counts. The hit area is now 24x24 while the dot still LOOKS
               like an 8px dot.

               And the active dot used to animate the width property, which is
               layout: every
               tick reflowed the whole dot row. It is a transform now, so the row
               is static and nothing below it can move. */
            [data-pillar="ventures"] .wathba-hero-dot{width:24px;height:24px;padding:0;border:0;background:none;cursor:pointer;display:grid;place-items:center;border-radius:50%;pointer-events:auto}
            [data-pillar="ventures"] .wathba-hero-dot-mark{width:8px;height:8px;border-radius:30px;background:rgba(var(--ink-rgb),.35);box-shadow:0 1px 4px rgba(0,0,0,.45);transition:transform .22s cubic-bezier(.22,.68,.24,1),background-color .22s ease;transform-origin:center}
            [data-pillar="ventures"] .wathba-hero-dot[data-active="1"] .wathba-hero-dot-mark{transform:scaleX(2.4);background:var(--accent)}
            /* Ten 24px targets do not fit between the arrows on a phone, and the
               tenth dot orphaned onto its own line. Below this width the arrows
               carry navigation on their own — they are 36px, the live region
               still announces each slide, and an orphaned dot is worse than no
               dot.

               HERO-METRICS — this rule never ran. The display property was
               declared inline on the element (see the rotator), and an inline
               declaration outranks a plain stylesheet rule, so the dots were
               measured at display:flex on a 360px phone. Display now lives
               here, where the query can reach it. (No backticks in this block:
               the whole stylesheet is a template literal.)

               And the threshold was wrong as well as dead. The row needs about
               412px of card width — ten 24px targets, nine 8px gaps, two 36px
               arrows — and the card column is NARROWER than that from 1100px
               down, not from 520px down: it measured 320px at an 820px viewport
               and 429px at 1024. Measured wrapping bands were 430-900px, all of
               it above the old 520px cutoff. One threshold, set where the row
               actually stops fitting. */
            @media (max-width:1100px){
              [data-pillar="ventures"] .wathba-hero-dots{display:none}
            }
            @media (min-width:1101px){
              [data-pillar="ventures"] .wathba-hero-dots{display:flex}
            }
            [data-pillar="ventures"] .wathba-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
            @media (max-width:880px){
              /* minmax(0,1fr), for the same reason as .wathba-home-hero above:
                 a grid item's min-width defaults to auto, so a 1fr track cannot
                 shrink below its content's min-content. Measured at 390px: the
                 duo's column resolved to 509px inside a 338px container and its
                 children sat at x = -145. Nothing ever reported it because
                 [data-pillar] sets overflow-x:clip, which makes scrollWidth
                 equal clientWidth — a page-level overflow check reads 0px while
                 the cards are being cut off. Pre-dates the stage; found while
                 screenshotting it. */
              [data-pillar="ventures"] .wathba-mag-duo{grid-template-columns:minmax(0,1fr)!important}
              [data-pillar="ventures"] .wathba-mag-row{grid-template-columns:1fr 1fr!important}
            }
            /* Stage 1 item 11 — «الرائجة» had NO responsive rule at all: a bare
               repeat(4,1fr) at every width, which measured 71px cards on a 390px
               phone. Three up on desktop (hero of discovery), two on tablet, one
               on a phone.

               The two queries are DISJOINT on purpose. Written as
               max-width:880 + min-width:761 they overlap between 761 and 880,
               and since both carry !important the later rule would win — the
               phone rule would have been silently dead across a 120px band.

               minmax(0,1fr) rather than 1fr for the same reason the duo above
               needed it: a 1fr track is sized by its content's min-content and
               will not shrink below it. */
            @media (max-width:620px){
              [data-pillar="ventures"] .wathba-trend-grid{grid-template-columns:minmax(0,1fr)!important;gap:18px!important}
            }
            @media (min-width:621px) and (max-width:1100px){
              [data-pillar="ventures"] .wathba-trend-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
            }
            @media (max-width:540px){
              [data-pillar="ventures"] .wathba-mag-row{grid-template-columns:1fr!important}
            }
            /* HERO-METRICS — the shared column height, per band.
               !important because the defaults are declared INLINE on the
               section (they size the LCP element and a body-stylesheet custom
               property is briefly undefined), and an inline declaration beats a
               plain rule. Without it these would lose silently, which is the
               same trap the dots-hide rule fell into above.

               DISJOINT bands, for the reason recorded on .wathba-trend-grid:
               two overlapping !important queries and the later one wins across
               the overlap, killing the earlier rule over a band nobody checks.
               The <=760 stacked case is set in its own query above.

               Why the height goes UP as the viewport narrows: the card column
               narrows faster than the text column's content shrinks, so the
               cover needs proportionally more room and the card body's four-stat
               row needs two rows instead of one. */
            @media (min-width:901px) and (max-width:1100px){
              [data-pillar="ventures"] .wathba-home-hero{--hero-col-h:560px!important;--hero-cover-h:250px!important;gap:40px!important}
            }
            /* THE 820px BAND — two columns at a width that cannot carry two.
               Measured at 820: the card column resolved to 335px and the text
               column to 393px, and with the headline still at 62px (the clamp
               tops out at 590) it ran three lines, leaving the text column 92px
               taller than the card. It was the last remaining column mismatch,
               and it was not a type problem: 335px is simply too narrow for a
               card carrying a cover, a title, a pitch, a progress bar and four
               figures.

               So the fix is the breakpoint, not the type. .wathba-home-hero now
               stacks at 900 rather than 760, which hands the card the full
               content width — 848px at a 900px viewport, against 335 — and the
               columns match again because a stacked layout has no columns to
               match. Only .wathba-home-hero moves; the spotlight hero, the
               discover row and the hero band keep their own 760px threshold,
               which is where their content actually stops fitting.

               Two stacked sub-bands rather than one, because a single
               --hero-cover-h across a 268-848px range of card widths cannot hold
               a sensible cover proportion: at the old 210px it would have been
               4:1 at the top of the band. 210/290 keeps the cover between 1.28:1
               and 2.92:1 end to end, against 2.33:1 on the desktop card. */
            @media (min-width:621px) and (max-width:900px){
              [data-pillar="ventures"] .wathba-home-hero{--hero-col-h:620px!important;--hero-cover-h:290px!important}
            }
            /* The card's four-stat row, two-up. Same disjoint-band discipline.
               The card column measures 320-460px across these two ranges — four
               tracks there give each figure ~80px, which is narrower than
               «297,000 من 180,000» sets at any legible size. Below 901 the card
               is stacked and full width, so four tracks fit again. */
            @media (min-width:901px) and (max-width:1100px){
              [data-pillar="ventures"] .wathba-hero-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
            }
            @media (max-width:520px){
              [data-pillar="ventures"] .wathba-hero-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
            }
            @media (max-width:980px){
              /* POLISH Unit 2 — spotlight stacks before the lead/rail split gets
                 cramped; the story trio drops to two up. */
              [data-pillar="ventures"] .wathba-spotlight-grid{grid-template-columns:1fr!important}
              [data-pillar="ventures"] .wathba-spotlight-stories{grid-template-columns:1fr 1fr!important}
            }
            @media (max-width:640px){
              [data-pillar="ventures"] .wathba-spotlight-stories{grid-template-columns:1fr!important}
            }
            @media (max-width:760px){
              [data-pillar="ventures"] .wathba-spotlight-hero{grid-template-columns:1fr!important;gap:26px!important;padding-top:44px!important}
              /* SPOTLIGHT-PLUS P1 — the cinematic hero re-scrims on a phone.
                 On desktop the copy sits in the start 58% and the scrim is
                 heaviest at that edge, letting the photograph breathe on the
                 far side. At 360 the copy is full width, so it would run into
                 the thin end of that gradient and lose contrast. Bottom-heavy
                 is the correct scrim for a bottom-anchored full-width column,
                 and it keeps the top of the cover visible. */
              [data-pillar="ventures"] .wathba-spotlight-copy{max-width:100%!important}
              [data-pillar="ventures"] .wathba-spotlight-scrim{background:linear-gradient(to top,rgba(4,10,7,.88) 0%,rgba(4,10,7,.74) 32%,rgba(4,10,7,.46) 62%,rgba(4,10,7,.26) 100%)!important}
              [data-pillar="ventures"] .wathba-hero-band{grid-template-columns:1fr!important}
              /* minmax(0,1fr), NOT 1fr. A grid item's min-width defaults to
                 auto, so a 1fr track cannot shrink below the item's min-content
                 — and the hero's four-stat row min-contents at ~377px. The
                 column blew 39px past the section's 338px content box, and it
                 re-resolved whenever text metrics settled: the stat row wrapped
                 a line, then unwrapped, ~30ms apart at ~1s. Two 0.14 shifts,
                 mobile CLS median 0.171 against 0.0001 on desktop. */
              [data-pillar="ventures"] .wathba-discover-row{flex-direction:column!important;align-items:stretch!important}
              [data-pillar="ventures"] .wathba-discover-aside{width:100%!important}
            }
            /* The stack itself, at 900 rather than 760 — see the 820px note
               above. Its own query, setting only the columns, so the two
               height sub-bands stay disjoint from it and from each other.
               --hero-col-h is NOT set here: this query overlaps both of them,
               and with everything carrying !important the later rule would win
               across the overlap. That is how a phone-only rule ends up dead
               over a 140px band. */
            /* The campaign story tab: contents rail | story | pledge sidebar.
               200px + 360px + two 36px gaps needs 632px, and it kept all three
               zones side by side at 360 — the story column alone measured
               360px inside a 308px box. Stacks below 1000, where the sidebar
               stops fitting beside a readable measure.
               !important because the columns are an INLINE style, which a plain
               stylesheet rule cannot override. */
            @media (max-width:1000px){
              [data-pillar="ventures"] .wathba-story-grid{grid-template-columns:minmax(0,1fr)!important;gap:24px!important}
            }
            @media (max-width:900px){
              [data-pillar="ventures"] .wathba-home-hero{grid-template-columns:minmax(0,1fr)!important;gap:26px!important;padding-top:34px!important}
              /* The copy column is pinned to --hero-col-h so it MATCHES the card
                 beside it. Stacked, there is nothing beside it to match, and the
                 pin turns into a hole: measured 180px of empty space between the
                 CTA row and the stat row at 820, where the card wants 620px and
                 the copy naturally sets at ~440. The card keeps its declared
                 height — that is the slide-uniformity guarantee and it is not
                 negotiable — but the copy goes back to its own size. */
              [data-pillar="ventures"] .wathba-hero-copy{min-height:0!important}
            }
            @media (max-width:620px){
              [data-pillar="ventures"] .wathba-home-hero{--hero-col-h:540px!important;--hero-cover-h:210px!important}
            }
          `,
        }}
      />
      {/* The provider lives INSIDE this div, not around it. Its toasts and
       *  confirm dialog are emitted after {children}, so mounting it as the
       *  parent left them siblings of the themed element — `var(--card)`,
       *  `var(--text)`, `var(--grad)` and `var(--on-accent)` all resolved to
       *  nothing and the dialog's copy sat on the bare scrim at 3.74:1 in
       *  BOTH themes. Nothing here creates a containing block, so the
       *  overlays stay position:fixed against the viewport. */}
      <WathbaFeedbackProvider>
        <PageViewTracker />
        <WathbaHeader
          theme={theme}
          onToggleTheme={() => setAndPersistTheme(theme === 'dark' ? 'light' : 'dark')}
        />
        {/* NO framer-motion wrap on main — first paint must show content
         *  without waiting for hydration (SEO + no-JS users). Inner cards
         *  still use motion.div for soft entrances where the loss of
         *  visibility-on-load is acceptable. */}
        <main className="wathba-fade">{children}</main>
        <WathbaFooter />
      </WathbaFeedbackProvider>
    </div>
  );
}
