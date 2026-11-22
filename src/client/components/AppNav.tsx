import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Images" },
  { to: "/workflows", label: "Workflows" },
  { to: "/run", label: "Run workflow" },
] as const;

/** The app's pages, in the AppShell bar. */
export function AppNav() {
  return (
    <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: link.to === "/" }}
          className="shrink-0 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
