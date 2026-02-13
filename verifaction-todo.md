# App Verification TODO

## Why users see warnings now

- **macOS warning** (`Apple could not verify ... free of malware`) means the app is not fully trusted by Gatekeeper yet (missing notarization and/or stapled ticket).
- **Windows warning** (`Unknown publisher`) means installers are not Authenticode-signed with a trusted code-signing certificate, or the cert has no SmartScreen reputation yet.

---

## 1) macOS trust (Gatekeeper) - Required

### A. Apple account and certs

- [ ] Enroll in Apple Developer Program (paid account).
- [ ] Create **Developer ID Application** certificate.
- [ ] Export certificate as `.p12` + password from Keychain.

### B. Notarization credentials

- [ ] Create app-specific password for Apple ID.
- [ ] Confirm values for:
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
  - `APPLE_SIGNING_IDENTITY` (example in `packages/tauri-src/.env.example`)

### C. GitHub Actions secrets

- [ ] Add signing/notarization secrets in repo settings:
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
  - `APPLE_SIGNING_IDENTITY`
  - (if needed by your setup) certificate secrets for CI keychain import (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`).

### D. Workflow wiring

- [ ] Ensure `.github/workflows/release-dev.yml` passes Apple signing/notarization envs to `tauri-apps/tauri-action`.
- [ ] Ensure `.github/workflows/release-stable.yml` passes same envs.

### E. Verify on produced artifact

- [ ] Confirm app is signed:
  - `codesign --verify --deep --strict --verbose=2 OpenUsage.app`
- [ ] Confirm notarization ticket is stapled:
  - `xcrun stapler validate OpenUsage.app`
- [ ] Confirm Gatekeeper acceptance:
  - `spctl --assess --type execute -vv OpenUsage.app`

---

## 2) Windows trust (SmartScreen + publisher) - Required

### A. Certificate

- [ ] Buy code-signing cert (recommended: **EV cert** for fastest SmartScreen trust).
- [ ] Export cert as `.pfx` and keep password.

### B. GitHub Actions secrets

- [ ] Add:
  - `WINDOWS_CERTIFICATE` (base64-encoded `.pfx`)
  - `WINDOWS_CERTIFICATE_PASSWORD`

### C. Workflow wiring

- [ ] Update `.github/workflows/release-dev.yml` Windows publish job to include Windows signing envs.
- [ ] Update `.github/workflows/release-stable.yml` Windows publish job similarly.
- [ ] Keep failing the release if Windows signing secrets are missing (do not ship unsigned Windows installers).

### D. Verify on produced artifact

- [ ] Verify signature in PowerShell:
  - `Get-AuthenticodeSignature .\OpenUsage_...exe | Format-List`
- [ ] Verify MSI/exe chain with signtool:
  - `signtool verify /pa /v OpenUsage_...exe`

### E. SmartScreen reality check

- [ ] Expect some warning period with standard cert until reputation builds.
- [ ] EV cert minimizes/avoids the "unknown publisher" experience much faster.

---

## 3) Repo-specific checks to keep

- [ ] Keep updater signing secrets in place:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [ ] Keep updater pubkey correctly encoded in `packages/tauri-src/src-tauri/tauri.conf.json`.
- [ ] After changing release signing, run a full dev release and stable release dry run to confirm all three targets (mac arm64, mac x64, windows x64) publish successfully.

---

## Done criteria

- [ ] macOS downloads open without the malware verification block for signed/notarized builds.
- [ ] Windows installer shows your publisher name (not "Unknown Publisher").
- [ ] `release-dev` and `release-stable` both enforce signing and fail loudly if secrets are missing.
