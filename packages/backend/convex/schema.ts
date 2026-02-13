import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  githubRepositoryStats: defineTable({
    slug: v.string(),
    owner: v.string(),
    repo: v.string(),
    stars: v.union(v.number(), v.null()),
    fetchedAt: v.union(v.number(), v.null()),
    lastRefreshRequestedAt: v.number(),
  }).index("by_slug", ["slug"]),
});
