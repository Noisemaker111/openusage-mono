import { createFileRoute } from "@tanstack/react-router";
import { api } from "@openusage-mono/backend/convex/_generated/api";
import { useAction, useConvex } from "convex/react";
import { useEffect } from "react";

import openUsageBodyHtmlRaw from "./openusage-body.html?raw";

const PRODUCTION_TITLE = "OpenUsage - AI Limits Tracker for Cursor, Claude Code, Codex and more";
const PRODUCTION_DESCRIPTION =
  "Never hit your AI limits by surprise. Know exactly where you stand without ever leaving your AI coding tool. Track Cursor, Claude Code, Codex, Copilot and more. Free and open source.";
const PRODUCTION_BODY_CLASS =
  "geistsans_d5a4f12f-module__Ur3q_a__variable geistpixelcircle_7ee616e3-module__hUl13q__variable antialiased";
const PRODUCTION_STYLESHEET_URL =
  "https://www.openusage.ai/_next/static/chunks/18141af1dfe18c48.css?dpl=dpl_FEcNUMfudsUjMFbSH2z2Gkhx1iG7";
const DEFAULT_RELEASE_REPOSITORY = "Noisemaker111/openusage-mono";
const RELEASE_REPOSITORY =
  import.meta.env.VITE_RELEASE_REPOSITORY && import.meta.env.VITE_RELEASE_REPOSITORY.trim().length > 0
    ? import.meta.env.VITE_RELEASE_REPOSITORY.trim()
    : DEFAULT_RELEASE_REPOSITORY;
const DEFAULT_GITHUB_REPOSITORY_URL = `https://github.com/${DEFAULT_RELEASE_REPOSITORY}`;
const RAW_RELEASE_CHANNEL = import.meta.env.VITE_RELEASE_CHANNEL;
const RELEASE_CHANNEL =
  RAW_RELEASE_CHANNEL === "dev"
    ? "dev"
    : RAW_RELEASE_CHANNEL === "stable"
      ? "stable"
      : import.meta.env.VITE_VERCEL_ENV === "preview"
        ? "dev"
        : "stable";
const RELEASES_API_BASE_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}`;
const RELEASES_LIST_API_URL = `${RELEASES_API_BASE_URL}/releases?per_page=20`;
const UPDATER_MANIFEST_URL = `https://github.com/${RELEASE_REPOSITORY}/releases/latest/download/latest.json`;
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
  releaseTrack: "stable" | "beta";
  comingSoon: boolean;
}

interface DownloadFallbackUrls {
  macArmUrl: string | null;
  macIntelUrl: string | null;
  windowsUrl: string | null;
  linuxUrl: string | null;
}

interface GitHubRepository {
  owner: string;
  repo: string;
  slug: string;
  url: string;
}

interface RepositoryStarsSnapshot {
  repository: string;
  stars: number | null;
  fetchedAt: number | null;
  lastRefreshRequestedAt: number | null;
  cacheTtlMs: number;
  refreshCooldownMs: number;
}

function parseGitHubRepository(value: string): GitHubRepository | null {
  const parts = value
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .split("/")
    .filter((part) => part.length > 0);

  if (parts.length !== 2) {
    return null;
  }

  const [owner, repo] = parts;
  return {
    owner,
    repo,
    slug: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
  };
}

const GITHUB_REPOSITORY = parseGitHubRepository(RELEASE_REPOSITORY);

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

function hasDownloadableAsset(release: ReleaseData): boolean {
  for (const asset of release.assets) {
    const normalizedName = asset.name.toLowerCase();
    if (
      normalizedName.endsWith(".dmg") ||
      normalizedName.endsWith(".exe") ||
      normalizedName.endsWith(".msi") ||
      normalizedName.endsWith(".appimage") ||
      normalizedName.endsWith(".deb") ||
      normalizedName.endsWith(".rpm")
    ) {
      return true;
    }
  }

  return false;
}

