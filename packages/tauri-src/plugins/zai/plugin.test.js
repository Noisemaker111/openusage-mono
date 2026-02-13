import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__openusage_plugin
}

const mockEnvWithKey = (ctx, key, varName = "ZAI_API_KEY") => {
  ctx.host.env.get.mockImplementation((name) => (name === varName ? key : null))
}

const QUOTA_RESPONSE = {
  code: 200,
  data: {
    limits: [
      {
        type: "TOKENS_LIMIT",
        usage: 800000000,
        currentValue: 1900000,
        percentage: 10,
        nextResetTime: 1738368000000,
      },
      {
        type: "TIME_LIMIT",
        usage: 4000,
        currentValue: 1095,
      },
    ],
  },
}

const SUBSCRIPTION_RESPONSE = {
  data: [{ productName: "GLM Coding Max", nextRenewTime: "2026-03-12" }],
}

const mockHttp = (ctx) => {
  ctx.host.http.request.mockImplementation((opts) => {
    if (opts.url.includes("subscription")) {
      return { status: 200, bodyText: JSON.stringify(SUBSCRIPTION_RESPONSE) }
    }
    return { status: 200, bodyText: JSON.stringify(QUOTA_RESPONSE) }
  })
}

describe("zai plugin", () => {
  beforeEach(() => {
    delete globalThis.__openusage_plugin
    vi.resetModules()
  })

  it("throws when no env vars set", async () => {
    const ctx = makeCtx()
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("No ZAI_API_KEY found. Set up environment variable first.")
  })

  it("uses ZAI_API_KEY when set", async () => {
    const ctx = makeCtx()
    mockEnvWithKey(ctx, "test-key")
    mockHttp(ctx)

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.find((l) => l.label === "Session")).toBeTruthy()
  })

  it("falls back to GLM_API_KEY when ZAI_API_KEY is missing", async () => {
    const ctx = makeCtx()
    mockEnvWithKey(ctx, "glm-key", "GLM_API_KEY")
    mockHttp(ctx)

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.lines.find((l) => l.label === "Session")).toBeTruthy()
  })

  it("renders session usage and plan", async () => {
    const ctx = makeCtx()
    mockEnvWithKey(ctx, "test-key")
    mockHttp(ctx)

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const line = result.lines.find((l) => l.label === "Session")
    expect(line).toBeTruthy()
    expect(line.type).toBe("progress")
    expect(line.used).toBe(10)
    expect(line.limit).toBe(100)
    expect(result.plan).toBe("GLM Coding Max")
  })

  it("throws on auth failure", async () => {
    const ctx = makeCtx()
    mockEnvWithKey(ctx, "test-key")
    ctx.host.http.request.mockImplementation((opts) => {
      if (opts.url.includes("subscription")) {
        return { status: 200, bodyText: JSON.stringify(SUBSCRIPTION_RESPONSE) }
      }
      return { status: 401, bodyText: "" }
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("API key invalid")
  })

  it("throws on invalid JSON from quota endpoint", async () => {
    const ctx = makeCtx()
    mockEnvWithKey(ctx, "test-key")
    ctx.host.http.request.mockImplementation((opts) => {
      if (opts.url.includes("subscription")) {
        return { status: 200, bodyText: JSON.stringify(SUBSCRIPTION_RESPONSE) }
      }
      return { status: 200, bodyText: "not-json" }
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Usage response invalid")
  })

  it("renders Web Searches line with count format", async () => {
    const ctx = makeCtx()
    mockEnvWithKey(ctx, "test-key")
    mockHttp(ctx)

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const line = result.lines.find((l) => l.label === "Web Searches")
    expect(line).toBeTruthy()
    expect(line.type).toBe("progress")
    expect(line.used).toBe(1095)
    expect(line.limit).toBe(4000)
    expect(line.format).toEqual({ kind: "count", suffix: "/ 4000" })
  })
})
