import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import "@fontsource-variable/mona-sans";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { api, setUnauthorizedHandler } from "./lib/api";
import { Link, navigate, usePath } from "./lib/router";
import { Icon, Logo } from "./components/Icon";
import { Spinner, Toasts } from "./components/ui";
import { Forgot, Login, Reset, Setup } from "./pages/Auth";
import { LinksPage } from "./pages/Links";
import { AnalyticsPage, LinkDetailPage } from "./pages/Stats";
import { DomainsPage } from "./pages/Domains";
import { SettingsPage } from "./pages/Settings";

interface Status { setup: boolean; authed: boolean; email: string | null; email_enabled: boolean; admin_email_hint: string | null }

const NAV = [
  { href: "/", label: "Links", icon: "link", match: (p: string) => p === "/" || p.startsWith("/links") },
  { href: "/analytics", label: "Analytics", icon: "chart", match: (p: string) => p.startsWith("/analytics") },
  { href: "/domains", label: "Domains", icon: "globe", match: (p: string) => p.startsWith("/domains") },
  { href: "/settings", label: "Settings", icon: "sliders", match: (p: string) => p.startsWith("/settings") },
];

function NavItem({ entry, path }: { entry: (typeof NAV)[number]; path: string }) {
  const active = entry.match(path);
  return (
    <Link href={entry.href} class={`nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
      <span class="nav-icon" aria-hidden="true"><Icon name={entry.icon} size={17} /></span>
      <span>{entry.label}</span>
    </Link>
  );
}

function AccountMenu({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div class="account-menu" ref={ref}>
      <button type="button" class="account-button" aria-expanded={open} aria-label="Account menu" title="Account menu" onClick={() => setOpen(!open)}>
        <span class="avatar">{(email ?? "A")[0]}</span>
        <span class="account-chevron" aria-hidden="true"><Icon name="chevron" size={13} /></span>
      </button>
      {open && (
        <div class="account-popover">
          <p class="popover-label">Kurz</p>
          <div class="popover-user">
            <strong>Admin</strong>
            <small>{email ?? ""}</small>
          </div>
          <span class="popover-sep" aria-hidden="true" />
          <a href="https://github.com/mddanishyusuf/kurz#api" target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            <Icon name="book" size={14} /> API docs
          </a>
          <button type="button" onClick={() => { setOpen(false); onLogout(); }}>
            <Icon name="logout" size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Shell({ path, email, onLogout }: { path: string; email: string | null; onLogout: () => void }) {
  const linkMatch = path.match(/^\/links\/(\d+)/);
  let page;
  if (linkMatch) page = <LinkDetailPage id={Number(linkMatch[1])} />;
  else if (path.startsWith("/analytics")) page = <AnalyticsPage />;
  else if (path.startsWith("/domains")) page = <DomainsPage />;
  else if (path.startsWith("/settings")) page = <SettingsPage />;
  else page = <LinksPage />;

  const logout = async () => {
    await api("/auth/logout", { body: {} }).catch(() => {});
    onLogout();
  };

  return (
    <div class="app">
      <div class="header-shell">
        <header class="app-header">
          <Link href="/" class="header-brand" aria-label="Kurz home">
            <Logo size={28} />
          </Link>
          <span class="header-divider" aria-hidden="true" />
          <nav class="top-nav" aria-label="Main">
            {NAV.map((n) => <NavItem key={n.href} entry={n} path={path} />)}
          </nav>
          <span class="header-divider" aria-hidden="true" />
          <div class="header-actions">
            <a class="icon-btn" href="https://github.com/mddanishyusuf/kurz" target="_blank" rel="noopener" aria-label="GitHub" title="GitHub">
              <Icon name="github" size={16} />
            </a>
            <AccountMenu email={email} onLogout={logout} />
          </div>
        </header>
      </div>
      <main key={path}>{page}</main>
      <nav class="mobile-tabbar" aria-label="Main">
        {NAV.map((n) => <NavItem key={n.href} entry={n} path={path} />)}
      </nav>
    </div>
  );
}

function App() {
  const path = usePath();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const refresh = () => api<Status>("/auth/status").then(setStatus, (e) => setError(e.message));

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setStatus((s) => (s ? { ...s, authed: false } : s)));
  }, []);

  // Keep the URL in sync with the auth state.
  useEffect(() => {
    if (!status) return;
    const authPages = ["/login", "/forgot", "/reset", "/setup"];
    if (status.authed && authPages.includes(path)) navigate("/", true);
    else if (!status.authed && status.setup && !authPages.includes(path)) navigate("/login", true);
  }, [status, path]);

  if (error) return <div class="center"><p class="error">{error}</p></div>;
  if (!status) return <Spinner />;

  let view;
  if (!status.setup) view = <Setup emailHint={status.admin_email_hint} onDone={refresh} />;
  else if (!status.authed) {
    if (path === "/forgot") view = <Forgot emailEnabled={status.email_enabled} />;
    else if (path === "/reset") view = <Reset onDone={refresh} />;
    else view = <Login onDone={refresh} />;
  } else view = <Shell path={path} email={status.email} onLogout={() => setStatus({ ...status, authed: false })} />;

  return (
    <>
      {view}
      <Toasts />
    </>
  );
}

render(<App />, document.getElementById("app")!);
