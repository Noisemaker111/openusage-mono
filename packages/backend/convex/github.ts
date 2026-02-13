import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";

const STARS_CACHE_TTL_MS = 1000 * 60 * 30;
const REFRESH_COOLDOWN_MS = 1000 * 60 * 2;

interface GitHubRepositoryInput {
  owner: string;
  repo: string;
}

function toRepositorySlug(input: GitHubRepositoryInput): string {
  return `${input.owner}/${input.repo}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseGitHubStars(payload: unknown): number | null {
  if (!isRecord(payload)) {
    return null;
  }

  const maybeStars = payload.stargazers_count;
  if (typeof maybeStars !== "number" || !Number.isFinite(maybeStars) || maybeStars < 0) {
    return null;
  }

  return Math.floor(maybeStars);
}

export const getRepositoryStars = query({
  args: {
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (ctx, args) => {
    const slug = toRepositorySlug(args);
    const existing = await ctx.db
      .query("githubRepositoryStats")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    return {
      repository: slug,
      stars: existing?.stars ?? null,
      fetchedAt: existing?.fetchedAt ?? null,
      lastRefreshRequestedAt: existing?.lastRefreshRequestedAt ?? null,
      cacheTtlMs: STARS_CACHE_TTL_MS,
      refreshCooldownMs: REFRESH_COOLDOWN_MS,
    };
  },
});

export const markRefreshRequested = internalMutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    requestedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const slug = toRepositorySlug(args);
    const existing = await ctx.db
      .query("githubRepositoryStats")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (existing === null) {
      await ctx.db.insert("githubRepositoryStats", {
        slug,
        owner: args.owner,
        repo: args.repo,
        stars: null,
        fetchedAt: null,
        lastRefreshRequestedAt: args.requestedAt,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      lastRefreshRequestedAt: args.requestedAt,
      owner: args.owner,
      repo: args.repo,
    });
  },
});

export const setRepositoryStars = internalMutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    stars: v.number(),
    fetchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const slug = toRepositorySlug(args);
    const existing = await ctx.db
      .query("githubRepositoryStats")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (existing === null) {
      await ctx.db.insert("githubRepositoryStats", {
        slug,
        owner: args.owner,
        repo: args.repo,
        stars: args.stars,
        fetchedAt: args.fetchedAt,
        lastRefreshRequestedAt: args.fetchedAt,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      owner: args.owner,
      repo: args.repo,
      stars: args.stars,
      fetchedAt: args.fetchedAt,
      lastRefreshRequestedAt: args.fetchedAt,
    });
  },
});

export const refreshRepositoryStars = action({
  args: {
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const current = await ctx.runQuery(api.github.getRepositoryStars, args);

    const hasFreshCache = current.fetchedAt !== null && now - current.fetchedAt < current.cacheTtlMs;
    if (hasFreshCache) {
      return { refreshed: false, source: "cache" };
    }

    const recentlyRequested =
      current.lastRefreshRequestedAt !== null && now - current.lastRefreshRequestedAt < current.refreshCooldownMs;
    if (recentlyRequested) {
      return { refreshed: false, source: "cooldown" };
    }

    await ctx.runMutation(internal.github.markRefreshRequested, {
      owner: args.owner,
      repo: args.repo,
      requestedAt: now,
    });

    const endpoint = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`;
    const githubToken = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (typeof githubToken === "string" && githubToken.trim().length > 0) {
      headers.Authorization = `Bearer ${githubToken.trim()}`;
    }

    try {
      const response = await fetch(endpoint, {
        headers,
      });

      if (!response.ok) {
        return { refreshed: false, source: "github-error" };
      }

      const payload: unknown = await response.json();
      const stars = parseGitHubStars(payload);
      if (stars === null) {
        return { refreshed: false, source: "invalid-payload" };
      }

      await ctx.runMutation(internal.github.setRepositoryStars, {
        owner: args.owner,
        repo: args.repo,
        stars,
        fetchedAt: now,
      });

      return { refreshed: true, source: "github" };
    } catch {
      return { refreshed: false, source: "network-error" };
    }
  },
});
