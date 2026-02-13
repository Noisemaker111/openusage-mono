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
const LEGACY_RELEASE_REPOSITORY = "robinebers/openusage";
const RELEASE_REPOSITORY =
  import.meta.env.VITE_RELEASE_REPOSITORY && import.meta.env.VITE_RELEASE_REPOSITORY.trim().length > 0
    ? import.meta.env.VITE_RELEASE_REPOSITORY.trim()
    : DEFAULT_RELEASE_REPOSITORY;
const DEFAULT_GITHUB_REPOSITORY_URL = `https://github.com/${DEFAULT_RELEASE_REPOSITORY}`;
const LEGACY_GITHUB_REPOSITORY_URL = `https://github.com/${LEGACY_RELEASE_REPOSITORY}`;
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
type ReleaseTrack = "stable" | "beta";

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
  releaseTrack: ReleaseTrack;
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

function findTrackAssetUrl(
  releases: ReadonlyArray<ReleaseData>,
  releaseTrack: ReleaseTrack,
  predicate: (normalizedAssetName: string) => boolean,
): string | null {
  const trackReleases =
    releaseTrack === "stable" ? releases.filter((release) => !release.prerelease) : releases.filter((release) => release.prerelease);
  return findAssetUrlAcrossReleases(trackReleases, predicate);
}

