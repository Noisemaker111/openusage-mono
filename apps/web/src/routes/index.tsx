import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import openUsageBodyHtmlRaw from "./openusage-body.html?raw";

const PRODUCTION_TITLE = "OpenUsage - AI Limits Tracker for Cursor, Claude Code, Codex and more";
const PRODUCTION_DESCRIPTION =
  "Never hit your AI limits by surprise. Know exactly where you stand without ever leaving your AI coding tool. Track Cursor, Claude Code, Codex, Copilot and more. Free and open source.";
const PRODUCTION_BODY_CLASS =
  "geistsans_d5a4f12f-module__Ur3q_a__variable geistpixelcircle_7ee616e3-module__hUl13q__variable antialiased";
const PRODUCTION_STYLESHEET_URL =
  "https://www.openusage.ai/_next/static/chunks/18141af1dfe18c48.css?dpl=dpl_FEcNUMfudsUjMFbSH2z2Gkhx1iG7";
const DEFAULT_RELEASE_REPOSITORY = "Noisemaker111/opencode-mono";
const RELEASE_REPOSITORY =
  import.meta.env.VITE_RELEASE_REPOSITORY && import.meta.env.VITE_RELEASE_REPOSITORY.trim().length > 0
    ? import.meta.env.VITE_RELEASE_REPOSITORY.trim()
    : DEFAULT_RELEASE_REPOSITORY;
const RAW_RELEASE_CHANNEL = import.meta.env.VITE_RELEASE_CHANNEL;
const RELEASE_CHANNEL =
  RAW_RELEASE_CHANNEL === "dev"
    ? "dev"
    : RAW_RELEASE_CHANNEL === "stable"
      ? "stable"
      : import.meta.env.VITE_VERCEL_ENV === "preview"
        ? "dev"
        : "stable";
