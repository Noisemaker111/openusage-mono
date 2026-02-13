import { HeadContent, Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "../index.css";

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "OpenUsage - All Your AI Coding Limits In One Place",
      },
      {
        name: "description",
        content: "Track all your AI coding tool subscriptions in one place. OpenUsage monitors Codex, Claude, Cursor, Copilot, Windsurf and more.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap",
      },
    ],
  }),
});

function RootComponent() {
  const router = useRouterState();
  const isHomePage = router.location.pathname === "/";

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <div className={isHomePage ? "" : "grid grid-rows-[auto_1fr] h-svh"}>
          {!isHomePage && <Header />}
          <Outlet />
        </div>
        <Toaster richColors />
      </ThemeProvider>
      {!isHomePage && <TanStackRouterDevtools position="bottom-left" />}
    </>
  );
}