function buildDownloadOptions(
  releases: ReadonlyArray<ReleaseData>,
  fallbackUrls: DownloadFallbackUrls | null = null,
): ReadonlyArray<DownloadOption> {
  const macArmStableUrl =
    findTrackAssetUrl(releases, "stable", (name) => name.endsWith("aarch64.dmg") || name.endsWith("arm64.dmg")) ??
    fallbackUrls?.macArmUrl ??
    null;
  const macArmBetaUrl = findTrackAssetUrl(
    releases,
    "beta",
    (name) => name.endsWith("aarch64.dmg") || name.endsWith("arm64.dmg"),
  );

  const macIntelStableUrl =
    findTrackAssetUrl(releases, "stable", (name) => name.endsWith("x64.dmg") || name.endsWith("intel.dmg")) ??
    fallbackUrls?.macIntelUrl ??
    null;
  const macIntelBetaUrl = findTrackAssetUrl(
    releases,
    "beta",
    (name) => name.endsWith("x64.dmg") || name.endsWith("intel.dmg"),
  );

  const windowsStableUrl =
    findTrackAssetUrl(
      releases,
      "stable",
      (name) => (name.endsWith(".exe") || name.endsWith(".msi")) && (name.includes("x64") || name.includes("amd64") || name.includes("windows")),
    ) ??
    findTrackAssetUrl(releases, "stable", (name) => name.endsWith(".exe") || name.endsWith(".msi") || name.includes("windows")) ??
    fallbackUrls?.windowsUrl ??
    null;
  const windowsBetaUrl =
    findTrackAssetUrl(
      releases,
      "beta",
      (name) => (name.endsWith(".exe") || name.endsWith(".msi")) && (name.includes("x64") || name.includes("amd64") || name.includes("windows")),
    ) ?? findTrackAssetUrl(releases, "beta", (name) => name.endsWith(".exe") || name.endsWith(".msi") || name.includes("windows"));

  const linuxStableUrl =
    findTrackAssetUrl(
      releases,
      "stable",
      (name) =>
        name.endsWith(".appimage") ||
        name.endsWith(".deb") ||
        name.endsWith(".rpm") ||
        (name.includes("linux") && (name.endsWith(".tar.gz") || name.endsWith(".zip"))),
    ) ??
    fallbackUrls?.linuxUrl ??
    null;
  const linuxBetaUrl = findTrackAssetUrl(
    releases,
    "beta",
    (name) =>
      name.endsWith(".appimage") ||
      name.endsWith(".deb") ||
      name.endsWith(".rpm") ||
      (name.includes("linux") && (name.endsWith(".tar.gz") || name.endsWith(".zip"))),
  );

  const fallbackSectionHref = `#${MORE_DOWNLOADS_SECTION_ID}`;

  return [
    {
      id: "macos-apple-silicon-stable",
      title: "macOS (Apple Silicon)",
      subtitle: "arm64 dmg",
      href: macArmStableUrl ?? fallbackSectionHref,
      available: macArmStableUrl !== null,
      releaseTrack: "stable",
      comingSoon: false,
    },
    {
      id: "macos-apple-silicon-beta",
      title: "macOS (Apple Silicon)",
      subtitle: "arm64 dmg",
      href: macArmBetaUrl ?? fallbackSectionHref,
      available: macArmBetaUrl !== null,
      releaseTrack: "beta",
      comingSoon: macArmBetaUrl === null,
    },
    {
      id: "macos-intel-stable",
      title: "macOS (Intel)",
      subtitle: "x64 dmg",
      href: macIntelStableUrl ?? fallbackSectionHref,
      available: macIntelStableUrl !== null,
      releaseTrack: "stable",
      comingSoon: false,
    },
    {
      id: "macos-intel-beta",
      title: "macOS (Intel)",
      subtitle: "x64 dmg",
      href: macIntelBetaUrl ?? fallbackSectionHref,
      available: macIntelBetaUrl !== null,
      releaseTrack: "beta",
      comingSoon: macIntelBetaUrl === null,
    },
    {
      id: "windows-x64-stable",
      title: "Windows",
      subtitle: "x64 installer",
      href: windowsStableUrl ?? fallbackSectionHref,
      available: windowsStableUrl !== null,
      releaseTrack: "stable",
      comingSoon: false,
    },
    {
      id: "windows-x64-beta",
      title: "Windows",
      subtitle: "x64 installer",
      href: windowsBetaUrl ?? fallbackSectionHref,
      available: windowsBetaUrl !== null,
      releaseTrack: "beta",
      comingSoon: windowsBetaUrl === null,
    },
    {
      id: "linux-x64-stable",
      title: "Linux",
      subtitle: "AppImage / DEB / RPM",
      href: linuxStableUrl ?? fallbackSectionHref,
      available: linuxStableUrl !== null,
      releaseTrack: "stable",
      comingSoon: false,
    },
    {
      id: "linux-x64-beta",
      title: "Linux",
      subtitle: "AppImage / DEB / RPM",
      href: linuxBetaUrl ?? fallbackSectionHref,
      available: linuxBetaUrl !== null,
      releaseTrack: "beta",
      comingSoon: linuxBetaUrl === null,
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
    const preferredIds =
      architecture === "arm64"
        ? ["macos-apple-silicon-stable", "macos-apple-silicon-beta"]
        : ["macos-intel-stable", "macos-intel-beta"];
    for (const id of preferredIds) {
      const option = getOptionById(options, id);
      if (option !== null && option.available) {
        return option;
      }
    }
  }

  if (platform === "windows") {
    for (const id of ["windows-x64-stable", "windows-x64-beta"]) {
      const option = getOptionById(options, id);
      if (option !== null && option.available) {
        return option;
      }
    }
  }

  if (platform === "linux") {
    for (const id of ["linux-x64-stable", "linux-x64-beta"]) {
      const option = getOptionById(options, id);
      if (option !== null && option.available) {
        return option;
      }
    }
  }

  for (const option of options) {
    if (option.available && option.releaseTrack === "stable") {
      return option;
    }
  }

  for (const option of options) {
    if (option.available) {
      return option;
    }
  }

  const fallback = getOptionById(options, "macos-apple-silicon-stable");
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

function getReleaseTrackLabel(track: ReleaseTrack): string {
  return track === "stable" ? "Stable" : "Beta";
}

function getDownloadTrackLabel(option: DownloadOption): string {
  const trackLabel = getReleaseTrackLabel(option.releaseTrack);
  if (!option.comingSoon) {
    return trackLabel;
  }

  return `${trackLabel} soon`;
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

function rewriteLegacyRepositoryLinks(repositoryUrl: string): void {
  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const href = anchor.getAttribute("href");
    if (href === null || !href.startsWith(LEGACY_GITHUB_REPOSITORY_URL)) {
      continue;
    }

    const suffix = href.slice(LEGACY_GITHUB_REPOSITORY_URL.length);
    anchor.setAttribute("href", `${repositoryUrl}${suffix}`);
  }
}

function getPlatformTrackSummary(
  options: ReadonlyArray<DownloadOption>,
  prefix: string,
  platformName: string,
): string {
  const platformOptions = options.filter((option) => option.id.startsWith(prefix));
  if (platformOptions.length === 0) {
    return `${platformName} unavailable`;
  }

  const labels: Array<string> = [];
  const stableAvailable = platformOptions.some((option) => option.releaseTrack === "stable" && option.available);
  if (stableAvailable) {
    labels.push("Stable");
  }

  const betaAvailable = platformOptions.some((option) => option.releaseTrack === "beta" && option.available);
  if (betaAvailable) {
    labels.push("Beta");
  } else {
    const betaSoon = platformOptions.some((option) => option.releaseTrack === "beta" && option.comingSoon);
    if (betaSoon) {
      labels.push("Beta soon");
    }
  }

  if (labels.length === 0) {
    return `${platformName} unavailable`;
  }

  return `${platformName} ${labels.join(" + ")}`;
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

function updatePrimaryDownloadCtas(
  primaryOption: DownloadOption,
  platformLabel: string,
  options: ReadonlyArray<DownloadOption>,
): void {
  const anchors = Array.from(document.querySelectorAll("a")).filter((anchor) => {
    const text = anchor.textContent?.trim() ?? "";
    return text.startsWith("Download for ");
  });

  const primaryTrackLabel = getDownloadTrackLabel(primaryOption);
  const primaryLabel = `Download for ${platformLabel} (${primaryTrackLabel})`;
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
    ctaParagraph.textContent = `Download OpenUsage for ${platformLabel} (${primaryTrackLabel}). It is free, and you will never have to guess your limits again.`;
  }

  const ctaFootnote = Array.from(document.querySelectorAll("p")).find((paragraph) => {
    const text = paragraph.textContent ?? "";
    return text.includes("MIT License") && text.includes("Requires macOS");
  });

  if (ctaFootnote !== undefined) {
    const macSummary = getPlatformTrackSummary(options, "macos-", "macOS");
    const windowsSummary = getPlatformTrackSummary(options, "windows-x64", "Windows");
    const linuxSummary = getPlatformTrackSummary(options, "linux-x64", "Linux");
    ctaFootnote.textContent = `${macSummary} - ${windowsSummary} - ${linuxSummary} - MIT License`;
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
  const macSummary = getPlatformTrackSummary(options, "macos-", "macOS");
  const windowsSummary = getPlatformTrackSummary(options, "windows-x64", "Windows");
  const linuxSummary = getPlatformTrackSummary(options, "linux-x64", "Linux");
  description.textContent = `${releaseSummary}. ${macSummary}, ${windowsSummary}, ${linuxSummary}.`;

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
    stageBadge.textContent = trackLabel;
    cardHeader.append(cardTitle, stageBadge);

    const cardSubtitle = document.createElement("p");
    cardSubtitle.className = "text-xs mt-1";
    cardSubtitle.style.color = "var(--page-fg-subtle)";
    cardSubtitle.textContent = option.subtitle;

    const cardAction = document.createElement("p");
    cardAction.className = "text-xs mt-3";
    cardAction.style.color = option.available ? "var(--page-accent)" : "var(--page-fg-muted)";
    if (option.available) {
      cardAction.textContent = `Download ${trackLabel.toLowerCase()}`;
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

  updatePrimaryDownloadCtas(primaryOption, platformLabel, options);
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
    rewriteLegacyRepositoryLinks(repositoryUrl);
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

        applyDownloadUi(buildDownloadOptions(releases), platform, architecture, release.tag);
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