const RELEASES_LATEST_URL = `https://github.com/${RELEASE_REPOSITORY}/releases/latest`;
const RELEASES_API_BASE_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}`;
const RELEASES_API_URL = `${RELEASES_API_BASE_URL}/releases/latest`;
const RELEASES_LIST_API_URL = `${RELEASES_API_BASE_URL}/releases?per_page=20`;
const MORE_DOWNLOADS_SECTION_ID = "downloads";

const productionBodyHtml = openUsageBodyHtmlRaw.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");

type Platform = "macos" | "windows" | "linux" | "other";
type Architecture = "arm64" | "x64";
type ReleaseChannel = "stable" | "dev";

interface ReleaseAsset {
  name: string;
  url: string;
}

interface ReleaseData {
  assets: ReadonlyArray<ReleaseAsset>;
  tag: string | null;
  prerelease: boolean;
}

interface DownloadOption {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  available: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractReleaseData(payload: unknown): ReleaseData {
  if (!isRecord(payload)) {
    return { assets: [], tag: null, prerelease: false };
  }

  const maybeTag = payload.tag_name;
  const tag = typeof maybeTag === "string" ? maybeTag : null;
  const prerelease = payload.prerelease === true;
  const maybeAssets = payload.assets;

  if (!Array.isArray(maybeAssets)) {
    return { assets: [], tag, prerelease };
  }

  const assets: Array<ReleaseAsset> = [];
  for (const maybeAsset of maybeAssets) {
    if (!isRecord(maybeAsset)) {
      continue;
    }

    const name = maybeAsset.name;
    const url = maybeAsset.browser_download_url;
    if (typeof name === "string" && typeof url === "string") {
      assets.push({ name, url });
    }
  }

  return { assets, tag, prerelease };
}

function extractReleaseList(payload: unknown): ReadonlyArray<ReleaseData> {
  if (!Array.isArray(payload)) {
    return [];
  }

  const releases: Array<ReleaseData> = [];
  for (const maybeRelease of payload) {
    releases.push(extractReleaseData(maybeRelease));
  }

  return releases;
}

function pickReleaseForChannel(
  releases: ReadonlyArray<ReleaseData>,
  channel: ReleaseChannel,
): ReleaseData | null {
  if (releases.length === 0) {
    return null;
  }

  if (channel === "dev") {
    for (const release of releases) {
      if (release.prerelease) {
        return release;
      }
    }
  }

  for (const release of releases) {
    if (!release.prerelease) {
      return release;
    }
  }

  return releases[0] ?? null;
}

function detectPlatform(userAgent: string): Platform {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes("mac os x") || normalized.includes("macintosh")) {
    return "macos";
  }

  if (normalized.includes("win")) {
    return "windows";
  }

  if (normalized.includes("linux") || normalized.includes("x11")) {
    return "linux";
  }

  return "other";
}

function detectArchitecture(userAgent: string): Architecture {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes("arm64") || normalized.includes("aarch64") || normalized.includes("arm")) {
    return "arm64";
  }

  return "x64";
}

function findAssetUrl(
  assets: ReadonlyArray<ReleaseAsset>,
  predicate: (normalizedAssetName: string) => boolean,
): string | null {
  for (const asset of assets) {
    const normalizedName = asset.name.toLowerCase();
    if (predicate(normalizedName)) {
      return asset.url;
    }
  }

  return null;
}

function buildDownloadOptions(assets: ReadonlyArray<ReleaseAsset>): ReadonlyArray<DownloadOption> {
  const macArmUrl =
    findAssetUrl(assets, (name) => name.endsWith("aarch64.dmg") || name.endsWith("arm64.dmg")) ?? RELEASES_LATEST_URL;
  const macIntelUrl =
    findAssetUrl(assets, (name) => name.endsWith("x64.dmg") || name.endsWith("intel.dmg")) ?? RELEASES_LATEST_URL;

  const windowsUrl =
    findAssetUrl(
      assets,
      (name) => (name.endsWith(".exe") || name.endsWith(".msi")) && (name.includes("x64") || name.includes("amd64") || name.includes("windows")),
    ) ??
    findAssetUrl(assets, (name) => name.endsWith(".exe") || name.endsWith(".msi") || name.includes("windows")) ??
    RELEASES_LATEST_URL;

  const linuxUrl =
    findAssetUrl(
      assets,
      (name) =>
        name.endsWith(".appimage") ||
        name.endsWith(".deb") ||
        name.endsWith(".rpm") ||
        (name.includes("linux") && (name.endsWith(".tar.gz") || name.endsWith(".zip"))),
    ) ?? RELEASES_LATEST_URL;

  return [
    {
      id: "macos-apple-silicon",
      title: "macOS (Apple Silicon)",
      subtitle: "arm64 dmg",
      href: macArmUrl,
      available: macArmUrl !== RELEASES_LATEST_URL,
    },
    {
      id: "macos-intel",
      title: "macOS (Intel)",
      subtitle: "x64 dmg",
      href: macIntelUrl,
      available: macIntelUrl !== RELEASES_LATEST_URL,
    },
    {
      id: "windows-x64",
      title: "Windows",
      subtitle: "x64 installer",
      href: windowsUrl,
      available: windowsUrl !== RELEASES_LATEST_URL,
    },
    {
      id: "linux-x64",
      title: "Linux",
      subtitle: "AppImage / DEB / RPM",
      href: linuxUrl,
      available: linuxUrl !== RELEASES_LATEST_URL,
    },
  ];
}

function getOptionById(options: ReadonlyArray<DownloadOption>, id: string): DownloadOption | null {
  for (const option of options) {
    if (option.id === id) {
      return option;
    }
  }

  return null;
}

function getPrimaryDownloadOption(
  options: ReadonlyArray<DownloadOption>,
  platform: Platform,
  architecture: Architecture,
): DownloadOption {
  if (platform === "macos") {
    const macOptionId = architecture === "arm64" ? "macos-apple-silicon" : "macos-intel";
    const option = getOptionById(options, macOptionId);
    if (option !== null) {
      return option;
    }
  }

  if (platform === "windows") {
    const option = getOptionById(options, "windows-x64");
    if (option !== null) {
      return option;
    }
  }

  if (platform === "linux") {
    const option = getOptionById(options, "linux-x64");
    if (option !== null) {
      return option;
    }
  }

  const fallback = getOptionById(options, "macos-apple-silicon");
  if (fallback !== null) {
    return fallback;
  }

  return {
    id: "fallback",
    title: "All Downloads",
    subtitle: "latest release",
    href: RELEASES_LATEST_URL,
    available: true,
  };
}

function getPlatformLabel(platform: Platform): string {
  if (platform === "macos") {
    return "macOS";
  }

  if (platform === "windows") {
    return "Windows";
  }

  if (platform === "linux") {
    return "Linux";
  }

  return "your platform";
}

function ensureMoreDownloadsAnchor(): void {
  const ctaSection = Array.from(document.querySelectorAll("section")).find((section) => {
    const heading = section.querySelector("h2");
    const headingText = heading?.textContent?.trim() ?? "";
    return headingText === "Never Get Cut Off by Surprise.";
  });

  if (ctaSection === undefined) {
    return;
  }

  const buttonRow = ctaSection.querySelector("div.flex.items-center.justify-center.gap-4");
  if (buttonRow === null) {
    return;
  }

  const existingAnchor = buttonRow.querySelector("a[data-openusage-more-downloads='true']");
  if (existingAnchor !== null) {
    existingAnchor.remove();
  }

  const moreDownloadsAnchor = document.createElement("a");
  moreDownloadsAnchor.setAttribute("data-openusage-more-downloads", "true");
  moreDownloadsAnchor.href = `#${MORE_DOWNLOADS_SECTION_ID}`;
  moreDownloadsAnchor.textContent = "More downloads";
  moreDownloadsAnchor.className = "inline-flex items-center text-sm font-medium transition-opacity hover:opacity-80";
  moreDownloadsAnchor.style.textDecoration = "underline";
  moreDownloadsAnchor.style.textUnderlineOffset = "4px";
  moreDownloadsAnchor.style.textDecorationThickness = "1px";
  moreDownloadsAnchor.style.color = "var(--page-fg)";
  moreDownloadsAnchor.addEventListener("click", (event) => {
    event.preventDefault();
    const targetSection = document.getElementById(MORE_DOWNLOADS_SECTION_ID);
    if (targetSection === null) {
      return;
    }

    targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${MORE_DOWNLOADS_SECTION_ID}`);
  });

  buttonRow.append(moreDownloadsAnchor);
}

function ensureHeroMoreDownloadsAnchor(): void {
  const heroDownloadAnchor = Array.from(document.querySelectorAll("a")).find((anchor) => {
    const text = (anchor.textContent ?? "").trim();
    return text.startsWith("Download for ");
  });

  if (heroDownloadAnchor === undefined || heroDownloadAnchor.parentElement === null) {
    return;
  }

  const buttonRow = heroDownloadAnchor.parentElement;
  const existingAnchor = buttonRow.querySelector("a[data-openusage-hero-more-downloads='true']");

  if (existingAnchor !== null) {
    existingAnchor.remove();
  }

  const moreDownloadsAnchor = document.createElement("a");
  moreDownloadsAnchor.setAttribute("data-openusage-hero-more-downloads", "true");
  moreDownloadsAnchor.href = `#${MORE_DOWNLOADS_SECTION_ID}`;
  moreDownloadsAnchor.textContent = "More downloads";
  moreDownloadsAnchor.className = "inline-flex items-center text-sm font-medium transition-opacity hover:opacity-80";
  moreDownloadsAnchor.style.textDecoration = "underline";
  moreDownloadsAnchor.style.textUnderlineOffset = "4px";
  moreDownloadsAnchor.style.textDecorationThickness = "1px";
  moreDownloadsAnchor.style.color = "var(--page-fg)";
  moreDownloadsAnchor.addEventListener("click", (event) => {
    event.preventDefault();
    const targetSection = document.getElementById(MORE_DOWNLOADS_SECTION_ID);
    if (targetSection === null) {
      return;
    }

    targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${MORE_DOWNLOADS_SECTION_ID}`);
  });

  heroDownloadAnchor.insertAdjacentElement("afterend", moreDownloadsAnchor);
}

function relocateContributeToHeroMetaRow(): void {
  const contributeAnchors = Array.from(document.querySelectorAll("a")).filter(
    (anchor) => (anchor.textContent ?? "").trim() === "Contribute",
  );

  if (contributeAnchors.length === 0) {
    return;
  }

  const badge = Array.from(document.querySelectorAll("span")).find((span) => {
    const text = (span.textContent ?? "").trim();
    return text.includes("Free") && text.includes("Open Source");
  });

  if (badge === undefined || badge.parentElement === null) {
    return;
  }

  const [primaryContributeAnchor, ...extraContributeAnchors] = contributeAnchors;
  for (const extraAnchor of extraContributeAnchors) {
    extraAnchor.remove();
  }

  const badgeContainer = badge.parentElement;
  badgeContainer.className = "flex items-center gap-3";
  badge.textContent = "Free · Open Source · Multi-platform";

  primaryContributeAnchor.setAttribute("data-openusage-relocated-contribute", "true");
  primaryContributeAnchor.className = "inline-flex items-center text-sm font-medium transition-opacity hover:opacity-80";
  primaryContributeAnchor.style.border = "none";
  primaryContributeAnchor.style.backgroundColor = "transparent";
  primaryContributeAnchor.style.padding = "0";
  primaryContributeAnchor.style.margin = "0";
  primaryContributeAnchor.style.backdropFilter = "none";
  primaryContributeAnchor.style.setProperty("-webkit-backdrop-filter", "none");
  primaryContributeAnchor.style.textDecoration = "underline";
  primaryContributeAnchor.style.textUnderlineOffset = "4px";
  primaryContributeAnchor.style.textDecorationThickness = "1px";
  primaryContributeAnchor.style.color = "var(--page-fg)";

  badgeContainer.insertBefore(primaryContributeAnchor, badge);
}

function updatePrimaryDownloadCtas(primaryOption: DownloadOption, platformLabel: string): void {
  const anchors = Array.from(document.querySelectorAll("a")).filter((anchor) => {
    const text = anchor.textContent?.trim() ?? "";
    return text.startsWith("Download for ");
  });

  const primaryLabel = `Download for ${platformLabel}`;
  for (const anchor of anchors.slice(0, 2)) {
    anchor.textContent = primaryLabel;
    anchor.setAttribute("href", primaryOption.href);
  }

  const ctaParagraph = Array.from(document.querySelectorAll("p")).find((paragraph) => {
    const text = paragraph.textContent ?? "";
    return text.includes("Download OpenUsage for") && text.includes("never have to guess your limits again");
  });

  if (ctaParagraph !== undefined) {
    ctaParagraph.textContent = `Download OpenUsage for ${platformLabel}. It is free, and you will never have to guess your limits again.`;
  }

  const ctaFootnote = Array.from(document.querySelectorAll("p")).find((paragraph) => {
    const text = paragraph.textContent ?? "";
    return text.includes("MIT License") && text.includes("Requires macOS");
  });

  if (ctaFootnote !== undefined) {
    ctaFootnote.textContent = "Latest release - MIT License";
  }

  ensureHeroMoreDownloadsAnchor();
  ensureMoreDownloadsAnchor();
  relocateContributeToHeroMetaRow();
}

function renderMoreDownloadsSection(options: ReadonlyArray<DownloadOption>, releaseTag: string | null): void {
  const footer = document.querySelector("footer");
  if (footer === null || footer.parentElement === null) {
    return;
  }

  const existingSection = document.getElementById(MORE_DOWNLOADS_SECTION_ID);
  if (existingSection !== null) {
    existingSection.remove();
  }

  const section = document.createElement("section");
  section.id = MORE_DOWNLOADS_SECTION_ID;
  section.className = "max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24";

  const wrapper = document.createElement("div");
  wrapper.className = "rounded-2xl p-6 md:p-8";
  wrapper.style.border = "1px solid var(--page-border)";
  wrapper.style.backgroundColor = "rgba(0, 0, 0, 0.15)";
  wrapper.style.backdropFilter = "blur(20px)";
  wrapper.style.setProperty("-webkit-backdrop-filter", "blur(20px)");

  const header = document.createElement("div");
  header.className = "mb-6";

  const title = document.createElement("h3");
  title.className = "text-2xl lg:text-3xl font-bold tracking-tight text-pretty";
  title.style.fontFamily = "var(--font-geist-pixel-circle)";
  title.textContent = "More Downloads";

  const description = document.createElement("p");
  description.className = "text-sm lg:text-base mt-2";
  description.style.color = "var(--page-fg-muted)";
  const releaseSummary = releaseTag === null ? "Latest release" : `Latest release ${releaseTag}`;
  description.textContent = `${releaseSummary}. Pick the package for your platform.`;

  header.append(title, description);

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3";

  for (const option of options) {
    const card = document.createElement("a");
    card.href = option.href;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.className = "rounded-xl p-4 transition-colors hover:brightness-110";
    card.style.border = "1px solid var(--page-border)";
    card.style.backgroundColor = "rgba(0, 0, 0, 0.15)";
    card.style.backdropFilter = "blur(20px)";
    card.style.setProperty("-webkit-backdrop-filter", "blur(20px)");

    const cardTitle = document.createElement("p");
    cardTitle.className = "text-sm font-semibold";
    cardTitle.style.color = "var(--page-fg)";
    cardTitle.textContent = option.title;

    const cardSubtitle = document.createElement("p");
    cardSubtitle.className = "text-xs mt-1";
    cardSubtitle.style.color = "var(--page-fg-subtle)";
    cardSubtitle.textContent = option.subtitle;

    const cardAction = document.createElement("p");
    cardAction.className = "text-xs mt-3";
    cardAction.style.color = option.available ? "var(--page-accent)" : "var(--page-fg-muted)";
    cardAction.textContent = option.available ? "Download" : "View releases";

    card.append(cardTitle, cardSubtitle, cardAction);
    grid.append(card);
  }

  wrapper.append(header, grid);
  section.append(wrapper);
  footer.parentElement.insertBefore(section, footer);
}

function formatMenuBarTime(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  let weekday = "";
  let month = "";
  let day = "";
  let hour = "";
  let minute = "";
  let dayPeriod = "";

  for (const part of formatted) {
    if (part.type === "weekday") {
      weekday = part.value;
    }

    if (part.type === "month") {
      month = part.value;
    }

    if (part.type === "day") {
      day = part.value;
    }

    if (part.type === "hour") {
      hour = part.value;
    }

    if (part.type === "minute") {
      minute = part.value;
    }

    if (part.type === "dayPeriod") {
      dayPeriod = part.value;
    }
  }

  return `${weekday} ${month} ${day} ${hour}:${minute} ${dayPeriod}`.trim();
}

function updateMenuBarClock(): void {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const nextText = formatMenuBarTime(new Date());

  for (const span of Array.from(document.querySelectorAll("span"))) {
    const text = (span.textContent ?? "").trim();
    const isClockText = weekdays.some((weekday) => text.startsWith(`${weekday} `)) && text.includes(":") && (text.includes(" AM") || text.includes(" PM"));
    if (isClockText) {
      span.textContent = nextText;
    }
  }
}

function applyDownloadUi(
  options: ReadonlyArray<DownloadOption>,
  platform: Platform,
  architecture: Architecture,
  releaseTag: string | null,
): void {
  const primaryOption = getPrimaryDownloadOption(options, platform, architecture);
  const platformLabel = getPlatformLabel(platform);

  updatePrimaryDownloadCtas(primaryOption, platformLabel);
  renderMoreDownloadsSection(options, releaseTag);
}

export const Route = createFileRoute("/")({
  component: HomeComponent,
  head: () => ({
    meta: [
      {
        title: PRODUCTION_TITLE,
      },
      {
        name: "description",
        content: PRODUCTION_DESCRIPTION,
      },
      {
        property: "og:title",
        content: PRODUCTION_TITLE,
      },
      {
        property: "og:description",
        content: PRODUCTION_DESCRIPTION,
      },
      {
        property: "og:url",
        content: "https://openusage.dev",
      },
      {
        property: "og:image",
        content: "https://www.openusage.ai/opengraph-image.jpg?opengraph-image.7ec223d1.jpg",
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "630",
      },
      {
        property: "og:image:type",
        content: "image/jpeg",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: PRODUCTION_TITLE,
      },
      {
        name: "twitter:description",
        content: PRODUCTION_DESCRIPTION,
      },
      {
        name: "twitter:image",
        content: "https://www.openusage.ai/opengraph-image.jpg?opengraph-image.7ec223d1.jpg",
      },
      {
        name: "twitter:image:width",
        content: "1200",
      },
      {
        name: "twitter:image:height",
        content: "630",
      },
      {
        name: "twitter:image:type",
        content: "image/jpeg",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: PRODUCTION_STYLESHEET_URL,
      },
      {
        rel: "icon",
        href: "https://www.openusage.ai/favicon.ico?favicon.0b3bf435.ico",
        type: "image/x-icon",
      },
      {
        rel: "icon",
        href: "https://www.openusage.ai/icon.svg?icon.8049e5f4.svg",
        type: "image/svg+xml",
      },
    ],
  }),
});

function HomeComponent() {
  useEffect(() => {
    const previousBodyClassName = document.body.className;
    document.body.className = PRODUCTION_BODY_CLASS;

    const userAgent = navigator.userAgent;
    const platform = detectPlatform(userAgent);
    const architecture = detectArchitecture(userAgent);

    updateMenuBarClock();
    const clockInterval = window.setInterval(updateMenuBarClock, 30_000);

    applyDownloadUi(buildDownloadOptions([]), platform, architecture, null);

    let isActive = true;
    void (async () => {
      try {
        const endpoint = RELEASE_CHANNEL === "dev" ? RELEASES_LIST_API_URL : RELEASES_API_URL;
        const response = await fetch(endpoint, {
          headers: {
            Accept: "application/vnd.github+json",
          },
        });

        if (!response.ok) {
          return;
        }

        const payload: unknown = await response.json();
        const release =
          RELEASE_CHANNEL === "dev"
            ? pickReleaseForChannel(extractReleaseList(payload), "dev")
            : extractReleaseData(payload);

        if (!isActive) {
          return;
        }

        if (release === null) {
          return;
        }

        applyDownloadUi(buildDownloadOptions(release.assets), platform, architecture, release.tag);
      } catch {
        // Keep the fallback links when release metadata cannot be fetched.
      }
    })();

    return () => {
      isActive = false;
      window.clearInterval(clockInterval);
      const moreDownloadsSection = document.getElementById(MORE_DOWNLOADS_SECTION_ID);
      if (moreDownloadsSection !== null) {
        moreDownloadsSection.remove();
      }
      document.body.className = previousBodyClassName;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: productionBodyHtml }} />;
}