function pickReleaseForChannel(
  releases: ReadonlyArray<ReleaseData>,
  channel: ReleaseChannel,
): ReleaseData | null {
  if (releases.length === 0) {
    return null;
  }

  const primaryMatch =
    channel === "dev"
      ? releases.find((release) => release.prerelease && hasDownloadableAsset(release))
      : releases.find((release) => !release.prerelease && hasDownloadableAsset(release));

  if (primaryMatch !== undefined) {
    return primaryMatch;
  }

  const channelFallback =
    channel === "dev"
      ? releases.find((release) => release.prerelease)
      : releases.find((release) => !release.prerelease);

  if (channelFallback !== undefined) {
    return channelFallback;
  }

  const releaseWithDownloads = releases.find((release) => hasDownloadableAsset(release));
  if (releaseWithDownloads !== undefined) {
    return releaseWithDownloads;
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

function findAssetUrlAcrossReleases(
  releases: ReadonlyArray<ReleaseData>,
  predicate: (normalizedAssetName: string) => boolean,
): string | null {
  for (const release of releases) {
    const url = findAssetUrl(release.assets, predicate);
    if (url !== null) {
      return url;
    }
  }

  return null;
}

function extractUpdaterUrl(platformEntries: ReadonlyArray<[string, string]>, matcher: (key: string, url: string) => boolean): string | null {
  for (const [platformKey, url] of platformEntries) {
    if (matcher(platformKey, url)) {
      return url;
    }
  }

  return null;
}

function extractUpdaterFallbackUrls(payload: unknown): DownloadFallbackUrls | null {
  if (!isRecord(payload)) {
    return null;
  }

  const maybePlatforms = payload.platforms;
  if (!isRecord(maybePlatforms)) {
    return null;
  }

  const platformEntries: Array<[string, string]> = [];
  for (const [rawKey, rawValue] of Object.entries(maybePlatforms)) {
    if (!isRecord(rawValue)) {
      continue;
    }

    const maybeUrl = rawValue.url;
    if (typeof maybeUrl !== "string" || maybeUrl.length === 0) {
      continue;
    }

    platformEntries.push([rawKey.toLowerCase(), maybeUrl]);
  }

  if (platformEntries.length === 0) {
    return null;
  }

  const macArmUrl = extractUpdaterUrl(
    platformEntries,
    (key, url) =>
      (key.includes("darwin") || key.includes("mac")) &&
      (key.includes("aarch64") || key.includes("arm64") || url.toLowerCase().includes("aarch64")),
  );
  const macIntelUrl = extractUpdaterUrl(
    platformEntries,
    (key, url) =>
      (key.includes("darwin") || key.includes("mac")) &&
      (key.includes("x86_64") || key.includes("x64") || url.toLowerCase().includes("x64")),
  );
  const windowsUrl = extractUpdaterUrl(
    platformEntries,
    (key, url) =>
      key.includes("windows") || url.toLowerCase().includes(".msi") || url.toLowerCase().includes(".exe") || url.toLowerCase().includes("windows"),
  );
  const linuxUrl = extractUpdaterUrl(
    platformEntries,
    (key, url) =>
      key.includes("linux") ||
      url.toLowerCase().includes(".appimage") ||
      url.toLowerCase().includes(".deb") ||
      url.toLowerCase().includes(".rpm") ||
      url.toLowerCase().includes("linux"),
  );

  return {
    macArmUrl,
    macIntelUrl,
    windowsUrl,
    linuxUrl,
  };
}

function extractReleaseFallbackUrls(releases: ReadonlyArray<ReleaseData>): DownloadFallbackUrls | null {
  const macArmUrl = findAssetUrlAcrossReleases(
    releases,
    (name) => name.endsWith("aarch64.dmg") || name.endsWith("arm64.dmg"),
  );
  const macIntelUrl = findAssetUrlAcrossReleases(
    releases,
    (name) => name.endsWith("x64.dmg") || name.endsWith("intel.dmg"),
  );
  const windowsUrl =
    findAssetUrlAcrossReleases(
      releases,
      (name) =>
        (name.endsWith(".exe") || name.endsWith(".msi")) &&
        (name.includes("x64") || name.includes("amd64") || name.includes("windows")),
    ) ?? findAssetUrlAcrossReleases(releases, (name) => name.endsWith(".exe") || name.endsWith(".msi") || name.includes("windows"));
  const linuxUrl = findAssetUrlAcrossReleases(
    releases,
    (name) =>
      name.endsWith(".appimage") ||
      name.endsWith(".deb") ||
      name.endsWith(".rpm") ||
      (name.includes("linux") && (name.endsWith(".tar.gz") || name.endsWith(".zip"))),
  );

  if (macArmUrl === null && macIntelUrl === null && windowsUrl === null && linuxUrl === null) {
    return null;
  }

  return {
    macArmUrl,
    macIntelUrl,
    windowsUrl,
    linuxUrl,
  };
}

function buildDownloadOptions(
  assets: ReadonlyArray<ReleaseAsset>,
  fallbackUrls: DownloadFallbackUrls | null = null,
): ReadonlyArray<DownloadOption> {
  const macArmUrl =
    findAssetUrl(assets, (name) => name.endsWith("aarch64.dmg") || name.endsWith("arm64.dmg")) ??
    fallbackUrls?.macArmUrl ??
    null;
  const macIntelUrl =
    findAssetUrl(assets, (name) => name.endsWith("x64.dmg") || name.endsWith("intel.dmg")) ??
    fallbackUrls?.macIntelUrl ??
    null;

  const windowsUrl =
    findAssetUrl(
      assets,
      (name) => (name.endsWith(".exe") || name.endsWith(".msi")) && (name.includes("x64") || name.includes("amd64") || name.includes("windows")),
    ) ??
    findAssetUrl(assets, (name) => name.endsWith(".exe") || name.endsWith(".msi") || name.includes("windows")) ??
    fallbackUrls?.windowsUrl ??
    null;

  const linuxUrl =
    findAssetUrl(
      assets,
      (name) =>
        name.endsWith(".appimage") ||
        name.endsWith(".deb") ||
        name.endsWith(".rpm") ||
        (name.includes("linux") && (name.endsWith(".tar.gz") || name.endsWith(".zip"))),
    ) ??
    fallbackUrls?.linuxUrl ??
    null;

  const fallbackSectionHref = `#${MORE_DOWNLOADS_SECTION_ID}`;

  return [
    {
      id: "macos-apple-silicon",
      title: "macOS (Apple Silicon)",
      subtitle: "arm64 dmg",
      href: macArmUrl ?? fallbackSectionHref,
      available: macArmUrl !== null,
      releaseTrack: "stable",
      comingSoon: false,
    },
    {
      id: "macos-intel",
      title: "macOS (Intel)",
      subtitle: "x64 dmg",
      href: macIntelUrl ?? fallbackSectionHref,
      available: macIntelUrl !== null,
      releaseTrack: "stable",
      comingSoon: false,
    },
    {
      id: "windows-x64",
      title: "Windows",
      subtitle: "x64 installer",
      href: windowsUrl ?? fallbackSectionHref,
      available: windowsUrl !== null,
      releaseTrack: "beta",
      comingSoon: false,
    },
    {
      id: "linux-x64",
      title: "Linux",
      subtitle: "AppImage / DEB / RPM",
      href: linuxUrl ?? fallbackSectionHref,
      available: linuxUrl !== null,
      releaseTrack: "beta",
      comingSoon: linuxUrl === null,
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
    if (option !== null && option.available) {
      return option;
    }
  }

  if (platform === "windows") {
    const option = getOptionById(options, "windows-x64");
    if (option !== null && option.available) {
      return option;
    }
  }

  if (platform === "linux") {
    const option = getOptionById(options, "linux-x64");
    if (option !== null && option.available) {
      return option;
    }
  }

  for (const option of options) {
    if (option.available) {
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
    href: `#${MORE_DOWNLOADS_SECTION_ID}`,
    available: false,
    releaseTrack: "stable",
    comingSoon: true,
  };
}

function getDownloadTrackLabel(option: DownloadOption): string | null {
  if (option.releaseTrack === "stable") {
    return null;
  }

  if (option.comingSoon) {
    return "Beta soon";
  }

  return "Beta";
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

  const primaryTrackLabel = getDownloadTrackLabel(primaryOption);
  const primaryLabel =
    primaryTrackLabel === null ? `Download for ${platformLabel}` : `Download for ${platformLabel} (${primaryTrackLabel})`;
  for (const anchor of anchors.slice(0, 2)) {
    anchor.textContent = primaryLabel;
    anchor.setAttribute("href", primaryOption.href);

    if (primaryOption.available) {
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      anchor.onclick = null;
      continue;
    }

    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
    anchor.onclick = (event) => {
      event.preventDefault();
      const targetSection = document.getElementById(MORE_DOWNLOADS_SECTION_ID);
      if (targetSection === null) {
        return;
      }

      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${MORE_DOWNLOADS_SECTION_ID}`);
    };
  }

  const ctaParagraph = Array.from(document.querySelectorAll("p")).find((paragraph) => {
    const text = paragraph.textContent ?? "";
    return text.includes("Download OpenUsage for") && text.includes("never have to guess your limits again");
  });

  if (ctaParagraph !== undefined) {
    ctaParagraph.textContent =
      primaryTrackLabel === null
        ? `Download OpenUsage for ${platformLabel}. It is free, and you will never have to guess your limits again.`
        : `Download OpenUsage for ${platformLabel} (${primaryTrackLabel}). It is free, and you will never have to guess your limits again.`;
  }

  const ctaFootnote = Array.from(document.querySelectorAll("p")).find((paragraph) => {
    const text = paragraph.textContent ?? "";
    return text.includes("MIT License") && text.includes("Requires macOS");
  });

  if (ctaFootnote !== undefined) {
    ctaFootnote.textContent = "macOS - Windows Beta - Linux Beta soon - MIT License";
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
  description.textContent = `${releaseSummary}. macOS is available, Windows is Beta, Linux is Beta soon.`;

  header.append(title, description);

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3";

  for (const option of options) {
    const card = document.createElement("a");
    card.href = option.href;
    if (option.available) {
      card.removeAttribute("target");
      card.removeAttribute("rel");
    } else {
      card.removeAttribute("target");
      card.removeAttribute("rel");
      card.setAttribute("aria-disabled", "true");
      card.addEventListener("click", (event) => {
        event.preventDefault();
      });
    }
    card.className = "rounded-xl p-4 transition-colors hover:brightness-110";
    card.style.border = "1px solid var(--page-border)";
    card.style.backgroundColor = "rgba(0, 0, 0, 0.15)";
    card.style.backdropFilter = "blur(20px)";
    card.style.setProperty("-webkit-backdrop-filter", "blur(20px)");

    const cardHeader = document.createElement("div");
    cardHeader.className = "flex items-center justify-between gap-2";

    const cardTitle = document.createElement("p");
    cardTitle.className = "text-sm font-semibold";
    cardTitle.style.color = "var(--page-fg)";
    cardTitle.textContent = option.title;

    const stageBadge = document.createElement("span");
    stageBadge.className = "text-[11px] px-2 py-[2px] rounded";
    stageBadge.style.border = "1px solid var(--page-border)";
    stageBadge.style.backgroundColor = "rgba(255,255,255,0.08)";
    stageBadge.style.color = "var(--page-fg-subtle)";
    const trackLabel = getDownloadTrackLabel(option);
    if (trackLabel !== null) {
      stageBadge.textContent = trackLabel;
      cardHeader.append(cardTitle, stageBadge);
    } else {
      cardHeader.append(cardTitle);
    }

    const cardSubtitle = document.createElement("p");
    cardSubtitle.className = "text-xs mt-1";
    cardSubtitle.style.color = "var(--page-fg-subtle)";
    cardSubtitle.textContent = option.subtitle;

    const cardAction = document.createElement("p");
    cardAction.className = "text-xs mt-3";
    cardAction.style.color = option.available ? "var(--page-accent)" : "var(--page-fg-muted)";
    if (option.available) {
      cardAction.textContent = trackLabel === null ? "Download" : `Download ${trackLabel.toLowerCase()}`;
    } else {
      cardAction.textContent = option.comingSoon ? "Coming soon" : "Unavailable";
    }

    card.append(cardHeader, cardSubtitle, cardAction);
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

function formatStarCount(stars: number): string {
  if (stars >= 1_000_000) {
    const millions = stars / 1_000_000;
    const value = millions >= 10 ? Math.round(millions).toString() : millions.toFixed(1);
    return `${value}M`;
  }

  if (stars >= 1_000) {
    const thousands = stars / 1_000;
    const value = thousands >= 10 ? Math.round(thousands).toString() : thousands.toFixed(1);
    return `${value}k`;
  }

  return stars.toString();
}

function formatStarLabel(stars: number): string {
  if (stars === 1) {
    return "1 Star";
  }

  return `${formatStarCount(stars)} Stars`;
}

function shouldRefreshRepositoryStars(snapshot: RepositoryStarsSnapshot | null): boolean {
  if (snapshot === null) {
    return true;
  }

  const now = Date.now();
  const hasFreshCache = snapshot.fetchedAt !== null && now - snapshot.fetchedAt < snapshot.cacheTtlMs;
  if (hasFreshCache) {
    return false;
  }

  const isInCooldown =
    snapshot.lastRefreshRequestedAt !== null && now - snapshot.lastRefreshRequestedAt < snapshot.refreshCooldownMs;
  return !isInCooldown;
}

function updateMenuBarGithubStars(stars: number | null, repositoryUrl: string): void {
  const trayIcon = document.getElementById("tray-icon");
  if (trayIcon === null || trayIcon.parentElement === null) {
    return;
  }

  const rightMenuGroup = trayIcon.parentElement;
  const existingAnchor = rightMenuGroup.querySelector<HTMLAnchorElement>("a[data-openusage-github-stars='true']");
  if (existingAnchor !== null) {
    existingAnchor.remove();
  }

  const starsAnchor = document.createElement("a");
  starsAnchor.setAttribute("data-openusage-github-stars", "true");
  starsAnchor.href = repositoryUrl;
  starsAnchor.target = "_blank";
  starsAnchor.rel = "noopener noreferrer";
  starsAnchor.className = "text-[11px] font-semibold opacity-90 hover:opacity-100 transition-opacity";
  starsAnchor.style.display = "inline-flex";
  starsAnchor.style.alignItems = "center";
  starsAnchor.style.gap = "4px";
  starsAnchor.style.color = "var(--bar-fg)";

  const starGlyph = document.createElement("span");
  starGlyph.textContent = "★";
  starGlyph.style.color = "#f4c542";

  const starLabel = document.createElement("span");
  starLabel.textContent = stars === null ? "Star" : formatStarLabel(stars);

  starsAnchor.append(starGlyph, starLabel);
  starsAnchor.title = stars === null ? "Open repository on GitHub" : `Open repository on GitHub (${stars.toLocaleString()} stars)`;

  rightMenuGroup.insertBefore(starsAnchor, trayIcon);
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
  const convex = useConvex();
  const refreshRepositoryStars = useAction(api.github.refreshRepositoryStars);

  useEffect(() => {
    const previousBodyClassName = document.body.className;
    document.body.className = PRODUCTION_BODY_CLASS;

    const userAgent = navigator.userAgent;
    const platform = detectPlatform(userAgent);
    const architecture = detectArchitecture(userAgent);

    updateMenuBarClock();
    const clockInterval = window.setInterval(updateMenuBarClock, 30_000);
    const repositoryUrl = GITHUB_REPOSITORY?.url ?? DEFAULT_GITHUB_REPOSITORY_URL;
    updateMenuBarGithubStars(null, repositoryUrl);

    applyDownloadUi(buildDownloadOptions([]), platform, architecture, null);

    let isActive = true;

    const applyUpdaterManifestFallback = async (): Promise<boolean> => {
      try {
        const response = await fetch(UPDATER_MANIFEST_URL, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return false;
        }

        const payload: unknown = await response.json();
        const fallbackUrls = extractUpdaterFallbackUrls(payload);
        if (fallbackUrls === null) {
          return false;
        }

        if (!isActive) {
          return false;
        }

        applyDownloadUi(buildDownloadOptions([], fallbackUrls), platform, architecture, null);
        return true;
      } catch {
        return false;
      }
    };

    void (async () => {
      try {
        const response = await fetch(RELEASES_LIST_API_URL, {
          headers: {
            Accept: "application/vnd.github+json",
          },
        });

        if (!response.ok) {
          await applyUpdaterManifestFallback();
          return;
        }

        const payload: unknown = await response.json();
        const releases = extractReleaseList(payload);
        const release = pickReleaseForChannel(releases, RELEASE_CHANNEL);

        if (!isActive) {
          return;
        }

        if (release === null) {
          await applyUpdaterManifestFallback();
          return;
        }

        const releaseFallbackUrls = extractReleaseFallbackUrls(releases);
        applyDownloadUi(buildDownloadOptions(release.assets, releaseFallbackUrls), platform, architecture, release.tag);
      } catch {
        await applyUpdaterManifestFallback();
      }
    })();

    void (async () => {
      if (GITHUB_REPOSITORY === null) {
        return;
      }

      try {
        const currentSnapshot = await convex.query(api.github.getRepositoryStars, {
          owner: GITHUB_REPOSITORY.owner,
          repo: GITHUB_REPOSITORY.repo,
        });

        if (!isActive) {
          return;
        }

        updateMenuBarGithubStars(currentSnapshot.stars, repositoryUrl);

        if (!shouldRefreshRepositoryStars(currentSnapshot)) {
          return;
        }

        await refreshRepositoryStars({
          owner: GITHUB_REPOSITORY.owner,
          repo: GITHUB_REPOSITORY.repo,
        });

        const updatedSnapshot = await convex.query(api.github.getRepositoryStars, {
          owner: GITHUB_REPOSITORY.owner,
          repo: GITHUB_REPOSITORY.repo,
        });

        if (!isActive) {
          return;
        }

        updateMenuBarGithubStars(updatedSnapshot.stars, repositoryUrl);
      } catch {
        if (!isActive) {
          return;
        }

        updateMenuBarGithubStars(null, repositoryUrl);
      }
    })();

    return () => {
      isActive = false;
      window.clearInterval(clockInterval);
      const moreDownloadsSection = document.getElementById(MORE_DOWNLOADS_SECTION_ID);
      if (moreDownloadsSection !== null) {
        moreDownloadsSection.remove();
      }

      const starsAnchor = document.querySelector<HTMLAnchorElement>("a[data-openusage-github-stars='true']");
      if (starsAnchor !== null) {
        starsAnchor.remove();
      }

      document.body.className = previousBodyClassName;
    };
  }, [convex, refreshRepositoryStars]);

  return <div dangerouslySetInnerHTML={{ __html: productionBodyHtml }} />;
}
