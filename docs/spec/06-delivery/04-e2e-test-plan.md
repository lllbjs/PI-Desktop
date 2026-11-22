# 04. E2E Test Plan

## 1. Goals

- Document every user-visible and protocol-visible behavior that MVP must verify.
- Provide a scenario catalog that maps to acceptance criteria (A–H) and milestones (M1–M6).
- Serve as the traceability backbone: scenario ID ↔ acceptance criterion ↔ spec.
- Define the required E2E gate for code-bearing task candidates containing the
  latest `origin/main`, before the pull request; do not merge into local `main`.
- Keep validation evidence tied to the commit the gate ran on, plus any later
  commit that changes the landed executable content.

## Scenario catalogs

Scenarios are grouped by product domain. Add a new scenario to the file
that owns its domain; keep its ID unique across all files.

| Domain | Catalog |
|---|---|
| Release, Platform, and Storage | [`e2e/release-and-platform.md`](e2e/release-and-platform.md) |
| Providers and Models | [`e2e/providers-and-models.md`](e2e/providers-and-models.md) |
| Conversation and Sessions | [`e2e/conversation.md`](e2e/conversation.md) |
| Tools, Permissions, and Workspace | [`e2e/tools-and-workspace.md`](e2e/tools-and-workspace.md) |
| Plugins and Extensions | [`e2e/plugins-and-extensions.md`](e2e/plugins-and-extensions.md) |
| Plans, Goals, Modes, and Automations | [`e2e/plans-goals-automation.md`](e2e/plans-goals-automation.md) |
| UI Shell | [`e2e/ui-shell.md`](e2e/ui-shell.md) |
| Live Sessions and Remote Control | [`e2e/live-and-remote.md`](e2e/live-and-remote.md) |

---

## 2. Non-goals

- Full UI-driven automated coverage; protocol and source-contract automation is
  active while the broader desktop suite remains planned.
- General performance / stress testing (post-MVP); bounded regression checks
  for desktop responsiveness are covered by the relevant functional scenarios.
- Native Windows/Linux release qualification (published artifacts exist; native
  qualification gaps remain documented).
- Hostile-plugin sandbox scenarios. Publisher provenance and the marketplace
  download boundary are now in scope (E2E-024R through E2E-024V); basic
  browse/install/update flows were already part of the catalog.
- Remote Gateway / browser control remains out of scope (ADR 0004 / baseline
  #20); the bounded local loopback MCP control plane is covered by E2E-220.

---

## 3. Test Pyramid

```
        ╱  E2E  ╲           — few, high-value, cross-system
       ╱ Integration ╲      — IPC/RPC contracts, host↔renderer
      ╱    Unit       ╲     — per-module, fast, isolated
```

| Level | Scope | Count target | Tooling |
|---|---|---|---|
| **Unit** | Single module, no IPC | Many | Vitest / Rust #[test] |
| **Integration** | IPC contract, host↔renderer, host↔sidecar | Moderate | Vitest + IPC mocks or live Electron |
| **E2E** | Full user journey through the desktop app | 100+ functional + US-UI visual catalog | protocol smoke + Electron probes now; Playwright later |

**Strategy**: document all E2E scenarios; add or update unit/integration tests
alongside code when change risk makes them necessary; use selective, high-value
E2E suites for every code-bearing pull request. Lower-level tests localize
correctness, while E2E validates cross-process runtime behavior; passing lower
levels does not waive the relevant E2E gate.

---

## 4. Tooling Intent

| Tool | Purpose | Status |
|---|---|---|
| **Vitest** | Unit + integration (TS side) | Active (`pnpm test`, shared package) |
| **Rust #[test]** | Host-core unit tests | Active (`cargo test -p host-core`) |
| **Protocol smoke** | Host RPC + tools + plugins headless | Active (`test:e2e`, 22 checks) |
| **Electron probes** | Boot bridge, session-list responsiveness, and crash supervision | Active (`test:e2e:boot`, `test:e2e:supervision`) |
| **Playwright** | Full UI-driven journeys | Planned (post-M5) |

> Decision: protocol smoke and Electron probes are active validation assets;
> broader desktop journeys remain scenario-specific and must be recorded as
> environment-limited when their required platform is unavailable.

---

## 5. Environment Requirements

| Requirement | Detail |
|---|---|
| Platform | macOS arm64 and Intel x64, Windows x64, and Linux x64 and arm64 release targets (D126/D285, D638 / ADR 0318) |
| Profile | Clean `~/.pi-desktop` profile (no prior config) |
| Fixtures | Sample project directory (`examples/fixtures/sample-project/`) |
| Sample plugin | `examples/plugins/hello` loaded from local path |
| Provider | At least one provider with a valid key (test account) |
| Display | Headless-capable Electron or real display |

---

## 6. Scenario Template

Each scenario is documented in this format:

```markdown
### E2E-<ID>: <title>

- **Preconditions**: what must be true before steps start
- **Steps**: ordered list of user / system actions
- **Expected**: observable outcome that proves correctness
- **Specs linked**: relevant spec file(s)
- **Acceptance criterion**: which A–H letter(s) this verifies
- **Milestone**: M1–M6 target
- **Status**: Draft | Documented | Partially automated | Automated | Passed
```

---

## E2E Main Integration Validation

Every code-bearing change must pass the E2E suites relevant to its regression
surface on a candidate that already contains the latest `origin/main`, before
the request branch is pushed and the pull request is opened. Code-bearing
changes include Renderer, Electron Main, Preload, Agent Runtime, Rust
host-core, sessions, transcripts, plans, plugins, MCP, permissions,
provider/model runtime, persistence, process lifecycle, packaging/runtime
startup, and build or CI behavior that affects application execution.
Documentation-only changes are exempt when they do not alter executable
behavior.

Run the selected suites from the request worktree after `pnpm check:pr-base`
passes. An E2E run on a branch that is behind `origin/main` is exploratory and
does not satisfy this gate. Do not merge the task into local `main` to create
the candidate.

### E2E environment reuse

Task-candidate E2E runs from the request worktree after the candidate is
prepared, but uses the host development environment already provisioned in the
primary checkout. Reuse the compatible Node/pnpm toolchain, `node_modules`,
Electron, Rust/Cargo targets, package-manager stores, build caches, and ignored
configuration by reference or link when needed.

Do not run `pnpm install`, `npm install`, or create a second dependency/runtime
environment solely for E2E. Isolate only mutable test state: temporary
profiles, data directories, sockets, ports, logs, and artifacts. Install or
rebuild dependencies only when the host environment is missing or incompatible
and record the reason. Clean CI and release runners may install from lockfiles.

Use the root `package.json` as the source of truth for executable commands.
The minimum selection is:

- Cross-cutting runtime, host, or IPC: `pnpm test:e2e`.
- Electron startup, preload, or window lifecycle: `pnpm test:e2e` and
  `pnpm test:e2e:boot`. For packaged-startup regressions, also run
  `node scripts/e2e-electron-boot.mjs <packaged-executable>` against the
  installed-layout artifact with an isolated profile.
- Session-list refresh or model capability lookup: `pnpm test:e2e` and
  `pnpm test:e2e:boot`, including the synthetic large-list responsiveness check.
- Settings/composer/plugin search theme surfaces: `pnpm build:js` followed by
  `pnpm test:e2e:theme-surfaces`.
- Composer clipboard representation and text insertion: `pnpm test:e2e:composer-paste`.
- Composer slash-menu name/description layout: `pnpm build:js` followed by
  `pnpm test:e2e:composer-autocomplete`.
- Transcript render boundaries and cross-part delegation display: `pnpm test:e2e:transcript`.
- Plan host/runtime behavior: `pnpm test:e2e` and `pnpm test:e2e:plan`.
- Plan UI behavior: `pnpm test:e2e:plan` and `pnpm test:e2e:plan-ui`.
- Host supervision, crash recovery, or restart behavior: `pnpm test:e2e` and
  `pnpm test:e2e:supervision`.
- Subagent lifecycle: `pnpm test:e2e` and `pnpm test:e2e:subagents`.
- Imported-extension dependency installation or registry-boundary changes: `pnpm test:e2e:plugin-import-deps`.
- Trusted extension or plugin-extension changes: `pnpm test:e2e:trusted-extensions`.
- Session collaboration / Session Orchestrator: `pnpm test:e2e:collaboration`.
- Completion-notice silence or the silent-turn contract (D193 / D446): `pnpm test:e2e:session-completion`.
- Changes spanning multiple surfaces use the union of the applicable suites.

`pnpm test:e2e` is the default cross-system smoke suite for host RPC, IPC,
agent execution, plugins, persistence integration, and shared runtime
contracts. A required suite that cannot run because of a missing display,
platform, credential, hardware resource, or other environment capability must
be recorded as `NOT RUN` with its reason, alternative validation, and remaining
risk. The pull request may still be opened with that record so the change can
be validated in a capable environment, but the gate is not satisfied and
delivery remains incomplete until the suite passes against the integrated
`main` that carries the change.

Required results must apply to the executable commit the gate ran on, and any
later commit that changes the landed executable content requires a rerun of
the affected suites (landing fixes, conflict resolution, or commits added
during review). Otherwise the recorded result stands. Report each command,
result, tested commit, and any relevant environment limitation; never claim an
unexecuted suite passed.

## E2E Failure Policy

A failed required E2E blocks the branch push, the pull request, and declaring
the integrated delivery complete until the failure is classified as an
implementation regression, test regression, environment failure, or known
flaky infrastructure. Fix the product or test defect and rerun the affected
suite against the integrated `main`. Do not delete scenarios, weaken
assertions, or add retries that hide a deterministic failure. When a scenario
is not automated on the required platform, keep its status documented and
identify the platform validation still needed.

## 7. MVP Scenario Catalog

### Runtime Resource Governance

#### E2E-097: Tool burst is bounded and recovers after host restart

- **Preconditions**: Host-core is healthy; one session has a workspace; the
  supervision probe can terminate the host process.
- **Steps**: 1) Dispatch a burst larger than the host tool budget containing
  read tools and shell commands. 2) Observe `app.health` while the burst runs.
  3) Terminate host-core during active calls. 4) Wait for one supervised
  restart. 5) Allow the persistence outbox to flush.
- **Expected**: Active shell processes never exceed the configured global and
  per-session limits. Excess work returns `HOST_OVERLOADED` or waits in the
  bounded queue. Queued requests do not reserve execution capacity: with four
  running Bash calls and twelve queued Bash calls, another session can still
  Read and Write. A saturated session cannot reserve spare class capacity, and
  admission-future cancellation/timeout restores queue and execution counters.
  Only one restart loop runs; stale-generation calls fail fast
  as `HOST_UNAVAILABLE`; no repeated `ERR_STREAM_DESTROYED` persistence storm
  is emitted. Temporary OS thread pressure during the same burst does not
  terminate host-core through its stdio control path; the host remains on one
  generation and capacity errors stay structured. Completed assistant/tool
  messages are persisted once after recovery.
- **Specs linked**: `03-runtime/06-host-rpc-protocol.md`,
  `03-runtime/07-process-model.md`, `03-runtime/08-error-codes.md`,
  `03-runtime/09-logging-and-observability.md`, ADR 0051
- **Acceptance**: A (runtime health), C (tool execution and recovery)
- **Milestone**: M5
- **Status**: Cross-session admission is automated by
  `node scripts/e2e-tool-admission.mjs` against an isolated real host. Class,
  session, global, mutation, queue bounds, fairness, cancellation, and timeout
  are unit-covered by `tool_budget/tests.rs`; restart coverage remains pending.

### Release & Packaging

#### E2E-192: Linux release publishes a system-Electron ASAR asset

- **Preconditions**: A `vX.Y.Z` tag matches `apps/desktop/package.json`; the
  Linux x64 release runner can complete `dist:linux` and has a system Electron
  available for repackaging validation. The arm64 lane is E2E-192a.
- **Steps**: 1) Run the tag release workflow. 2) Inspect the published GitHub
  Release assets. 3) Confirm the versioned
  `PI-Desktop-X.Y.Z-linux-x64.asar` asset is present. 4) Place that archive in
  the target Electron resources layout with the target package's native host
  and other resources, then launch it with `electron <archive>.asar`.
- **Expected**: The ASAR is copied byte-for-byte from
  `linux-unpacked/resources/app.asar`, is uploaded alongside the Linux
  AppImage, deb, and rpm, and the system Electron opens the PI-Desktop application
  archive without requiring the bundled Electron executable.
- **Specs linked**: `06-delivery/06-release-runbook.md`, `03-runtime/07-process-model.md`
- **Acceptance**: Quality (release artifact and packaging compatibility)
- **Milestone**: M6+
- **Status**: Documented; artifact export is unit-covered, native system-Electron
  repackaging remains runner validation

#### E2E-192a: Linux arm64 release lane publishes native arm64 packages

- **Preconditions**: A `vX.Y.Z` tag matches `apps/desktop/package.json`; GitHub's
  arm64 `ubuntu-22.04-arm` runner is available to the repository.
- **Steps**: 1) Run the tag release workflow. 2) Confirm the arm64 lane ran on
  an `aarch64` runner and that the packaged
  `target/release/pi-desktop-host-core` is an AArch64 binary. 3) Inspect the
  published Release assets for `PI-Desktop-X.Y.Z-linux-arm64.AppImage`,
  `pi-desktop_X.Y.Z_arm64.deb`, `pi-desktop-X.Y.Z-aarch64.rpm`,
  `PI-Desktop-X.Y.Z-linux-arm64.asar`, and
  `pi-host-X.Y.Z-linux-arm64.tar.gz` with its `.sha256`. 4) Confirm
  `latest-linux.yml` still lists the x64 AppImage while
  `latest-linux-arm64.yml` lists the arm64 one. 5) Install the arm64 AppImage,
  deb, or rpm on an arm64 Linux machine and launch it.
- **Expected**: Both feeds describe exactly one architecture-labelled AppImage
  each, the arm64 packages carry an arm64 host-core, the app starts on arm64
  Linux, and merging the lanes never replaces the x64 feed with the arm64 one.
- **Specs linked**: `06-delivery/06-release-runbook.md`, `01-product/01-product-scope.md`
- **Acceptance**: Quality (release artifact and packaging compatibility)
- **Milestone**: M6+
- **Status**: The matrix, feed naming, artifact naming, and the ASAR export are
  unit/source-contract covered (`ci-workflow.test.mjs`, `release-asar.test.mjs`);
  native arm64 installation remains runner validation. Microphone capture stays
  Raspberry Pi only on arm64 Linux (D638 / ADR 0318).

#### E2E-200: Linux RPM preserves the Wayland desktop identity

- **Preconditions**: A Linux x64 package validation run or tag release can
  complete on Ubuntu 22.04; a clean Fedora 44 KDE/Wayland machine is available
  for installation and launch.
- **Steps**: 1) Build the Linux targets and inspect the RPM with `rpm -qip` and
  `rpm -qpl`. 2) Confirm the package contains the application archive,
  host-core, `pi-desktop.desktop`, and the 512px `pi-desktop` icon. 3) Confirm
  the RPM has no global `/usr/lib/.build-id` links. 4) Install the RPM on the
  Fedora KDE/Wayland machine and launch PI-Desktop from its desktop entry.
  5) Inspect the taskbar grouping and the installed desktop entry.
- **Expected**: The x64 RPM is produced with the documented name and uploads
  with the release artifacts. Its desktop entry contains `Icon=pi-desktop` and
  `StartupWMClass=pi-desktop`; the running Wayland window groups with the
  PI-Desktop launcher and shows its icon instead of a generic Electron icon.
  The package remains notify-and-link for updates, and the bundled Electron
  binaries do not create global build-id links.
- **Specs linked**: `01-product/01-product-scope.md`,
  `04-ux/09-interaction-patterns.md`, `06-delivery/06-release-runbook.md`
- **Acceptance**: Quality (release packaging and desktop integration)
- **Milestone**: M6+
- **Status**: Unit/source-contract covered (`auto-update.test.mjs`,
  `development-branding.test.mjs`, `ci-workflow.test.mjs`); Fedora KDE/Wayland
  installation remains runner validation

#### E2E-196a: Unsigned macOS debug lane

- **Preconditions**: The Release workflow is manually dispatched with
  `sign_macos: false`; Windows and Linux release credentials are not affected.
  This path must not be used to publish a GitHub Release tag.
- **Steps**: 1) Dispatch the Release workflow with `sign_macos: false`. 2)
  Confirm both macOS architectures complete ordinary DMG/ZIP packaging without
  certificate secrets. 3) Inspect the artifacts and workflow steps.
- **Expected**: macOS DMG/ZIP artifacts are produced and uploaded without
  Developer ID signatures or notarization, using explicit `-arm64` and `-x64`
  filename markers for their native architecture; macOS staple and Gatekeeper
  checks are explicitly skipped. Windows/Linux artifacts and the merged updater
  feed still publish normally. This exception does not satisfy E2E-196c.
- **Specs linked**: `06-delivery/06-release-runbook.md`
- **Acceptance**: Quality (debug packaging)
- **Milestone**: M6+
- **Status**: Opt-in debug lane; tag releases must satisfy E2E-196c.

#### E2E-196b: macOS packages omit first-launch helper assets

- **Preconditions**: An unsigned macOS debug packaging run has produced DMG and
  ZIP artifacts for at least one native architecture.
- **Steps**: 1) Inspect the DMG and confirm the app and Applications link are
  the only items in its window. 2) Inspect the ZIP root without extracting the
  app and confirm neither `PI-Desktop-macOS-opening-help.txt` nor
  `PI-Desktop-macOS-open.command` is present. 3) Confirm the app remains
  installable from the ZIP.
- **Expected**: The DMG contains the branded 720×440 background, the app, and
  the Applications link only. The ZIP contains the app but neither first-launch
  guidance asset. The same omission applies to signed and unsigned macOS
  artifacts; signing, notarization, and updater behavior are unchanged.
- **Specs linked**: `06-delivery/06-release-runbook.md`,
  `05-security/01-security.md`
- **Acceptance**: Quality, Security
- **Milestone**: M6+
- **Status**: Automated by `packaging-footprint.test.mjs`; native archive
  inspection remains release-runner validation

#### E2E-196c: macOS tag artifacts pass Gatekeeper without a quarantine bypass

- **Preconditions**: A `vX.Y.Z` tag matching `apps/desktop/package.json` is
  pushed, or the Release workflow is dispatched with `sign_macos: true`
  (default); GitHub Actions has `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` secrets; both native macOS
  runners are available.
- **Steps**: 1) Run the tag workflow. 2) For each macOS architecture, inspect
  the unpacked app with `codesign -dv --verbose=4` and confirm authority
  `Developer ID Application: XingYu Liu (DUV63RKYTW)`. 3) Run
  `codesign --verify --deep --strict --verbose=2`,
  `spctl --assess --type execute --verbose=4`, and `xcrun stapler validate`
  against the app, including `Contents/Resources/bin/pi-desktop-host-core`.
  4) Confirm the app stapler shim retries `xcrun stapler staple` and
  `xcrun stapler validate` up to six total attempts after the app submission
  is accepted, then confirm the workflow's DMG step reported an Apple notary
  status of `Accepted` and stapled and validated the matching DMG. A transient
  CloudKit lookup failure during validation is retried within the same bound.
  5) Download the DMG on a clean macOS profile, move the app to
  `/Applications`, and open it without clearing `com.apple.quarantine`.
- **Expected**: Each macOS app passes signature integrity, Gatekeeper reports
  `source=Notarized Developer ID`, and both app and DMG contain valid stapled
  tickets. The DMG has its own submission: a DMG that was never submitted has
  no ticket and fails `stapler staple` with error 65, so a tag build must never
  reach that state. The app opens normally; no `xattr` quarantine-removal
  command or Security & Privacy override is required. Missing secrets, a
  rejected submission, or exhausted staple or validation retries fail the job.
- **Specs linked**: `06-delivery/06-release-runbook.md`,
  `05-security/01-security.md`, ADR 0289
- **Acceptance**: Quality, Security
- **Milestone**: M6+
- **Status**: Workflow script/unit-covered; clean-machine journey required for
  each release (run only in a capable environment when this surface changes)

#### E2E-212: GitHub Release starts the CNB mirror pipeline

- **Preconditions**: Repository secret `CNB_MIRROR_TOKEN` is configured on
  `vastsa/PI-Desktop`; the CNB pipeline at `aixk/Pi-Desktop` listens for
  `api_trigger_mirror`; a GitHub Release tag such as `vX.Y.Z` exists with
  uploaded artifacts.
- **Steps**: 1) Publish or edit that GitHub Release, or dispatch
  `mirror-to-cnb.yml` with the same tag. 2) Inspect the Actions log for the
  resolved tag and the POST to `api.cnb.cool`. 3) Confirm the CNB pipeline
  starts with `MIRROR_TAGS` equal to that tag.
- **Expected**: The job runs only on `vastsa/PI-Desktop`. Manual dispatch
  without a `vX.Y.Z` tag fails before calling CNB. A missing
  `CNB_MIRROR_TOKEN` fails closed. The JSON body is built with `jq` (not
  YAML string interpolation). GitHub Release artifacts and updater feeds are
  unchanged; CNB is a mirror of the same tag.
- **Specs linked**: `06-delivery/06-release-runbook.md`
- **Acceptance**: Quality (release mirroring)
- **Milestone**: M6+
- **Status**: Source-contract covered (`ci-workflow.test.mjs`); live CNB
  start remains operator validation (run only in a capable environment when this surface changes)

### Boot & Healthcheck

#### E2E-001: App launches and shows main window

- **Preconditions**: macOS arm64 or Intel x64; no prior `~/.pi-desktop` profile. For the
  development lane, workspace package build outputs are absent or older than
  their TypeScript sources.
- **Steps**: 1) Launch PI-Desktop. In the development lane, use `pnpm dev`.
  2) Observe main window appears. In the macOS development lane, confirm the
  menu-bar tray icon appears.
- **Expected**: Development launch rebuilds all workspace dependencies before
  host-core and Electron startup. Window first shows the branded startup splash
  while bootstrap runs, then reveals the main shell in English with the current
  locale catalog; no compile error, missing-menu runtime error, or crash;
  version info visible. The macOS development bundle contains both tray icon
  resources, and the tray starts without a missing-icon warning. Key lifecycle
  and error records are written to the categorized logs. GitHub auto-update is
  not started until after `ensureWindow`, and a hung feed cannot keep updater
  status on `checking` for Chromium's ~60s timeout. The Main output root also
  resolves from inside Rollup shared chunks (`out/main/chunks/*.js`), so the
  renderer entry, preloads, and the forked plugin host keep their authored
  relative paths instead of resolving one level too deep (black screen).
- **Specs linked**: `03-runtime/07-process-model.md`, `04-ux/01-ui-ia.md`,
  `03-runtime/09-logging-and-observability.md`
- **Acceptance**: A (app startup)
- **Milestone**: M1
- **Status**: Partially automated (`runtime-build-contract.test.mjs` covers the
  dependency build contract; `update-timeout.test.mjs` and
  `auto-update.test.mjs` cover the bounded auto-check contract;
  `main-module-path.test.mjs` covers the Main output-root contract from the
  entry bundle and from inside `out/main/chunks/`; Electron window
  launch remains Draft)

#### E2E-002: IPC bridge is functional

- **Preconditions**: App is running.
- **Steps**: 1) Trigger an action that calls preload IPC (e.g. version query). 2) Observe result in renderer.
- **Expected**: Main↔renderer IPC returns expected data; no error. The packaged
  main and plugin-panel sandbox preloads are self-contained and do not require
  an additional local runtime chunk.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`
- **Acceptance**: A (bridge normal)
- **Milestone**: M1
- **Status**: Automated (`scripts/e2e-electron-boot.mjs` — sandboxed preload bridge + IPC round-trip)

#### E2E-003: Rust host healthcheck responds

- **Preconditions**: App is running; Rust host-core sidecar started.
- **Cold-start timeout**: Let the first handshake time out, then allow a fresh
  host to answer. Verify the shell opens in the same desktop process. Repeat
  with both handshakes timing out and with quit during the first attempt.
  Verify the recovery surface stays available after two attempts and quit
  prevents a second child. The startup-host-retry tests inject these outcomes
  at the Main lifecycle boundary.
- **Steps**: 1) Electron handshakes with protocol version 11. 2) Call the host
  healthcheck RPC. 3) Repeat boot with mismatched older and newer protocol
  fixtures.
- **Expected**: The protocol v11 host returns `ok` and the handshake is logged.
  Every version other than v11, whether older or newer, is rejected before the
  conversation surface becomes interactive, so Plan approval/state events and
  context checkpoints cannot be silently lost.
- **Specs linked**: `03-runtime/05-host-core-rust.md`, `03-runtime/06-host-rpc-protocol.md`
- **Acceptance**: A (bridge normal)
- **Milestone**: M1
- **Status**: Automated (protocol smoke)

#### E2E-004: First-run inline checklist appears

- **Preconditions**: Fresh profile (no `~/.pi-desktop`).
- **Steps**: 1) Launch app on fresh profile. 2) Observe onboarding checklist.
- **Expected**: Inline checklist is displayed; provider/key items open Settings
  → Agent, and the optional plugin item opens the app-shell Plugins
  destination.
- **Specs linked**: `04-ux/05-onboarding.md`
- **Acceptance**: A (first-run checklist)
- **Milestone**: M2
- **Status**: Automated (protocol smoke: host onboarding state; UI checklist manual)

### Provider & Key

#### E2E-169: Default model picker selects a configured model

- **Preconditions**: Two runnable providers exist; one provider has at least two configured model bindings.
- **Steps**: Open Settings → Model configuration → Change default model, then select the second model under the provider.
- **Expected**: The Defaults card presents a compact settings row with the
  provider name and exact model ID beneath the Default model label; its quiet
  Change action does not repeat the current value. The picker groups
  model-level entries by provider, marks the exact current model, and a newly
  created session inherits that exact model and its owning provider. Changing
  the default later does not rewrite an already created session's stored
  provider/model; only a new session or the unpersisted home draft follows the
  live default. Searching by provider or model filters locally, the result list
  scrolls without moving the settings card, and an unmatched query shows an empty
  state.
- **Specs linked**: `03-runtime/13-model-catalog-and-selection.md`
- **Acceptance**: B (model selection)
- **Milestone**: M6
- **Status**: Documented; automation pending


#### E2E-005: Add a provider and save API key

- **Preconditions**: App running; no provider configured; the models.dev snapshot ships with the build.
- **Steps**: 1) Open Settings → Model configuration and choose Add provider. 2) Confirm the searchable service chooser opens. Filter and select a built-in API-key service or **Custom endpoint**; the selection must open its matching form, never the plugin-only “selected service unavailable” state. Confirm the form has no stepper or Next/Back buttons. For **Custom endpoint**, Name and Base URL appear on one row with no helper paragraph under the URL (placeholder only), API Key and API format appear side by side on the next row (not behind Advanced), and a focused field plus its 2px accent ring stays fully inside the dialog, including on a window narrower than 1040px. The custom form has no authentication-mode switch; the API key is optional and its input stays enabled. 3) Enter a name and a base URL for a service that publishes a `/models` route, then paste an API key. Confirm the models section fills with the models THAT SERVICE returned without requiring a key for discovery; confirm a model the deployment does not host is absent. Also exercise the no-auth path with a custom endpoint: leave the key empty, select a discovered model, and save. 4) Type in the filter box and confirm the list narrows client-side with no network request per keystroke. 5) Confirm each row shows the models.dev-derived context/output for models the catalog knows, that its compact text tracks the published value instead of a coarser rounded one (a 1,050,000 window reads `1.05M`, never `1.1M`), and that a model with no catalog match still lists with generic defaults. 6) Select two models with the checkboxes. 7) Expand Advanced on one chosen row, override its limits and toggle thinking chips; confirm each numeric field has a five-chip preset ladder for common values, clicking a chip writes the value, hand editing remains possible, and a non-preset value leaves the ladder unselected. Set max output to 8,192 while its context window still follows the catalog. On a model whose published image input is enabled, toggle image input off and then back on before saving, so the explicit choice equals the current catalog value. Confirm the label and optional hint sit above one compact grouped control and do not force the options onto a second row at normal dialog width; confirm all seven canonical levels are available, that published levels start selected for a known reasoning model, and that a non-reasoning or unknown row shows the same chips unselected with the manual-override hint; enable one level on that row and confirm the other row is unaffected. 8) Open the form-level Advanced and confirm the API format is present but pre-derived. 9) Add a free-form model ID the service did not return; confirm it is added with 128,000 / 8,192 / no-thinking defaults, then enable a thinking level if the endpoint supports it; confirm re-adding the same ID in different letter case is rejected as already added. 10) Save.
- **Expected**: The service is asked first and models.dev only enriches the answer and seeds known-model defaults. The no-auth custom path saves `authKind: "none"`, omits `secretValue`, and makes the configured provider available anywhere an enabled no-auth provider is selectable; named cloud preset behavior stays unchanged. Newly fetched or checked model rows stay collapsed until the user opens Advanced, so every selected model ID remains visible in the right pane after a multi-select. The settings picker always offers the seven canonical thinking levels, and the Composer later renders the explicit levels saved in the same model binding; an empty or `off`-only binding resolves to `off`. Discovery is debounced ~600 ms, does not mark loading until that window elapses, and a slow reply from an earlier keystroke never replaces a newer list; named add-path discovery waits for an API key, while an unsaved custom provider is probed with the typed base URL (and key, if any) before it exists. Preset ladders cover common context/output limits while preserving hand-edited values. The explicitly selected 8,192 output remains pinned independently of the catalog-sourced context window, and the image-input choice remains explicitly enabled after it is toggled back to the published value; neither is reinterpreted as "follow catalog" on save/reopen. Later catalog corrections change only values whose own source is `catalog`. Limit text renders through one shared compact formatter, so neighbouring published windows stay distinguishable (`1M` / `1.05M` / `1.1M`) and a compact limit never reads above its published value. Custom endpoint keeps API format beside the key and omits Base URL helper copy; named endpoints do not show format. Point the same custom form at an unreachable or unauthorized URL and confirm one classified sentence reaches the app toast while the left pane keeps its single “no list” label (not a raw JSON/HTML dump and not a second “no models” empty state); with cached rows from a later edit the same reason is toasted while the rows stay. Point a second provider at a base URL with no `/models` route and confirm the list falls back to the catalog, is labelled as coming from models.dev rather than the service, and still saves. The provider appears as a row with its host, model count and secret badge; the key is stored securely (not in plaintext config); `models` contains both bindings and `models[0]` remains the provider default.
- **Specs linked**: `03-runtime/11-provider-model-system.md`, `03-runtime/12-provider-config-schema.md`, `03-runtime/13-model-catalog-and-selection.md`, `03-runtime/14-secrets-storage.md`, `04-ux/06-settings-ia.md`
- **Acceptance**: B (multi-model provider configuration, save key)
- **Milestone**: M2
- **Status**: Manual model-picker acceptance; chooser-to-key-form selection is covered by `apps/desktop/test/plugin-provider-catalog-user-path.test.mjs`; automated protocol smoke covers provider creation and secret handling without plaintext echo.

#### E2E-PROVIDER-custom-endpoint-no-api-key: Configure a custom service without credentials

- **Preconditions**: Isolated settings profile and a local OpenAI-compatible fixture that lists a model without credentials; no live or paid provider.
- **Steps**: 1) Open Settings → Model configuration → Add provider → Custom endpoint. 2) Enter a name and the fixture URL; leave the optional API key empty, without selecting an authentication mode. 3) Confirm model discovery succeeds without a key, select the returned model, and save. 4) Reopen and save without changes, then type a key and save; confirm API-key authentication is restored. 5) Edit an API-key provider and save with a blank input; confirm its key is retained. Reopen and confirm **Clear saved API key** is an icon-only button to the right of the input on the same row, with a localized accessible name and tooltip. Activate it, confirm focus returns to the input, and confirm subsequent discovery does not reuse the stored key. Close without saving and confirm no credential changed. Repeat Clear followed by Save, and Clear followed by a replacement key and Save. 6) Confirm the no-auth provider and model are offered by chat/default-model and subagent selectors. 7) Send a request through the no-auth provider fixture.
- **Expected**: The custom form has no no-key switch and keeps the key input enabled. An empty or whitespace-only key with no saved credential automatically saves `authKind: "none"` without `secretValue`; a supplied key uses API-key authentication. A blank edit retains an existing key. Clear is staged until Save and a replacement key takes precedence over removal. The enabled no-auth provider with `hasSecret: false` remains selectable for chat, defaults, subagents, and image generation where its model supports that operation. Named cloud presets remain unchanged. Runtime requests contain no API-key or Authorization credentials.
- **Automation**: `node --test apps/desktop/test/custom-provider-no-api-key-user-path.test.mjs` covers empty/whitespace keys, keyed creation, save/reopen, preservation, staged removal/cancellation, discovery without the old secret, and replacement. `pnpm test:e2e:provider-api-style` renders the production setup form in English and Simplified Chinese with a stubbed model-discovery/API boundary and verifies create/update payloads and chat/default/subagent selector eligibility. `pnpm --filter @pi-desktop/agent-runtime exec vitest run src/provider-binding.test.ts` verifies request headers; `apps/desktop/test/image-generation-default.test.mjs` covers no-auth image-model availability; `cargo test -p host-core --locked switching_provider_to_no_auth_clears_its_api_key` verifies Host persistence and secret removal.
- **Specs linked**: `03-runtime/11-provider-model-system.md`, `03-runtime/12-provider-config-schema.md`, `03-runtime/13-model-catalog-and-selection.md`, `04-ux/06-settings-ia.md`.
- **Acceptance**: B (model configuration), F (provider persistence), Security.
- **Milestone**: M2.
- **Status**: Automated coverage uses a deterministic stub for model discovery and fetch. The full local-endpoint send flow remains available for manual acceptance; no paid provider or user profile is used.

#### E2E-PROVIDER-defaults-survive-an-added-provider: An added provider leaves the app defaults alone

- **Preconditions**: App running; provider A saved and set as the app default model; a second provider B serving different models; one image-capable model configured on A and another on a different service.
- **Steps**: 1) Open Settings → Model configuration and add provider B; save without touching the Default model row. 2) Confirm the Default model row still names provider A and its exact model, and that a new session starts on it. 3) Set an image model as the default image model, then add a provider that also serves image models; save. 4) Confirm the Default image model row still names the earlier binding while the picker lists the new provider's image models as candidates. 5) Delete the provider that owned a default, then add a service that serves a model and an image model; save. 6) Confirm both defaults now resolve to that newly added provider.
- **Expected**: Saving a new provider never repoints an app default that still resolves: the model default keeps the pairing the Default model row already renders, and the image default keeps its stored binding while its candidate list grows. A removed image model is cleared and requires an explicit new selection; a removed chat default still uses the existing chat repair rule. Deleting the provider row that owned an image default needs no manual repair either: the next settings read or write drops the binding and candidate whose provider row is gone, so the Default image model row reports no default instead of a binding the runtime rejects. The explicit make-default actions and the edit path remain unchanged.
- **Specs linked**: `03-runtime/13-model-catalog-and-selection.md`, `03-runtime/21-image-generation.md`
- **Acceptance**: B (model selection)
- **Milestone**: M6
- **Status**: Documented; covered by `apps/desktop/test/default-model-display.test.mjs`, `apps/desktop/test/image-generation-default.test.mjs`, `apps/desktop/test/provider-model-config.test.mjs`

#### E2E-PROVIDER-custom-model-limits: A hand-typed custom model id takes its limits from the model library

- **Preconditions**: App running; the models.dev snapshot ships with the build; a provider editor is open.
- **Steps**: 1) Type a model id the snapshot publishes into the add-model field and add it; confirm the new row's context window, max output tokens and thinking levels match the published record instead of 128,000 / 8,192 with none. 2) Type an id the snapshot does not publish and add it; confirm the row keeps the generic 128,000 / 8,192 seed and no thinking levels. 3) Add an id while the service list is unreachable; confirm the row still appears exactly once and stays editable. 4) Add an id and edit its limits immediately, before the lookup answers; confirm the typed values survive.
- **Expected**: `providers.lookupModel` answers a hand-typed id from the local snapshot only — no provider network request and no host call — and a hit seeds the binding the way a picked model is seeded (published context window, max output tokens, thinking levels, `contextWindowSource: "catalog"`) while the stored id stays exactly what the user typed. A miss, a failed call, or an id the current discovery already described leaves the previous behavior intact: one usable row, the generic seed, and no stalled or duplicated list.
  A record published under another spelling of that id — a route prefix, a dated
  stamp, a marker the deployment appends — is a hit too: the row is upgraded in
  place as soon as the answer arrives, without waiting for a save. In a live
  discovered row, a positive safe integer context/input or output limit reported by
  the endpoint takes precedence over the catalog for that field; omitted fields
  independently use catalog metadata. For an unanchored relay, a published
  owner record outranks reseller matches; dotted/dashed version aliases and one
  whitelisted deployment label keep the served ID intact, the owner's sibling
  keys add evidence when the public key states nothing, and a corroborated
  canonical declaration translates a name the owner publishes under another ID
  without rewriting the served ID. Conflicting owner records do not supply
  guessed limits.
- **Specs linked**: `03-runtime/12-provider-config-schema.md`, `03-runtime/13-model-catalog-and-selection.md`
- **Acceptance**: B (multi-model provider configuration)
- **Milestone**: M2
- **Status**: Documented; covered by `apps/desktop/test/model-custom-lookup.test.mjs`, `apps/desktop/test/provider-lookup-model-handler.test.mjs`, and `apps/desktop/test/provider-endpoint-metadata.test.mjs`

#### E2E-PROVIDER-configured-models-search: The chosen pane's search narrows the configured list

- **Preconditions**: App running; one provider saved with at least three model bindings, one of them carrying an alias and another whose catalog display name differs from its id.
- **Steps**: 1) Open Settings → Model configuration and edit that provider. 2) Type part of one model id into the search field beside the right pane's title and confirm the configured list narrows as you type while the count beside the title keeps reporting every configured model. 3) Search another row by its alias, then by its catalog display name, and confirm both find the binding they stand for. 4) Type a query that matches nothing and confirm the right pane shows its own empty state rather than the "nothing chosen yet" one. 5) With that query still in the field, tick a model in the left discovered list and confirm it is added in view — the field is dropped only when the filter would have hidden it — then tick a model whose id matches the query and confirm the filter stays. 6) Clear the filter, remove every configured model, and confirm the field ends up empty instead of holding a query in a box that is now disabled. 7) Save.
- **Expected**: The right pane's search filters the configured list client-side with no host round trip, matching the model id, its alias and the catalog display name case-insensitively. The count badge keeps reporting every configured model, so a filtered view is never mistaken for a provider that offers fewer models. A model added while a filter is active is never added out of view: the field is dropped when the new row would be hidden and kept when it still shows what was added, and an emptied list discards the query so no filter is stranded in a disabled field.
- **Specs linked**: `04-ux/08-component-spec.md`, `03-runtime/13-model-catalog-and-selection.md`
- **Acceptance**: B (multi-model provider configuration)
- **Milestone**: M2
- **Status**: Documented; UI automation pending

#### E2E-005A: Edit provider model bindings and migrate a legacy model

- **Preconditions**: One provider saved with two model bindings; one fixture provider row exists with only the legacy `default_model_id` and no `config_json.models`; one fixture row carries an unknown or legacy `apiStyle` string.
- **Steps**: 1) Reopen the saved provider; confirm the single form opens with its cached model list painted immediately, and that the API key field explains an unchanged key is kept. 2) Confirm the live probe then refreshes that list without a retyped key, because the stored secret is reused. 3) Confirm both existing bindings are still chosen and check-marked, with their limits, thinking chips and defaults intact. 4) Enable a level the fixture catalog does not publish, edit one row's limits and save. 5) Reopen the fixture provider and confirm its legacy model appears as one chosen row with 128,000 context, 8,192 max output and all seven thinking choices available but unselected. 6) Reopen the unknown-style fixture and confirm the editor renders with Chat Completions selected instead of an error boundary; save it and confirm the repaired style is persisted. 7) Save the fixture provider without changing the model. 8) Select the second binding as the app default, reopen the provider and save unchanged; confirm the app default stays on that binding. Save another provider and confirm the app default is unchanged. Reopen the default provider, remove the selected binding, and save; confirm the app default falls back to the first remaining binding. 9) Take the service offline or revoke the key, reopen the provider, and confirm the cached rows stay visible with a compact classified discovery error rather than an empty list or a raw host dump.
- **Expected**: Editing never drops an unmodified binding. An explicitly enabled level remains saved even when the catalog does not publish it, so the Composer reads the same binding rather than silently narrowing it; a binding whose model discovery is unavailable keeps its stored levels untouched. Legacy read materializes one binding without losing the old model ID; the subsequent write stores `config_json.models` and keeps `defaultModelId` equal to the first binding for older readers. An unknown or legacy `apiStyle` is treated as a compatibility input: the editor falls back to Chat Completions, remains usable, and repairs the stored value on save. Saving the default provider preserves `settings.defaultModelId` while the selected model remains configured; only removal of that model falls back to the first remaining binding. Editing another provider never changes the app default. A failed live probe degrades to the cached list, one classified toast sentence and a one-line pane label, never to a blank picker or a raw HTTP/JSON dump, and a catalog fallback is never written into the model cache. Deleting a configured model and saving forgets that model's cached parameters, so the pane no longer paints the deleted id from cache and a later re-add starts from what the service or the catalog says. A probe that no longer publishes a model drops its cached row the same way, unless the row is the user's own (a hand-typed id, a configured binding), and a save that moves the base URL or the API format drops the answer the previous endpoint produced.
- **Specs linked**: `03-runtime/11-provider-model-system.md`, `03-runtime/12-provider-config-schema.md`, `03-runtime/13-model-catalog-and-selection.md`, ADR 0114
- **Acceptance**: F (provider persistence and migration)
- **Milestone**: M2
- **Status**: Unit-covered host migration; manual UI journey

#### E2E-MODELS-list-layout: Model lists remain browsable in constrained windows

- **Preconditions:** 60 discovered and configured models; isolated Electron
  fixture with real provider/account dialogs, hooks and production styles.
- **Steps:** Open both dialog types at 850×600, 850×850, 1000×560, 1200×700
  and 1600×1000 content sizes. Scroll each list to its last and first model.
- **Expected:** Every list displays at least one complete row. Both endpoints
  are fully visible inside the list, dialog body and viewport. Narrow panes
  stack; short wide windows keep the side-by-side layout.
- **Command:** `pnpm test:e2e:provider-model-layout`
- **Boundary:** Model-discovery IPC is a fixture; no real credentials or host
  persistence are involved. React, browser layout and scrolling are real.

#### E2E-005K: Preserve explicit extended thinking levels on the wire

- **Preconditions**: A provider has a selected model binding with reasoning
  enabled and `xhigh`/`max` explicitly selected; the catalog omits or marks
  those adapter mappings as unsupported; a deterministic OpenAI-compatible
  capture fixture records request JSON.
- **Steps**: 1) Select `high`, `xhigh`, and `max` in separate turns. 2) Capture
  each request body at the fixture boundary.
- **Expected**: The three requests contain `reasoning_effort: "high"`,
  `reasoning_effort: "xhigh"`, and `reasoning_effort: "max"` respectively.
  The catalog's non-null wire mapping remains in force when one is published;
  an absent or null mapping for an explicitly enabled extended level does not
  silently downgrade it to `high`.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`,
  `03-runtime/13-model-catalog-and-selection.md`
- **Acceptance**: B (model configuration), F (runtime provider requests)
- **Milestone**: M2
- **Status**: Unit-covered; deterministic provider fixture pending

#### E2E-005B: Configure the fixed OpenCode Go API-style preset

- **Preconditions**: App running; no OpenCode Go provider configured; the
  OpenCode Go endpoint is reachable with a test API key.
- **Steps**: 1) Open Settings → Model configuration and open the add-provider
  dialog. 2) Select **OpenCode Go** in Service. 3) Confirm Name and Base URL
  are not on the common path, enter an API key, and wait for model discovery.
  4) Select a discovered model and save the provider. 5) Reopen the provider
  and switch Service to Custom endpoint.
- **Expected**: Selecting the preset shows Service + API key, a host summary
  for `opencode.ai/zen/go/v1`, and focuses the API key field. Discovery
  requests `https://opencode.ai/zen/go/v1/models` with
  `Authorization: Bearer <key>`; the saved row persists
  `apiStyle: "opencode_go"` and the key is stored via the secret store.
  Reopening preserves the fixed identity. Switching to Custom endpoint reveals
  editable Name and Base URL.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`, `04-ux/06-settings-ia.md`,
  ADR 0116
- **Acceptance**: B (model configuration and key storage), Security
- **Milestone**: M2
- **Status**: Unit-covered (form and discovery contracts); rendered UI scenario Draft

#### E2E-205: OpenCode Go requests carry a stable session header

- **Preconditions**: An OpenCode Go provider is configured; a deterministic
  fixture or capture proxy records outbound HTTP headers. A second generic
  OpenAI-compatible provider is also configured.
- **Steps**: 1) Start an Agent turn in a session against OpenCode Go. 2)
  Capture the provider request headers. 3) Send a follow-up in the same
  session. 4) Run a plugin `agent.complete` one-shot against the same provider.
  5) Run `/compact` in the same session and capture
  the summary request. 6) Repeat a turn against the generic
  OpenAI-compatible provider.
- **Expected**: Every OpenCode Go LLM request includes `x-opencode-session`
  equal to the conversation id (or a stable per-call id when no session
  exists), `x-opencode-client: pi-desktop`, and a `User-Agent` identifying
  PI-Desktop. Follow-up turns reuse the same session header, and so does the
  compaction summary request, which the harness would otherwise send with no
  headers at all. The generic OpenAI-compatible provider does not receive
  these headers. The gateway does
  not return `MissingSessionID`, and `/compact` does not fail with a 400.
- **Specs linked**: `03-runtime/02-agent-runtime.md`,
  `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`, ADR 0116
- **Acceptance**: B (model configuration), F (runtime provider requests)
- **Milestone**: M2
- **Status**: Unit-covered (header merge, one-shot stream options, and the
  compaction summary request)

#### E2E-005E: Provider and model wire API precedence stays explicit

- **Preconditions**: An OpenCode Go provider is configured; a deterministic
  fixture serves `muse-spark-1.3-contributor` on `/responses` and 500s it on
  `/chat/completions`. A generic provider and a custom endpoint each serve the
  same model id; the custom model metadata pins `openai-completions`, while its
  saved provider style is Responses.
- **Steps**: 1) Select the muse model on the OpenCode Go provider and send a
  turn. 2) Capture the outbound request path. 3) Repeat against the generic
  provider with the same model id. 4) Select the model on the custom endpoint
  and send a turn, then capture its outbound request path.
- **Expected**: The OpenCode Go turn posts to `/responses` (the model-level
  `api: "openai-responses"` pin wins); the generic turn still posts to
  `/chat/completions`; the custom endpoint posts to `/responses` because its
  saved provider style wins over the model metadata. Replayed history carries
  the resolved API.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`, ADR 0116
- **Acceptance**: F (runtime provider requests)
- **Milestone**: M2
- **Status**: Unit-covered (binding resolution and endpoint assertion)

#### E2E-005K: OpenCode Go Claude models use the published Anthropic route

- **Preconditions**: An OpenCode Go provider uses the built-in preset. The
  deterministic catalog fixture contains `claude-haiku-5-5` with
  `api: "anthropic_messages"` and an OpenCode Anthropic root `baseUrl`, plus a
  DeepSeek Chat Completions control model.
- **Steps**: 1) Select Claude Haiku and send a text turn through a capture
  fixture. 2) Capture the request URL and adapter payload. 3) Repeat with the
  DeepSeek control model. 4) Repeat with the same catalog metadata on a custom
  OpenAI-compatible provider.
- **Expected**: OpenCode Claude uses the Anthropic adapter and posts to
  `/zen/go/v1/messages`; it does not post Chat Completions and does not return
  `ModelProtocolUnsupported`. DeepSeek keeps `/chat/completions`. The custom
  provider keeps its saved wire style and base URL despite the foreign catalog
  API. Unit coverage lives in `packages/agent-runtime/src/provider-binding.test.ts`.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/13-model-catalog-and-selection.md`, issue #1728
- **Acceptance**: F (runtime provider requests)
- **Milestone**: M2
- **Status**: Unit-covered; live endpoint scenario Draft

#### E2E-005C: OpenAI-compatible system role fallback

- **Preconditions**: A deterministic OpenAI-compatible Chat Completions
  fixture exposes one reasoning-capable model and rejects `role: "developer"`
  in favor of `role: "system"`.
- **Steps**: 1) Configure the fixture provider and select its reasoning model.
  2) Start an Agent turn with a non-empty system prompt. 3) Capture the JSON
  request body at the fixture boundary. 4) Repeat with a model record that
  explicitly sets `compat.supportsDeveloperRole: true`.
- **Expected**: The first request contains the system prompt with
  `role: "system"` and the turn succeeds. The explicit model override changes
  only the second request to `role: "developer"`; the default remains
  model-scoped and does not affect other provider adapters.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`
- **Acceptance**: B (OpenAI-compatible provider interoperability)
- **Milestone**: M2
- **Status**: Unit-covered (including the #30 GLM gateway regression); deterministic provider fixture pending

#### E2E-206: Anthropic Messages endpoint with a `/v1` base URL

- **Preconditions**: A deterministic Anthropic Messages fixture exposes
  `GET /v1/models` and `POST /v1/messages`; the configured custom endpoint ends
  in `/v1` and returns one model such as `glm-5.3`.
- **Steps**: 1) Open Settings → Model configuration and add a Custom endpoint.
  2) Enter the fixture URL ending in `/v1`, choose Anthropic Messages, and
  wait for model discovery. 3) Select the discovered model and save. 4) Start
  an Agent turn and capture the fixture request path.
- **Expected**: Discovery succeeds against `/v1/models`, and the Agent turn
  succeeds against `/v1/messages`. The runtime does not send the request to a
  doubled `/v1/v1/messages` path; a configured Anthropic root without `/v1`
  remains equivalent.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`
- **Acceptance**: B (custom provider interoperability), C (chat and stream)
- **Milestone**: M2
- **Status**: Unit-covered; deterministic provider fixture pending

#### E2E-005F: Custom endpoint input guardrails

- **Preconditions**: App running; the add-provider dialog is open with Custom
  endpoint selected.
- **Steps**: 1) Enter `api.gateway.example.com` with no scheme and leave the
  Base URL field. 2) Confirm the field settles on
  `https://api.gateway.example.com` and discovery runs. 3) Paste
  `https://api.gateway.example.com/v1/messages` and leave the field. 4) Confirm
  the field settles on `https://api.gateway.example.com/v1`, the API format
  reads Anthropic Messages, and the form says that format was auto detected. 5)
  Change the API format by hand to OpenAI Chat Completions, then paste the
  `/v1/responses` URL: confirm the hand-picked format survives and the operation
  is left in place until the suggestion is applied. 6) Replace the value with
  `ftp://gateway.example.com`, then leave the field. 7) Enter a valid URL again
  and confirm model discovery can run; paste a full `/models` path and leave the
  field. 8) Point the row at a gateway whose `/models` route answers only under
  `/v1` and confirm the field and the saved row show that address.
- **Expected**: A bare host is completed with `https://` inside the origin the
  user typed; credentials, queries and fragments are still refused. A pasted
  operation path names the matching format, selects it and is stripped from the
  base endpoint, and `/models` is removed as well — unless the operation
  contradicts a format the user picked by hand, which is then preserved and
  offered as a suggestion instead. When the endpoint itself decided the format,
  the form says so next to the selector. When only the `/v1` candidate answers,
  the field and the saved row show that address rather than a hidden rewrite,
  and every probed candidate stays on the typed origin. A non-http(s) URL shows
  an inline, accessible error, does not start discovery, and keeps Save
  disabled. A valid URL restores discovery. The long URL field uses a full row
  on wide dialogs and stacks cleanly with the other credentials at the
  responsive breakpoint.
- **Specs linked**: `04-ux/06-settings-ia.md`,
  `03-runtime/12-provider-config-schema.md`
- **Acceptance**: B (custom provider configuration)
- **Milestone**: M2
- **Status**: Unit-covered; rendered UI scenario pending

#### E2E-005G: Per-provider custom HTTP headers

- **Preconditions**: One API-key AI service (including an OpenCode Go row) and
  one signed-in vendor (OAuth) account; a capture proxy records outbound HTTP
  headers, including Codex and Anthropic adapters.
- **Steps**: 1) Open the AI service and click the upper-right Advanced settings
  action. Confirm a separate modal opens without changing the main form layout,
  and that its header close action is the only close control (no footer action
  row). Use the common-header preset to add User-Agent, then import a JSON object
  containing `X-Gateway: alpha` and enough headers to exceed five visible rows.
  Copy headers as JSON and confirm the clipboard is the pretty-printed persisted
  record (blank names omitted, last write wins) with localized success feedback.
  Confirm the header list scrolls inside the modal while the underlying model
  panes keep their working area, close the modal, then save. 2) Start an Agent
  turn, a follow-up, a plugin `agent.complete` one-shot, and the standalone
  plugin's Composer transform when installed. 3) Refresh
  `/models` from the form before saving a second change and confirm the
  unsaved headers are sent. 4) Clear the rows and save; confirm adapter
  defaults return. 5) Edit the OAuth account Advanced headers, save, then
  run a turn that refreshes the access token. 6) Repeat against OpenCode Go
  and confirm `x-opencode-session` is still present. 7) Repeat against
  Codex/Anthropic OAuth inference. 8) Enter a value holding fullwidth
  characters (`０`, `１２３`) and confirm the editor says it will be saved as
  half-width, then save and reopen: the stored value is ASCII. 9) Enter a value
  holding Han text or a NUL and confirm the editor warns before saving, then
  save: it is rejected as `HEADERS_INVALID` with the character and its index
  named. 10) Point the app at a store whose row was written before this rule and
  run a turn. 11) Attempt `Authorization` and CR/LF values; save is rejected.
- **Expected**: Non-empty custom headers are the last writer on that row's
  outbound HTTP (turns, subagents, one-shots, discovery, connection test,
  OAuth refresh). Empty restores pi-ai / `claude-cli` / OpenCode defaults.
  Advanced keeps up to five header rows visible and scrolls additional rows in its
  own bounded area, so they do not compress or hide the model panes. Escape and outside-click close
  only the Advanced modal while it is open. The preset adds the expected
  User-Agent value, Copy JSON serializes the same `pairsToRecord` map saved on
  the row, JSON import accepts both supported object shapes, and
  case-insensitive duplicate keys are merged rather than duplicated.
  Toolbar actions wrap at the narrow dialog breakpoint instead of overflowing.
  OpenCode still sends
  `x-opencode-session` and `x-opencode-client`. Codex
  and Anthropic still send the custom User-Agent despite adapter last-writes.
  First OAuth login does not collect headers. A fullwidth value saves as
  half-width and is folded again on read, so a row stored before this rule runs
  a turn instead of throwing. A value holding Han text or a control character is
  refused at save with the character and index named, and dropped by the runtime
  rather than thrown by `Headers.set`. Reserved keys and CR/LF are
  rejected. Advanced is a compact key/value editor, not a lone User-Agent
  field.
- **Specs linked**: `03-runtime/12-provider-config-schema.md`,
  `03-runtime/11-provider-model-system.md`, `03-runtime/02-agent-runtime.md`,
  `04-ux/06-settings-ia.md`, ADR 0178
- **Acceptance**: B (model configuration), F (runtime provider requests)
- **Milestone**: M2
- **Status**: Unit-covered (host persistence, fetch wrapper, discovery,
  form Advanced); rendered UI scenario pending

#### E2E-005J: GitHub Copilot OAuth requests carry native IDE headers

- **Preconditions**: A signed-in GitHub Copilot OAuth account with a selected
  model; a deterministic capture proxy records the model request headers.
- **Steps**: 1) Start an Agent turn against the account and capture the request
  headers. 2) Send a follow-up after the assistant response and capture the
  next request. 3) Repeat with an image attachment when the selected model
  supports vision. 4) Set a saved custom header with the same name as one of
  the Copilot defaults and send another turn. 5) Select a Claude model on the
  same account (Anthropic Messages) and send a turn, capturing its auth and
  identity headers.
- **Expected**: Every Copilot model request includes the pinned pi-ai
  transport identity headers `Editor-Version`, `Editor-Plugin-Version`, and
  `Copilot-Integration-Id`. `X-Initiator` is `user` for a user-led request and
  `agent` for a continuation; `Openai-Intent` is `conversation-edits`, and
  image requests include `Copilot-Vision-Request: true`. The OAuth row keeps
  its local provider id for account binding, and a saved custom header remains
  the final override. Claude requests carry `Authorization: Bearer <Copilot token>`
  and no `X-Api-Key`, while retaining the same IDE identity and context headers.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`, ADR 0095
- **Acceptance**: B (model configuration), F (runtime provider requests)
- **Milestone**: M2
- **Status**: Unit-covered (row-scoped model headers and request-context
  headers, Anthropic Messages Bearer auth and rotating tokens); live Copilot
  account journey pending

#### E2E-005H: Select every visible model from a long service list

- **Preconditions**: App running; the add-provider or edit-provider dialog is
  open against a service (or vendor account) that returns a long model list,
  including at least one model whose id would not match a later search.
- **Steps**: 1) Wait until the left pane lists the service's models. Confirm
  the list header shows a checkbox beside the pane title, unchecked while no
  rows are chosen. 2) Tick that header checkbox. Confirm every listed row is
  checked and the right pane lists a chosen binding for each, keeping any
  already-configured advanced overrides. 3) Untick one row, then confirm the
  header checkbox is indeterminate. Tick it again and confirm the remaining
  visible rows are chosen without duplicating already-chosen ones. 4) Type a
  filter that matches a subset. Untick the header checkbox and confirm only
  the matching chosen rows disappear; a model hidden by the filter stays on
  the right. 5) Tick the header checkbox again and confirm only the matching
  rows are added back. Clear the filter and confirm the previously hidden
  chosen model is still present. 6) Save.
- **Expected**: One header checkbox selects or clears the currently visible
  list. A search filter narrows which rows "all" means. Models already chosen
  outside the filter stay chosen. Newly added rows adopt published limits and
  thinking levels; existing bindings are not rebuilt. The same control is
  present in the vendor-account editor because both dialogs render the shared
  picker.
- **Specs linked**: `03-runtime/13-model-catalog-and-selection.md`,
  `04-ux/06-settings-ia.md`, `04-ux/08-component-spec.md`
- **Acceptance**: B (multi-model provider configuration)
- **Milestone**: M2
- **Status**: Unit-covered (shared picker source contract); rendered UI
  scenario pending

#### E2E-005I: Fetch the service model list from the picker header

- **Preconditions**: The add-provider or edit-provider dialog is open against a
  reachable service (or vendor account) that publishes a `/models` list.
- **Steps**: 1) Confirm the left-pane header shows a Fetch list action beside
  the title, disabled before a valid endpoint is ready. 2) Enter a valid
  endpoint. Confirm Fetch list enables during the 600 ms debounce wait. Click
  it immediately; confirm it does not wait for that window, shows the loading
  label while the probe is in flight, and then shows rows. 3) Click Fetch list
  again. Confirm it keeps the current rows on screen and replaces them with the
  live answer. 4) Take the service offline and click Fetch list; confirm the
  classified error reaches the toast and the previous rows remain. 5) Restore the
  service, click Fetch list, and confirm the live list returns. 6) Repeat in
  the vendor-account editor.
- **Expected**: The header action probes the service immediately, including
  during the edit debounce after a URL becomes valid. Automatic discovery on
  credential edits is unchanged. The same control is present for both
  credential kinds because both dialogs render the shared picker.
- **Revocation regression**: Configure two served models, revoke one upstream,
  add another, then Fetch list. The left service pane shows the current served
  pair, including when the revoked ID has a published catalog record. The right
  chosen pane retains both saved bindings and their overrides; refresh does not
  delete configuration. A manual/offline fallback still exposes configured IDs.
- **Specs linked**: `03-runtime/13-model-catalog-and-selection.md`,
  `04-ux/06-settings-ia.md`, `04-ux/08-component-spec.md`
- **Acceptance**: B (multi-model provider configuration)
- **Milestone**: M2
- **Status**: Unit-covered (discovery hook + picker source contract); rendered
  UI scenario pending

#### E2E-005D: Configure a Zhipu / Z.AI named endpoint preset

- **Preconditions**: App running; no Zhipu provider configured; the models.dev
  snapshot ships with `zhipuai`, `zhipuai-coding-plan`, `zai`, and
  `zai-coding-plan`.
- **Steps**: 1) Open Settings → Model configuration and open the add-provider
  dialog. 2) Open Service, type to filter, and select **Zhipu AI Coding Plan**.
  Confirm model discovery does not start until an API key is entered. 3) Confirm
  the common path is Service + API key with a host summary, enter an API key,
  and wait for model discovery. 4) Select a discovered model and save. 5) Reopen the
  provider, switch Service to **Z.AI**, then to **Custom endpoint**.
- **Expected**: Coding Plan shows Service + API key, a host summary for
  `open.bigmodel.cn/api/coding/paas/v4`, and focuses the API key field. Name
  and API format are not on the common path. The saved row persists
  `vendorKey: "zhipuai-coding-plan"`, `apiStyle: "chat_completions"`, and the
  exact Coding Plan URL. Switching to Z.AI replaces the host summary with
  `api.z.ai/api/paas/v4` and `vendorKey: "zai"`. Switching to Custom endpoint
  reveals editable Name and Base URL without a stepper or vendor-card grid.
  A later Agent turn against a Zhipu URL sends Completions with Zhipu thinking
  (`thinkingFormat: "zai"`) rather than the OpenAI `developer` role.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`, `04-ux/06-settings-ia.md`,
  ADR 0155
- **Acceptance**: B (model configuration and key storage)
- **Milestone**: M2
- **Status**: Unit-covered (preset matching, catalog aliases, Completions
  compat); rendered UI scenario Draft

#### E2E-248: Responses turn completes without waiting for the server to close the connection

- **Preconditions**: A provider whose model pins `api: "openai-responses"` (or
  a provider with `apiStyle: "responses"`) is configured; the endpoint is
  fronted by a proxy that holds the HTTP connection open after the final
  SSE event (a local reverse proxy or a stub server that never sends FIN).
- **Steps**: 1) Start a session with that model and send a short prompt. 2)
  Capture the SSE frames and confirm the server emitted
  `response.completed` with `status: "completed"` and usage. 3) Keep the
  stub/proxy connection open without sending a TCP FIN. 4) Observe the
  assistant turn state and send a follow-up prompt.
- **Expected**: The turn completes as soon as `response.completed` is
  finalized: usage is recorded, `stopReason` is `stop`, and the client stops
  consuming the stream (the underlying request is aborted) instead of
  blocking on the idle connection. The composer becomes idle immediately and
  the follow-up turn starts normally. The stream must not hang when the
  server never closes the connection.
- **Specs linked**: `03-runtime/11-provider-model-system.md` (§16.1)
- **Acceptance**: B (provider Responses compatibility)
- **Milestone**: M2
- **Status**: Unit-covered (stream processor terminates on the terminal
  event via the pi-ai patch); live-proxy scenario Draft

#### E2E-005E: DeepSeek thinking replay includes reasoning_content on aggregator endpoints

- **Preconditions**: An OpenAI-compatible provider whose base URL is not
  `deepseek.com` is configured with a DeepSeek-family model id (for example
  SiliconFlow `deepseek-ai/DeepSeek-V3.2`) and thinking enabled.
- **Steps**: 1) Start a session in thinking mode. 2) Complete several turns
  including at least one assistant reply that produces no thinking text.
  3) Send another prompt so the history is replayed to the provider.
- **Expected**: The later Completions request includes a reasoning field on
  every assistant message. Official `api.deepseek.com` rows may use `""` for
  turns that had no thinking. Non-official DeepSeek-family relays use real
  retained thinking when available, otherwise the documented non-empty
  placeholder from ADR 0256 — never a silent empty string after compaction.
  Each assistant message carries exactly one reasoning field, named after the
  newest assistant row's field; real reasoning stored under another field name
  is moved there rather than replaced by the placeholder, which only fills rows
  with no reasoning at all (D677). The thinking panel and replayed history
  never show a leading echo of the placeholder as reasoning.
  Relay requests omit the generic OpenAI `reasoning_effort` field because
  relays were reported rejecting it (#1664). Official `api.deepseek.com`
  requests send `thinking: {type: "enabled"}` together with the selected
  `reasoning_effort` (#1821).
  The request does not switch `thinkingFormat` to `"deepseek"` solely because
  the model id contains `"deepseek"`. Official `api.deepseek.com` rows keep
  URL-based DeepSeek `thinkingFormat` from pi-ai.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`
- **Acceptance**: B (provider Completions compatibility)
- **Milestone**: M2
- **Status**: Unit-covered (compat inject + convertMessages empty/non-empty fill +
  mixed-field normalization + echoed-placeholder strip + compaction
  retained-reasoning wire proof); live OpenCode / aggregator
  verification deferred; rendered UI scenario pending

#### E2E-006: Key survives restart

- **Preconditions**: Provider + key configured.
- **Steps**: 1) Quit app. 2) Relaunch. 3) Open Settings → Agent → Providers.
- **Expected**: Provider still listed; key usable (no re-entry needed).
- **Specs linked**: `03-runtime/14-secrets-storage.md`
- **Acceptance**: B (key survives restart)
- **Milestone**: M2
- **Status**: Draft

#### E2E-007: No-provider blocking prompt

- **Preconditions**: App running; no provider configured.
- **Steps**: 1) Attempt to start a chat.
- **Expected**: Clear blocking prompt explaining that a provider must be configured.
- **Specs linked**: `04-ux/06-settings-ia.md`
- **Acceptance**: B (blocking prompt)
- **Milestone**: M2
- **Status**: Draft

### Conversation Stream & Abort

#### E2E-008: New session and send message

- **Preconditions**: Provider configured.
- **Steps**: 1) Create new session. 2) Type a message. 3) Send.
- **Expected**: The transcript immediately shows a compact localized `Working…`
  status after send, before the first assistant or tool event. It remains
  visible through thinking/tool/answer output, or identifies a runtime-reported
  wait. Pending user interaction suppresses it; it disappears when the turn ends.
  The conversation topbar keeps only the task title and window actions; it does
  not add a separate running-state indicator.
- **Specs linked**: `03-runtime/02-agent-runtime.md`, `03-runtime/10-session-state-machine.md`
- **Acceptance**: C (new session, send message)
- **Milestone**: M2
- **Status**: Automated (protocol smoke, live-model lane; requires PI_DESKTOP_TEST_API_KEY)

#### E2E-008d: Composer Enter-to-send and modifier send

- **Preconditions**: Provider configured; a session is open.
- **Steps**: 1) Leave Enter-to-send enabled. Type a draft and press Enter.
  2) Disable Enter-to-send in Settings. 3) Type a second draft and press
  Cmd/Ctrl+Enter. 4) Press Enter and Shift+Enter in a third draft.
- **Expected**: Step 1 sends. After the setting is off, Cmd/Ctrl+Enter sends;
  plain Enter and Shift+Enter insert newlines and do not send. IME composition
  and an open autocomplete menu still take precedence over send.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/08-component-spec.md` §11.5,
  `04-ux/09-interaction-patterns.md` §1.2
- **Acceptance**: C (composer send)
- **Milestone**: M2
- **Status**: Source-level regression (`composer-ime.test.mjs`); full UI
  keyboard journey remains Draft. Protocol smoke does not dispatch key events.

#### E2E-008e: Host speech transcribe and speak

- **Preconditions**: A session is open. No `AppSettings.speech` role is bound.
- **Steps**: 1) Call `speech/transcribe` with a scratch wav while unbound. 2)
  Persist an ASR binding (`openai_audio` / whisper) and a TTS binding with a
  host settings write. 3) Transcribe the wav and insert the returned text into a
  draft. 4) Synthesize that draft.
- **Expected**: An unbound role fails `SPEECH_NOT_CONFIGURED` and never calls the
  provider. Transcribe returns text. Synthesize writes session-scratch audio and
  returns a bounded data URL; audio bytes never enter the renderer. Whisper/TTS
  never appear in the chat model picker.
- **Specs linked**: `03-runtime/20-speech.md`, `04-ux/06-settings-ia.md`
- **Acceptance**: C (speech)
- **Milestone**: M2
- **Status**: Source-level regression (`speech-capability.test.mjs`,
  `plugin-speech-adapter.test.mjs`); no renderer entry point exists, and the live
  provider journey remains Draft.

#### E2E-008a: First-turn tools load on demand

- **Preconditions**: Agent mode; provider configured; `BrowserPreview` or an
  enabled plugin tool is available; request capture can inspect the first and
  subsequent provider payloads.
- **Steps**: 1) Create a fresh session and send a simple prompt. 2) Inspect
  the first provider request's tool list. 3) Ask the agent to create or edit an
  HTML page and observe the tool activity. 4) Start a second user prompt after
  the preview task completes.
- **Expected**: The first request contains only the mode core tools (Agent:
  `Read`/`Bash`/`Edit`/`Write`; Chat: `Read`/`Glob`/`Grep`)
  and local `ToolSearch`; deferred schemas are
  represented only by a bounded `# On-demand tools` catalog. The agent calls
  `ToolSearch` before `BrowserPreview` (or the selected plugin/`Skill` tool)
  when the capability is needed, and the matching schema is available on the
  next model turn. For a user-visible HTML deliverable, `BrowserPreview` is
  called once after creation or the first meaningful visual edit, then reused
  through live reload while the page is refined. Generated, test-only, and
  non-visual HTML files do not trigger a preview call. At the second prompt,
  successful activation markers still in the effective context may restore the
  matching deferred schemas in the first request, including tools that were
  activated but not yet called. New results use `details.addedToolNames`; the
  legacy `details.activated` and top-level `addedToolNames` markers remain
  readable. Failed, interrupted, and missing-result rows do not restore tools.
  Catalog and mode changes also prevent restoration.
  No host permission or workspace escape is granted by restoration.
- **Specs linked**: `03-runtime/02-agent-runtime.md` §7.1,
  `03-runtime/03-tools-and-permissions.md` §2.1, ADR 0048, ADR 0225,
  `08-meta/decisions-log.md` (D185, D400)
- **Acceptance**: C (first turn and stream) + E (tool execution)
- **Milestone**: M5
- **Status**: Unit-covered (`agent-runtime` deferred-tool tests); live-model
  request capture and full Electron journey pending

#### E2E-008b: Bundled Browser plugin chrome and CDP

- **Preconditions**: Packaged or checkout build with bundled plugins; Agent
  session with a workspace HTML file; Plan session available.
- **Steps**: 1) Confirm Plugins lists `pi.browser`, enabled, not uninstallable.
  2) With the work panel closed, ask the agent to preview a workspace HTML
  file (`BrowserPreview`) and verify the Browser tab opens in the visible work
  panel. 3) Use ToolSearch `cdp` / `Browser` to snapshot and interact while the
  panel remains visible. 4) Collapse the panel and continue Browser snapshot,
  click/fill, screenshot and navigation. 5) Switch to a second session and call
  Browser; verify it uses that session's own page. 6) Continue the first session's
  Browser actions while the second session is visible; reload the shell and
  return to the first page. 7) In Plan/Goal, exercise the read-only Browser
  actions and verify mutating actions remain denied. 8) Disable
  `pi.browser`. 9) Call `BrowserPreview` and click an http(s) transcript link.
  10) From a third-party or test caller, send
  `Network.getAllCookies` through `pi.browser.cdp`.
- **Expected**: The launcher has no host Browser row. Preview opens the plugin
  view, reveals the work panel, and live-reloads the file. Session-owned Browser
  operations run in the background without opening the panel, borrowing another
  page, or changing focus. Shell reload retains the native page and form data;
  its side-panel tabs can be restored. ToolSearch activates the Browser tool.
  Plan/Goal allow navigate/snapshot/screenshot/console; click/fill/evaluate/cdp
  remain denied. Disable
  hides the view and tools; `BrowserPreview` errors; http(s) chips use
  `openExternal`. Cookie CDP is denied. Guest bounds stay inside the plugin
  view.
- **Specs linked**: ADR 0170, D333, `07-plugins/03-plugin-api.md`,
  `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (plugin view + tool) + security allowlist
- **Milestone**: M5
- **Status**: Unit-covered (`bundled-plugins`, `browser-cdp`,
  `browser-preview-tool`); full Electron journey pending

#### E2E-008c: Quiet intervals explain active work

- **Preconditions**: A deterministic provider fixture can delay the first
  response, return one retryable failure with a bounded backoff, and a session
  can start one delegated task whose completion is controlled by the fixture.
- **Steps**: 1) Send a prompt and hold the provider before its first assistant
  event. 2) Observe the transcript status row. 3) Release a retryable failure
  and inspect the row during backoff. 4) Start a delegated task and wait for
  the parent to converge on it. 5) Release the fixture and let the turn end.
- **Expected**: The status row names the quiet interval — `Starting…`,
  `Waiting for model`, `Preparing next request…`, `Compacting context…`,
  `Recovering empty response…`, `Retrying model request`, or `Waiting for`
  a named subagent with its latest coarse action — with a monotonic elapsed
  time matching the active phase. A multi-subagent wait lists each running
  target. It uses the same compact inline treatment as `Working…`, never adds
  a duplicate progress card, and clears when assistant output or a terminal
  event arrives. The Stop action remains available throughout.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, `04-ux/09-interaction-patterns.md`,
  ADR 0175, ADR 0198
- **Acceptance**: C (chat stream), Quality (feedback and accessibility)
- **Milestone**: M5
- **Status**: Draft (deterministic fixture pending)

#### E2E-009: Streamed tokens visible in UI

- **Preconditions**: Session active; message sent.
- **Steps**: 1) Request a long answer containing Markdown and inline/display
  math using both dollar (`$…$` / `$$…$$`) and TeX bracket (`\(…\)` /
  `\[…\]`) delimiters. 2) Observe the assistant response as it streams. 3) Let
  the answer complete and inspect the renderer console.
- **Expected**: Runtime chunks appear progressively through the incremental
  Markdown renderer and the final response is complete. All four math delimiter
  forms render with KaTeX, with `\[…\]` using display layout. The renderer does
  not start a second animation-frame typewriter loop, raise React error 185, or
  reject Vite-inlined KaTeX fonts under CSP.
- **Specs linked**: `03-runtime/02-agent-runtime.md`,
  `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`,
  `05-security/01-security.md`
- **Acceptance**: C (streamed output), Quality
- **Milestone**: M2
- **Status**: Partially automated (protocol live-model stream, renderer source
  regression in `renderer-stream-safety.test.mjs`, and math delimiter rendering
  in `latex-math.test.mjs`; full UI observation remains Draft)

#### E2E-010: Stop turns and in-flight tools safely

- **Preconditions**: A session can produce both a deliberately delayed first
  token and a streaming response. A deterministic Host fixture can hold a
  read-only `Grep` call and expose a pending `Write` approval.
- **Steps**: 1) Send ordinary text and click Stop immediately, including while
  the prompt is still being admitted. 2) Confirm the user row is undone and
  the text returns to the composer after that first Stop. 3) Send again, wait
  for partial output, then stop during the stream. 4) Immediately send a new
  prompt after Stop returns, without waiting for an idle delay. 5) Start a
  read-only Grep that does not return, press Stop, then start another prompt.
  Hold its `tools.abort` acknowledgement as well and repeat for Read and Glob.
  6) Start a Write that is waiting for permission, press Stop, then try to
  approve the stale request. 7) Observe the transcript, composer, and workspace.
- **Expected**: The first Stop is honored even if prompt admission is still in
  progress; the unanswered send is undone and its draft restored. The
  streaming send stops with its partial response preserved and no draft
  restoration or duplicate user turn. The read-only tool returns
  `TOOL_ABORTED`, its late result is discarded, and the follow-up starts
  without `AGENT_BUSY`, even while the cancellation acknowledgement is pending.
  Late results or cancellation failures cannot change the follow-up turn.
  Stopping the pending Write cancels its permission;
  approving the stale request fails and creates no file. A mutating operation
  that already started is not reported stopped before its Host result arrives.
  On a headless Host, hold durable-turn creation, user-row append, and sidecar
  history restoration in turn, then request abort during each hold. Release the
  hold and confirm abort settles the runtime before acknowledging cancellation;
  a follow-up input completes under a new durable turn. Repeat with an approved
  plan still being admitted, and ensure its execution settles as interrupted.
  An old turn's delayed abort must leave a newer turn alone, and admission in
  another session must not wait for this session's cancellation.
- **Specs linked**: `03-runtime/02-agent-runtime.md`,
  `03-runtime/03-tools-and-permissions.md`, `03-runtime/06-host-rpc-protocol.md`,
  ADR `tool-abort-abandons-host-call`
- **Acceptance**: C (abort)
- **Milestone**: M2
- **Status**: Runtime and Host cancellation contracts automated by
  `packages/agent-runtime/src/runtime.test.ts` and the pending-Write regression
  in `crates/host-core/src/rpc/mod.rs`. `read-only-stop.test.ts` covers held
  acknowledgements and late failures through real Agent loops.
  After building shared and running `node packages/agent-runtime/scripts/bundle.mjs`,
  `node scripts/e2e-read-only-stop.mjs` runs the production sidecar bundle and
  a localhost provider, holding execution and cancellation responses at the Host
  edge. It verifies follow-up prompts and the Write settlement boundary;
  `packages/host-runtime/src/runtime-service.test.ts` covers headless admission,
  approved-plan startup, stale aborts, and independent sessions. After building
  host-runtime and the sidecar bundle, `node scripts/e2e-headless-startup-abort.mjs`
  exercises the production RuntimeService, stdio transport, sidecar, and local
  provider through startup cancellation and a successful follow-up.
  Rendered Electron interaction remains
  a manual validation run.

#### E2E-171: Streaming reply survives quit, crash, and stop

- **Preconditions**: A session whose transcript is longer than one renderer
  page (more than 100 messages) and a model that streams a reply for at least
  ten seconds before its first tool call.
- **Steps**: 1) Send a prompt and let the reply stream for ~5 s. 2) Quit the
  app (Cmd+Q / tray Quit) mid-stream, relaunch, and open the session. 3) Repeat
  the send, then kill the agent sidecar process mid-stream and observe the
  transcript. 4) Repeat the send, press Stop mid-stream, then reopen the
  session from the sidebar and inspect `sessions/<id>.jsonl` and
  `sessions/<id>.inflight.json`. 5) Repeat the send and let it finish normally.
- **Expected**: 2) The session shows the user prompt followed by the streamed
  text up to at most 1.5 s before the quit, as an `aborted` assistant row under
  an `aborted` turn; nothing earlier in the session is missing or truncated. 3)
  The streaming row settles to `aborted` in place with its text, the same row
  is present after a reload, and no `.inflight.json` remains. 4) The partial
  reply is visible immediately after Stop and after reopening; the transcript
  file was not rewritten (its earlier lines are byte-identical) and the
  checkpoint file is gone once the aborted final row landed. 5) The completed
  reply has exactly one row per assistant fragment, no `aborted` duplicate, and
  no checkpoint file. A completed reply that had not yet left the outbox at
  quit is still present after relaunch (promoted `complete` if recovered from
  the checkpoint, or drained from the outbox before the first `session.get`).
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `03-runtime/07-process-model.md`,
  `03-runtime/01-ipc-protocol.md`
- **Acceptance**: C (abort), F (persistence)
- **Milestone**: M2
- **Status**: Draft

#### E2E-SESSION-outbox-duplicate-id-does-not-drop-history

- **Preconditions**: Two sessions whose provider tool rows reuse the same
  `toolCallId` as `messages.id` (for example `call_421522`). The first session
  already persisted that id. The second session then runs several turns so
  assistant/tool rows queue behind the colliding append.
- **Steps**: 1) Complete a tool call in session A with id `call_421522`.
  2) In session B, run the same provider tool id, then continue chatting for
  several turns. 3) Quit and reopen. 4) Open both sessions.
- **Expected**: Session A still has its original tool row. Session B kept its
  later turns after reopen; the colliding tool row is stored under
  `{sessionB}:{call_421522}` (or an equivalent remapped id). The persistence
  outbox is empty and did not stay paused on `UNIQUE constraint failed:
  messages.id`. No later assistant/tool row from either session is missing.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, ADR 0041, D444
- **Acceptance**: F (persistence)
- **Milestone**: M2
- **Status**: Unit-covered (`append_message_remaps_ids_owned_by_another_session`,
  `persistence-outbox.test.mjs`); desktop journey outstanding

#### E2E-SESSION-outbox-poison-does-not-drop-history

- **Preconditions**: A session-collaboration delivery turn is running. The user
  steers with Alt+Enter (content that does not match the delivery). Later
  assistant and tool rows from this or another session queue behind that
  append. Optionally the outbox already holds a `PERMISSION_DENIED:` head from
  an older host.
- **Steps**: 1) Start a collaboration delivery turn. 2) Alt+Enter a steering
  prompt. 3) Let the turn produce assistant/tool rows, including in another
  session if convenient. 4) Quit and reopen. 5) Open the affected sessions.
- **Expected**: Steering persists as a human user row with no
  `session_message` origin. The delivery user row still has host-derived
  origin. Later assistant/tool rows survive reopen. The outbox is empty and
  did not stay paused on `PERMISSION_DENIED:`. A `PLUGIN_PERMISSION_DENIED`
  head would still pause rather than drain.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, ADR 0041, ADR 0239,
  ADR active-turn-steering, D597
- **Acceptance**: F (persistence)
- **Milestone**: M2
- **Status**: Unit-covered (`steering_input_persists_without_inheriting_delivery_origin`,
  `persistence-outbox.test.mjs`); desktop journey outstanding


#### E2E-SESSION-outbox-unclassifiable-failure-does-not-stall-the-queue

- **Preconditions**: One queued outbox append fails with an error the outbox
  cannot classify (`Error: stream did not contain valid UTF-8` from a torn host
  transcript), while later appends from other sessions queue behind it.
  Optionally the outbox is already at its 1024-entry cap and the flush log
  shows repeated `session persistence flush paused` for that key.
- **Steps**: 1) Produce the unclassifiable append failure. 2) Keep sending
  messages in two other sessions. 3) Observe `logs/app/persistence.log` for
  `session persistence flush paused` (bounded attempts), then
  `session persistence flush quarantined entry`, and for the absence of
  `session.persistence.outbox.is.full`. 4) Confirm
  `session-message-outbox.dead-letter.json` holds that key with its payload and
  error, and that `session-message-outbox.json` drops below the cap. 5) Restart
  the app and confirm the quarantined append is not replayed. 6) Optional:
  delete the failing session and confirm its dead letter is dropped.
- **Expected**: The failing append is paused four times with a growing backoff
  and quarantined on the fifth consecutive failure, then skipped. Later
  appends from every session drain, no enqueue is rejected with `outbox is
  full`, and the queued outbox file empties. The dead letter survives a
  restart without being replayed.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, ADR 0041, D318, D444, D597, D656
- **Acceptance**: F (persistence)
- **Milestone**: M2
- **Status**: Unit-covered (`persistence-outbox.test.mjs` bounded retry,
  quarantine, dead-letter persistence and cap tests); desktop journey
  outstanding


#### E2E-011: Switch between project and temporary sessions

- **Preconditions**: One retained project session and one path-less Temporary
  session exist. Both transcripts exceed one viewport and have distinct final
  records.
- **Steps**: 1) Open the project session from its exact-path sidebar group. 2)
  Scroll to an earlier record and confirm the jump-to-latest control appears.
  3) Open the Temporary session and observe its first painted frame. 4) Switch
  rapidly project → Temporary → project while the first two transcript reads
  are delayed, and observe which row responds and which destination commits. 5)
  Hover/focus Temporary, switch to it again to exercise the warm cache, then
  repeat with reduced motion enabled. 6) Observe chat content and workspace
  chrome.
- **Expected**: The sidebar contains no Recents aggregate; retained projects
  have scoped groups and path-less sessions remain under Temporary; each
  transcript loads correctly; selecting Temporary clears project context and
  inherits no workspace access; both sessions remain persisted. Every session
  first activation paints its distinct final record at the transcript bottom
  without first exposing the transcript top, another session's scroll position,
  or a stale jump-to-latest control. The latest clicked row responds immediately
  and its transcript request does not wait for superseded reads; only the final
  project/session/work-panel tuple commits. On a cold switch the currently
  visible pane keeps showing its own session under a thin progress track until
  the destination commits, with the composer keeping its settled home/docked
  shape but inert so no prompt can reach the session being left; no transcript is
  dimmed at any point. A warm revisit reveals the retained pane immediately at
  its own content and scroll position, then revalidates in place without a
  visible change. Reduced motion keeps the progress track static and preserves
  the same destination without a skeleton remount or animated traversal through
  history.
- **Specs linked**: `03-runtime/10-session-state-machine.md`,
  `04-ux/01-ui-ia.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (switch sessions)
- **Milestone**: M2
- **Status**: Source-level regression covered; full visual scenario Draft

#### E2E-TRANSCRIPT-restored-live-tail-status

- **Preconditions**: An isolated renderer with two retained session panes, a
  running turn with tool output, and the real Composer and SessionPane.
- **Steps**: Restore a bookmark during selection revalidation; append live
  output; switch away and reveal the running pane; inspect an unread history
  range and an explicit search at the tail; settle and abort the turn. While
  reading above the live tail, click return-to-latest and switch away in the
  same task, before the return-to-latest animation advances a frame. Return
  first with the pane retained, then repeat while a project switch actually
  unmounts the pane and output continues in the background.
- **Expected**: The restored live tail keeps a running process header while
  Stop is available. Content updates and pane reveal do not falsely show
  Finished. The restored range and scroll offset remain owned by the reader.
  Another session, unread pages, and explicit search do not inherit live
  status. Terminal completion and abort show Finished and Stopped respectively.
  An empty restored range stays historical, an ordinary empty canonical range
  shows the initial wait, and a restored navigation-parent copy with the same
  message id keeps the running presentation.
  Return-to-latest synchronously records a pinned bookmark and commits any
  prepared latest view on hide or unmount; both a retained reveal and a fresh
  project remount follow the newest output without a second click. The running
  header and Stop control stay consistent. Readers who did not choose
  return-to-latest keep their existing historical reading position.
- **Automation**: `node scripts/e2e-transcript-reading-position.mjs`
  (`transcriptLiveTailProbe`).
- **Specs linked**: `04-ux/09-interaction-patterns.md` §2.3 / §2.4
- **Acceptance**: C (session switching and running status)
- **Status**: Automated isolated Electron regression

#### E2E-207: Open large and long sessions through bounded transcript windows

- **Preconditions**: A session contains a message with at least 50 MB of text
  or tool output and enough additional messages to span several transcript
  pages; a second session contains a long ordinary conversation.
- **Steps**: 1) Open each session from the sidebar while recording the first
  visible transcript frame and renderer responsiveness. 2) Scroll to the top
  of the transcript. 3) Repeat the open/close cycle after the session has been
  cached. 4) Inspect the host request/response or test fixture for the session
  read window. 5) In an isolated Host profile, create a transcript above the
  layout-cache threshold, append more rows, settle a middle Task result with a
  longer value, then restart with a legacy layout file beside the transcript.
  6) Read the newest page, page to the beginning, locate a nested message and
  its owning Task, then read the complete history.
- **Expected**: Opening paints the newest bounded page without transferring
  the complete 50 MB value to the renderer. The large value is visibly marked
  as truncated for display while the transcript and model-facing read remain
  lossless. Reaching the top loads older pages incrementally and preserves the
  viewport position; the final page reports no older history. Reopening a long
  session reuses the bounded cache and does not synchronously construct every
  historical row before the latest messages become usable. Edit, delete,
  revision, and Stop operations rehydrate the full transcript before any
  rewrite, so older messages are never lost because only a window was visible.
  The isolated Host journey returns every message once and in order after the
  middle rewrite, legacy-cache rejection and restart; the Task result is
  terminal, nested-message navigation resolves its owning Task, and paging
  reaches the beginning without a UTF-8 error or omitted row.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/04-data-storage.md`, `03-runtime/06-host-rpc-protocol.md`,
  ADR 0120
- **Acceptance**: C (session open and scroll), F (persistence), Quality
- **Milestone**: M5
- **Status**: Source-level and isolated Host RPC cache regressions covered;
  full large-fixture Electron journey Draft

#### E2E-TRANSCRIPT-invalid-utf8-window-remains-readable

- **Preconditions**: An isolated Host profile contains a session transcript
  with valid messages before and after a complete line containing invalid
  UTF-8 bytes. The damaged bytes are inside message text in one fixture and
  make a separate message line unparseable in another. No real user data.
- **Steps**: Open the session through the renderer's bounded `session.get`
  path with `messageLimit`, page across the damaged line, then read the full
  history through the Host API. Compare the transcript file before and after.
- **Expected**: The session stays readable. Valid surrounding messages appear
  in order; parseable damaged text contains U+FFFD, while an unparseable row is
  skipped. The source transcript remains byte-identical and paging positions
  stay consistent.
- **Specs**: `03-runtime/04-data-storage.md` and ADR 0127.
- **Acceptance**: C (conversation and stream), F (persistence), Quality.
- **Milestone**: Maintenance.
- **Automation**: `pnpm test:e2e:transcript-cache` exercises bounded `session.get`
  against an isolated Host and verifies replacement text plus unchanged source
  bytes. `crates/host-core/src/transcripts_layout_tests.rs` covers the invalid
  row and layout reader directly. Full renderer journey remains Draft.

#### E2E-011a: New session while another session is still streaming

- **Preconditions**: Provider configured; session A is streaming a long
  response (composer shows the stop/abort control).
- **Steps**: 1) While A is still streaming, click New task / New chat. 2)
  Observe the fresh session's composer. 3) Type a prompt and send it while A
  continues streaming in the background. 4) Let A finish and observe the
  fresh session's composer again.
- **Expected**: The previous streaming transcript leaves the screen on the
  first frame. The new session immediately shows the empty home and the idle
  Send control (never a stuck stop/abort control) and its textarea is enabled;
  the prompt sends and streams normally while A keeps running in the
  background. When A ends, its cross-session `agent_end` does not change the
  new session's composer state, which remains idle with the Send control.
- **Specs linked**: `04-ux/08-component-spec.md` (§11.4),
  `04-ux/09-interaction-patterns.md` (§1.6, §11)
- **Acceptance**: C (session isolation, chat & stream)
- **Milestone**: M2
- **Status**: Unit-covered (`composer-send-state.test.mjs`); pending-admission component/store user path
  covered (`queue-pending-actions.test.mjs`); full UI scenario Draft

#### E2E-011b: Create a new session from a retained project group

- **Preconditions**: Provider configured; at least one retained project is
  visible in the sidebar; the current conversation may be idle or streaming.
- **Steps**: 1) Click the project group's New session control. 2) Wait for the
  project conversation to load. 3) Type a prompt and inspect the Send control.
  4) Send without clicking New session again.
- **Expected**: Project activation commits as one renderer navigation flow.
  Reuse is decided from the in-memory list plus renderer empty signals
  (`messageCount`, live rows, running flag, submitted drafts), not a blocking
  `session.list`. If the latest session is empty, the existing row is selected
  on the first frame; if it is non-empty, the empty home replaces the previous
  transcript immediately and one durable empty session is created from
  `session.create`. The composer becomes editable with the Send control
  enabled as soon as the destination is selected; an earlier project's
  background turn cannot leave it disabled. Repeating the click while the slot
  is empty selects the same row and creates no duplicate.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/09-interaction-patterns.md` (§1.6), `04-ux/08-component-spec.md` (§11.4)
- **Acceptance**: C (project session creation and send readiness)
- **Milestone**: M2
- **Status**: Source-level regression covered (`app-store-sidebar.test.mjs`);
  full UI scenario Draft

#### E2E-011c: Session-scoped composer drafts

- **Preconditions**: Provider configured; sessions A and B exist; A has a
  transcript so it uses the docked composer; B is an empty session so it uses
  the home composer; the composer is visible and both sessions are idle.
- **Steps**: 1) Select A and type a prompt without sending it. 2) Switch to B
  and inspect the composer. 3) Type a different prompt in B, then switch back
  to A. 4) Create a new session and inspect its composer. 5) Return to B and
  then delete B; revisit the remaining sessions and the home composer if it is
  available. 6) Type in A, add a workspace file through `@` and a pasted scratch
  file, open Settings (or Plugins), then return to chat. Confirm both file chips
  and the surrounding text remain. Change the workspace of the same draft and
  confirm only its workspace-relative reference is removed.
  7) Hide the app window and show it again with an unsent draft in A.
- **Expected**: B initially shows an empty composer, A restores its original
  unsent prompt, and the new session starts empty rather than inheriting A or
  B. Each session keeps only its own draft (including file-reference chips)
  across empty-home ↔ docked remounts. Deleting B removes its cached draft. If
  a prompt is sent while its request is in flight and the user switches
  sessions, successful completion clears only the submitting session's draft
  and never clears the destination composer. The draft in A is still present
  after the Settings/Plugins round-trip and after the window is hidden and
  shown (D301).
- **Specs linked**: `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (session isolation and composer input)
- **Milestone**: M2
- **Status**: Source-level regression covered
  (`composer-draft-cache.test.mjs`); real React remount and workspace-change
  coverage in `scripts/e2e/composer-paste.tsx` (`pnpm test:e2e:composer-paste`);
  full UI scenario Draft

#### E2E-011c-1: Preserve newer drafts after command completion

- **Preconditions**: Sessions A and B exist; the `/compact` API response can be held pending.
- **Steps**: In A, submit `/compact` and hold its response. Replace the command
  text with a new draft, then release the response. Repeat with an image added
  to the unchanged command text, and with navigation to B before completion.
  For the `reentered` variant, while compact is pending replace the editor text
  with temporary text and dispatch `input`, then type the exact `/compact`
  again and dispatch `input` before releasing the response. Finally run the
  command without editing its draft.
- **Expected**: Completion preserves newer text and image attachments in A;
  B's draft is untouched, and returning to A restores its newer draft. The
  `reentered` case still displays `/compact` after success even though its final
  text equals the submitted value. An unchanged submitted command draft clears.
- **Coverage**: `scripts/e2e/composer-submission.tsx`, executed by
  `pnpm test:e2e:composer-paste`; real desktop recording uses isolated data and
  a local model with a controlled response delay.

#### E2E-011c-2: Late send failures do not restore stale composer drafts

- **Preconditions**: Session A is idle; the two send results for its composer
  can be held and settled independently.
- **Steps**: Submit draft N, then submit draft N+1 before N settles. Accept N+1
  and reject N. Repeat with N+1 rejected after N remains pending.
- **Expected**: N's late rejection never restores its text or file references
  over N+1. If N+1 is rejected, only N+1's own snapshot is restored.
- **Specs linked**: `04-ux/09-interaction-patterns.md` (session-scoped drafts)
- **Acceptance**: C (composer input and session isolation)
- **Milestone**: M2
- **Status**: Async ownership behavior covered by
  `apps/desktop/test/composer-submit-race.test.mjs`; rendered UI scenario Draft

#### E2E-SESSION-reference-conversation-link: A pasted conversation link carries that conversation into the turn

- **Preconditions**: Isolated desktop profile; one project with conversations A
  and B, and a second project with conversation C; a configured model that
  answers from the context it is given.
- **Steps**: 1) In A's conversation overflow menu choose Copy conversation
  link and read the clipboard. 2) Open B, paste the link into the Composer
  draft, send it, and inspect the user message. 3) Ask a follow-up in B without
  repeating the link. 4) Paste C's link into B and send. 5) In A, send A's own
  link. 6) Rename A from its conversation overflow menu, then return to B.
- **Expected**: The clipboard holds `pi-desktop://session/<A's id>`. B's user
  message keeps the link text visible and shows a chat-icon chip labelled with
  the catalog's reference label and A's title; activating the chip opens A. The
  answer uses A's content, and the follow-up still reads the same reference
  without the link being written again. C's link and A's own link attach
  nothing: the message keeps its plaintext and the model receives no excerpt
  from them, because the resolver drops a self-reference before any read and
  discards an excerpt whose conversation belongs to another project.
  Renaming A afterwards renames the chip in B, which names the conversation from
  its current title; the excerpt the model already read keeps the name recorded
  when the reference was made.
- **Specs linked**: `04-ux/08-component-spec.md` §20B,
  `03-runtime/04-data-storage.md`, `03-runtime/02-agent-runtime.md`
- **Acceptance criterion**: C — Conversation & stream
- **Milestone**: M2
- **Status**: Draft — the resolver and the chip are covered at source level by
  `apps/desktop/test/session-references.test.mjs` and
  `apps/desktop/test/session-reference-ui.test.mjs`

#### E2E-COMPOSER-input-history-recall

- **Preconditions**: Isolated Electron test profile and the production Composer
  input/draft/history/submit hooks mounted in the renderer fixture. The send
  boundary is deterministic; no provider or network credentials are needed.
- **Steps**: 1) In session A, send `alpha`, `beta`, and `beta` again through
  Enter; press ArrowUp twice and ArrowDown twice. 2) Edit a recalled draft and
  confirm arrows no longer replace it. 3) Send a prompt with a file reference,
  recall it, and inspect the rendered chip. 4) Switch to B, verify A's history
  is absent, send `beta`, and verify B recalls only its own entry. 5) Start the
  first Home prompt with the send boundary held, switch to B before acceptance,
  release it, then open the materialized session and recall the prompt. 6) Exit
  Electron and launch a new process with the same isolated profile; recall A's
  attachment entry and the Home-created session's prompt.
- **Expected**: Duplicate consecutive `beta` is stored once; ArrowUp/ArrowDown
  walk newest-to-oldest and back to an empty draft. Editing ends browsing.
  Attachment text and its rendered file chip return together. Sessions A and B
  remain isolated. The delayed Home send is recorded under the session ID
  materialized by `sendPrompt`, not the session selected when the send finishes.
  Both histories and the attachment survive a real Electron process restart.
- **Specs linked**: `04-ux/09-interaction-patterns.md`,
  `08-meta/decisions-log.md` (D632), `04-ux/08-component-spec.md`
- **Acceptance**: C (composer input and session isolation)
- **Milestone**: M2
- **Status**: Automated by `pnpm test:e2e:composer-paste` (renderer keyboard
  interactions, Home session switch, attachment recall, and second-process
  persistence); store callback race regression is covered by
  `apps/desktop/test/composer-input-history.test.mjs`.

#### E2E-011d: New task creates an immediate durable empty slot

- **Preconditions**: Provider configured; at least one real session exists so
  the sidebar history is non-empty.
- **Steps**: 1) Invoke New Task from the sidebar, the top bar, or Cmd/Ctrl+N
  inside a retained project and in the temporary scope. 2) Inspect the sidebar
  history and the composer. 3) Click the same group's New Task control several
  times quickly. 4) Type a message and send it. 5) Inspect the sidebar history
  again and repeat in a different project group.
- **Expected**: When the group's latest session is non-empty, the empty home
  replaces the previous transcript on the first frame, then one new row is
  persisted from `session.create` (without a blocking `session.list` /
  `session.get` round-trip) and selected before the first send. Once that row
  is the group's latest empty session, repeated clicks select it (or do
  nothing when already selected) and create no duplicate. Sending updates the
  same row's title and message count; the project and temporary groups keep
  independent slots.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/08-component-spec.md` (§11), `04-ux/01-ui-ia.md` (§5)
- **Acceptance**: C (history integrity and group-scoped creation)
- **Milestone**: M2
- **Status**: Source-level regression covered
  (`app-store-sidebar.test.mjs`, `composer-send-state.test.mjs`,
  `session-create.test.mjs`); full UI scenario Draft

#### E2E-011e: Empty-session reuse is scoped to the latest session

- **Preconditions**: One project group contains an older empty session and a
  newer session with messages; a separate project and the Temporary group are
  available.
- **Steps**: 1) Click New Task in the first project group. 2) Confirm the new
  row is created even though the older empty session remains. 3) Click New Task
  again before sending. 4) Repeat in the second project and Temporary group.
- **Expected**: The first click creates a new durable row because only the
  latest session is considered and it is non-empty. The second click reuses
  that newly created empty row. The older empty row remains untouched, while
  each other group gets its own independent empty-slot decision.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, `04-ux/01-ui-ia.md`,
  `04-ux/08-component-spec.md`
- **Acceptance**: C (session creation and grouping), F (persistence)
- **Milestone**: M2
- **Status**: Source-level regression covered; full UI scenario Draft

#### E2E-012b: Project memory persists only within its project

- **Preconditions**: App running with two retained projects and a configured
  provider.
- **Steps**: 1) Open the first project row menu and choose Project memory. 2)
  Add a memory card, enter a title and project-specific note, then save. 3)
  Reopen the editor, edit the note, add a second card, remove the first card,
  and save. 4) Start or continue a chat in the first project and verify the
  next runtime receives the saved entries as derived context. 5) Switch to the
  second project and start a chat. 6) Return to the first project and reopen
  the editor.
- **Expected**: The editor loads the saved cards after reopening. The first
  project's runtime receives their readable projection as a labelled
  user-context block; the second project's runtime does not. An existing
  legacy plain-text memory opens as one untitled card. Empty memory is valid,
  removing all cards clears the projection, saving replaces the prior value,
  and content above 32 KiB is rejected without a partial save. The create
  dialog's memory hint is concise and does not imply that memory is shared
  across projects.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` (§9),
  `03-runtime/04-data-storage.md` (§4.1),
  `03-runtime/06-host-rpc-protocol.md` (Projects),
  `04-ux/06-settings-ia.md` (Project archive),
  `04-ux/08-component-spec.md` (Sidebar interactions)
- **Acceptance**: C (chat/stream), D (project UI), F (persistence), Localization
- **Milestone**: M5
- **Status**: Unit/source covered; full provider/UI journey Draft

#### E2E-011f: Send while running queues per-session prompts and supports Send now

- **Preconditions**: Provider configured; session A can produce a delayed
  response with at least one completed tool batch; session B exists and is
  idle.
- **Steps**: 1) Send a long-running prompt in A. 2) While A is running, verify
  the composer has exactly one submit button: with an empty draft it is Stop
  (`aria-label="Stop generating"`) and no Send button is present; type a draft
  and verify the same slot becomes Send (`aria-label="Send"`) with no Stop
  button present. Send two more prompts and inspect the queue above the
  composer. 3) Remove the second queued row and switch to B. 4) Send a prompt
  in B, then return to A before either run completes. 5) Choose Send now on A's
  remaining queued row, then choose Send now on a second row. 6) Observe A
  through the next model request within the same turn. 7) Start
  another run in A, clear the draft to expose the single Stop button, press
  Stop, and inspect the queue. 8) Repeat with two queued prompts, let the active
  turn finish without Send now, and delay its host `session.endTurn` response
  until after `agent_end` is delivered. Release finalization and observe both
  follow-ups through their turn boundaries. Repeat with a provider error and an
  immediate abort. 9) With waiting rows, use move up and move down and confirm
  the persisted order follows. 10) Edit a waiting row while the composer holds
  text, then with an empty composer. 11) Delay Host queue admission. Attempt to
  edit/remove the pending row, release admission, then edit/remove the durable
  row. Repeat with a captured file-reference draft. 12) Withhold a local Host
  queue-save request until its existing RPC deadline expires, then retry.
  13) With an empty composer and two waiting rows, press the steering shortcut
  (`⌥/Alt+Enter`): verify the first row is promoted, press it again to promote
  the second, then repeat with only a saving row present. 14) Repeat with a
  draft in the composer and confirm the shortcut steers the draft and leaves
  both rows waiting.
- **Expected**: The single submit slot contains exactly one button in every
  state: disabled Send while idle and empty, enabled Send while running with
  content (which queues the prompt), and Stop while running with an empty
  draft. A's two prompts appear in FIFO order, the removed row never sends,
  and B's queue remains independent. Send now delivers promoted input in click
  order into the current turn without requesting a stop. An active TaskWait
  yields to the input while delegates keep running. Refused input or input
  with a different permission mode remains queued for a later turn.
  A promoted row locks move/edit and Send now, but permits removal; promotion is
  one-way. Move up/down swaps only waiting rows, never crosses the promoted
  block, and persists. Edit is refused with a visible message while the input
  is non-empty, and otherwise removes the row and returns its text plus its
  file-reference chips to the composer. Immediate Stop aborts the current reply
  and preserves A's queued row;
  switching sessions preserves both queues. Ordinary completion, provider
  failure, and abort all resume queued sending automatically after durable
  finalization releases the session. No queued prompt starts while finalization
  is pending; each subsequent turn starts once in FIFO order, without another
  click or session switch. Repeated terminal handling does not double-dispatch.
  Other sessions' queues remain unchanged, and quitting while finalization is
  pending preserves queued work without starting another turn. Pending-admission
  rows disable all five actions, explain Saving in each tooltip, show Saving
  on Send now, and remain visible without restoring a second draft. Once acknowledged, remove deletes the durable row and edit restores
  exactly its captured draft; neither row reappears after refresh. A local Host
  admission timeout clears the pending row, reports the error, and restores
  the rejected composer draft; retry can queue normally. With an empty composer
  the steering shortcut promotes the first waiting row exactly as its Send now
  action does, skipping rows that are saving or already promoted; with a draft
  present it steers the draft and leaves the queue untouched.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` (§5.6),
  `04-ux/08-component-spec.md` (§11),
  `04-ux/09-interaction-patterns.md` (§3.4), ADR 0118, ADR 0213, ADR 0265
- **Acceptance**: C (chat, stream, and session isolation), Quality
- **Milestone**: M6+
- **Status**: Source-level regression and deterministic desktop finalization /
  Agent Host integration covered (`queued-turn-finalization.test.mjs`);
  promotion, reorder, and edit contracts covered at source level
  (`composer-send-state.test.mjs`); the empty-composer send-now shortcut is
  covered by `composer-queued-send-now-shortcut.test.mjs`; full UI scenario Draft

#### E2E-QUEUE-promote-orders-delivery-by-click: Two Send now clicks deliver in click order

- **Preconditions**: Provider configured; session A is running a turn with at
  least one completed tool batch; three prompts are queued behind it.
  the first queued row. 3) Confirm the promoted block orders third → first, that
  both rows lock their move/edit actions, and that the remaining row is
  still editable. 4) Observe steering delivery at the next model request.
- **Expected**: The first click is delivered first and the second second — the
  click order is the delivery order, not "last click wins" and not the original
  queue order. Both rows appear as user messages in the same active turn;
  the queue no longer lists either accepted promoted row. Both
  promoted rows show as waiting and cannot be edited or reordered. Removal
  remains available until delivery. Refused steering retains the row for the
  next turn and leaves it cancelable. If cancellation wins admission,
  the input never executes; if delivery wins, cancellation reports that it
  already started. The row disappears only after Host acknowledgement.
  A stalled steering delivery does not block admission or cancellation of other
  queued inputs. Failed durable removal after acceptance reports an error and
  rejects cancellation; a subsequent drain retries cleanup without re-executing
  the accepted input in the live Host. The waiting row keeps its actions and is not delivered before
  either promoted row.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` (§5.6),
  `04-ux/08-component-spec.md` (§11), ADR 0265
- **Acceptance**: C (chat, stream)
- **Milestone**: M6+
- **Status**: Draft; ordering and the adjacent delivery are covered by
  `turn_queue`, `turn-queue`, and `agent-host` unit tests
- **Specs linked**: `03-runtime/01-ipc-protocol.md` (§5.6),
  `04-ux/08-component-spec.md` (§11), ADR 0265
- **Acceptance**: C (chat, stream)
- **Milestone**: M6+
- **Status**: Draft; underlying ordering covered by `turn_queue`,
  `turn-queue`, and `agent-host` unit tests

#### E2E-QUEUE-reorder-moves-plain-neighbours: Move up/down reorders the waiting queue

- **Preconditions**: Provider configured; a turn is running with at least three
  prompts queued and no promoted row.
- **Steps**: 1) Move the third row up twice and confirm it becomes first. 2) Move
  the first row up once and confirm nothing moves. 3) Promote a row, then try to
  move the adjacent waiting row across it. 4) Reload the renderer and inspect the
  queue order.
- **Expected**: Each move swaps the row with its adjacent waiting neighbour and
  the Host persists the new order, so a reload reproduces it. The waiting-block
  boundary and the promoted block are immovable: a move at the block edge is a
  no-op that never reaches the Host, and no move changes a promoted row's place.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` (§5.6), ADR 0265
- **Acceptance**: C (chat), F (persistence)
- **Milestone**: M6+
- **Status**: Draft; host-side reorder covered by `turn_queue` unit tests

#### E2E-QUEUE-cancel-next-during-start: The next waiting message stays cancelable

- **Preconditions**: An isolated desktop profile and a local provider that can
  hold a reply open; one active turn followed by queued messages A and B.
- **Steps**: Release the active reply. While A is executing, cancel B. Finish
  A and send another message.
- **Expected**: A's early runtime events retain A's identity. B remains queued
  at position 1 until cancellation succeeds, never reaches the provider, and
  disappears from the durable queue. A and the subsequent message complete.
- **Specs linked**: `03-runtime/19-remote-agent-control-protocol.md` (turn states)
- **Acceptance**: C (chat), F (persistence)
- **Status**: Manual local-provider acceptance scenario

#### E2E-QUEUE-edit-restores-draft-only-when-input-empty: Edit restores the queued draft

- **Preconditions**: Provider configured; a turn is running with a queued prompt
  that carries text and a file-reference chip; the composer input is empty.
- **Steps**: 1) Type a draft, then choose edit on the queued row. 2) Clear the
  composer and choose edit again. 3) Confirm the queue no longer lists the row
  and the composer holds the row's text and its file-reference chip. 4) Send it
  and compare the transcript with the original queued prompt. 5) Queue an image
  with a file, quit the app normally, reopen it, and edit the restored row.
  Repeat with an image-only row and a text-only row; resend each edited draft.
- **Expected**: With a non-empty input (or an attachment chip) the edit is
  refused with a visible message and the row stays queued. With an empty input
  the row leaves the queue, the Host no longer lists it, and the composer holds
  the exact text plus the original file-reference chip — not the
  serialized prompt the Host received. Re-sending produces the same prompt as the
  queued row would have. After restart, Host-stored content and all attachments
  survive editing and resubmission even though the in-memory draft is gone.
- **Specs linked**: `04-ux/08-component-spec.md` (§11), ADR 0265
- **Acceptance**: C (chat, stream)
- **Milestone**: M6+
- **Status**: Draft; composer-side contract covered by
  `composer-send-state.test.mjs`

#### E2E-011g: New Task does not leave the previous transcript on screen

- **Preconditions**: Provider configured; session A has a visible transcript
  (idle or streaming); the group's latest session is non-empty.
- **Steps**: 1) Click New Task (sidebar, top bar, or Cmd/Ctrl+N). 2) Observe
  the chat surface on the next frame, before the new sidebar row is required
  to exist. 3) Type in the composer during that interval. 4) Wait for the new
  row and send. Also send while creation is still pending, and overlap two
  first-input materialization requests with the host response delayed.
- **Expected**: A's transcript is gone on the first frame (empty home, idle
  Send). The composer does not stay on A's draft. After `session.create` the
  same empty session is selected, any text typed during the wait belongs to
  that session, and sending does not create a second row. Repeating New Task
  before sending reuses the row. The host is not asked to `session.list` or
  `session.get` before the empty destination is visible. Overlapping inputs
  share one creation and its session id; the first send does not invalidate
  New Task navigation. Superseded creation returns no target to waiting inputs,
  and a failed create releases the slot so retry can succeed.
- **Specs linked**: `04-ux/09-interaction-patterns.md` (§1.6),
  `04-ux/08-component-spec.md` (§11), ADR 0154
- **Acceptance**: C (session creation), Quality
- **Milestone**: M2
- **Status**: `pnpm test:e2e:composer-paste` covers first Send, oversized
  paste, and navigation cancellation with a delayed create reply over the
  Electron preload bridge. Source-level tests also cover create failure and retry.


#### Composer file-reference undo regression

- Add a file reference to an unsent draft, select the chip, delete it, then
  undo and redo with the native editor shortcuts. Undo must restore both the
  chip and the file path used by submission; redo must remove both.
- Switch to another chat and back after undo: the other draft stays empty and
  the source retains the restored reference. Typing a removed chip's private-use
  token as plain text must not restore the attachment.
- Automated by `pnpm test:e2e:composer-paste` (`fileReferenceUndoRedo`).

### Conversation Top Bar

#### E2E-087: Conversation top bar renders on the chat route

- **Preconditions**: Provider configured; at least one session exists.
- **Steps**: 1) Open the chat route. 2) Inspect the 46px bar at the top of the
  conversation area. 3) Confirm it shows the concise session/task title and the
  New task / Search buttons; hover or focus each and inspect its tooltip. Confirm
  the sidebar toggle appears **only when collapsed**. 4) Customize each shortcut
  in Settings → Shortcuts and confirm the tooltip updates; disable each binding
  and confirm its shortcut is omitted. 5) Switch to Scheduled, Plugins, or
  Settings and inspect the same top region.
- **Expected**: Every route-owned top region uses the same `--ds-toolbar-height`
  (46px), bg-primary surface, and bottom border; Windows/Linux reserve the
  same 120px native-control band at the right. On the chat route the
  conversation top bar renders with its title and actions only; it has no model
  or Agent|Plan|Goal mode control. The
  left-of-input Composer chip owns the active session's Agent/Plan/Goal switch,
  and the Composer-right combined chip owns model and reasoning selection. The
  task title is the only visible title text and uses the available width,
  with an ellipsis only on overflow. Check an English title longer than 10
  characters in wide and narrow layouts, with the sidebar expanded/collapsed
  and the work panel open/closed; titles must not overlap the action buttons.
  The complete title and project scope remain available through its tooltip.
  New task and Search tooltips show their effective platform-formatted
  shortcuts, including custom bindings; an explicitly unbound shortcut is
  omitted, while the accessible name remains the localized action. The sidebar
  toggle is present only when collapsed (no duplicate of the sidebar's control).
  On every other route the frameless drag band renders instead (no chat top-bar
  controls) while retaining the same surface and alignment. The bar is draggable
  to move the window; interactive controls do not start a window drag.
  macOS leaves the left 88px clear for traffic lights only while the sidebar is
  collapsed (8px in fullscreen); Windows/Linux leave the right 120px clear for
  native window controls.
- **Specs linked**: `04-ux/08-component-spec.md` (§2 Topbar)
- **Acceptance**: C (send/UI), Quality
- **Milestone**: M2
- **Status**: Draft

#### E2E-087a: Destination page headers clear the titlebar band on macOS

- **Preconditions**: macOS build; at least one plugin installed.
- **Steps**: 1) Open the Plugins route with the window at its default size.
  2) Inspect the top of the page: the "Plugins" title row, its primary action,
  and the overflow menu button. 3) Scroll the page to the top and confirm no
  page content is hidden behind the 46px band. 4) Repeat on the Scheduled
  route. 5) Open a plugin's detail sheet and inspect its head.
- **Expected**: The page header renders fully below the frameless drag band on
  macOS as it already does on Windows/Linux: the title row is not clipped, and
  the Installed / Marketplace segmented control and search field sit at their
  intended offset instead of at the window's top edge. `.page-frame` reserves
  `--ds-toolbar-height` plus an 8px buffer on darwin, win32, and linux alike.
  Scrolling Plugins and Scheduled use a destination-owned
  scroller rather than the chat transcript scroller, so the bottom rows remain
  fully painted and reachable instead of inheriting the Composer occlusion mask.
  The plugin detail sheet mounts on the viewport overlay host, stays above the
  expanded sidebar and titlebar band, and keeps its own head at the top edge,
  with its close button opting out of the drag rectangle.
- **Specs linked**: `04-ux/08-component-spec.md` (§2.3 Layout)
- **Acceptance**: C (UI), Quality
- **Milestone**: M2
- **Status**: Source-level regression covered
  (`apps/desktop/test/plugins-page-style.test.mjs`,
  `apps/desktop/test/route-scroll.test.mjs`); full UI scenario Draft


#### E2E-088: Composer Agent/Plan/Goal chip updates the session

- **Preconditions**: Chat route active; a session selected.
- **Steps**: 1) Click the left-of-input Composer mode chip to enter Plan. 2)
  Send a prompt that would normally require Write/Edit and observe behavior. 3)
  Click the same Composer chip to return to Agent. 4) Begin a turn and try to
  toggle mode mid-run or while a pending Plan approval is visible.
- **Expected**: The Composer chip updates the active session `mode` (Plan and
  Goal hard-deny Write/Edit and plugin tools while Bash follows the selected
  permission mode; Agent allows its normal tools per permission settings). The
  chip is disabled while a turn or active pending approval exists and re-enables
  after the session returns idle/planning. No top-bar mode control is rendered.
- **Specs linked**: `04-ux/08-component-spec.md` (§2, §11),
  `03-runtime/03-tools-and-permissions.md` (§10),
  `03-runtime/04-data-storage.md` (§8)
- **Acceptance**: C, E
- **Milestone**: M2
- **Status**: Draft

#### E2E-088a: Composer configuration controls survive project/session initialization

- **Preconditions**: Provider configured; a new project or new session flow is
  visible while the destination `activeSessionId` is still resolving.
- **Steps**: 1) Inspect the Composer mode, model × reasoning, and permission
  controls during the empty/home transition. 2) Click the mode control and
  confirm it advances to the next mode. 3) Open the combined chip, enter the
  Reasoning level submenu, and select a supported level. 4) Open permission
  mode and select Auto. 5) Inspect the destination session
  after navigation completes.
- **Expected**: None of the idle configuration triggers is disabled merely
  because the destination session has not been projected yet. New Task has
  already selected or created the durable empty row, and the first
  configuration action applies to that session without waiting for a message;
  no second click is required. Running turns and pending approvals still
  disable the controls. Behind that transition the chat area follows the
  cold-switch rule: the currently visible pane keeps showing its own session
  until the destination commits, the only wait affordance is the thin progress
  track, nothing is dimmed, and prompt submission stays inert until the visible
  pane is the active session, so a prompt cannot reach the session being left.
  In zh-CN/zh-TW, the Composer permission menu renders the Accept edits option
  as `允许编辑` / `允許編輯` and keeps it on one line.
- **Specs linked**: `04-ux/08-component-spec.md` (§11),
  `04-ux/09-interaction-patterns.md` (§5A), ADR 0137
- **Acceptance**: C (new project/session composer)
- **Milestone**: M2
- **Status**: Draft

#### E2E-088b: Composer placeholder guidance follows page and session context

- **Preconditions**: English and zh-CN locales are available; a provider is
  configured; at least one Skill is active; both an empty home and two
  conversations can be opened.
- **Steps**: 1) On empty home, record the welcome placeholder and wait longer
  than 4 seconds to confirm it is unchanged. 2) Open conversation A, record
  its guidance, type and clear text, focus and blur the textarea, and wait;
  confirm the copy is unchanged. 3) Switch to conversation B and then back to
  A, recording each guidance change. 4) Switch between home and a conversation
  and inspect the command/file and keyboard hints. 5) Type `/` and inspect the
  slash menu. Include Skills with long English/CJK descriptions, short/no
  descriptions, a separate title/argument hint, and an exceptionally long slash
  name; also inspect a long filename in `@` mode. Repeat at 800px and 1680px
  viewport widths with 320px and 640px composer widths. 6) Switch to zh-CN and
  repeat the context-switch checks.
- **Expected**: The initially rendered context starts with its welcome copy and stays stable until
  the page/session context changes. Each context switch advances to the next
  localized command/file or keyboard hint with an opacity fade; no timer-driven
  changes occur. The keyboard hint includes Shift+Enter and a submit hint, while the
  command/file hint includes `/` and `@`. The slash menu still contains `/new`,
  `/compact`, `/agent-mode`, `/plan-mode`, and `/goal-mode`, followed by a
  Skills group at the bottom. Selecting a Skill inserts `/skill:<id>`; sending
  it keeps the typed command chip visible and the model calls `Skill` with the
  original ID before answering. Verify builtin, plugin, and user Skill prefixes,
  multiple inline references, and a prompt template sharing the unprefixed
  Skill name; inactive and unknown Skills must not resolve. zh-CN shows the
  matching localized copy, including
  `Shift+Enter for newline · Use Send to submit`.
  Long descriptions use only the space remaining after command names and
  hints, so short names stay fully visible. Descriptions and oversized names
  ellipsize within the row without horizontal overflow; file names retain the
  available row width. Name highlights and click acceptance with input focus
  retained remain intact.
- **Specs linked**: `04-ux/08-component-spec.md` (§11),
  `04-ux/04-builtin-commands.md` (§7–8)
- **Acceptance**: C (send/UI), Localization, Quality
- **Milestone**: M2
- **Status**: Source-covered (`composer-placeholder-context.test.mjs`);
  slash-menu layout covered by `pnpm test:e2e:composer-autocomplete` after
  `pnpm build:js` (real React/Chromium and production CSS, deterministic command
  fixtures; no provider required). Full provider/session scenario Draft;
  branch runs do not replace post-integration E2E

##### Connected MCP slash selection (#1377)

- Restart Desktop with an enabled saved MCP server. Without visiting MCP
  settings or sending an ordinary message first, open the slash menu and
  submit a server/tool command. Discovery initializes the connection and the
  first prompt reaches the selected tool; opening the menu executes no tool.

- With a ready user MCP server, type `/` or search its display label. The MCP
  group appears before Skills. Enter and mouse selection insert the encoded
  server command without sending or invoking a tool.
- Send a task after the command. The runtime receives the server-specific
  instruction, exact server IDs, and task; persisted command metadata retains
  the typed text. All six fixture tools are activated without ToolSearch; a
  similarly named server remains unselected. Steering activates only for the
  request consuming the queued message. Plan and Host permissions still apply.
- Submit a server/tool command with no task text or attachment. Main rejects it
  before opening or persisting a turn; adding task text or an attachment allows
  the selected tools to be offered to the model.
- Disconnect, disable, or remove project access between menu selection and
  send. Sending fails before a new turn or history replacement. Steering uses
  the same validation; native Pi cannot silently accept Desktop MCP commands.
- Coverage: `apps/desktop/test/composer-mcp.test.mjs` exercises the real command
  service and prompt/steering IPC with external runtime boundaries stubbed.
  `node scripts/e2e-composer-ime-stack.mjs` exercises the real React editor,
  completion controller and keyboard/mouse acceptance in isolated Electron.
  `node scripts/e2e-composer-mcp.mjs` uses production sidecar transport, an
  isolated Rust Host, a real stdio MCP child and a local SSE model fixture.
  It verifies the sixth tool executes without ToolSearch and its server-only
  nonce reaches the next model request. These fixtures do not prove a real
  provider's tool choice or remote MCP health.
- Select `/mcp:<server>:<tool>` by keyboard and pointer, then submit or steer.
  Main preserves the original command and forwards exact server/tool IDs.
  Only the requested tool activates; similarly named tools, another server's
  tools and removed tools cannot broaden the selection. Whole-server rows
  remain selectable and existing active tools retain their availability.
- Run `MCP_SELECTION_TOOL=1 node scripts/e2e-composer-mcp.mjs` for the
  individual-tool variant of the deterministic sidecar/Host/MCP scenario.

#### E2E-089: Composer model menu opens upward and switches model

- **Preconditions**: Chat route active; provider configured with two reasoning
  models whose binding defaults differ.
- **Steps**: 1) Click the Composer-right model × reasoning chip. 2) Confirm the
  menu opens upward from the bottom composer. 3) Enter Model, select a different
  provider/model, and return to the root. 4) Confirm its default thinking level,
  choose another supported level, then reselect the same model. 5) Open Settings
  from the command palette or application menu.
- **Expected**: The trigger uses a Bot icon while retaining the current model
  and reasoning labels. The root shows only Model and Reasoning level entries.
  The Model submenu lists enabled runnable providers and only the model bindings
  saved for each provider, with each model row visibly indented beneath its provider
  heading. Cached or freshly discovered models may supply display names and
  metadata for those bindings, but unconfigured discovery results are absent;
  configured IDs remain available when discovery is unavailable. The root slider
  lists the selected model's supported levels. Selecting a different model
  updates the active session to that binding's default thinking level; selecting
  the already-active model preserves a manually selected level. Settings opens
  from the command palette/menu. The Composer model trigger ellipsizes long IDs.
  Each option shows one display name only, and hovering a long option exposes its
  complete display name in the tooltip without changing the menu layout or adding
  a visible model ID.
- **Specs linked**: `04-ux/08-component-spec.md` (§11, model menu),
  `03-runtime/13-model-catalog-and-selection.md`
- **Acceptance**: C
- **Milestone**: M2
- **Status**: Component-covered by `pnpm test:e2e:composer-model-selection`
  (isolated React/Electron with the real Composer hook); full provider/session
  desktop journey remains Draft.

#### E2E-COMPOSER-narrow-controls: Composer controls adapt to a narrow chat column

- **Preconditions**: Chat route active; a configured model is selected; the
  composer is rendered in both empty-home and thread-docked variants.
- **Steps**: 1) Set the Composer container to 560px and inspect the combined
  model × reasoning trigger. 2) Set it to 480px, then 450px. 3) At each width,
  inspect the mode, permission, context, enhancement, and Send/Stop controls;
  open the model menu from the narrow trigger; repeat the visual check in the
  other Composer variant.
- **Expected**: The toolbar remains one non-wrapping row and does not overflow
  its container. At 560px the reasoning label and separator yield first; at
  480px the model label is further capped; at the 450px floor the combined
  model × reasoning trigger is a 32px icon-only control. The full selection is
  still available through the trigger's menu, tooltip, and accessible name.
  Mode and permission labels remain single-line and ellipsized, the context
  ring and action controls retain usable hit targets, and the single Send/Stop
  slot remains reachable. Home and thread-docked composers match.
- **Specs linked**: `04-ux/08-component-spec.md` (§11)
- **Acceptance**: C (send/UI), Quality
- **Milestone**: M2
- **Status**: Automated on task candidate `737435248ebd32e0b2a406f93b7b245784bc4289`
  (base `cea6e02c`): `pnpm test:e2e:layout` 167/167 including the 450px
  model-chip assertion; `pnpm test:e2e:composer-autocomplete` and
  `pnpm test:e2e:composer-paste` passed. Source-covered by
  `composer-responsive.test.mjs`.

#### E2E-090: Transcript bottom reserve tracks the docked composer height

- **Preconditions**: Chat route active; a session with a transcript that
  exceeds one viewport so the last message sits near the docked composer.
- **Steps**: 1) Scroll the transcript to the latest message. 2) Measure the
  vertical gap between the last message and the top of the docked composer.
  3) Type several lines into the composer so the draft grows multi-line. 4)
  Re-measure the gap and confirm the last message is still fully visible above
  the composer (not overlapped). 5) Collapse the draft back to a single line and
  confirm the gap shrinks back toward the tight ~16px reserve.
- **Expected**: The last message sits close above the composer (a small,
  consistent gap) rather than far below it; the reserve follows the composer's
  real height via `--composer-dock-height` so a taller multi-line draft pushes
  the transcript up instead of covering it. The jump-to-latest button and the
  minimap stay anchored just above the composer at every draft height.
- **Specs linked**: `04-ux/08-component-spec.md` (§4.3 MainChat layout)
- **Acceptance**: C (send/UI), Quality
- **Milestone**: M2
- **Status**: Draft

#### E2E-144: Sending a prompt keeps the transcript at the latest turn

- **Preconditions**: Chat route active; the selected session contains enough
  history to overflow the transcript viewport; the transcript is at the latest
  message or has been scrolled upward.
- **Steps**: 1) Send a prompt from the bottom of the viewport. 2) Observe the
  transcript from the first send state through the persisted user-message
  event and the first streamed row. 3) Repeat with a multi-line draft so the
  composer collapses when the draft clears, and again after manually scrolling
  upward before sending.
- **Expected**: Send immediately hides the jump control and re-pins the
  transcript in the layout phase. The historical rows move upward only as the
  new turn is added; the viewport never flashes to the top of the conversation,
  and the new user turn plus streamed response remain visible at the bottom.
  The composer collapse and indicator layout clamps after send never release
  follow mode (no "↓ Scroll to bottom" button appears while the turn streams
  unless the user actually scrolled with an input device).
- **Specs linked**: `04-ux/08-component-spec.md` (§4.3, §4.4),
  `04-ux/09-interaction-patterns.md` (§9.1, §10.4)
- **Acceptance**: C (send/UI), Quality
- **Milestone**: M2
- **Status**: Draft

### Workspace Open

#### E2E-012: Open a project directory

- **Preconditions**: App running; no project open.
- **Steps**: 1) Open project directory via UI. 2) Select a local folder.
- **Expected**: Project path displayed; tool paths resolve relative to project root.
- **Specs linked**: `03-runtime/15-workspace-ignore-rules.md`
- **Acceptance**: D (open project, show path)
- **Milestone**: M3
- **Status**: Draft

#### E2E-012a: Create a named project from multiple folders

- **Preconditions**: App running; no project dialog open; at least two local
  folders are available, including one with a long name or path.
- **Steps**:
  1. Invoke Add project from Settings → Project archive or the sidebar Projects
     heading and inspect the empty dialog.
  2. Add two folders with the folder picker without typing a name. Confirm the
     name field seeds with the first folder's name, both rows render, and the
     first row is marked Primary.
  3. Remove one row, check the count, and add it again.
  4. Inspect the empty and populated states in light and dark themes, including
     a narrow window and reduced-motion settings.
  5. Use Tab and Shift+Tab to traverse the controls. Close with Escape, then
     reopen and close by clicking outside; check focus after each close.
  6. Reopen, enter the name, add the folders, and create the project. Inspect
     the in-flight controls and the resulting active primary workspace and one
     grouped project entry with both roots.
  7. Start a session in the group and ask the agent to read a file using the
     additional root's absolute path; then try an unrelated outside path.
- **Expected**: The dialog traps focus, closes on Escape or outside click while
  idle, and keeps the name and selected folders visible without horizontal
  overflow. The native picker allows multiple directories in one selection.
  Removing a folder updates the count and never removes another row. Create
  needs one folder and no typed name; an empty name field falls back to the
  first folder's name. On creation one
  logical project group receives the entered display name; its primary folder
  becomes the active workspace and every selected folder is retained as a group
  root. The Project archive shows one group row, and its sessions, shared
  instructions, and shared memory use the group identity. Read/Glob/Grep/
  Write/Edit can use an explicitly addressed additional root only after host
  canonical containment; an unrelated outside path still follows the normal
  permission flow. The
  dialog is unavailable while creation is in flight and returns focus to the
  invoking control after close. The surface follows the shell's neutral gray
  theme with a 480px maximum width, 18px tokenized corners, shared dialog
  elevation, and the global compact type ramp. The title uses the dialog-level
  heading size, the name field uses the body/input size, and labels/metadata
  remain on the smaller global steps. The header and action row use the shared
  18px dialog gutter; sections use a 16px gap. It shows one Create project
  title, a filled name field without duplicate placeholder copy, a compact
  local source chip, and a softly filled Add folder action. It does not add
  explanatory memory or multi-selection copy. The workspace section keeps the
  current local folder selection behavior while staying neutral about future
  remote sources. No outer stroke, section rules,
  footer divider, or dashed picker border appears. Spacing provides the section
  hierarchy; long names and paths remain contained, and scrolling content never
  hides the fixed action row. Both themes keep text readable and keyboard focus
  visible; reduced motion suppresses the control transitions. The source chip
  is the extension point for a future remote project source; the current flow
  remains local-only.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` (§9),
  `04-ux/06-settings-ia.md` (Project archive),
  `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md` (§3.5)
- **Acceptance**: C (project creation UI), D (multi-folder project setup),
  Accessibility, Localization
- **Milestone**: M3
- **Status**: Source-level regression covered; full UI scenario Draft

#### E2E-012b: Delete a project root from a multi-folder group

- **Preconditions**: A two-root project group has sessions in both roots; one
  session in the root being deleted can be started and stopped.
- **Steps**:
  1. Start a turn in the primary root, then request deletion of that project
     and confirm the action.
  2. Confirm the running-session conflict and inspect the group and both
     session lists.
  3. Let the turn finish, delete the primary project, and confirm again.
  4. Inspect the remaining group, its sessions, shared instructions and
     memory, and both directories on disk.
- **Expected**: A running session blocks deletion without changing group
  membership or deleting data. After the session is idle, deletion removes the
  selected root, its sessions and project memory, promotes the first remaining
  root when needed, and preserves the remaining root's sessions and group-level
  instructions and memory. The original folders remain on disk.
- **Specs linked**: `03-runtime/06-host-rpc-protocol.md` (Projects),
  `04-ux/08-component-spec.md` (§3.9)
- **Status**: Draft

#### E2E-013: Read-only tools work in project

- **Preconditions**: Project directory open.
- **Steps**: 1) Ask agent to read a file in the project. 2) Observe result.
- **Expected**: `Read` returns immediately within project scope. In Agent mode,
  `Glob` and `Grep` are available in the first Agent request without
  `ToolSearch`; Plan keeps its read/search core available from the first
  request. All results remain within project scope.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (Read/Glob/Grep work), D (tools based on project)
- **Milestone**: M3
- **Status**: Automated (protocol smoke: Read + Glob in sample project)

### Permission Allow / Deny / Cancellation

#### E2E-014: Write/Edit/Bash triggers permission card

- **Preconditions**: Agent mode; project open.
- **Steps**: 1) Ask agent to write a file. 2) Observe permission card.
- **Expected**: Permission card appears inline in the originating transcript
  with tool name, workspace, arguments preview, and allow/deny
  options. It creates no backdrop or modal and does not cover another session.
- **Specs linked**: `04-ux/03-permission-ux.md`, `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (Write/Edit/Bash trigger confirmation)
- **Milestone**: M3
- **Status**: Draft

#### E2E-015: Denied permission blocks execution

- **Preconditions**: Permission card displayed.
- **Steps**: 1) Click deny on permission card. 2) Observe agent response.
- **Expected**: Tool not executed; agent receives denied result; no file changed.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (denied → not executed)
- **Milestone**: M3
- **Status**: Draft

#### E2E-016: Allowed permission executes tool

- **Preconditions**: Permission card displayed.
- **Steps**: 1) Click allow on permission card. 2) Observe agent response and UI.
- **Expected**: Tool executed; result returned to model and displayed in UI; file modified.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (allowed → result returned)
- **Milestone**: M3
- **Status**: Draft

#### E2E-017: Local permission approval has no automatic deadline

- **Preconditions**: Permission card displayed; no user action.
- **Steps**: 1) Leave the permission card unanswered. 2) Confirm it remains
  visible and the tool call remains pending. 3) Choose Deny and observe the
  outcome.
- **Expected**: No countdown or automatic denial appears; the request remains
  pending until the explicit Deny action, and the tool is not executed.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (timeout → deny)
- **Milestone**: M3
- **Status**: Draft

#### E2E-018: Plan denies workspace mutation and plugin tools

- **Preconditions**: Plan mode active with Auto selected and a plugin agent tool registered.
- **Steps**: 1) Ask the Agent to call Write, Edit, and the plugin tool. 2) Ask it
  to run a Bash command that creates a marker file. 3) Repeat the Bash call
  with Ask selected and inspect the permission card.
- **Expected**: Write, Edit, and the plugin tool are not visible and direct
  attempts return `WRITE_DISABLED_IN_PLAN`, `EDIT_DISABLED_IN_PLAN`, or
  `PLUGIN_DISABLED_IN_PLAN`; no file is changed by those tools. Bash runs
  without a confirmation under Auto and may mutate; under Ask it waits for the
  ordinary permission card. No Chat-mode error or command exists.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (Plan policy)
- **Milestone**: M3
- **Status**: Documented (M6; E2E execution pending)

#### E2E-019: Workspace-outside paths follow permission mode

- **Preconditions**: Agent or Plan mode; project open; a readable file exists
  outside both the session project and scratch roots.
- **Steps**: 1) With Ask selected, ask the agent to `Read` the external file and
  observe the inline permission card. 2) Deny once and verify no content is
  returned. 3) Repeat and allow once; verify the tool result carries
  `root: "external"` and the canonical absolute path. 4) Switch to Auto and
  repeat with `Grep` or `Glob`; verify no card appears and the bounded result
  returns. 5) Repeat with Accept edits; verify the external read/search still
  asks for permission.
- **Expected**: An explicit outside path never hard-fails before the user can
  decide. Ask and Accept edits request permission; Auto executes. Denial,
  timeout, or cancellation returns `TOOL_DENIED` and performs no operation.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/15-workspace-ignore-rules.md`, `04-ux/03-permission-ux.md`
- **Acceptance**: E (workspace-outside permission policy)
- **Milestone**: M3
- **Status**: Automated (host-core protocol/unit coverage; desktop journey pending)

#### E2E-019e: Bounded search parameters stay portable across platforms

- **Preconditions**: Agent or Plan mode; project open; the host tool catalog is
  available on macOS, Linux, or Windows.
- **Steps**: 1) In Agent mode, inspect `Glob`/`Grep` in the first request
  without `ToolSearch`; confirm Plan also exposes both from its first request.
  2) Search with workspace-relative `path`, `include`, `headLimit`, and
  `outputMode: "filesWithMatches"` or `"count"`, first with a directory and
  then one explicit file. 3) Call `Read` with a directory and follow its
  structured Glob suggestion. 4) Repeat with the platform's native shell
  selected, without changing the tool arguments.
- **Expected**: The schemas expose the same bounded search controls on every
  platform; `Read` declares file-only input, `Glob` declares directory input,
  and `Grep` accepts a file or directory. `filesWithMatches` is accepted as the
  canonical output mode. A directory Read returns `INVALID_ARGUMENT` with
  `suggestedTool=Glob` and bounded args; the corrected call succeeds. Search
  results use workspace-relative paths inside the project and absolute paths
  only for approved external locations. No shell-specific path syntax is
  required, workspace-relative paths use `/` for platform separators while
  literal backslashes in POSIX filenames remain intact, and oversized results
  remain bounded.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/16-tool-result-limits.md`, ADR 0057, ADR 0069
- **Acceptance**: E (bounded cross-platform search)
- **Milestone**: M5
- **Status**: Unit-covered (host-core and agent-runtime); live multi-platform
  protocol capture pending. The workspace-relative path expectation is covered
  on Windows by `relative_display`, which must canonicalize the workspace root
  with the resolver's own spelling (`simple_canonicalize`) — std
  `Path::canonicalize` keeps the `\\?\` prefix there and silently degrades
  every label to an absolute path.

#### E2E-019a: Scratch-directory writes stay out of the workspace (D114)

- **Preconditions**: Agent mode; project open; session started.
- **Steps**: 1) Ask the agent to produce a temporary/intermediate file (e.g. a one-off script). 2) Observe where it writes and whether a permission card appears. 3) Check `git status` and the work-panel state. 4) On Windows with Git Bash selected, print `$PI_SCRATCH_DIR` and write a file through that path. 5) Delete the session and check `<data_dir>/scratch/`.
- **Expected**: The file lands under `<data_dir>/scratch/<sessionId>/` without a permission card; project `git status` stays clean; no file or Review artifact tab opens for the scratch write; Git Bash receives a directly usable forward-slash path matching the prompt, while PowerShell and cmd retain native path spelling; deleting the session removes the scratch directory.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md §4b`, `03-runtime/04-data-storage.md`
- **Acceptance**: E (temp files isolated from workspace)
- **Milestone**: M5
- **Status**: Partially automated (host-core unit tests: dual-root resolve, scratch write/read, Windows Git Bash `PI_SCRATCH_DIR` formatting, sweep)

#### E2E-019b: Scratch containment matches workspace defenses (D114)

- **Preconditions**: Agent mode; project open.
- **Steps**: 1) Attempt Write with `..` traversal from the scratch root. 2) Attempt Write through a symlink planted inside scratch pointing outside. 3) Attempt the same Write calls in Plan.
- **Expected**: Both escapes return `PATH_OUTSIDE_WORKSPACE`; Plan returns
  `WRITE_DISABLED_IN_PLAN` before any scratch path can make Write available.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md §4b`
- **Acceptance**: E (scratch root cannot be escaped)
- **Milestone**: M5
- **Status**: Automated (host-core unit tests)

#### E2E-019c: Permission modes govern high-risk approval (D115/D132)

- **Preconditions**: Agent mode; project open; global default `ask`.
- **Steps**: 1) With a newly inherited session and global default Ask every time, open the composer menu — expect Ask every time to be selected with no global-default/inherit label — then ask the Agent to write a workspace file and expect a permission card. 2) Switch the session chip to Accept edits; repeat — expect no card for Write/Edit but still a card for Bash. 3) Switch to Auto — expect no card for Bash either. 4) Create another inherited session after setting the global default to Accept edits in Settings — expect the composer chip and menu selection to display Accept edits directly and Write/Edit to be auto-allowed. 5) Switch the session to Plan, then Goal, with Auto set — expect Write/Edit/plugin denied but Bash allowed without confirmation.
- **Expected**: Effective mode = session override → global default → ask; Plan and Goal Write/Edit/plugin hard denies outrank every mode while their Bash follows the selected mode; the composer chip and menu always display the effective mode without default/inherit provenance.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md §6`, `03-runtime/04-data-storage.md`, `08-meta/decisions-log.md` (D115/D132)
- **Acceptance**: E (permission modes resolve and enforce host-side)
- **Milestone**: M5
- **Status**: Partially automated (host-core unit tests: evaluate matrix, Plan policy precedence, session grants under ask; renderer source test: effective-only composer options and selection)

#### E2E-019d: Bash tool sees the user's login-shell toolchain (D181)

- **Preconditions**: Agent mode; project open; the OS user has a login shell
  (default on macOS) whose profile exports at least one tool not on the app's
  minimal GUI PATH (e.g. nvm/Homebrew).
- **Steps**: 1) Ask the agent to print `$PATH` and run a toolchain check such
  as `command -v node && node -v`. 2) Compare with the PATH a fresh terminal
  shows for the same user. 3) Optionally remove `~/.bash_profile` temporarily
  and repeat on a machine where only `.zshrc` initializes the toolchain.
- **Expected**: The Bash tool resolves tools the user's own login shell
  exports (nvm, pnpm, Homebrew) even though commands run through bash; the
  probed login PATH is a subset of the effective child PATH (bash profile may
  prepend/dedupe). A missing or wedged user shell degrades to the host PATH
  without failing the tool.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md §5`, `08-meta/decisions-log.md` (D181), ADR 0045
- **Acceptance**: E (user toolchain visible in Bash tool)
- **Milestone**: M5
- **Status**: Automated (host-core unit tests: login-PATH probe + child-PATH injection)

#### E2E-MCP-stdio-login-path: Market stdio MCP finds uvx/npx after a GUI launch (issue #571)

- **Preconditions**: macOS; the app was started from Finder/Dock so `process.env.PATH`
  is the GUI default; `uvx` or `npx` exists on the user's login-shell PATH.
- **Steps**: 1) Install Fetch from the MCP market (`uvx mcp-server-fetch`).
  2) Test connection. 3) Repeat with an npx catalog entry.
- **Expected**: The stdio child env PATH includes the login-shell PATH (Homebrew /
  nvm / `~/.local/bin`) ahead of the GUI PATH, so spawn succeeds. A truly missing
  binary reports `command not found: uvx` rather than `spawn uvx ENOENT`.
  Windows keeps the inherited PATH.
- **Specs linked**: ADR 0045, D600, `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: Quality
- **Milestone**: M6+
- **Status**: Automated (`apps/desktop/test/user-login-path.test.mjs`,
  `apps/desktop/test/plugin-mcp.test.mjs`)

#### E2E-MCP-stdio-windows-npx: Official Node and fnm both start `npx` MCP (issue #789)

- **Preconditions**: Windows; Node is either the official `Program Files\nodejs`
  install (`node.exe` + `npx.cmd` + `npx-cli.js` on PATH) or fnm-managed and
  not on the GUI PATH.
- **Steps**: 1) Add Memory from the MCP market (`npx -y @modelcontextprotocol/server-memory`).
  2) Test connection. 3) Repeat with a user-typed `npx` server.
- **Expected**: Official Node rewrites to `node.exe` + `npx-cli.js` and
  handshakes. fnm is discovered from `%LOCALAPPDATA%\fnm\aliases\default` when
  PATH has no node. Remaining `.cmd` shims start through `cmd.exe /d /s /c`
  with quoted literal args, never `shell: true`. A Git-Bash extensionless
  `npx` next to `npx.cmd` is not chosen. Missing binaries still report
  `command not found: npx`.
- **Specs linked**: ADR 0038, D624, `07-plugins/04-plugin-security.md`
- **Acceptance**: Quality
- **Milestone**: M6+
- **Status**: Automated (`apps/desktop/test/mcp-stdio-launch.test.mjs`)

### Session Persistence

#### E2E-020: Session survives restart

- **Preconditions**: Session with message history exists.
- **Steps**: 1) Quit app. 2) Relaunch. 3) Open session list.
- **Expected**: Previous session appears; messages recoverable.
- **Specs linked**: `03-runtime/04-data-storage.md`, `03-runtime/10-session-state-machine.md`
- **Acceptance**: F (session survives restart)
- **Milestone**: M2
- **Status**: Automated (protocol smoke: host-level persistence; full restart lane manual)

#### E2E-021: Delete session works

- **Preconditions**: A session exists near the bottom of the expanded Sidebar.
- **Steps**: 1) Open its overflow menu. 2) Verify the menu and Delete action stay
  inside the window. 3) Repeat in a short window and scroll the menu to its last
  action. 4) Delete the session and observe the session list.
- **Expected**: The menu stays within the viewport, the last action is reachable,
  and the deleted session disappears from the list with its data removed.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: F (delete session)
- **Milestone**: M2
- **Status**: Unit-covered (`sidebar-floating-menu.test.mjs`,
  `sidebar-navigation.test.mjs`); rendered viewport scenario Draft

#### E2E-021a: Rename session title persists without changing activity

- **Preconditions**: A project-scoped session and a path-less session exist;
  at least one session has transcript history and one still has the default
  title. The standalone Session Titles plugin is enabled with
  `session.autoTitle`, `agent.complete`, and `models.list`, a deterministic test
  model, a custom prompt template, and thinking set to off.
- **Steps**: 1) Open a Sidebar session overflow menu or right-click a session
  row and choose Rename. 2) Enter a title with surrounding whitespace and
  save. 3) Verify the title in the Sidebar, topbar, Project archive, and
  Search. 4) Restart the app and verify the title again. 5) Try an empty and
  an over-80-Unicode-code-point title. 6) Open **Session Titles: Configure**,
  set the prompt to return a fixed test title, choose the deterministic test
  model, and save. 7) Send the first prompt in the default-title session. 8)
  Confirm the Sidebar and topbar immediately show the normalized
  48-character prompt fallback, then wait for `session:turnEnded` and the
  plugin completion, which replaces that fallback with the deterministic test
  title. 9) Manually rename that session and complete another turn. 10) Send
  the first prompt in another default-title session with the plugin disabled.
- **Expected**: The saved title is trimmed, displayed across every current
  session-summary surface, and persists after restart. The session stays in
  the same project or Temporary group, its transcript/message count and
  recent-activity ordering do not change, and historical notification title
  snapshots are unchanged. Empty and overlong values are rejected. Sending the
  first prompt immediately persists the normalized 48-character prompt fallback
  as a still-replaceable automatic title. With the plugin enabled, that fallback
  is replaced by the deterministic test title after the completed turn; after a
  manual rename, a later plugin completion cannot replace it. A session without
  the plugin keeps its prompt fallback, and a second prompt never changes it.
- **Upgrade regression**: In an isolated v22 fixture, manually rename a session
  to lowercase `new task` before opening it in the current build. After upgrade,
  the title remains `new task` with source `legacy`; first-prompt derivation and
  plugin title writes cannot replace it. New sessions still derive titles.
  Host regression: `v22_database_migrates_session_title_sources_without_losing_titles`.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/04-data-storage.md`, `03-runtime/06-host-rpc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, `07-plugins/03-plugin-api.md`,
  `07-plugins/13-plugin-permissions-matrix.md`, `04-ux/01-ui-ia.md`,
  `04-ux/08-component-spec.md`, ADR 0143, ADR 0323
- **Acceptance**: F (session metadata persistence), Quality (localized task
  management)
- **Milestone**: M2
- **Status**: Draft (run only in a capable environment when this surface changes)

#### E2E-021b: Session context menus expose hover submenus

- **Preconditions**: A session exists, including one whose scratch directory
  has not been created yet. The session can create a branch; worktree actions
  are available when it belongs to a Git project.
- **Steps**: 1) Open the session overflow menu or right-click its row. Hover Git
  and verify its second-level actions appear; click/tap Git to open it without
  hover. Use ArrowRight to enter, ArrowLeft to return, and Escape to close only
  the child menu. 2) Open Copy and choose Copy conversation ID, Copy session
  path, and Copy conversation link in turn; paste each clipboard value. 3) Enable
  developer mode, reopen the menu, and choose Open session path. 4) Disable
  developer mode and verify Open session path is absent while Copy remains.
- **Expected**: Git and Copy are menuitem/haspopup triggers; hover and click
  reveal their child menus without dismissing the root. ArrowRight enters a
  child, ArrowLeft and the first Escape return to its trigger, and a second
  Escape closes the root. Child actions remain keyboard reachable and execute
  once. The ID equals the session id, the path equals the Host-resolved scratch
  path for local sessions, and the link is the canonical conversation link.
  Remote sessions omit Copy session path. The system file manager opens
  `<data_dir>/scratch/<sessionId>/` when the developer-only Open session path
  action is chosen. The renderer never sends a filesystem path to Main.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/08-component-spec.md`, `04-ux/06-settings-ia.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (sessions), Quality (nested menu interaction)
- **Milestone**: M2
- **Status**: Component interaction automated (`worktree-menu-user-path.test.mjs`,
  `sidebar-menu-panel.test.mjs`, `sidebar-navigation.test.mjs`); full Sidebar
  desktop journey remains Draft

#### E2E-021c: Bottom-edge project menus stay beside their anchor

- **Preconditions**: The expanded Sidebar shows a retained project in its lowest visible row, with insufficient room below it for the project menu.
- **Steps**: 1) Open the project's Copy submenu; copy the project name and path
  and verify each pasted value. 2) Right-click the bottom project row and
  inspect the root menu. 3) Close it, open the row's overflow button, and hover
  Copy and Git. Verify both child menus and all actions stay inside the viewport.
- **Expected**: Both root-menu entry points place the menu immediately above
  the row when it cannot fit below; otherwise they open below. Copy yields the
  displayed project name and path. Child submenus remain attached to their
  trigger, flip sides as needed, and are neither clipped nor displaced.
- **Specs linked**: `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: Quality (sidebar interaction)
- **Milestone**: M2
- **Status**: Automated (`node scripts/e2e-three-column-layout.mjs --sidebar-only`, `sidebar-floating-menu.test.mjs`, `sidebar-navigation.test.mjs`)

#### E2E-036: Settings session-import destination retired

- **Expected**: Settings has no session-import tab or scan panel. Plugin session
  import remains available through the host-owned API and is covered by
  E2E-214 / E2E-215 / E2E-216. The legacy local-session scanner remains covered
  by its importer unit tests.
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/08-component-spec.md`,
  `07-plugins/03-plugin-api.md`, ADR 0319 / D645
- **Status**: Retired by D645; Settings UI removed

#### E2E-037: Core session-import project workflow retired

- **Expected**: Project binding and renderer refresh for imported sessions are
  verified through plugin-owned session import in E2E-216. Settings no longer
  invokes the legacy core session scanner/import path. Plugin ownership,
  durable project rows, and project archive behavior remain unchanged.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `04-ux/01-ui-ia.md`, `07-plugins/03-plugin-api.md`, ADR 0319 / D645
- **Status**: Superseded by E2E-214 / E2E-216

#### E2E-038: Settings owns the project archive destination

- **Preconditions**: App running with developer mode enabled, at least one configured provider, one retained project, and one archived project.
- **Steps**:
  1. Open Settings and inspect the complete settings rail.
  2. Open General and change the theme in its Appearance card using the
     searchable theme picker.
  3. Open AI and inspect the Permissions and Defaults cards, including the
     Command shell row; confirm Context management has no settings card.
  4. Open Shortcuts and inspect the Keyboard shortcuts card.
  5. Open Instructions and save global instructions.
  6. Open Models and inspect the provider studio and inline import action.
  7. Open Skills and MCP and confirm each has its own external-import action.
  8. Open Projects and Info in order.
  9. Search Settings for "project" or "archive".
  10. In Projects, compare each group strip's count with its rendered rows.
  11. Switch the sort control from Recent to Name.
  12. Search for a known session title, confirm the owning project is selected
      and its inspector lists matching sessions, then reveal more than eight
      sessions; clear the search with the clear affordance.
  13. Open the inspector menu, dismiss it with Escape and with an outside press.
  14. Restore the archived project, then activate it.
  15. Archive one project session, open it from Projects, and return to Projects.
  16. Return to the app shell and open Plugins.
- **Expected**: The rail contains exactly Appearance, Conversation, Shortcuts, Voice, Behavior, Models, Instructions, Skills, MCP, Subagents, Projects, System, Cloud sync, Remote Hosts, and Info in that order, each with its semantic Lucide icon (Palette / MessageSquare / Keyboard / Mic / Sliders / Bot / FileText / BookOpen / Server / Sparkles / Archive / Monitor / CloudDownload / Globe / Info), and no two destinations share a glyph. The flat directory is visually grouped under four muted, non-interactive headings — Preferences / 偏好 for Appearance, Conversation, Shortcuts, and Voice; Agent / 智能体 for Behavior, Models, Instructions, Skills, MCP, and Subagents; Workspace / 工作区 for Projects; System / 系统 for System, Cloud sync, Remote Hosts, and Info — with whitespace and no divider lines between groups; searching keeps the destination results flat and hides empty groups together with their headings. The selected row carries an accent-tinted pill and an accent glyph, and the content pane opens with that same glyph at page scale beside the title. There is no General and no AI destination (D684): theme and type are Appearance, the transcript and composer rows are Conversation, network/storage/power are System, and the permission mode, default mode and Command shell row are Behavior → Session defaults; an available selected shell is represented by the selector without a duplicate Configured status, while default, fallback, and no-effective-shell states remain explicit; Context management has no settings card; Keyboard shortcuts and global instructions have their own destinations; Developer lives under Info; Projects shows active, closed, and archived durable rows without a visibility toggle, grouping them under the always-visible Pinned / All projects / Archived strips (D168/D267/D455) with per-section counts in a one-column workbench. The destination renders no hero block and no page-level counter run: the intro is one quiet description line, and each group strip's count agrees with its rendered rows; a click selects a row without leaving Settings; sorting by Name reorders rows inside every section without hiding any; search matches project fields and session titles and reports a match count, a session-title result selects its owning project, lists sessions in the inspector by latest activity with relative update times, and reveals history in batches of eight; clearing the search restores the complete index. The inspector menu closes on Escape and on an outside press. Bootstrap completion and background refreshes do not return Settings or Extensions to the chat home; the destination changes only after an explicit navigation action. Restore keeps the archive open and activation returns to chat with the restored project retained in the sidebar. Opening an archived session succeeds before clearing its archived state, returns to chat with that session selected, and makes it visible in the project sidebar; returning to Project archive no longer shows that session as archived. The home sidebar and global page results have no standalone Projects destination; Settings search finds Projects; Plugins remains an independent app-shell destination.
  Cloud sync and Remote Hosts appear in packaged Settings with Experimental
  badges on their navigation rows and page titles; see `04-ux/06-settings-ia.md`.
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/01-ui-ia.md`, `03-runtime/11-provider-model-system.md`
- **Acceptance**: B (model configuration), F (project persistence)
- **Milestone**: M4
- **Status**: Unit-covered (`settings-project-archive.test.mjs`, `project-archive.test.mjs`, `sidebar-navigation.test.mjs`); rendered scenario Draft

#### E2E-091: Appearance card selects searchable theme and language pickers

- **Preconditions**: App running on macOS; the harness can exercise English,
  Simplified Chinese, Traditional Chinese, Turkish, German, Spanish, French,
  Korean, and Brazilian Portuguese system locales.
- **Steps**:
  1) Open Settings → Appearance.
  2) In the Appearance card, open the Theme picker. Confirm System, Light, and
     Dark are pinned at the top; select Dark and confirm the trigger shows Dark
     and the UI switches to dark.
  3) Select Light and confirm the UI switches to light.
  4) In the Language row, open the searchable picker. Confirm Auto is pinned
     at the top with the detected native name and that English, 简体中文,
     繁體中文, Türkçe, Deutsch, Español, Français, 한국어, and Português (Brasil)
     are listed by native name. With Simplified Chinese selected as the OS
     locale, selecting Auto applies Simplified Chinese; with Traditional Chinese
     selected, Auto applies Traditional Chinese; with Brazilian Portuguese
     selected, Auto applies pt-BR.
  5) Select English, 简体中文, 繁體中文, Türkçe, Deutsch, Español, Français,
     한국어, and Português (Brasil) in turn and confirm shell chrome switches
     to each locale without a reload. Confirm `zh-Hant` and `zh-HK` resolve to
     繁體中文, `de-DE` to Deutsch, `es-MX` to Español, `fr-CA` to Français,
     `ko-KR` to 한국어, and `pt`, `pt-BR`, `pt_BR`, and `pt-PT` to pt-BR.
  6) Type a native name or English name into the language search and confirm
     unmatched locales disappear. Type a theme name into the theme search and
     confirm unmatched options disappear.
- **Expected**: Theme and Language are searchable picker rows (not a card grid
  and not a native select); each closed trigger sizes to the current label,
  capped by the settings control column, without overflowing the row. Theme lists System, Light, and Dark,
  then any plugin themes after a divider. Auto resolves the OS locale through
  the main process (`app.getLocale()`), passes it safely through the sandboxed
  preload bridge, and reflects the detected native name inline in the menu;
  zh-TW, Turkish, German, Spanish, French, Korean, and Brazilian Portuguese
  are complete shell catalogs, including release-note copy; switching options
  updates the live UI without a reload.
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/02-i18n-english-first.md`
- **Acceptance**: A (core shell), H (localization)
- **Milestone**: M4
- **Status**: Partially automated in `scripts/e2e-settings-scroll.mjs` for pt-BR picker selection and live copy; the full locale list and OS Auto-resolution matrix remain documented.

#### E2E-091a: Theme changes keep the Windows frameless background aligned

- **Preconditions**: App running windowed on Windows with the OS in light mode.
- **Steps**: 1) Select Dark in Settings → Appearance → Interface. 2) Inspect the lower-left, lower-right, and resize edges while the shell settles and while collapsing/expanding the sidebar. 3) Select Light and repeat. 4) Switch the OS color preference and select System; repeat after the app resolves the system theme.
- **Expected**: The native BrowserWindow background follows the resolved application theme (`#181818` for dark and `#ffffff` for light), so no white strip appears around the frameless renderer during theme changes or shell animations. macOS keeps its transparent vibrancy behavior unchanged.
- **Specs linked**: `04-ux/06-settings-ia.md`, `02-architecture/01-architecture.md`
- **Acceptance**: A (core shell)
- **Milestone**: M5
- **Status**: Documented; native Windows validation pending

#### E2E-SETTINGS-ai-tab-pickers-use-in-app-menus

- **Preconditions**: App running with a host that reports at least one configured command shell and at least one catalog shell that is unavailable on this platform.
- **Steps**: 1) Open Settings → Appearance and open the Theme and Language pickers; note the pill trigger and the opened surface. 2) Open Behavior / 行为. 3) Open the Session defaults card's permission-mode control and select ask, accept-edits, and auto in turn. 4) Open the Session defaults card's Command shell control; inspect the unavailable entries and select an available shell. 5) Dismiss each open menu with Escape and then with an outside press. 6) Close Settings, reopen it, and read both rows.
- **Expected**: Both rows open the same anchored menu surface as the Appearance pickers — the app-drawn frame with the shared radius, elevation, border, and theme tokens, a check mark on the current option, and a hover/keyboard highlight — and never a platform-drawn `<select>` popup. Closed triggers size to the current label, capped by the settings control column. Unavailable shells stay listed with their suffix, are not selectable, and cannot become the current value. Escape and an outside press close the menu and restore focus to the trigger; arrow keys move between selectable options with wraparound. The selected permission mode and command shell persist across closing and reopening Settings, and the selected shell stays the only configured-state indicator.
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: A (core shell)
- **Milestone**: M4
- **Status**: Documented

#### E2E-039: Settings titlebar drag moves the window

- **Preconditions**: App running windowed on macOS with Settings open.
- **Steps**: 1) Record the window position. 2) Drag the empty 46px band above the settings rail. 3) Drag the same band above the content pane. 4) Use Back, search, Project archive, and navigation controls. 5) In light and dark themes, sample the top row's color above the rail and above the content pane.
- **Expected**: Either top-band drag moves the native window; Back, search, and navigation remain interactive and never initiate a window drag. The top row above the rail matches the rail surface (`#f4f4f4` light / `#000` dark) and the top row above the content pane matches the primary surface, so the band never renders a mismatched color over the rail.
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/01-ui-ia.md`
- **Acceptance**: Quality (key operations feel polished)
- **Milestone**: M5
- **Status**: Draft

#### E2E-043: Settings content follows window width

- **Preconditions**: App running windowed on macOS with Settings open.
- **Steps**: 1) Open General at the default window width and record the content-card width. 2) Expand the window to 1600px wide. 3) Open Models, Skills, MCP, and Projects. 4) Shrink the window to the supported 800px minimum.
- **Expected**: The right-side content cards expand and contract with the available pane at every tested width; the 275px rail and pane gutters remain stable; controls remain visible without clipping or horizontal page scrolling.
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/07-ui-design-system.md`
- **Acceptance**: Quality (key operations feel polished)
- **Milestone**: M5
- **Status**: Unit-covered (`settings-responsive-layout.test.mjs`); scenario Documented

#### E2E-040: Nested tool activity survives transcript reload
- **Preconditions**: Provider configured; project open; a turn can contain
  progress text, multiple search/tool/thinking items, and a failed or denied tool.
- **Steps**: 1) Stream progress paragraph A, a multi-item search segment,
  progress paragraph B, and a multi-item command segment with adjacent Bash rows.
  2) Inspect the open active group; manually close it while more output arrives.
  3) Complete the turn and confirm exactly one process disclosure owns every
  pre-answer row; close it and confirm the groups and run rows close with it, then
  reopen and confirm the group choice returns. 4) Open one completed group and one
  item, copy its output, close and reopen the group, then open a sibling group
  independently. 5) Switch `Transcript display` across Flat, Commands first, and
  Fully folded and inspect the grouping, group boundaries, where the run rows
  render, and the disclosure count. 6) Repeat with a singleton item and with the
  last activity group's literal final item set to a tool/search, thinking, failed
  tool, and denied tool. 7) Toggle `Show thinking` off and on and inspect the
  active-thinking, failure/recovery and completed states. 8) Remount rows within
  the retained pane, then reload the renderer and reopen the session.
- **Expected**: A turn renders exactly one process disclosure containing every
  pre-answer row, the `Bash`/run rows included; the trailing answer, assistant
  errors and stopped trailing text stay outside it, as do pending actions. The
  active group stays open while the turn runs. After completion, ordinary groups
  with at most four visible items and Task topology groups remain open; larger
  ordinary groups start closed. Closing the turn's disclosure hides groups and
  run rows under it, and reopening restores their defaults and explicit user
  choices. In
  Fully folded (the default), run rows stay inside their groups and only ordinary
  assistant progress text splits a group. In Commands first, run rows render as
  their own rows beside the groups, adjacent calls stay separate, a row's detail
  stays closed until opened, and a normal assistant progress message or a command
  ends a group. In Flat, no nested group renders and the rows keep transcript
  order inside the outer disclosure. Every mode keeps the disclosure count at one.
  A singleton has no group wrapper. No item payload opens itself except the
  display mode's Thinking default: a tool/search row stays a header until the user
  opens it, while a final thinking item never selects an earlier tool. The header
  reports `Running`, `Finished`, `Stopped`, or `Failed` with failure and stop
  outranking a normal finish, reads `Thinking` while the live step is reasoning,
  never repeats the current command, and omits the duration when none was
  recorded. When `Show thinking` is off, no completed reasoning row renders; only
  the live TextShimmer `Thinking` indicator remains while reasoning streams, and
  turning it back on restores the completed rows. Parent, child and sibling
  choices are independent; closing/reopening a parent preserves descendants, and
  streaming/completion does not override user-owned choices. Retained-pane
  remounts preserve choices; renderer restart reapplies defaults while tool names,
  arguments, results and statuses remain restored. Group headers show bounded
  running and issue summaries without marking the whole turn failed.
- **Specs linked**: `04-ux/01-ui-ia.md`,
  `04-ux/07-ui-design-system.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (chat stream), E (tools), F (persistence)
- **Milestone**: M3
- **Status**: Draft. Unit and style checks cover the display modes, Thinking
  defaults and header rules; this scenario remains the intended manual
  transcript-reload behavior.

#### E2E-041: Conversation minimap navigates long transcripts

- **Preconditions**: A session contains enough user and assistant turns to
  scroll beyond one viewport and densely fill the minimap, including assistant
  responses emitted as multiple fragments around tool activity; a
  second session has at least two eligible turn markers that still fit in one
  viewport.
- **Steps**: 1) Open the long session. 2) Scroll through the transcript and
  observe the active minimap marker. 3) Hover a marker and inspect its preview.
  4) Use keyboard focus to reach another marker. 5) Activate a marker. 6) Open a
  session with fewer than two eligible turn markers. 7) Open the
  multi-message session that still fits one viewport. 8) Resize the long session
  window taller until content no longer overflows, then shorter again. 9) At a
  short window height, inspect and activate the first and last markers near the
  minimap's vertical bounds, including from the titlebar-facing side.
- **Expected**: The rail contains one marker per visible user message;
  assistant and tool rows create no marker. The marker near the upper-third reading
  anchor exposes `aria-current`; hover and focus show the same localized sender
  and preview; nearby markers magnify horizontally without shifting the stack;
  activation smoothly scrolls to that user message;
  the rail is absent when fewer than two eligible markers exist **or** when
  content does not overflow one viewport; the rail reappears once overflow
  returns after a resize. Dense markers remain centered in the unobstructed
  span between the 46px titlebar and docked composer, compress uniformly, and
  remain interactive without entering the native window drag region. The
  empty-home and docked composer use the same horizontal width envelope, and
  the composer does not shrink when the minimap appears.
- **Specs linked**: `04-ux/08-component-spec.md`
- **Acceptance**: C (chat stream), Quality (keyboard and long-thread navigation)
- **Milestone**: M3
- **Status**: Draft

#### E2E-042: Pre-v7 storage archives via breaking reset; transcripts live in session files

- **Preconditions**: A fixture data directory contains a `pi.sqlite` whose
  `PRAGMA user_version` is between 1 and 6 (pre-D119 content-in-DB schema)
  with representative rows.
- **Steps**: 1) Start host-core against the fixture. 2) Create a session and
  append messages through host RPC. 3) Stop and restart host-core. 4) Reload
  the session through RPC and inspect the data directory.
- **Expected**: Host-core renames the legacy file to exactly one
  `pi.sqlite.v6.bak`, bootstraps a fresh schema-v7 database (index-only
  `messages`), writes `sessions/<id>.jsonl` with a session-header line plus
  one line per message, reloads the transcript from the file after restart
  with identical logical results, and deleting the session removes both the
  index rows and the session files. No Electron-owned persistence file is
  authoritative.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, ADR 0014
- **Acceptance**: F (persistence), H (reset failures are diagnosable)
- **Milestone**: M2
- **Status**: Unit-covered (`db::tests::archives_pre_v7_database_and_starts_fresh`,
  `sessions::tests::transcript_survives_reopen_from_file`,
  `sessions::tests::delete_session_removes_transcript_files`); full fixture
  scenario Draft

#### E2E-252: Session and folder drag/drop across projects

- **Preconditions**: Two projects are open in the sidebar; one holds an idle
  session, and one session somewhere is running a turn.
- **Steps**: 1) Drag the idle session row onto the other project group and drop
  it. 2) Reopen that session and read its transcript. 3) Attempt to drag the
  running session and, separately, open its session menu. 4) Drop a folder onto
  the projects list. 5) Drop a folder on the composer.
- **Expected**: The dragged idle session lists under the target project with its
  transcript, attachments, and tasks unchanged, and the move survives a restart
  because the session's project membership is persisted. The running session is
  not draggable, its context menu has no project-move list, and a move issued
  after a turn starts is rejected as busy rather than rebinding the agent.
  Dropping a folder on the projects list adds or switches to that project
  without creating a duplicate row, and a non-folder drop explains that a folder
  is required. Dropping a folder on the composer offers an explicit choice and
  never attaches directory contents: "Open as project" opens the project, and
  "Reference folder" inserts the literal path. The dragged row paints at reduced
  opacity and the eligible group shows an accent outline.
- **Specs linked**: `04-ux/09-interaction-patterns.md` §8,
  `03-runtime/06-host-rpc-protocol.md` (session.moveProject)
- **Acceptance**: D (project membership and workspace switching), Quality
  (drag/drop feedback and keyboard fallback)
- **Milestone**: M5
- **Status**: Documented; source-contract covered
  (`session-project-move.test.mjs`); automation pending

### Plugin Load / Command / Disable

#### E2E-022: Load local plugin

- **Preconditions**: App running; sample plugin available at local path.
- **Steps**: 1) Open Extensions from the sidebar footer Plugins icon. 2) Choose Load local plugin from the header overflow menu. 3) Enable it with the row switch.
- **Expected**: Plugin loads; manifest validated; contributions registered; the row appears under Active with a Local tag.
- **Specs linked**: `07-plugins/01-plugin-system.md`, `07-plugins/05-plugin-lifecycle.md`
- **Acceptance**: G (load local plugin)
- **Milestone**: M4
- **Status**: Automated (protocol smoke: plugins.loadDev)

#### E2E-022A: Create a plugin from a template

- **Preconditions**: App running; an empty folder available.
- **Steps**: 1) Open Extensions. 2) Choose New plugin from template in the header overflow menu (or use the empty-state button). 3) Pick each of the four templates in turn and read its description. 4) Choose the folder. 5) Cancel the folder picker on a second attempt.
- **Expected**: The picker lists exactly `panel-basic`, `agent-tool-basic`, `skill-pack`, `full-demo`, each named and described in the active locale; choosing a folder writes the template files, loads the plugin as a development plugin, refreshes the list, then opens that folder as the active project — the app lands on chat with the new folder as the workspace, it appears in the sidebar project list, and the toast reads "<name> created, loaded, and opened for development"; the plugin's contributions are immediately usable and the built-in plugin-development skill is active in the new workspace. That skill teaches the current global `pi` API (`onLoad()` plus `pi.commands.register`) and the fixed `window.pluginBridge` boundary, and does not teach the retired `onLoad(pi)` / `pi.registerCommand` shape. A canceled folder picker changes nothing and reports no error.
- **Specs linked**: `07-plugins/10-plugin-devex.md`, `../../plugin-development.md`, ADR 0039
- **Acceptance**: G (create plugin from template)
- **Milestone**: Post-MVP
- **Status**: Automated in part (`apps/desktop/test/plugin-template-action.test.mjs`: channel, template-id parity with the devkit, locale coverage, canceled-pick ordering, project activation); UI walk-through Documented

#### E2E-022B: Development plugin hot reload

- **Preconditions**: A plugin loaded from a local folder and enabled.
- **Steps**: 1) Edit `main.js` to change a command title and save. 2) Save several files at once. 3) Introduce a syntax error and save. 4) Fix the error and save. 5) Add a new permission to `manifest.json` and save. 6) Open the development-plugin card's More actions menu and choose Reload. 7) Edit again and restart the app.
- **Expected**: The single edit reloads the plugin without re-picking the folder and the command palette shows the new title; a save burst produces one reload, and writes under `dist/` or `node_modules/` produce none; the syntax error reports a reload failure without crashing the app, and the fixing save recovers the plugin; the added permission refuses automatic reload with `PERMISSION_DENIED`, while the explicit Reload action loads the registered folder, refreshes the permission ceiling, and reports success; a later edit uses the refreshed ceiling, and after a restart the folder is still watched.
- **Specs linked**: `07-plugins/10-plugin-devex.md` §7, `07-plugins/13-plugin-permissions-matrix.md`, ADR 0039, ADR 0075
- **Acceptance**: G (hot reload), D (permissions cannot widen without review)
- **Milestone**: Post-MVP
- **Status**: Automated in part (`apps/desktop/test/plugin-hot-reload.test.mjs`: debounce, ignore list, permission ceiling, recovery, teardown); manual edit loop Documented

#### E2E-022C: Check, pack, install round-trip

- **Preconditions**: A scaffolded plugin directory.
- **Steps**: 1) `pnpm pi-plugin check <dir>`. 2) Delete the file named by `main` and run `check` again; repeat with the file named by `manifest.renderer` in a plugin that declares one. 3) Restore it, declare `contributes.skills` without `agent.prompt.inject`, and run `check` again. 4) `pnpm pi-plugin pack <dir>`. 5) Install the resulting `.piplug` from the plugins page. 6) Ask the agent to run `PluginCheck` and `PluginPack` on the same directory.
- **Expected**: A scaffolded plugin checks clean and reports its file count and size; the missing `main` or `manifest.renderer` entry is an error that blocks `pack`; the inert-skills case is a warning that does not block; `pack` writes `dist/<id>-<version>.piplug` with store-only entries and prints its sha256; the package installs through the normal permission review and appears under Active; the agent tools produce the same verdicts and refuse any directory outside the session workspace.
- **Specs linked**: `07-plugins/10-plugin-devex.md` §5–§6, `07-plugins/06-plugin-packaging.md`, ADR 0039
- **Acceptance**: G (local packaging round-trip)
- **Milestone**: Post-MVP
- **Status**: Automated in part (`packages/plugin-devkit` vitest: scaffold→check→pack per template, store-method headers, every check rule, and a parity test that pins the `permission.high-risk` list to the permissions matrix's high rows); install step Documented

#### E2E-023: Plugin command in global search and executes

- **Preconditions**: Plugin loaded and enabled.
- **Steps**: 1) Open global search (Cmd/Ctrl+K or Cmd/Ctrl+Shift+P). 2) Find the plugin command under the Commands section. 3) Execute.
- **Expected**: Command appears in global search results; execution produces expected result.
- **Specs linked**: `07-plugins/09-plugin-command-palette.md`
- **Acceptance**: G (plugin command appears and executes)
- **Milestone**: M4
- **Status**: Draft

#### E2E-PLUGIN-command-ownership: Command registration respects plugin ownership

- **Preconditions**: Two plugins run in separate plugin host processes.
- **Steps**: 1) Register a command from one plugin. 2) Attempt to replace and
  unregister it from the other plugin. 3) Update and unregister it from the
  owner. 4) Repeat with a load-time collision and concurrent registrations.
- **Expected**: Cross-plugin replacement rejects with `CONFLICT`; cross-plugin
  removal rejects with `PERMISSION_DENIED`. Rejected calls leave the original
  handler runnable. Same-owner updates preserve the ID; repeated removal is
  harmless; released IDs can be reused. A failed plugin load or unloading a
  losing registrant does not remove the winning command. Concurrent calls
  admit exactly one owner.
- **Specs linked**: `07-plugins/03-plugin-api.md`, `07-plugins/12-plugin-ipc-and-host-services.md`
- **Acceptance**: G (plugin command isolation)
- **Milestone**: M4
- **Status**: Automated — `pnpm test:e2e:plugin-command-ownership` exercises
  the public plugin API through real plugin host processes and the host broker.

#### E2E-024: Plugin registers and calls agent tool

- **Preconditions**: Plugin loaded; plugin declares an agent tool.
- **Steps**: 1) Ask agent to use the plugin's tool. 2) Observe permission card if required. 3) Allow.
- **Expected**: Tool registered with forced prefix (`plugin_<id>_<name>`); call succeeds.
- **Specs linked**: `07-plugins/03-plugin-api.md`, `07-plugins/13-plugin-permissions-matrix.md`
- **Acceptance**: G (plugin agent tool)
- **Milestone**: M4
- **Status**: Automated (protocol smoke: dispatch roundtrip host->runner->host; in-app JS execution via PluginRuntime)

#### E2E-024G: Marketplace detail sheet shows README, permissions, versions

- **Preconditions**: Official marketplace catalog available.
- **Steps**: 1) Open Extensions → Marketplace. 2) Open details for `demo.workspace-summary`. 3) Inspect README / risk-grouped permissions / version rows. 4) Pick a version and install after permission review. 5) Dismiss the sheet with Escape and by clicking the scrim.
- **Expected**: Detail sheet loads via `market.getDetail`; README, safety notes, and per-risk permission explanations render; the picked version drives the sticky install action; the sheet mounts on the viewport overlay host above the expanded sidebar; Escape and scrim both close the sheet without closing the permission dialog underneath.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`
- **Acceptance**: G (marketplace detail UX)
- **Status**: Documented

- **Focus regression**: In light and dark themes, open a marketplace card and press Escape. Like pointer dismissal, Escape leaves no line or focus ring on the card. Then use Tab and Shift+Tab: the detail button shows a complete, unclipped ring, and Install remains separately focusable. Automated focus-state regression: `node scripts/e2e-plugin-detail-focus.mjs`; verify the rendered ring visually.

#### E2E-PLUGIN-reviews-public-reads: Public ratings and reviews stay read-only in the desktop

- **Preconditions**: Extensions reachable with at least one installed and one marketplace plugin the centre knows, plus a second run against a centre that has no review API.
- **Steps**: 1) Open Extensions → Installed and, without visiting Marketplace, confirm a published plugin's card shows a rating chip only when the centre returned a summary. 2) Open a marketplace card's detail sheet and read the ratings summary between Permissions and Versions; press "See all reviews". 3) In the drawer, filter by sentiment and switch between newest and most helpful; page with Load more. 4) Inspect the composer: it is disabled, and its one action is the link to the plugin centre page. 5) Press Escape once (only the drawer closes) and again (the sheet closes). 6) Reopen the sheet and confirm the drawer left its scroll position untouched. 7) Repeat against the centre without review support and read the summary.
- **Expected**: Installed and marketplace ids are batched into one summary read that never requires a Marketplace refresh; an unavailable centre shows no fabricated zeros, and the detail summary says ratings are unavailable — while the review entry stays reachable and the drawer retries its own list, so its disabled composer and its web link (official fallback until the host reports `reviewUrl`) are never lost; a successful summary read replaces the ratings for the ids just requested, so a plugin the centre stops serving loses its stale rating chip; the chip rides the card's existing metadata line and adds no row; the drawer covers the mounted detail sheet, keeps its scroll position, closes on the first Escape only, returns focus to its opener (Escape claims the key with preventDefault/stopPropagation; the covered sheet is inert and Tab is trapped inside the drawer), appends pages deduplicated by review id, and drops an answer for a filter the user already left; a review's version reads as user-reported, never as an installed version; the composer accepts no input, and the only write path is the real link opened through `browserOpenExternal` in the system browser on a primary or middle click (right-click stays with the platform menu), with a failed open reported as a toast; no sign-in, vote, report, or review-writing UI exists in any locale.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md` §7, `07-plugins/14-plugin-roadmap.md`
- **Acceptance**: G (Extensions page) + Security
- **Status**: Automated fixture (`node scripts/e2e-plugin-reviews-drawer.mjs`: three probes — full path with card chip, section order, paging/dedup, filter stale-drop, error+retry, link href/middle-click-only/failure toast, Tab trap + inert, Escape/focus/scroll restoration; stale-summary replacement; unavailable-summary drawer entry + retry + fallback link) plus unit-covered (`plugin-reviews-logic.test.mjs`, `plugin-reviews-surface.test.mjs`)

#### E2E-024F: Refresh the official marketplace catalog

- **Preconditions**: Network available to `plugins.aiuo.net`.
- **Steps**: 1) Open Extensions → Marketplace. 2) Use the header Refresh marketplace action. 3) Confirm the official catalog refreshes and the card grid updates.
- **Expected**: The marketplace uses `plugins.aiuo.net/catalog.json`; the page has no source selector; the cached official catalog remains available if refresh fails.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`
- **Acceptance**: G (remote marketplace source)
- **Status**: Documented / host-core unit covered

#### E2E-024P: The marketplace ignores legacy source settings

- **Preconditions**: Profiles can be seeded with legacy `pluginMarketSource` values `github`, `mirror`, and `custom`, including a custom URL. Network or a local request stub is available for the official catalog.
- **Steps**: 1) Start the app with each seeded profile. 2) Open Extensions → Marketplace and refresh. 3) Inspect the catalog request. 4) Install a published plugin from the marketplace.
- **Expected**: The page has no source controls; every profile requests `https://plugins.aiuo.net/catalog.json` and ignores the persisted source and custom URL; install uses the official platform resolve path, with the official catalog URL as the verified fallback; legacy settings remain readable and require no migration.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md` §2
- **Acceptance**: G (remote marketplace source)
- **Status**: Documented / host-core unit covered

#### E2E-024Z: Windows curl handles offline revocation checks and localized errors

- **Preconditions**: Windows x64 host with curl built against Schannel. For the
  offline-revocation case, use a proxy route that can reach the HTTPS fixture
  while its certificate revocation distribution point is unavailable. For the
  diagnostic case, force the catalog request to fail with localized, non-UTF-8
  curl output (a deterministic fake curl may emit GBK stderr and exit 35).
- **Steps**: 1) Open Extensions → Marketplace. 2) Refresh the catalog and
  install a package through the system proxy while the revocation distribution
  point is offline. 3) Confirm the installed curl advertises
  `--ssl-revoke-best-effort` and inspect the verified package. 4) Force a
  localized curl/Schannel failure, refresh again, and inspect the error toast.
- **Expected**: When the installed Schannel curl supports the option, catalog
  and package requests tolerate an unavailable revocation distribution point
  without disabling certificate verification; package size and SHA-256 checks
  still gate installation. A real network/TLS failure remains
  `PLUGIN_NETWORK`, with localized diagnostics readable and no Unicode
  replacement characters.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`,
  `03-runtime/07-process-model.md`, ADR 0177
- **Acceptance**: G (remote marketplace source)
- **Status**: Documented; host-core unit covered; Windows proxy/TLS validation pending

#### E2E-024B: Marketplace install with permission review

- **Preconditions**: App running; official market catalog available.
- **Steps**: 1) Open Extensions → Marketplace. 2) Install `demo.workspace-notes`. 3) Read the risk-tiered permission dialog. 4) Accept high-risk permissions.
- **Expected**: Permissions are grouped High / Medium / Low with plain-language explanations before any download; the review dialog mounts on the viewport overlay host above the expanded sidebar; the host refreshes marketplace metadata immediately before download so a stale UI cache cannot pair an old checksum with a current package; plugin installed from the marketplace package, checksum verified, permissions granted, panel/tools available; the installed tab and risk-grouped rows reflect the new plugin without a separate overview card row.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`, `07-plugins/13-plugin-permissions-matrix.md`
- **Acceptance**: G (marketplace install + permission review)
- **Status**: Documented / host-core covered by unit tests + protocol methods

#### E2E-024R: Install a center-published plugin from the official marketplace

- **Preconditions**: A `schemaVersion: 2` catalog served from the distribution repository, with one plugin carrying provenance and an approved review verdict, its package under `packages/`. A second fixture declares `artifactBaseUrl` for the mirror/enterprise case.
- **Steps**: 1) Open a plugin's detail sheet. 2) Read the Source section. 3) Install the selected version through the official resolve path. 4) Repeat with a local resolve stub that returns no source, exercising the official catalog URL fallback and an `artifactBaseUrl` fixture.
- **Expected**: Center-published plugins appear in the fixed official catalog; the detail sheet shows the source repository, commit, and builder before install; resolve mirror bytes match the platform digest, while catalog fallback bytes match the catalog digest; the installed record keeps publisher, trust tier, and source pin.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`, `07-plugins/15-plugin-center.md`
- **Acceptance**: G (publisher-owned source distribution)
- **Status**: Documented / host-core covered by unit tests

#### E2E-024S: Package host allowlist refuses an untrusted download

- **Preconditions**: An isolated host-core test uses `PI_DESKTOP_PLUGIN_MARKET_URL` to load a catalog fixture whose version URL points at a host outside the allowlist, plus fixtures with embedded credentials and plain HTTP.
- **Steps**: 1) Refresh the fixture catalog. 2) Inspect the plugin card and detail sheet. 3) Attempt an install. 4) Repeat with a private catalog whose packages sit on its own host.
- **Expected**: The row does not offer an install action for an off-allowlist URL; an attempted install fails with `PLUGIN_MARKET_UNTRUSTED_HOST` naming the rejected host before any request leaves the machine; a credentialed URL and non-loopback plain HTTP are refused the same way; a private catalog can still serve packages from the host that served it, without widening the allowlist for third-party hosts.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`, `07-plugins/04-plugin-security.md`
- **Acceptance**: G (marketplace download boundary)
- **Status**: Documented / host-core covered by unit tests

#### E2E-024T: A withdrawn version is not offered, installed, or hidden

- **Preconditions**: A catalog where the newest version is `yanked` with a reason, an older version is live, and the yanked version is installed locally.
- **Steps**: 1) Open the plugin's detail sheet. 2) Inspect version history. 3) Select the withdrawn version. 4) Run Check for updates. 5) Run Apply automatic updates. 6) Inspect the installed row.
- **Expected**: The offered latest version is the newest non-yanked one; the withdrawn version stays in history with its reason and a struck-through number; selecting it disables the install action with withdrawn copy rather than not-yet-published copy; an explicit install of it fails with `PLUGIN_MARKET_YANKED` and the reason; no update is offered when the newest live version is not newer than the installed one, so a downgrade is never presented as an update; the installed row is flagged as needing attention and the plugin keeps running.
- **Specs linked**: `07-plugins/08-plugin-signing-updates.md`
- **Acceptance**: G (incident response propagation)
- **Status**: Documented / host-core covered by unit tests

#### E2E-024U: Trust tier and host version bound are enforced by the client

- **Preconditions**: Test runs use `PI_DESKTOP_PLUGIN_MARKET_URL` for a catalog claiming `trust: "verified"`, a catalog with an unrecognised tier, and a version whose `minPiDesktop` exceeds the running host.
- **Steps**: 1) Load the fixture catalog. 2) Inspect the card and detail sheet badges. 3) Attempt to install the version pinned to a newer host. 4) Repeat with a `minPiDesktop` that is a range expression rather than a version.
- **Expected**: A `verified` claim from a non-official source renders as community with no shield; an unrecognised tier renders as unknown; the version requiring a newer host is not offered and an explicit install fails with `PLUGIN_HOST_TOO_OLD` naming both versions; an unparseable bound is ignored rather than making the plugin uninstallable.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`, `07-plugins/15-plugin-center.md`
- **Acceptance**: G (trust presentation)
- **Status**: Documented / host-core covered by unit tests

#### E2E-024V: Publisher pins a version with pi-plugin publish

- **Preconditions**: A plugin directory inside a git repository with an https or ssh origin remote.
- **Steps**: 1) Run `pi-plugin publish` with uncommitted changes. 2) Commit and tag, then rerun. 3) Rerun on a commit with no tag. 4) Rerun with a remote containing credentials. 5) Feed the resulting registry entry through the center's catalog build and the client preflight.
- **Expected**: A dirty worktree is refused so the submitted commit describes the packaged bytes; a clean run writes the package, its sha256, the canonical repository URL, the tag ref, the resolved commit, and the plugin subdirectory into a submission payload; an untagged commit is accepted with a warning; a credentialed remote is refused; the generated catalog passes the same preflight the client ships.
- **Specs linked**: `07-plugins/10-plugin-devex.md`, `07-plugins/15-plugin-center.md`
- **Acceptance**: G (publisher tooling)
- **Status**: Documented / devkit covered by unit tests

#### E2E-024C: Plugin package install and auto-update path

- **Preconditions**: Marketplace catalog has a newer version or local `.piplug`.
- **Steps**: 1) Install package from the header overflow menu. 2) Enable auto-update from the row overflow menu. 3) Reopen Extensions while the marketplace is slow or unavailable and confirm the Installed surface and Marketplace tab remain usable. 4) Confirm the installed list refreshes update metadata from the local catalog. 5) Run Check for updates, then Apply automatic updates.
- **Expected**: The Extensions surface does not wait for a remote request during its silent cache-only check; the row moves to Updates available and the update banner reports the count; the highest semantic version is selected even when the catalog version array is not newest-first; the explicit check fetches the current catalog and uses the cached catalog offline; permissions the new version adds are tagged New in the review dialog; auto-update applies only when the permission diff is empty or pre-granted.
- **Specs linked**: `07-plugins/06-plugin-packaging.md`, `07-plugins/08-plugin-signing-updates.md`
- **Acceptance**: G (package install + update policy)
- **Status**: Documented

#### E2E-024Q: Marketplace update diagnosis and release-data gate

- **Preconditions**: A catalog fixture contains an installed `0.5.0` plugin, a
  `0.5.1` version, and either unsorted version entries or intentionally missing
  package metadata.
- **Steps**: 1) Record the plugin ID, installed version, displayed latest
  version, catalog URL, and local cache path. 2) Fetch the live/fixture catalog
  and inspect the exact entry. 3) Inspect the installed registry separately.
  4) Run `pnpm check:marketplace -- --url <catalog> --plugin <id>`. 5) Run the
  update check against the fixture.
- **Expected**: The failure is classified as catalog data, fetch/cache,
  host comparison, IPC propagation, or renderer presentation before code is
  changed; the preflight reports every missing checksum, URL, package size, or
  permissions field; an incomplete release may be shown for discovery but is
  not installable; a valid `0.5.1` is detected regardless of catalog ordering;
  the final fix includes a regression test for the diagnosed boundary.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`,
  `07-plugins/08-plugin-signing-updates.md`,
  `06-delivery/03-ai-development-workflow.md`
- **Acceptance**: G (marketplace update diagnosis)
- **Status**: Documented / preflight script

#### E2E-024H: Installed plugins surface state, risk, and failures

- **Preconditions**: At least one enabled plugin, one disabled plugin, and one plugin whose load failed.
- **Steps**: 1) Open Extensions → Installed while plugin changed events are arriving in a burst. 2) Read the tab and group counts. 3) Confirm the failed plugin sits under Needs attention with its error message. 4) Search by author and by permission. 5) Clear the search. 6) Inspect enabled panel-only, update-ready, settings-bearing, and disabled plugin cards.
- **Expected**: The page remains usable during transient host backpressure: identical plugin and extension registry refreshes coalesce, and renderer-facing RPC calls retry explicit `HOST_OVERLOADED` responses with bounded backoff before surfacing an error. Plugins group as Needs attention / Updates available / Active / Turned off with counts; `status: "error" | "load_error"` renders the error message inline instead of being silent; each plugin is a card in an auto-filling grid, defaulting to a quiet name/id/version summary (plus a rating chip when the centre has one), while a Details disclosure reveals risk-tinted permission chips, capabilities, and resident service status; the single scope trigger opens explained Off / This project / Everywhere choices and the project picker; card icon actions expose hover/focus labels; the result count reflects the filtered subset and clearing restores every group.
- **Card actions**: Installed cards never show an Open panel shortcut, even when enabled with a declared panel. A panel-only card keeps scope and overflow controls; an enabled update-ready card keeps its versioned update action; enabled declared settings remain reachable. Panel opening remains available through the plugin launcher.
- **Specs linked**: `04-ux/01-ui-ia.md`, `07-plugins/13-plugin-permissions-matrix.md`
- **Acceptance**: G (installed plugin management)
- **Status**: Documented

#### E2E-024D: Isolated plugin panel host bridge

- **Preconditions**: Plugin with `ui.panel` enabled.
- **Steps**: 1) Set the app language to English and open a panel whose manifest declares localized `ui.title.en` and `ui.title.zh-CN`; confirm the native window/launcher identity remains available without a host-rendered title. 2) Set the app language to Simplified Chinese and reopen the panel; confirm the panel content remains plugin-owned. 3) While the panel stays open, switch the app language to Korean and confirm the live `appearance:changed` event updates the panel controls, safe-area reminder, and accessible labels without reopening it. 4) Open the panel on macOS, Windows, and Linux; confirm the same frameless 46px drag band, fixed top-right capsule fully contained inside that band, and exactly three accessible controls. 5) Exercise minimize, maximize, restore, close, keyboard focus, light/dark themes, page-defined light/dark backgrounds, and reduced motion on every platform. 6) Render a plugin-owned titlebar/toolbar; verify fixed/sticky UI uses `--pi-plugin-titlebar-height`, its interactive controls use `no-drag`, and clicks outside the capsule in the top 46px are treated as window dragging. 7) On Windows with classic scrollbars, scroll a panel with content overflow and inspect the right edge. 8) Open a development plugin and confirm the localized reminder explains that the top 46px is not clickable outside the capsule. 9) Reopen a minimized panel. 10) Invoke panel bridge APIs (`ui.showToast`, optional fs/net with grants). 11) Close the panel from the capsule and by disabling or uninstalling the plugin. 12) Repeat with a panel and a docked work-panel view open and quit the app, then read the main-process log.
- **Expected**: Panel runs in its sandboxed window/partition; all three platforms use one host-owned frameless chrome contract with no native traffic lights, host-rendered title, or application menu; the top drag band is exactly 46px, and the minimal capsule stays fixed at the top-right without exceeding it. The capsule contains minimize/maximize-or-restore/close, follows the plugin page's surface/text colors, and never forces a black surface onto a light page. A v2 page marked `pi-plugin-chrome` uses `--pi-plugin-titlebar-height` and starts its own content directly below the 46px band without an additive duplicate spacer; a legacy page keeps the compatibility offset. A panel's stable scrollbar gutter is scoped to its actual content scroller; Windows does not show a second root-level empty side rail outside the page surface. The plugin owns its title and toolbar; the host drag strip remains usable, blocks clicks outside the capsule, and development panels alone show the reminder. Reopening restores the existing panel; switching to Korean while the panel remains open updates the host capsule, reminder, and accessible labels in place; bridge calls remain permission-checked and the host remains stable on panel close. Closing a panel must not throw a main-process `TypeError: Object has been destroyed` or show an uncaught-exception dialog, and neither closing a panel nor quitting with panels and docked views open may log a panel-bridge failure for the page that is closing: a call from a page that is already gone is settled, and the panel and view pages are gone before the plugin runtime and the host stop.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, `04-ux/07-ui-design-system.md`, `07-plugins/01-plugin-system.md`, `07-plugins/03-plugin-api.md`, `07-plugins/04-plugin-security.md`, `07-plugins/12-plugin-ipc-and-host-services.md`, ADR 0081, ADR 0082, ADR 0092, ADR 0093
- **Acceptance**: G (isolated panel)
- **Status**: Documented

Initial-load timeout check: Open a fixture panel from the plugin launcher
whose page load remains pending. After 15 seconds, the open request must report
`PANEL_LOAD_TIMEOUT` through the initiating action and destroy the hidden
window; opening a normal panel afterward must still work.

#### E2E-024AA: Plugin-owned UI follows the host locale

- **Preconditions**: A loaded plugin with a panel or settings destination, and a plugin process subscribed to `pi.events.on("appearance:changed")`.
- **Steps**: 1) Call `pi.app.getLocale` / `app.getAppearance` and confirm the tag matches Settings → language. 2) Switch the app language while the plugin stays loaded. 3) Confirm generated `contributes.settings` titles remain the author-language strings. 4) Confirm the plugin process and any open panel receive `appearance:changed` with the new `locale` and restyle their own copy.
- **Expected**: The host publishes language only. Plugin-owned copy changes without a reload. The generated settings sheet does not parse `{ en, "zh-CN" }` maps. Host-owned identity still follows `manifest.i18n` (ADR 0267).
- **Specs linked**: `07-plugins/03-plugin-api.md`, `07-plugins/02-plugin-manifest-schema.md`, `04-ux/02-i18n-english-first.md`, ADR 0280
- **Acceptance**: G (plugin i18n)
- **Status**: Automated in part (`apps/desktop/test/plugin-settings.test.mjs`, `plugin-work-panel-views.test.mjs`); UI walk-through Documented


#### E2E-024Y: Large-file plugin reads and dropped-file grants stay host-gated

- **Preconditions**: A test plugin declares `fs.read`; the workspace contains a
  readable log and a protected credential fixture; the plugin panel is open.
- **Steps**: 1) Pick a directory and open a large log. 2) Confirm initial page,
  search, follow, and a file-growth poll complete through `fs.stat` and bounded
  `fs.readRange`. 3) Drag a regular file into the panel and open it. 4) Drag a
  second file or forge an absolute path with the first grant and retry. 5)
  Reload/unload the plugin and retry the old grant.
- **Expected**: Directory reads remain relative to the selected root and are
  permission/audit checked. Range reads reject invalid values and lengths above
  8 MiB, return an empty byte array at EOF, and preserve total size. A real
  drop creates a one-file, read-only, memory-only grant; the dropped file uses
  the same paging/search/follow engine, while another path, a protected path,
  and a grant after unload fail closed with `PERMISSION_DENIED` or `NOT_FOUND`.
  No renderer worker or raw plugin `node:fs` path is used.
- **Specs linked**: `07-plugins/03-plugin-api.md`,
  `07-plugins/04-plugin-security.md`, `07-plugins/12-plugin-ipc-and-host-services.md`,
  `07-plugins/13-plugin-permissions-matrix.md`, ADR 0190
- **Acceptance**: Security + G (plugin host services)
- **Status**: Unit/integration-covered; real drag gesture remains manual

#### E2E-PLUGIN-fetch-redirect-policy

- **Preconditions**: Current-main task candidate, built workspace packages,
  real Node plugin child process and two loopback HTTP fixtures; no real user
  profile, provider or credentials.
- **Steps**: Load the example probe plugin and invoke its `probe.fetch` operation
  through the production panel bridge. Query capabilities, request error/manual/
  follow, and repeat against the injected single-hop transport. Exercise invalid
  modes, missing grants, disallowed targets, relative/missing Location, loops,
  and timeout. Test 301/302/303/307/308 and default compatibility.
- **Expected**: Error returns REDIRECT_DISALLOWED and manual returns the original
  response, both with zero target requests. Follow reaches the target only after
  egress authorization. Error codes survive child IPC; refusals are audited.
- **Specs linked**: `07-plugins/03-plugin-api.md`, `07-plugins/04-plugin-security.md`
- **Acceptance**: G + Security
- **Milestone**: Post-MVP plugin API
- **Status**: Automated protocol E2E via `pnpm test:e2e:plugin-fetch-redirect`.
  The sample panel's native-window gesture remains manual; no desktop is attached.

#### E2E-024E: High-risk plugin APIs require grants

- **Preconditions**: Notes plugin installed with explicit grants.
- **Steps**: 1) Call `fs.writeText` / `net.fetch` / `shell.openExternal` through plugin runtime or panel bridge. 2) Revoke one permission and retry.
- **Expected**: Granted calls succeed with audit; revoked/undeclared calls fail with `PERMISSION_DENIED` and do not crash the app.
- **Specs linked**: `07-plugins/13-plugin-permissions-matrix.md`, `07-plugins/04-plugin-security.md`
- **Acceptance**: Security + G
- **Status**: Documented

#### E2E-024W: Plugin clipboard history captures bounded text and images

- **Preconditions**: The app is running; a test plugin declares and is granted
  `clipboard.read`; the Composer can receive one text paste and one image paste.
- **Steps**: 1) Paste text into the Composer, paste an image into the Composer,
  then invoke `pi.clipboard.getHistory()`. 2) Invoke it again and mutate the
  returned image bytes. 3) Paste the same text consecutively and invoke the API.
  4) Leave the app idle with an image on the OS clipboard and verify no
  clipboard sampling occurs. 5) Revoke `clipboard.read` and invoke it again.
  6) Add fixtures over the text/image caps and older than the retention window.
- **Expected**: The result is newest-first with text and image entries
  interleaved, ISO timestamps, PNG bytes, and image dimensions; mutating the
  result does not mutate host state. Consecutive duplicates collapse with a
  refreshed timestamp. Entries over the per-entry caps and expired entries are
  absent, and the host total/entry caps are enforced. A paste causes only the
  event's already-read content to be recorded; the host does not reread the OS
  clipboard or sample it while idle. The API reuses the `clipboard.read` grant,
  denied calls fail with `PERMISSION_DENIED`, and a successful call emits an
  audit entry containing the returned entry count.
- **Specs linked**: `07-plugins/03-plugin-api.md`,
  `07-plugins/04-plugin-security.md`,
  `07-plugins/13-plugin-permissions-matrix.md`, ADR 0115
- **Acceptance**: G (plugin clipboard history) + Security
- **Status**: Unit-covered (`clipboard-history.test.mjs`); Electron clipboard
  capture remains manual

#### E2E-024I: Plugin skills reach the agent and load on demand

- **Preconditions**: `examples/plugins/hello` enabled with `agent.prompt.inject` granted; a second copy of the manifest without that permission available; one workspace that is a plugin directory and one that is not.
- **Steps**: 1) Start a session and ask the agent what skills it has. 2) Ask it to follow the Hello demo skill so it calls the `Skill` tool. 3) Edit the skill document and repeat step 2. 4) Disable the plugin and start a new turn. 5) Load the variant without `agent.prompt.inject` and repeat step 1. 6) Declare a document larger than the per-skill cap. 7) Open each of the two workspaces in turn.
- **Expected**: The catalog lists the skill id, name, and trimmed description but no body or path, after the built-in skills and before the project instruction chain; the `Skill` schema is loaded through `ToolSearch` only when requested and reads the edited file without a restart; the loaded result identifies the actual `SKILL.md` path and its parent directory before the body so relative references resolve against that document; disabling the plugin rebuilds the runtime so the skill disappears from the next turn; the variant without the permission loads normally and contributes no skills; the oversized document is skipped with an audit line rather than clamped into the prompt; the built-in `plugin-development` skill is catalogued in the plugin workspace and absent in the other, while `PluginCheck` is listed in the bounded on-demand tool catalog in both.
- **Specs linked**: `07-plugins/02-plugin-manifest-schema.md`, `07-plugins/04-plugin-security.md` §7.1, `07-plugins/10-plugin-devex.md`, ADR 0039, ADR 0037, D174
- **Acceptance**: G (skill activation) + E (tools & permissions) + D (high-risk permission gating)
- **Status**: Unit-covered (`plugin-skills.test.mjs`, agent-runtime prompt/digest tests); agent-facing scenario Draft

#### E2E-024J: Plugin theme applies and falls back when withdrawn

- **Preconditions**: A marketplace/package-installable `examples/plugins/hello` variant (`demo.hello`) whose `midnight` theme CSS references a declared package-relative image at `art/preview.png`; a plugin with CSS using `@import` or remote `url()` for rejection plus a comment-only variant; an asset theme with `windowAppearance` variants with and without `ui.window.appearance`, including `cornerRadius: 0` and an invalid value above 24.
- **Steps**: 1) Install the packaged Hello variant from Marketplace or its `.piplug` package and select `Hello Midnight` in Settings → Appearance → Theme. 2) Restart the app. 3) Disable the providing plugin. 4) Re-enable it, then uninstall it. 5) Load the plugin with unsafe CSS. 6) Load the comment-only variant. 7) Select the asset variant's theme on Windows/Linux and on macOS, verify the package-relative image renders through `plugin-asset:` in the shell and the plugin's panel, and load a sheet with an undeclared package-relative `url()` to verify it is refused. 8) Deselect its theme after removing `ui.window.appearance`.
- **Expected**: The packaged plugin installs successfully with its relative image resolved inside the plugin root; its theme appears in the picker alongside the built-ins and applies immediately, with the image served through `plugin-asset:`; the choice survives restart as `plugin:demo.hello:midnight`; disabling or uninstalling the provider falls back to `system` instead of an unstyled shell; unsafe CSS is refused at load with the reason logged and no `<style>` element injected; the comment-only sheet loads and contributes its theme, because the sanitizer only inspects CSS the browser would apply; the declared asset paints through `plugin-asset:` in the shell and in the plugin's own panel, an undeclared reference is refused with the reason logged, the declared background colours the native window on Windows/Linux and is never sent on macOS, and `cornerRadius: 0` makes only the Windows main window rectangular while the authorized theme is selected. Deselecting the theme or dropping the grant restores the host background and the global 12 DIP `--radius-md` Windows corners; a radius above 24 rejects without changing the window. The whole shell follows the theme, including the work-panel column, its header, and the browser/file viewer strips, all of which read `--ds-bg-dock` / `--ds-bg-dock-raised` rather than a literal.
- **Specs linked**: `07-plugins/02-plugin-manifest-schema.md`, `07-plugins/04-plugin-security.md` §3.1, `04-ux/07-ui-design-system.md`, D175
- **Acceptance**: G (theme contribution) + Security
- **Status**: Unit-covered (`plugin-themes.test.mjs`, `theme-css` SDK tests, host-core package-relative asset/install tests). `test:e2e:window-controls` selects an authorized test plugin theme with `cornerRadius: 0` and returns to a built-in theme, verifying the native shape follows both choices. The broader asset visual scenario remains Draft.

#### E2E-PLUGIN-runtime-theme-apis

- **Preconditions**: A plugin with `ui.theme` that can drive `pi.app.setTheme` and `pi.themes.upsert` / `remove` (panel or command). Settings → Appearance shows the searchable theme picker.
- **Steps**: 1) From the plugin UI, call `themes.upsert` with a new theme id and distinct CSS. 2) Confirm the theme appears in Settings without reload/disable. 3) Call `app.setTheme` to select it. 4) Call `themes.upsert` again with different CSS while it is active. 5) Call `themes.remove` on an inactive theme. 6) Call `app.setTheme` with an unknown id. 7) Upsert a ninth theme (former hard cap was 8).
- **Expected**: The new theme is listed and applies immediately through the same path as Settings; live CSS edits restyle the shell without plugin reload; remove drops the picker row and the event refreshes the list; an unknown id rejects with `INVALID_ARGUMENT` and leaves the preference unchanged; the ninth theme is accepted. `settingsChanged` reaches the renderer store; `appearance:changed` reaches open panels.
- **Specs linked**: `07-plugins/03-plugin-api.md`, `07-plugins/12-plugin-ipc-and-host-services.md`, `07-plugins/13-plugin-permissions-matrix.md`, ADR 0260, D417
- **Acceptance**: G (theme contribution) + Security
- **Status**: Unit-covered (`plugin-themes.test.mjs`); interactive scenario Draft

#### E2E-PLUGIN-sidebar-gradient-token

- **Preconditions**: A plugin theme that sets `--ds-bg-sidebar` to a solid color and `--ds-bg-sidebar-image` to a `linear-gradient(...)`; Windows/Linux and macOS shells.
- **Steps**: 1) Select the theme. 2) Inspect the sidebar plate and rail. 3) Confirm borders/glass tint still resolve from the color token. 4) Switch back to a built-in theme.
- **Expected**: The gradient paints as `background-image` over the color plate on all platforms; macOS sheen still overlays the image layer; borders and `color-mix` consumers do not break; clearing the token returns the plain sidebar.
- **Specs linked**: `04-ux/07-ui-design-system.md`, ADR 0260, D417
- **Acceptance**: Visual / platform
- **Status**: CSS unit contracts in `plugin-themes.test.mjs`; visual scenario Draft

#### E2E-024K: Plugin MCP server tools reach the agent

- **Preconditions**: A plugin declaring one `stdio` and one non-loopback HTTP MCP server against trusted local-network stubs; `mcp.server.local` and `mcp.server.remote` granted; the HTTP host is listed in `net.domains`; a settings key holding the stub credential.
- **Steps**: 1) Enable the plugin and confirm no server process starts yet. 2) Ask the agent to call a discovered tool. 3) Inspect the stub's received environment/headers. 4) Make the stub fail a call, then run an HTTP tool that takes longer than the 10s handshake budget but less than the 100s call budget, then time a call out beyond its own budget. 5) Grow the stdio stub's catalog past the old 64-tool cap and re-discover it. 6) Disable the plugin.
- **Expected**: Servers connect lazily on first use; tools appear as `plugin_demo_*_<serverId>_<tool>` at `risk: "medium"` with per-call audit; the stdio child receives only the declared `env` values plus PATH/temp/locale, never host provider keys; the non-loopback HTTP endpoint is accepted only because its host is declared, and its unencrypted transport is visible in review; a redirect to an undeclared host is blocked before the second request; the HTTP tool can finish after the handshake budget while a call that exceeds its own budget fails; other failures and timeouts return tool errors without crashing the plugin or the host; a catalog larger than the old 64-tool cap arrives whole, while a server that breaks a per-server guard (count, pages, cursor, traversal time) is refused instead of contributing a prefix of its catalog; disable disconnects both servers.
- **Specs linked**: `07-plugins/02-plugin-manifest-schema.md`, `07-plugins/04-plugin-security.md` §8.1, ADR 0038, ADR 0142, D176, D281, D452
- **Acceptance**: G (MCP bridge) + E (tools & permissions) + Security
- **Status**: Unit-covered (`plugin-mcp.test.mjs` stdio + HTTP stubs); agent-facing scenario Draft

#### E2E-MCP-pi-client-owner-policy: Pi protocol under existing Desktop owners

- **Preconditions**: Pi 1.1.0 with the pinned host-policy patch; offline stdio and
  HTTP fixtures, no paid provider or user credentials.
- **Steps**: Run `plugin-mcp.test.mjs`, `user-mcp.test.mjs`,
  `mcp-stdio-launch.test.mjs`, `mcp-call-registry.test.mjs`, `mcp-oauth.test.mjs`,
  and `mcp-oauth-discovery.test.mjs` under `apps/desktop/test` using `node --test`.
- **Expected**: Concurrent discovery starts one process; host launch/env/egress
  policies remain enforced; Pi delivers progress and structured content; progress
  cannot extend the total call deadline; cancellation reaches the stdio peer and
  leaves other calls usable. OAuth uses Pi DCR/PKCE/refresh with host TLS/redirect,
  scope, callback-state, and encrypted-storage boundaries. No legacy client runs.
- **Status**: Offline integration-covered; packaged Electron journey NOT RUN.

#### E2E-MCP-CANCEL: Stop interrupts only the calling session's MCP request

- **Preconditions**: Two Agent sessions share one user or plugin MCP server;
  each has a pending tool call, and the server records cancellation notifications.
- **Steps**: Stop the first session while both calls are pending, then allow the
  second call to finish. Repeat with a remote HTTP server and a stdio server.
- **Expected**: The first request receives `notifications/cancelled` and cannot
  produce a successful tool result after Stop. The second session's call finishes normally;
  its server connection remains available. Closing the app cancels remaining
  requests without retaining listeners.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §12a,
  `07-plugins/04-plugin-security.md` §8.1
- **Status**: Client and session-isolation unit-covered; full desktop journey Draft

#### E2E-MCP-tool-requires-approval: User MCP tools prompt under ask and accept-edits

- **Preconditions**: A project-bound Agent session; one user-configured stdio
  MCP server whose tool list annotates a tool as read-only/low risk.
- **Steps**: 1) With the session in `ask`, ask the agent to call the MCP tool.
  2) Answer the card with allow-once, call it again, then answer with
  allow-session and call it a third time. 3) Switch to `accept-edits` in a new
  session and repeat the call. 4) Switch to `auto` and call it. 5) Switch to
  Plan, then Goal, and call it.
- **Expected**: Under `ask` and `accept-edits` every call shows an approval card
  with reason "MCP server tool requires approval" at `medium` risk, regardless of
  the server's self-declared annotation. Allow-once covers only that call;
  allow-session suppresses further cards for the same `mcp_<serverId>_<tool>`
  name in that session only, and does not cover other tools of the server.
  `auto` runs the tool without a card. Plan and Goal deny it even with a
  session grant.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `05-security/01-security.md`, D640, ADR `mcp-tool-approval-risk`
- **Acceptance**: E (tools & permissions) + Security
- **Status**: Unit-covered (host-core `permissions.rs` MCP risk and mode tests);
  desktop journey Draft

#### E2E-024L: Resident plugin service is supervised and visible

- **Preconditions**: `examples/plugins/hello` enabled with `background.service` granted.
- **Steps**: 1) Open Extensions → Installed and expand Details on the plugin row to read the `Greeter heartbeat` chip. 2) Kill the plugin's utility process and watch the chip. 3) Kill it repeatedly past the restart ceiling. 4) Disable and re-enable the plugin. 5) Revoke `background.service` and reload.
- **Expected**: The Details disclosure exposes a chip that reports `running` after load; a kill shows `failed` then `running` again with an incremented restart count and backoff between attempts; past five attempts the plugin stays `failed` and stops retrying; manual disable/enable cancels the pending timer and resets the counter; without the permission the service never starts and the skip is audited.
- **Specs linked**: `07-plugins/05-plugin-lifecycle.md` §3.1, ADR 0040, D177
- **Acceptance**: G (resident services)
- **Status**: Unit-covered (`plugin-services.test.mjs` supervision + backoff); manual kill scenario Draft

#### E2E-024M: Bus messages cross plugins only as declared

- **Preconditions**: Two plugins enabled — one publishing `demo.*` topics, one subscribing `demo.**` — with `bus.publish` / `bus.subscribe` granted.
- **Steps**: 1) Run the publisher's command and watch the subscriber. 2) Publish a topic absent from `contributes.bus.publish`. 3) Subscribe to a pattern absent from `contributes.bus.subscribe`. 4) Publish a payload over 64KB and exceed 100 publishes in 10s. 5) Unload the subscriber and publish again.
- **Expected**: The subscriber receives `{ topic, from, payload, at }` and the publisher never receives its own message; undeclared publish and subscribe both fail `PERMISSION_DENIED` with an audit line naming the topic; the oversized payload and the rate burst fail `LIMIT_EXCEEDED` / `RATE_LIMITED`; publishing to a departed subscriber succeeds with a smaller fan-out and no host error.
- **Specs linked**: `07-plugins/02-plugin-manifest-schema.md` §5.1, `07-plugins/04-plugin-security.md` §5.1, ADR 0040, D178
- **Acceptance**: G (message bus) + Security
- **Status**: Unit-covered (`plugin-bus.test.mjs` delivery, filtering, caps); two-plugin manual scenario Draft

#### E2E-024N: Extensions page density and theme-readable actions

- **Preconditions**: App running with at least one installed extension and one
  available marketplace action; dark and light themes available.
- **Steps**: 1) Open Extensions in dark theme. 2) On Windows/Linux, confirm
  the compact two-tier header presents the extension mark/title and contextual
  action rail below the native window-control band, then confirm the Installed and Marketplace tabs are the only tabs and both reach the content
  without a four-card numeric overview band or explanatory header/section
  paragraphs. 3) Confirm installed plugins are cards in an
  auto-filling grid — cards keep their width above 340px and collapse below —
  then expand Details on one card and inspect its capabilities, service status,
  and permissions. 4) Use the compact scope
  control and its explained scope menu, the card's one call to action (Update to
  the available version, or Open panel), and the 28px settings and overflow icon
  actions; widen and narrow the window to see the rail wrap at the card's left
  edge rather than clip. 5)
  Switch to light theme and repeat. 6) Keyboard-focus the Details disclosure,
  scope states, and each action.
- **Expected**: The four numeric overview cards are absent; the header uses a
  quiet 24px extension mark, 18px title, restrained 30px action controls, and
  a visible keyboard focus ring; tab counts,
  installed group counts, and any update alert remain available in their
  relevant surfaces. The page header, section headers, empty states, and update
  alert use compact labels and actions; decision-specific explanations remain
  in disclosures, details, and dialogs. Cards keep their default height low while the
  disclosure exposes the complete secondary readout. The scope trigger stays
  aligned with the card's control rail, its menu explains each state, and icon
  actions remain visible at rest while showing labels on hover and focus; a
  disabled card shows no primary action and no settings icon.
  Primary and secondary buttons keep
  visible semantic surfaces, text, borders, hover states, and focus rings in
  both themes, and keyboard focus does not depend on pointer hover.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/07-ui-design-system.md`,
  `07-plugins/07-plugin-marketplace.md`, ADR 0058, D196
- **Acceptance**: G (Extensions page) + Quality
- **Status**: Unit-covered (`extensions-page.test.mjs`,
  `plugins-page-style.test.mjs`, `plugin-reviews-surface.test.mjs`);
  visual scenario Draft

#### E2E-024O: Marketplace hides development-only sample plugins

- **Preconditions**: App running; the official catalog contains the
  development fixtures `demo.hello` or `demo.workspace-summary` and at least
  one product plugin.
- **Steps**: 1) Open Extensions → Marketplace with an empty search. 2) Search
  for `Hello`, `Workspace Notes`, and `Workspace Summary` in turn. 3) Inspect
  the category filters and result cards. 4) Open Installed and verify an
  already-installed sample remains manageable.
- **Expected**: Entries whose IDs begin with `demo.` never appear in the
  marketplace cards, categories, or search results; product plugins remain
  discoverable. An already-installed sample is still listed under Installed so
  it can be disabled or uninstalled rather than becoming an unmanaged runtime.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`,
  `04-ux/01-ui-ia.md`
- **Acceptance**: G (Extensions page) + Quality
- **Status**: Unit-covered (`extensions-page.test.mjs`); visual scenario Draft

#### E2E-025: Disable plugin removes contributions

- **Preconditions**: Plugin enabled and contributions visible.
- **Steps**: 1) Disable the plugin on the Extensions page. 2) Check global search and agent tools.
- **Expected**: Commands and tools disappear; no leftover contributions.
- **Specs linked**: `07-plugins/05-plugin-lifecycle.md`
- **Acceptance**: G (disable removes contributions)
- **Milestone**: M4
- **Status**: Automated (protocol smoke: disable clears enabled flag; global search removal manual)

#### E2E-026: Plugin error does not crash app

- **Preconditions**: Plugin loaded.
- **Steps**: 1) Trigger a scenario where plugin throws an error. 2) Observe app behavior.
- **Expected**: App remains running; error is captured and reported; no crash.
- **Specs linked**: `07-plugins/04-plugin-security.md`
- **Acceptance**: G (plugin error → no crash)
- **Milestone**: M4
- **Status**: Draft

#### E2E-024X: Page copy stays concise in both locales

- **Preconditions**: App running with English and Simplified Chinese available; project archive, Scheduled, Extensions, and Agent capability destinations are reachable.
- **Steps**: 1) Open each destination in English and inspect its header, toolbar, empty state, and primary action. 2) Switch to 简体中文 and repeat. 3) Trigger a permission, validation, destructive-action, or provider-error state.
- **Expected**: Page headers do not repeat their title as explanatory subtitles; empty states use a concise title and action, with body text only when context or a required next step is necessary. Settings and capability pages omit prose that only explains obvious controls. Permission, security, validation, destructive-action, keyboard, scope, and error details remain visible in both locales.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/07-ui-design-system.md`
- **Acceptance**: Quality (concise page copy)
- **Status**: Unit-covered (`packages/i18n/test/user-facing-copy.test.mjs`); visual scenario Draft

### Security — No Secret Leakage

#### E2E-027: Secrets not in logs for normal flows

- **Preconditions**: Provider configured with API key.
- **Steps**: 1) Perform a chat session. 2) Inspect log files.
- **Expected**: API keys / tokens not present in any log output for normal flows.
- **Specs linked**: `05-security/01-security.md`, `03-runtime/09-logging-and-observability.md`
- **Acceptance**: H (secrets not in logs)
- **Milestone**: M2
- **Status**: Automated (protocol smoke: provider list carries no secret material)

#### E2E-028: Renderer has no Node integration

- **Preconditions**: App running.
- **Steps**: 1) Inspect renderer process flags.
- **Expected**: `nodeIntegration: false`; `contextIsolation: true`; preload is the only bridge.
- **Specs linked**: `05-security/01-security.md`
- **Acceptance**: Security (no Node in renderer)
- **Milestone**: M1
- **Status**: Draft

#### E2E-029: Unwhitelisted IPC cannot be called

- **Preconditions**: App running.
- **Steps**: 1) Attempt to invoke an IPC method not on the whitelist from renderer.
- **Expected**: Call blocked; no data returned; error or no response.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, `05-security/01-security.md`
- **Acceptance**: Security (IPC whitelist enforced)
- **Milestone**: M1
- **Status**: Draft

#### E2E-030: Plugin cannot read API key

- **Preconditions**: Plugin loaded; provider configured.
- **Steps**: 1) Plugin attempts to access provider secret via any API. 2) Observe result.
- **Expected**: Access denied; no secret data returned to plugin.
- **Specs linked**: `07-plugins/04-plugin-security.md`, `03-runtime/14-secrets-storage.md`
- **Acceptance**: Security (plugin cannot read API key)
- **Milestone**: M4
- **Status**: Draft

#### E2E-031: Error codes are stable and readable

- **Preconditions**: App launched through the normal desktop development
  command; provider configured.
- **Steps**: 1) Select or enter a model ID that the provider rejects. 2) Send a
  prompt. 3) Inspect the assistant error message and its detail disclosure. 4)
  Switch sessions and reload the failed session. 5) Repeat with an invalid
  provider key.
- **Expected**: The run stops and the transcript contains one durable
  `role=assistant`, `status=error` message instead of a toast, floating banner,
  or blank row. It shows a localized summary and stable
  `MODEL_NOT_CONFIGURED` or `PROVIDER_UNAUTHORIZED` code. Details expose the
  redacted provider response plus provider/model IDs and can be copied; no API
  key or Authorization value appears. The configuration failure links to
  settings, retriable failures offer Retry, the composer becomes usable again,
  and reload preserves the error message. The development launch executes a
  sidecar rebuilt from current runtime source.
- **Specs linked**: `03-runtime/02-agent-runtime.md`,
  `03-runtime/07-process-model.md`, `03-runtime/08-error-codes.md`
- **Acceptance**: C (failed chat settles), H (errors expose stable codes)
- **Milestone**: M2
- **Status**: Unit-covered (agent-runtime error message/redaction, host
  persistence, desktop transcript contract, and predev build contract); full
  Electron UI scenario Draft

### Hardening (M5)

#### E2E-032: Backend crash triggers supervised restart

- **Preconditions**: App running; host-core and sidecar healthy.
- **Steps**: 1) Kill the host-core (or sidecar) process externally. 2) Observe app behavior.
- **Expected**: In-flight RPCs fail fast (no long hang); `hostStatus` shows degraded then restored; child restarts with backoff; after 3 failed restarts in 2 minutes the app stays degraded with a visible fatal status. Repeat the kill with the main window closed: the crash is still logged (with the child's last stderr lines), the child still restarts, and no unhandled renderer-send error appears — supervision is independent of a live window.
- **Specs linked**: `03-runtime/07-process-model.md`
- **Acceptance**: Quality (main path no crash)
- **Milestone**: M5
- **Status**: Automated (`scripts/e2e-supervision.mjs` — SIGKILL host-core, assert restart + healthy RPC)

#### E2E-033: Window bounds persist across restart

- **Preconditions**: App running with default window size.
- **Steps**: 1) Resize/move the window to distinct normal bounds A (≥800×560), maximize before the 600ms save debounce ends, quit, and relaunch. 2) Restore, resize/move to distinct bounds B, quit before the debounce ends, and relaunch again.
- **Expected**: Each relaunch restores the latest normal bounds (A, then B), including when quit occurs while maximized or with a pending save. Maximized/fullscreen geometry is never stored as normal bounds; invalid/tiny saved bounds fall back to the 1200×800 default.
- **Specs linked**: `04-ux/09-interaction-patterns.md`
- **Acceptance**: Quality (key operations feel polished)
- **Milestone**: M5
- **Status**: Documented

#### E2E-034: NDJSON log files are written and redacted

- **Preconditions**: Fresh profile; provider configured; one chat turn completed.
- **Steps**: 1) Run a prompt with a tool call. 2) Open `~/.pi-desktop/logs/`. 3) Inspect the categorized files under `app/`, `host/`, and `agent/`.
- **Expected**: NDJSON records exist with `ts/level/channel/category/event/message`; a normal tool call produces one completion or failure record carrying `sessionId`/`toolCallId`, safe tool metadata, and bounded result/duration information; an interrupted tool remains traceable by the same id; no API key, authorization value, raw command output, or local absolute path appears; each category file rotates at 5 MB; lifecycle, permission, tool, provider, plugin, persistence, updater, and error records remain available without creating dedicated timing category files.
- **Specs linked**: `03-runtime/09-logging-and-observability.md`
- **Acceptance**: H (diagnostics)
- **Milestone**: M5
- **Status**: Documented

#### E2E-194: Broken stdout does not crash the main process

- **Preconditions**: Packaged or development app; a session can send a prompt.
- **Steps**: 1) Launch so stdout/stderr are a closed pipe (Linux AppImage from
  a desktop entry, or with the stdout reader closed). 2) Send a chat message.
  3) Confirm the main process stays up and the uncaught-exception dialog does
  not appear. 4) Quit and relaunch.
- **Expected**: No Electron "A JavaScript error occurred in the main process"
  dialog with `Error: write EPIPE` from `Logger.log`. NDJSON category logs still
  receive the prompt records. Relaunch still reaches the local host service
  instead of a fatal "Can't reach the local service" / “无法连接本地服务”
  status caused by a previous main-process crash.
- **Specs linked**: `03-runtime/09-logging-and-observability.md`,
  `03-runtime/07-process-model.md`
- **Acceptance**: H (diagnostics), Quality (main path no crash)
- **Milestone**: M5
- **Status**: Unit-covered (`logger-routing.test.mjs`); packaged AppImage
  journey Documented

#### E2E-RUNTIME-non-ascii-http-header-does-not-show-main-exception-dialog

- **Preconditions**: Packaged or development app on a machine whose system
  HTTP proxy or gateway injects a non-Latin-1 response header (for example a
  value starting with U+661F), or a test that delivers the same
  `TypeError: Cannot convert argument to a ByteString` through Electron `net`.
- **Steps**: 1) Launch so the auto-updater check or model discovery issues a
  main-process `net.fetch` / Electron-updater request. 2) Confirm the native
  exception dialog does not appear. 3) Dismiss nothing; wait for a later
  updater or discovery request. 4) Open `~/.pi-desktop/logs/app/runtime.log`.
- **Expected**: No Electron "A JavaScript error occurred in the main process"
  dialog. The app stays running and does not quit. `runtime.log` contains an
  error record with `code: "NON_ASCII_HTTP_HEADER"` and `recoverable: true`.
  A later main-process HTTP request does not re-open the native dialog.
- **Specs linked**: `03-runtime/07-process-model.md`,
  `03-runtime/09-logging-and-observability.md`
- **Acceptance**: H (diagnostics), Quality (main path no crash)
- **Milestone**: M5
- **Status**: Unit-covered (`main-process-errors.test.mjs`); packaged Windows
  proxy journey Documented

#### E2E-195: Linux glibc below 2.35 names supported distros

- **Preconditions**: Linux x64 or arm64 packaged app; the machine glibc is older than
  2.35 (for example Ubuntu 20.04 / Debian 11 / Fedora 35), or a test doubles
  `process.report` to `2.31`.
- **Steps**: 1) Launch the AppImage, deb, or rpm. 2) Observe the main window and
  fatal banner. 3) Confirm host-core is not restarted in a loop.
- **Expected**: Electron still opens. There is no uncaught `write EPIPE`
  dialog. The fatal banner says the build needs glibc 2.35 or newer and names
  Ubuntu 22.04, Debian 12, and Fedora 36+. Restart supervision does not spin.
  A host-core binary whose symbols need glibc 2.39 fails
  `scripts/check-linux-host-glibc.mjs`.
- **Specs linked**: `03-runtime/07-process-model.md`,
  `01-product/01-product-scope.md`, `06-delivery/06-release-runbook.md`
- **Acceptance**: H (diagnostics), Quality (main path no crash)
- **Milestone**: M5
- **Status**: Unit-covered (`linux-glibc.test.mjs`); packaged distro journey
  Documented

#### E2E-035: Bash tool uses the effective catalog shell

- **Preconditions**: Workspace open; agent mode.
- **Steps**: 1) Select an available catalog shell and run `Bash` (e.g. `echo ok`). 2) Make the persisted selection unavailable and inspect the effective catalog before running the next turn. 3) Run with the previous turn snapshot.
- **Expected**: The unchanged `Bash` protocol call uses the selected catalog entry. A later unavailable persisted choice falls back to the first available platform shell and marks the catalog fallback; the previous turn snapshot is rejected as stale by `COMMAND_SHELL_CHANGED` rather than silently changing shell. No partial execution occurs; E2E-113 covers the stale identity path.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`, `03-runtime/06-host-rpc-protocol.md`, `03-runtime/08-error-codes.md`, ADR 0054
- **Acceptance**: H (errors expose stable codes)
- **Milestone**: M5
- **Status**: Unit-covered (`tools::shell::tests`); scenario Documented

#### E2E-044: Development launch uses PI-Desktop Dock branding

- **Preconditions**: macOS development checkout with canonical `build/icon_1024.png`.
- **Steps**: 1) Run `pnpm dev`. 2) Inspect the running application's Dock icon.
- **Expected**: The Dock shows the PI-Desktop brand icon, not Electron's default icon; packaged builds continue to use `build/icon.icns`.
- **Specs linked**: `06-delivery/06-release-runbook.md`
- **Acceptance**: Quality (development shell matches release branding)
- **Milestone**: M5
- **Status**: Unit-covered (`development-branding.test.mjs`); visual scenario Documented

#### E2E-045: Global text selection preserves editing and copying

- **Preconditions**: App running with a chat transcript containing a user
  message, an assistant Markdown response with a code block, and an expanded
  tool result.
- **Steps**: 1) Drag across sidebar/titlebar chrome and a button label. 2)
  Drag across user/assistant prose, code, and tool output. 3) Focus the
  composer and a settings/search input, then use `Cmd/Ctrl+A` and replace the
  selected text. 4) Copy selected transcript and code text.
- **Expected**: Chrome does not leave an accidental text selection; message
  prose, code, tool input/output, and editable controls remain selectable and
  copyable; native editing shortcuts, focus-visible rings, and window drag
  behavior remain intact.
- **Specs linked**: `04-ux/07-ui-design-system.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: Quality (key operations feel polished)
- **Milestone**: M5
- **Status**: Unit-covered (`user-select.test.mjs`); scenario Documented

#### E2E-046: PI-Desktop renderer branding and composer icon boundary

- **Preconditions**: App running in both English and zh-CN locales, with an
  empty home and a docked transcript available.
- **Steps**: 1) Inspect the expanded and collapsed sidebar. 2) Inspect the
  empty-home hero and docked composer. 3) Observe the eight-frame mascot GIF
  looping in place, move the pointer over it, and confirm its cadence and
  geometry do not change. Enable reduced motion and confirm the still first
  frame is shown. 4) Focus the footer Settings and Plugins icons, then each
  project/Temporary session create control. 5) Open Settings and the composer
  input.
- **Expected**: Visible shell identity reads `PI-Desktop`; the empty-home hero
  renders the theme-matching 100px `HomeMascotLogo` GIF with a short idle hold
  and a looping wave. Pointer hover does not alter the cadence or geometry,
  and reduced motion shows the matching still first frame.
  The expanded/collapsed
  sidebar renders the derived `src/assets/brand/logo-*.png` asset through `BrandLogo`
  and the docked composer prompt row has no leading
  brand icon or reserved icon slot and its text aligns directly with the input
  gutter. The right Composer toolbar shows a Bot model × reasoning chip and
  the single submit slot; an installed plugin may contribute text actions
  between them. Without such a plugin no prompt-enhancement action appears.
  The footer Settings and Plugins actions are compact icon buttons;
  Plugins sits immediately to the right of Settings and exposes a localized
  accessible name. Every scoped session-creation control uses the dedicated
  message-plus icon with localized labels and accessible names. `Codex` remains visible only as
  the external import-source label or in non-runtime design-reference text.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`,
  `08-meta/decisions-log.md` (D094/D160/D293),
  `../../adr/0031-icon-free-composer-prompt-row.md`,
  `../../adr/0152-eight-frame-empty-home-mascot-gif.md`
- **Acceptance**: Quality (brand consistency and key operations feel polished)
- **Milestone**: M5
- **Status**: Unit-covered (`renderer-branding.test.mjs`); scenario Documented

#### E2E-047: Retain, collapse, switch, and close multiple project tabs

- **Preconditions**: Projects A and B each have at least one durable session;
  neither path is archived; a Temporary session also exists.
- **Steps**: 1) Open project A from Settings → Project archive. 2) Open project B without closing
  A. 3) Click A's directory row on its chevron, folder, label, and trailing
  disclosure hit area in turn to collapse/expand it; use B's directory row to
  activate and collapse B; verify `+` and overflow do not toggle B. 4) Hover and
  keyboard-focus A's project title and confirm the full path is exposed; open
  A's project overflow or right-click menu and choose Open folder; confirm
  conversation overflow no longer offers Open folder. 5) Select A's conversation.
  6) Close B. 7) Restart the app. 8) Reopen B from Settings → Project archive.
- **Expected**: A and B render as separate exact-path sidebar groups in a
  compact continuous list with one keyboard stop per directory disclosure;
  every non-action point in A's row toggles only A, project activation is owned
  by the directory row rather than its overflow menu, and project actions appear on
  hover/focus without shifting labels, the project title hover/focus path shows
  A's full absolute path in a content-sized tooltip (long paths wrap within a
  420px maximum), Open folder is a project-menu action only and opens A
  in the system file manager, and collapse survives restart;
  activating a group or its conversation
  clears the previous visible transcript, updates the selected workspace and
  session binding, and then loads only the selected project's conversation;
  Temporary remains separate; closing B removes only its retained tab and
  deletes neither its project row nor sessions; reopening B restores the same
  sessions without duplication.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, ADR 0016
- **Acceptance**: C (switch sessions), D (workspace), F (local presentation
  persistence)
- **Milestone**: M5
- **Status**: Unit-covered (`sidebar-preferences.test.mjs` for retained paths
  and collapse persistence); full UI scenario Draft

#### E2E-047b: Sidebar session hover card surfaces rich metadata

- **Preconditions**: A retained project with at least two sessions, one of
  which has a recorded git branch; a Temporary/scratch session also exists.
- **Steps**: 1) Hover a session row under the retained project and wait for
  the card to appear; repeat with keyboard focus on the same row. 2) Change
  the active project's Git branch externally, then switch to another
  conversation in the same directory and hover its row; wait for the card. 3)
  Move the pointer to a different session row without leaving the sidebar; wait.
  4) Hover a Temporary/scratch session row. 5) Resize the sidebar narrower
  than 320px; hover again. 6) Right-click a session row while the card is
  visible and open its context menu. 7) Scroll the sidebar body while the card
  is up.
- **Expected**: The card appears after a 500ms dwell, never appears during
  quick pointer passes, and re-targets to the latest hovered row when the
  pointer changes. Each card shows: the localized session title, the
  mode/permission badge, live status, the readable model display name when
  known, the project name (or "Temporary" / "临时对话" for scratch rows)
  with the latest Git branch on the same row, and the row's `Updated`
  timestamp formatted by the active locale without seconds. Ordinary
  sessions do not show a Local task chip, session UUID, separate Provider
  label, or a status-checked timestamp. Refreshing the branch
  does not activate a project or change the selected conversation. The session
  row has no native `title` tooltip; the hover card is the only full-title
  surface. The card never widens past 320px, never causes the underlying row
  to horizontally scroll, and disappears immediately on resize, scroll, or
  context-menu open.
- **Specs linked**: `04-ux/09-interaction-patterns.md §9.1b`
- **Acceptance**: F (local presentation)
- **Milestone**: M5
- **Status**: Unit-covered (`sidebar-navigation.test.mjs` and
  `app-store-sidebar.test.mjs` for the session hover card, branch refresh, and
  the absence of a native row `title`); full UI scenario Draft

#### E2E-048: Pin, archive, restore, and sort project/conversation rows

- **Preconditions**: Two retained projects contain conversations with distinct
  titles and created/updated timestamps; archived view is initially disabled.
- **Steps**: 1) Inspect the Sessions and Projects heading actions at rest. 2)
  Hover each heading and keyboard-focus each action to confirm the controls
  reveal without moving the labels. 3) Inspect the `Sessions` toolbar and verify
  that Sort appears before New Chat. 4) Open Sort and inspect its placement,
  then select Recently updated, Created date, Oldest first, and Name in turn.
  5) Pin one project and one conversation. 6) Archive another conversation
  and project. 7) Enable Show archived and restore both. 8) Restart the app.
  9) Delete a disposable conversation through the distinct Delete action.
- **Expected**: Section create and sort controls are visually quiet at rest and
  reveal on toolbar hover or keyboard focus; project `+` and overflow actions
  follow the same rule without shifting labels. Sort precedes New Chat in the
  Sessions toolbar; the sort menu remains content-sized, opens to the trigger's
  right without flipping left, and
  session/project/section body-level menus use the same right-side rule with a
  narrow-viewport width cap. Pinned rows remain ahead
  of unpinned rows under every selected secondary order; in the sidebar, pinned
  project rows replace the Folder with a filled accent Star while unpinned rows
  retain Folder. Each sort
  produces the documented stable order; archived rows disappear from the default view but
  retain transcripts/project records and reappear in Show archived; restore
  returns them to the selected order; archiving the active row selects a visible
  non-archived fallback or creates the documented empty fallback instead of
  leaving hidden active context; pin/archive/sort choices survive restart; only
  Delete removes the disposable durable session. A legacy `manual` preference
  loads safely without exposing or implying a drag-reorder workflow.
- **Specs linked**: `03-runtime/04-data-storage.md`, `04-ux/01-ui-ia.md`,
  `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (session organization), F (persistence)
- **Milestone**: M5
- **Status**: Unit-covered (`sidebar-preferences.test.mjs` for metadata,
  filtering, and sort behavior); full UI scenario Draft

#### E2E-048b: Edit a logical project name and folder roots

- **Preconditions**: One retained logical project is visible in the sidebar and
  in Settings → Project archive; it has a primary folder, one additional folder
  promoted to primary during the scenario, and one other additional folder
  without chats.
- **Steps**: 1) Open the project's overflow menu in the sidebar and choose
  Edit project. 2) Change the name, use the extra folder's Set as Primary
  action, and confirm that row moves to the top with the Primary tag while the
  former primary becomes an ordinary row. 3) Remove the other additional folder
  and add it again with the native folder picker. 4) Confirm the Primary row
  cannot be removed. 5) Save and inspect the sidebar row, Project archive
  roots, and active workspace. 6) Restart the app and inspect the group again.
- **Background-update regression**: Open Edit project from Settings, change the
  name, promote another folder to primary, and remove the additional folder,
  then complete a background task before saving. Every draft edit must remain
  visible and save together. The isolated rendered test is
  `node scripts/e2e-project-edit.mjs`; it uses real page/store wiring with a
  controlled host IPC boundary and does not prove disk persistence.
- **Expected**: Both project menus offer Edit project. The editor keeps focus
  contained, trims the name, limits it to 80 Unicode characters, keeps the
  Primary folder as the first row, and updates the root count without removing
  another row. Promoting a member folder makes it the first row and the stored
  primary root, so the project opens there afterwards; a folder outside the
  saved roots is never accepted as primary, and a remote project keeps its
  host-owned binding unchanged. Saving persists one logical group with the
  adjusted roots; the name and the promoted primary folder survive restart,
  while the group's sessions, transcripts, and on-disk folders remain
  unchanged.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: D (workspace identity), F (local presentation persistence)
- **Milestone**: M5
- **Status**: Unit-covered (`project-edit.test.mjs`,
  `sidebar-preferences.test.mjs`); rendered scenario Draft, with primary
  promotion covered by `node scripts/e2e-project-edit.mjs`

#### E2E-048c: Detach a project folder with chats and delete it

- **Preconditions**: One retained logical project has a primary folder and an
  additional folder with at least one saved chat. All chats are idle.
- **Steps**: 1) Open Edit project and remove the additional folder. 2) Save and
  inspect the remaining group and the standalone project row for the detached
  folder. 3) Open its chat and confirm the transcript is intact. 4) Choose
  Delete for the detached project and explicitly confirm in the dialog. 5)
  Inspect the remaining group, project list, chat list, and folder on disk.
- **Expected**: Removing the folder from the group preserves its project row,
  chats, and transcripts, and exposes it as a standalone project. Future chats
  use the detached project's path-scoped context; shared instructions and
  memory remain with the original group. The confirmed delete then removes that
  project's sessions and transcripts while keeping its folder on disk; the
  original group remains with its primary folder.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`, ADR 0249,
  ADR 0251.
- **Acceptance**: C (project and chat interaction), F (persistence), Quality.
- **Milestone**: M5
- **Status**: Host RPC integration-covered; full UI scenario Draft

#### E2E-048A: Project session lists fold after the ten most recent rows

- **Preconditions**: One retained project contains more than ten durable
  sessions with distinct updated timestamps; the sidebar uses the default
  Recently updated sort; another retained project has ten or fewer sessions.
- **Steps**: 1) Inspect the large project's session rows and count them. Check
  rows with recent and older replies. Hover a row, then focus one with the
  keyboard. 2) Select the **Load N more…** control. 3) Switch the sort to Name
  and inspect the same group before expanding. 4) Restart the app and inspect
  the group again.
- **Expected**: The group shows exactly ten session rows by default plus a
  **Load N more…** control (N = remaining session count); there are no time-group
  headers. Every row places the title before a divider and the localized last
  reply date. Replies within seven calendar days show an exact relative day
  (including 0–7 days); older replies show a concrete localized date. Hovering
  or focusing a row hides its date and reveals the session action. The ten rows
  are the first rows in the active sort order, so pinned rows are never pushed
  behind unpinned rows and a Name sort folds everything after the first ten
  alphabetically; selecting Load more expands the flat list and the control
  disappears. Expansion is per group and resets on restart (not persisted); the
  project with ten or fewer sessions shows no fold control.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (session organization)
- **Milestone**: M5
- **Status**: Scenario Documented

#### E2E-049: Background sessions keep their originating workspace

- **Preconditions**: Projects A and B are retained; each contains a session in
  Agent mode; both workspaces contain different marker files with the same
  relative name.
- **Steps**: 1) In session A, start a turn that reads the marker and performs a
  permission-gated long-running tool. 2) While A is running, activate project
  B and open session B. 3) Read B's marker and allow a tool only in B. 4) Wait
  for both turns to complete. 5) Open a Temporary session and attempt a
  workspace-required tool.
- **Expected**: Switching tabs aborts neither turn; A's tool cwd/path sandbox
  remains project A and B's remains project B; A's events and grants never
  appear in B's transcript/session; each sidebar row reports its own
  running/completed state; the Temporary session inherits no project and
  receives `WORKSPACE_REQUIRED`; returning to A restores A's completed
  transcript.
- **Specs linked**: `02-architecture/01-architecture.md`,
  `03-runtime/02-agent-runtime.md`, `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/06-host-rpc-protocol.md`,
  `03-runtime/10-session-state-machine.md`, ADR 0016
- **Acceptance**: C (parallel sessions), D (workspace), E (tool/permission
  isolation), Security (workspace boundary)
- **Milestone**: M5
- **Status**: Unit-covered (`rpc::tests` for project-bound, Temporary, and
  missing-session workspace resolution); full multi-turn UI scenario Draft

#### E2E-050: Composer model × reasoning menu follows exact capability

- **Preconditions**: One catalogued reasoning model, one non-reasoning model,
  and one unknown free-form model id.
- **Steps**: 1) Open the Composer model × reasoning chip. 2) Confirm the root
  contains the model list plus a segmented reasoning control in the footer
  with one labeled column per supported level; confirm every level keeps a
  visible label, each centered in its column. 3) Drag and click the control
  across multiple supported levels and click a label, confirming the chip
  updates while the menu stays open and the raised pill sits under the
  selected label. 4) Open Model, search for a model, and select a
  model from a provider group; confirm the menu remains open at the root.
  5) Open Reasoning level and choose a level from the radio list. 6) Repeat
  with a non-reasoning provider and an unknown free-form model id; exercise
  Escape, outside click, Up/Down, Enter, Left, and the slider's arrow keys.
  In both roomy and crowded toolbars, switch `omit`, `low`, `high`, `max`,
  and `off` without closing the menu: its horizontal position stays stable,
  and the trigger stays inside its slot, including with a long model name.
  Moving the anchor and dispatching a viewport resize must reposition the
  menu without an event-target type error. Automated geometry coverage:
  `node scripts/e2e-composer-thinking-layout.mjs` (isolated Electron fixture,
  production React picker and compiled styles; no live providers).
  Repeat native mouse press/release to open, select the first and subsequent
  reasoning levels, close, and reopen three times with motion enabled. The
  menu must retain its opening position on every selection; synthetic DOM
  `click()` alone does not exercise the trigger's `:active` transition.
  Hover each dot and its label: the corresponding label highlights. Unfilled
  dots brighten and enlarge slightly; filled dots and the selected thumb stay unchanged
  without shifting the menu. Move outside: the preview clears and the selected
  value remains unchanged. Reduced motion disables hover transitions.
  Click a non-adjacent level and verify the thumb travels through intermediate
  positions while the selected value already equals the target. Interrupt
  travel with another click; the thumb retargets without jumping to the old
  start, and only the clicked levels are submitted. Check save failure,
  stale completion, remount, and 3/5/7/8-stop alignment. At each stop, verify
  the fill covers the first dot's left edge and still ends at the thumb center.
  Native range dragging
  follows immediately; arrow keys retain focus and update the selection.
  With reduced motion enabled, the target is shown without a transition.
- **Expected**: The chip is in the right toolbar with a Bot icon; any
  explicitly installed plugin text actions appear after it and before
  Send/Abort. The host has no built-in prompt-enhancement action. Off omits the
  level text. The single anchored menu replaces its root
  with an in-place back row and submenu, never opens tabs or a second popover,
  and always reopens at the root. Model search filters sticky provider groups;
  reasoning levels come from `omit` then the selected model binding's enabled
  levels in canonical order. The root carries a drag slider with one labeled
  stop per level directly beneath the Reasoning level entry when more than
  one level is listed (a single-level binding hides the slider). Dragging
  across several stops persists only the last pending level; tick labels are
  not tab stops. Slider and tick commits update the chip immediately while
  the menu stays at the root. The Reasoning level entry opens the radio list,
  which uses radio semantics, a trailing check, and the current model support
  note. Selecting either value immediately updates the chip and root value,
  clears model filtering, and keeps the menu open. A
  non-reasoning or unknown model starts at `off`, but an explicit Settings
  binding can make its configured levels available; discovery never promotes it
  automatically. Refreshing discovered model data cannot overwrite the binding.
  Before the first message creates a session, the Composer uses the
  exact model selected in its model menu rather than the provider's default
  model; after materialization, the same exact-model capability remains in
  effect.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`,
  `03-runtime/13-model-catalog-and-selection.md`, ADR 0018, ADR 0027
- **Acceptance**: B (model config), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`thinking-ui.test.mjs`, `composer-model-thinking-menu.test.mjs`, `thinking-commit-queue.test.mjs`, agent-runtime capability tests); full UI scenario Draft

#### E2E-051: Thinking level persists with the session

- **Preconditions**: A reasoning-capable session is idle.
- **Steps**: 1) Select `high`. 2) Change Plan/Goal/Agent mode without changing the
  thinking level. 3) Restart the app and reopen the session. 4) Switch to
  another session and back.
- **Expected**: Every configuration update sends the complete session config;
  `high` survives the permission-mode change, session switches, host reload, and
  app restart.
  A v2 database migrates the same field to `off` without transcript loss.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `04-ux/08-component-spec.md`, ADR 0018
- **Acceptance**: F (persistence)
- **Milestone**: M5
- **Status**: Unit-covered (host schema/session tests, `thinking-ui.test.mjs`); full restart scenario Draft

#### E2E-052: Thinking level reaches the pi request

- **Preconditions**: Instrumented reasoning-capable provider with a sparse
  level set and request capture; one session configured above and below gaps.
- **Steps**: 1) Select each enabled level and run a prompt. 2) Seed an
  explicit binding level the catalog does not publish and run again. 3) Repeat
  with a pi-catalogued non-reasoning model, first with no enabled level and then
  after an explicit Settings opt-in.
- **Expected**: Main resolves capability using the session's actual model id;
  Composer, main, sidecar, and pi use the same upward-first/downward-second
  clamp over the binding's enabled set, without intersecting it with the
  catalog. Pi receives the effective level, an empty or `off`-only binding
  receives `off`, and an explicitly opted-in endpoint receives the configured
  level. Model-specific request semantics, including adaptive thinking and
  whether `off` is expressible, match the pinned pi record without a desktop
  rewrite.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, `03-runtime/13-model-catalog-and-selection.md`, ADR 0018, ADR 0027
- **Acceptance**: B (model config), C (chat and stream)
- **Milestone**: M5
- **Status**: Unit-covered (agent-runtime prompt/clamp tests); integration scenario Draft

#### E2E-053: Thinking streams separately from the answer

- **Preconditions**: Provider emits thinking deltas before and between answer
  deltas.
- **Steps**: 1) Start a turn in both light and dark themes. 2) Observe a
  thinking-only phase. 3) Let the answer complete. 4) Toggle the disclosure,
  test keyboard focus, enable reduced motion, and use Copy answer.
- **Expected**: The transcript opens during thinking-only streaming; the latest
  Thinking disclosure opens and updates without an empty answer bubble or
  duplicate Working indicator. If the user collapses or expands it, that choice
  remains authoritative through later thinking deltas and completion. The
  disclosure uses the transcript surface, theme tokens, a Sparkles/chevron
  trigger, and a left rule instead of an inset card; collapsed content leaves
  focus traversal and reduced motion disables the running marker pulse and
  transitions. Final answer markdown renders separately; Copy answer contains
  no thinking text.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/07-ui-design-system.md`, `04-ux/08-component-spec.md`, ADR 0018
- **Acceptance**: C (chat and stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`thinking-ui.test.mjs`, agent-runtime event tests); full streaming scenario Draft

#### E2E-054: Stored thinking reloads losslessly

- **Preconditions**: A completed assistant message contains both reasoning and
  final answer blocks; another contains reasoning only.
- **Steps**: 1) Complete both turns. 2) Restart the host/app. 3) Reopen the
  session. 4) inspect search results and answer copy.
- **Expected**: Host returns the same separate `thinking` and `content`
  values after reload/import/replace round-trips; both messages remain
  visible; search and answer copy exclude reasoning.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `04-ux/08-component-spec.md`, ADR 0018
- **Acceptance**: C (chat and stream), F (persistence)
- **Milestone**: M5
- **Status**: Unit-covered (host message/import tests, `thinking-ui.test.mjs`); full reload scenario Draft

#### E2E-055: Unsupported provider transition clamps safely

- **Preconditions**: Session on a reasoning provider at `max`; target
  providers include non-reasoning and sparse-level variants.
- **Steps**: 1) Switch to the non-reasoning provider. 2) Run a turn. 3) Switch
  to sparse variants around the previous level. 4) send malformed/legacy
  payloads lacking capability or thinking fields.
- **Expected**: Non-reasoning persists and sends `off`; sparse variants choose
  the same nearest level everywhere; missing fields fall back safely;
  malformed thinking is not rendered and never contaminates answer content.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/13-model-catalog-and-selection.md`, `04-ux/08-component-spec.md`, ADR 0018
- **Acceptance**: B (model config), C (chat and stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`thinking-ui.test.mjs`, host validation tests); full UI scenario Draft

#### E2E-056: Work panel shell docking and persistence

- **Preconditions**: App running with any workspace state.
- **Steps**: 1) Relaunch and inspect the titlebar and application menu; confirm
  the panel starts closed and a viewport-fixed work-panel toggle is present
  (disabled with no session). Press Cmd/Ctrl+J or click the toggle and inspect
  the no-resource New launcher, then press/click again to confirm it
  collapses the
  panel and no tab is created or deleted; a third press must restore the same
  context. 2) Open two distinct file artifacts, the same first file again,
  a URL preview, and a completed Bash row. 3) Verify the header is a tablist:
  open enough tabs to overflow it, confirm only the strip scrolls and the `+`
  trigger stays visible, and activate the scrolled-away tab. Right-click an
  inactive tab and choose Close Other Tabs; verify the pointed-to tab remains
  and becomes active, and that the action is disabled with one tab. Reopen
  multiple artifacts, then right-click and choose Close All Tabs; confirm the
  panel remains open on the New launcher. Reopen resources before checking
  hover/focus `×`, middle-click, drag reorder, insertion indicators, and edge
  auto-scroll. Open a tab menu with Shift+F10, navigate its items with arrows,
  and press Escape to leave the tabs unchanged. With only one or two tabs, drag
  unused header space to move the native window; tab and action clicks must
  still work without moving it.
  4) Click `+` twice and verify each creates and activates a separate New
  launcher tab. Confirm its body lists Review and each in-scope plugin view
  exactly once. With 40 plugin views and long localized names, shrink the
  window and narrow the panel: the New title stays pinned, the row list alone
  scrolls, and 40px rows stay reachable by wheel, scrollbar, and Tab focus
  (#2026). A quiet scrollbar thumb is visible before hover, its reserved
  gutter prevents label shifts, and there is no horizontal overflow or scroll
  chaining into the shell. Repeat with no explicit tab, a `+`-created New tab,
  few/no plugins, and light/dark themes in English and Chinese. Activate the
  last tool, close its view, and confirm the complete launcher returns.
  Open Browser and confirm its native surface opens at unchanged
  bounds. Open its context menu and verify the native popup appears above Browser
  chrome while the page remains visible. With Browser active, right-click another
  tab and confirm it still uses the native menu. Repeat at 50% and 150% app zoom;
  the menu must remain anchored to the pointer. Escape closes it without hiding
  the page or changing bounds. Close the window while a native menu is open and
  confirm the pending request settles. 5) Close active middle/edge tabs, verify neighbor selection,
  then close the final tab and confirm New remains. 6) Collapse/reopen the panel
  and trigger an artifact. In session A, leave Browser open; switch to B and
  create another tab set, then switch repeatedly between sessions and select a
  project without an active conversation. Generate a background artifact. 7)
  Drag the inner divider
  pointer-down does not jump the divider or resize the native window, cancel one
  gesture with Escape, then focus the handle and exercise Arrow/Shift+Arrow/Home/End.
  Commit a different panel width with Browser active, double-click the divider and
  confirm the default 360px width returns (or the live budget when it is smaller),
  then commit a different width again. 8) Record MainChat width
  and native bounds while opening, repeating the same open action, resizing the
  panel, collapsing, reopening, and closing the final resource. Repeat collapse
  on Windows while watching the entire frameless window. 9) With the panel open,
  resize the application from each edge and confirm only the application
  bounds change; the panel remains at its renderer-committed width. Resize from
  the left edge and repeat after toggling the sidebar. 10) Open, resize, and
  collapse on a small work area, then repeat while maximized and fullscreen. 11)
  Move the normal window between displays and change the active display's
  work-area geometry. 12) Send valid and malformed reservation payloads,
  including positive values, and confirm the compatibility seam never changes
  native bounds. 13) Relaunch. 14) Open a contributed plugin view and reload
  the main renderer with Cmd/Ctrl+R. Confirm the native view detaches before the
  new renderer appears, then reopen its tab and verify the cached plugin page
  returns. Repeat with a same-document navigation and a child-frame navigation;
  neither may detach the active view.
- **Expected**: Startup shows no panel, welcome chooser, or fixed tool buttons.
  A viewport-fixed toggle in the window's top-right corner is the pointer
  equivalent of Cmd/Ctrl+J; there is still no application-menu launcher.
  Cmd/Ctrl+J opens the active session's panel at its
  committed width without creating a resource tab and collapses it again on the
  next press while retaining that context,
  and the shortcut does nothing without an active session or while Settings is
  open. Each artifact atomically opens the docked third column and creates or
  activates one resource; file resources are path-keyed and repeated resources
  deduplicate. Opening, collapse, and
  closing animate the panel's width/flex allocation with its bounded
  opacity/slide, so MainChat reflows continuously without a pre-animation jump.
  Opening the panel, collapsing it, or committing a divider resize updates the
  presentation without a native-window jump. The header is a horizontally
  scrollable tablist with stable `92px–180px` tabs, visible spacing, and a
  fixed `+`; labels stay readable instead of shrinking into one cluster, the
  strip alone scrolls, active tabs scroll into view, and close selects the
  right neighbor then left. A localized, keyboard-navigable tab context menu
  offers Close Tab, Close Other Tabs, and Close All Tabs. Close Other Tabs
  retains and activates its target and is disabled for one tab; Close All Tabs
  closes Browser resources and leaves the panel open on New. For an active
  Browser/plugin view, the tab context menu is a Main-owned native popup above
  Browser chrome; the page stays visible and its bounds do not change. When
  Browser is active, right-clicking another tab also selects this native path.
  Native menu labels, order, and enabled states match the renderer menu, while
  platform styling preserves the native-view z-order. Its position follows the
  pointer at the current app zoom, and closing the window settles the request.
  New launcher tabs expose Review and plugin views as body buttons, with no
  overlapping popup. Dragging a tab shows a before/after insertion indicator;
  edge-holding scrolls toward hidden tabs, and reordering leaves the active
  resource unchanged. `Alt+ArrowLeft`/`Alt+ArrowRight` provides keyboard
  reordering. Selecting a launcher row replaces New or activates its singleton.
  Collapse retains runtime tabs while hiding the panel. Width follows the shared
  three-column budget without a fixed pixel cap and
  previews its current/minimum/maximum values through the panel separator. The
  inner divider exposes the panel width to assistive technology and supports
  the documented keyboard steps. Pointer-down preserves the starting width,
  movement follows the pointer continuously, and release commits once only when
  the target changed. Escape or cancellation restores the press-time width, and a
  double-click restores the 360px default inside the live bounds.
  Browser preview does not intercept an active divider drag.
  A and B independently restore their runtime open state, ordered tabs, active
  tab, and Browser resource; selecting a project without an active conversation
  hides the panel, and no relative resource crosses session/workspace context.
  Background artifacts update only their retained context and never change the
  visible panel or native window geometry. Before exit motion, the native
  Browser preview detaches from the window; collapse produces no stale preview
  frame. Only `{width}` is restored after relaunch; every session's open state,
  tabs, active tab, and Browser resource reset. The panel remains exactly at its
  committed width while open, and sidebar or native window changes do not alter
  that preferred panel width. The compatibility reservation seam returns
  `{requested: 0, reserved: 0}` for every valid request, including positive
  legacy values, and never changes native bounds. Malformed payloads fail with
  `INVALID_ARGUMENT` and never coerce. A full main-frame renderer reload
  detaches the visible plugin view without closing its page, so no orphan
  overlay covers the fresh renderer; reopening the tab reattaches that same
  page. Same-document and child-frame navigation leave the view attached. The
  former context-panel overlay no longer exists.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, `04-ux/01-ui-ia.md`,
  `04-ux/07-ui-design-system.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, ADR 0068, ADR 0151, ADR 0195, D207, D292,
  D357
- **Acceptance**: F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`work-panel-resize.test.mjs`,
  `work-panel-window.test.mjs`, `work-panel-presentation.test.mjs`,
  `work-panel-tabs.test.mjs`, `browser-tab-restore.test.mjs`,
  `work-panel.test.mjs`, `plugin-work-panel-views.test.mjs`,
  `plugin-view-navigation.test.mjs`, `work-panel-tab-menu.test.mjs`);
  isolated Electron tab-menu, Browser native-menu page visibility, and close
  geometry in `scripts/e2e-work-panel-tab-close.mjs`; launcher overflow,
  native focus reveal, hit targets, and open/close user paths in
  `node scripts/e2e-work-panel-launcher-overflow.mjs`; full UI scenario Draft

#### E2E-057: Message-owned review history survives commits and rolls back safely

- **Preconditions**: A project-bound Agent session with a writable workspace;
  no Git repository is required.
- **Steps**: 1) Ask the active agent to edit an existing file and create a new
  file in session A. 2) Expand the activity group and inspect each review card
  directly after its corresponding tool row; verify every card starts
  collapsed with its added/modified status and +/− counts visible in the
  header, then expand it to verify the exact hunks. 3) Commit the files
  outside the app, close and reopen the Review panel, then reload session A.
  4) Verify the same cards
  and counts remain because they come from the transcript messages. 5) Use a
  card's rollback action and verify the created file is removed or the previous
  file bytes are restored. 6) Edit that file again outside the app and retry
  rollback; inspect the conflict result and verify the later bytes remain. 7)
  Switch to session B and a background project session, then return to A. 8)
  Repeat with failed, denied, and scratch writes.
- **Expected**: Each successful workspace Write/Edit creates one message-owned
  review record and one adjacent keyboard-accessible card; the card is never a
  bottom/global entry. The completion opens nothing: the panel keeps whatever
  the user left it showing, and Review appears only after the user opens it.
  Every review card, inline and in the Review tab, is
  collapsed by default and expands on demand. The Review tab lists A's
  chronological recorded changes, independent of Git status, repository
  presence, commit state, focus refresh,
  or workspace switching. Added, modified, and deleted statuses plus line
  additions/deletions and hunks are shown when bounded evidence is available.
  Successful rollback updates the card to Rolled back and survives restart.
  A post-tool file change returns Conflict and does not overwrite it. Failed,
  denied, and scratch writes do not create cards; session B cannot inherit A's
  records. Binary or oversized snapshots show bounded metadata and disable
  rollback when the previous bytes were not retained.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §13a,
  `03-runtime/03-tools-and-permissions.md` §4c,
  `04-ux/08-component-spec.md` §5, ADR 0043
- **Acceptance**: D (workspace), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`chat-review-entry.test.mjs`); full UI scenario Draft

#### E2E-CHAT-turn-changed-files-summary: A finished turn lists the files it changed

- **Preconditions**: A project-bound Agent session with a writable workspace.
- **Steps**: 1) Ask the agent to create one file and edit another; watch the
  turn while it streams. 2) After the reply finishes, inspect the area below
  the answer: only the summary header is visible. Click it to expand, click
  again to collapse, then focus it and repeat with Enter and Space. Confirm
  hidden rows and the Review link cannot receive keyboard focus and the title
  keeps its viewport anchor. 3) Ask for a change touching more than twelve files
  across several directories; confirm its card starts collapsed independently.
  Expand it. 4) Click a row, then the `View all N files in Review` link.
  5) Roll back one file's change in Review and return to the turn.
  6) Ask a question that writes no files. 7) Switch sessions and come back.
- **Expected**: No summary appears while a turn streams or after a failed
  turn. A finished turn that wrote workspace files shows one borderless
  `Changes this turn` card below its answer and above plugin `entryExtra`
  blocks. It starts collapsed with only its chevron, title, file count, and
  summed `+`/`−` visible; directory counts remain visible for dense summaries.
  The full-width header toggles with click, Enter, or Space, exposes its state
  through ARIA, and leaves Review closed. Collapsed details occupy no space
  and cannot receive focus. Each turn's explicit choice is independent and
  survives ordinary rerenders. When expanded, each path appears once with
  its merged status letter and counts; up to four files use relaxed rows,
  more use dense rows with a directory count, and rows past 12 fold into
  `+N more`. A row click opens the session's Review tab scrolled to that file
  with its changes expanded; the link opens Review without expanding. The
  rolled-back file stays listed, struck through. Every earlier finished turn
  keeps its own card, a turn without writes has none, and a session switch
  fetches nothing extra. The per-call review rows are unchanged.
- **Specs linked**: `04-ux/08-component-spec.md` §4.4, D674
- **Acceptance**: D (workspace), Quality
- **Milestone**: M5
- **Status**: Unit/SSR-covered (`turn-changes-card.test.mjs`); isolated Chromium
  pointer, Enter/Space, independent disclosure, hidden-focus, and Review paths
  covered by `turn-changes-disclosure-user-path.test.mjs`; full UI scenario Draft

#### E2E-CHAT-completed-turn-scrolls-to-prompt: A finished reply reads from its prompt

- **Preconditions**: An Agent session whose next reply is longer than the
  transcript viewport.
- **Steps**: 1) Send a prompt and let the transcript follow the reply to its
  end. 2) Send a prompt with a reply short enough to fit on screen. 3) Send a
  long prompt again and scroll up while it streams. 4) Stop a long reply
  midway. 5) Queue a follow-up while a long reply streams.
- **Expected**: 1) When the reply completes, its prompt sits at the top of the
  viewport and jump-to-latest appears. 2) The short reply stays at the bottom
  in follow mode. 3) The view stays where the user scrolled. 4) The aborted
  turn stays at the bottom. 5) The follow-up turn keeps following at the
  bottom.
- **Specs linked**: `04-ux/09-interaction-patterns.md` §2.2,
  `04-ux/08-component-spec.md` §4.4, D676
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Automated (`pnpm test:e2e:transcript-turn-completion`, real
  `useTranscriptScroll` in Electron; `turn-completion-scroll.test.mjs`)

#### E2E-058: Built-in interactive terminal is absent

- **Preconditions**: A workspace is open and the Agent has completed a Bash
  tool call.
- **Steps**: 1) Open the work panel with Cmd/Ctrl+J and inspect the empty
  state and context menu. 2) Confirm there is no Terminal tab, launcher row,
  terminal-specific panel copy, or terminal IPC surface. 3) Confirm the
  completed Bash row still shows its command, output, status, and copy action,
  and that its `IconTerminal` presentation remains available. 4) Verify an
  interactive shell is opened in the user's external terminal instead of the
  work panel. 5) Build/package the desktop app and inspect the dependency and
  unpacked-resource lists.
- **Expected**: The work panel offers the Review launcher row plus Browser and
  in-scope plugin views; Review opens on explicit user action and file resources
  are transcript-opened; no PTY is created and no terminal tab can be opened.
  Agent Bash remains non-interactive and fully visible in the transcript.
  Interactive shell work is performed by the external terminal. Desktop
  packaging has no PTY/xterm dependency, terminal-specific
  IPC, or native terminal payload, while generic lifecycle `terminal` values
  continue to work.
- **Specs linked**: `02-architecture/02-tech-stack.md`,
  `03-runtime/01-ipc-protocol.md` §13a, `04-ux/08-component-spec.md` §5,
  ADR 0108
- **Acceptance**: D (workspace), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`work-panel.test.mjs`, `packaging-footprint.test.mjs`);
  full UI scenario Draft

#### E2E-059: Embedded browser preview isolation and overlays

- **Preconditions**: A local dev server is running; a URL or BrowserPreview artifact exists; HTML fixtures exist both inside and outside the workspace.
- **Steps**: 1) Activate the artifact, enter `localhost:<port>` and
  `localhost:<port>/index.html` without a scheme, and submit each. Enter a
  dotted host with a port (for example, `example.com:8080`), then verify an
  explicit HTTP(S) URL and a rejected `javascript:` URL.
  2) Navigate site links; use back/forward/reload/stop. 3) Trigger a
  `window.open` popup and a permission-requesting page (e.g. notification
  prompt). 4) Open global search, then rename a session from the left sidebar;
  close it and open Settings. Return to chat
  and trigger an inline tool permission card. 5) Switch to another panel tab
  and back; close the panel. 6) Use open-external. 7) From both an existing page
  and a blank Browser tab, enter an existing HTML file inside the workspace by
  platform-appropriate `file:` URL and absolute path. Then enter an existing
  file outside the workspace by its platform-appropriate URL and absolute path
  (for example, `file:///tmp/demo.html` and `/tmp/demo.html` on Unix, or
  `file:///D:/demo.html` and `D:\demo.html` on Windows). From the loaded
  local HTML, follow a link to another existing file outside the workspace.
  From an HTTP page, try the same outside file link and enter a missing local
  file path.
- **Expected**: Scheme-less input normalizes to http; nav state (URL bar,
  back/forward enablement, load spinner) mirrors the page. Popups open in
  the default browser (never in-app) only when the URL parses as http(s) or
  mailto; popups using `file:`, `javascript:`, and custom schemes are denied.
  Permission requests are denied; top-level navigation allows HTTP(S),
  in-workspace file links, and existing local file links from a local file
  page. HTTP pages cannot navigate to files outside the workspace. Missing
  files, directories, remote file authorities, and other schemes are blocked.
  The preview hides for the whole lifetime of the rename
  dialog and every other blocking overlay, and while
  unmounted, reappearing with correct bounds afterwards. An inline permission
  card does not hide or remount the preview; resize/drag keeps the native view
  visible and aligned with the placeholder rect without a black flash. Opening
  the work-panel context dropdown moves beside the native view; the view keeps
  its full surface rect and the plugin body does not shift down.
  Open-external launches an http(s) page in the default browser and any loaded
  local file via `openPath`. The view uses an isolated persist partition
  (no session bleed from the app shell). Both inside and outside forms load;
  the HTTP page's outside link and missing path do not reach the guest load.
  The submitted address remains visible on failure, with localized copy that
  only existing local files can open.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §13a, `04-ux/08-component-spec.md`, `05-security/01-security.md`, ADR 0019, ADR 0168, ADR 0328
- **Acceptance**: Quality, Security
- **Milestone**: M5
- **Status**: Partial automation: `scripts/e2e-browser-local-file-access.mjs` covers native local-file navigation; the address-bar and overlay workflow remains manual.

#### E2E-CHAT-html-artifacts: Open generated pages from ordinary and project conversations

- **Preconditions**: Isolated Electron profile, real Host storage and loopback
  model fixture; no credentials or paid provider requests.
- **Steps**: Open assistant Markdown links to ordinary-session scratch HTML,
  primary project HTML, secondary project-folder HTML, project scratch HTML
  and an isolated session's worktree HTML. Repeat with a `file:` URL containing
  Unicode/spaces. Interact with each rendered page using native pointer input.
  Try a missing file, an outside HTML file, an outside text file whose folder
  and name contain spaces and CJK characters, an outside file under a `.ssh`
  folder, an outside extensionless file and the extensionless `.ssh/config`,
  and a positioned HTML source reference. Send a prompt that invokes BrowserPreview through the real
  sidecar in ordinary, project and isolated conversations. Disable Browser and click
  again. Switch conversations between cases.
- **Expected**: Valid pages render and execute in the side browser at their
  canonical path. A missing file reports an error without a guest load. The
  outside HTML, text, `.ssh`, and extensionless files open in the host file
  view (HTML as source, never executed) (ADR 0339).
  A line reference opens source, not execution. Disabled Browser remains
  disabled and reports an error. BrowserPreview uses its originating session's
  roots and delivers a valid resource tab. No visible-project fallback.
- **Automation**: `node scripts/e2e-chat-html-artifacts.mjs`, after building
  Host, runtime and Electron. Captures and synthetic profiles are retained in
  `PI_TEST_OUTPUT` (or the OS temporary directory).
- **Status**: Electron user-path covered on Windows and macOS (on macOS set
  `PI_TEST_OUTPUT` to a real-path directory such as `/private/tmp/...`; the
  `/var` → `/private/var` alias of the default temporary directory makes guest
  URL matching miss); Linux pending.

#### E2E-BROWSER-capture-resize: Capture preserves live placement and restores the latest viewport

- **Preconditions**: Isolated Electron profile and a local responsive page
  taller than the visible browser viewport. No provider account is needed.
- **Steps**: Start a full-page screenshot for pages taller than 2048px and
  verify proportional scaling to at most 1280×2048 output pixels. Keep one
  capture pending while resizing the browser hole twice. Repeat with raw
  `Page.captureScreenshot`, which retains caller-supplied capture settings.
  While a capture is pending, maximize, restore, enter fullscreen, and leave
  fullscreen so the panel moves or changes size. Also queue overlapping
  captures, switch resource tabs, hide and restore a captured page, fail a
  capture, close a tab with a queued capture, and recreate a destroyed guest.
- **Expected**: Full-page Browser captures are proportionally bounded to
  1280×2048; viewport captures are unchanged. During capture, the native guest
  follows the panel's current position and remains clipped within its bounds;
  it never covers the conversation. Its capture-time viewport stays stable
  until completion, then `innerWidth`/`innerHeight` match the latest requested
  bounds. Captures on one page serialize without blocking a sibling page.
  Failed capture releases resize handling. Hiding or closing a page cannot
  expose it or redirect its queued capture to another page. A destroyed guest
  leaves no orphan native view when it is recreated or disposed. No screenshot
  is repeated to repair layout.
- **Image failure recovery**: If a full-page image cannot be normalized, the tool
  result keeps its screenshot path/text and replaces the image with an omission
  message; the failed image is absent from later model requests.
- **Timeout recovery**: When either screenshot API does not complete within
  30 seconds, it fails with `TIMEOUT`, detaches the stalled CDP session, and
  releases the page queue; the next capture reattaches and can run.
- **Status**: Native Electron capture/resize and pending window-transition
  placement path automated by
  `node scripts/e2e-browser-capture-resize.mjs` (artifacts retained). The
  production Host/Pane/CDP service paths for failure, queueing, tab closure,
  guest recreation, and relocated-panel clipping are covered by
  `apps/desktop/test/browser-capture-resize.test.mjs`.

#### E2E-BROWSER-session-preview-race: Session switching does not expose a stale preview

- **Preconditions**: Two sessions have distinct HTML previews; their Browser
  panel contexts are retained independently. Directory lookups and document
  loads can be delayed independently by the fixture.
- **Steps**: Preview A; produce B's preview in the background; collapse A's
  panel and open B; delay B's directory lookup and load, then return to A.
  Switch rapidly B → C and finish the older B lookup last. Repeat with an
  already-started old load, an empty session, a failed load, and disposal.
- **Expected**: Background B does not navigate A. On switching, no A document
  appears in B's panel, even after bounds/visibility updates. Only the latest
  navigation can reveal the guest; the late B lookup cannot replace C.
  Returning to A restores A, while an empty session remains empty. Closing or
  disposing cannot be undone by a delayed completion. Same-session navigation
  keeps its current page visible. Invalid, failed, or timed-out loads do not
  report the previous document as the destination being ready. A switch that
  exceeds the 15-second main-frame wait stays hidden with an error until retried.
  Slow images/subframes do not delay revealing a committed current document.
  Start navigation during an unfinished page load: the old ERR_ABORTED event
  must not prevent the new address, title, and loading state from updating.
- **Specs linked**: `04-ux/08-component-spec.md` §5.3; ADR 0028, ADR 0170.
- **Status**: Automated service-path coverage in `browser-host-session.test.mjs`
  and `browser-pane-navigation.test.mjs`: production BrowserHost/BrowserPane,
  controlled native-browser/Host boundaries, and deterministic timers. Native
  Electron compositing and the reporter's live sessions are not covered.

#### E2E-BROWSER-responsive-resource-tabs

- **Preconditions**: Browser enabled; isolated profile; local HTML with a
  17-second image, a delayed main response, and ordinary/new-window links.
- **Steps**: Submit the slow-image URL once; observe loading feedback and page
  display before the image finishes. Open two chat links and a website
  new-window link; switch tabs, navigate within one, then switch away and back.
  Repeat with a delayed main response, Stop, failed navigation, and a retry.
  Set Link open destination to External and repeat the new-window link.
- **Expected**: The current document displays after main-frame commit; slow
  assets do not strand the empty state. New links preserve earlier resource
  tabs. Tab switching retains forms, scroll positions, JS state and independent history
  without another page request. Each tab keeps its last address; same-tab navigation updates only its
  originating tab. Failure/stop leave usable address controls. External mode
  does not create a work-panel tab. Session switches and invalid schemes retain
  their security and visibility gates.
- **Additional paths**: Invoke BrowserPreview through ToolSearch/BrowserPreview
  while a tab has unsent form input: only a new host-owned page navigates, before
  its renderer tab mounts. Navigate for an inactive session and verify immediate
  execution in its connected page without changing the visible one. Open a blank
  tab and inspect its empty address and state. Close a background tab and verify its WebContents is
  destroyed without affecting its sibling; deleting a session and plugin/window
  disposal release the appropriate retained pages.
- **Status**: Targeted isolated Electron validation; no new repository test suite.

#### E2E-BROWSER-in-page-navigation: Browser chrome follows same-document navigation

- **Preconditions**: Browser plugin enabled; a local page has a fragment link
  and a History API route control.
- **Steps**: Open the page; click the fragment link; change the route with
  `history.pushState`; use Back, Forward, and Reload. Switch to another session
  and verify late events from the old page cannot update the new preview.
- **Expected**: The address matches the main document URL and history buttons
  reflect its history. Loading settles back to Reload. Subframe, replaced-frame,
  and invalidated-session events cannot change the toolbar.
- **Coverage**: `browser-pane-navigation.test.mjs` for published state and event
  isolation; native Electron click-through for actual same-document events.
- **Specs linked**: `04-ux/08-component-spec.md` §5.3.

#### E2E-BROWSER-background-lifecycle: Side-panel presentation does not own page execution

- **Preconditions**: Dedicated worktree, reused Electron/toolchain, isolated
  profile and localhost A/B/C pages. No real account or paid provider requests.
- **Steps**: Snapshot A, switch to B, fill and click A through production CDP,
  then start a new hidden screenshot. Detach presentation, reload the renderer,
  repeat A's snapshot/screenshot and restore its tab. Open a first C preview
  before UI mounting. Close C and try unknown/closed targets. Exercise every
  Browser API through real concurrent plugin invocations with spoofed argument
  identities. Restore missing renderer tabs while the panel is collapsed.
- **Expected**: A's actions, pixels and screenshot path belong to A; B is
  unchanged and remains the only visible guest. No background action reveals
  a page. Renderer reload retains native identity and inputs. C executes before
  mounting. Unknown/closed targets fail without fallback. Restored tabs are
  scoped, duplicate-free and do not reopen or replace a user's selected resource.
  Hidden backing hosts remain invisible and release with the last parked page.
- **Automation**: `node scripts/e2e-browser-background.mjs`,
  `browser-background-session.test.mjs`, `browser-tab-restore.test.mjs`,
  `browser-capture-resize.test.mjs`, and `plugin-tool-invocations.test.mjs`.
  The isolated Desktop trial also uses real Composer, sidecar, plugin and Host
  wiring with a localhost SSE model; no real provider is contacted.
- **Specs**: `04-ux/08-component-spec.md`, `07-plugins/03-plugin-api.md`,
  `05-security/01-security.md`, [background lifecycle ADR](../../adr/browser-background-lifecycle.md).
- **Status**: Automated native Chromium/service paths; isolated Desktop trial passed.

#### E2E-BROWSER-audio-mute: A user mutes one Browser tab from the toolbar

- **Preconditions**: Dedicated worktree, reused Electron/toolchain, isolated
  profile and localhost pages that play a quiet Web Audio tone.
- **Steps**: Open two tabs in one session and wait until both report audible.
  Mute the first tab through the toolbar action, then unmute it. Mute the
  second tab, close it, and open a new page with the same tab id.
- **Expected**: Only the chosen guest is muted in Chromium and its published
  state reports `audioMuted` while still reporting `audible`; the sibling tab is
  unaffected. Unmute restores the tab. Closing a tab discards its mute choice.
  The toolbar button enables with a page, toggles Mute tab / Unmute tab and
  `aria-pressed`, and follows the selected tab's own state.
- **Automation**: `node scripts/e2e-browser-audio-mute.mjs`,
  `browser-pane-navigation.test.mjs`, `browser-mute-toolbar.test.mjs`.
- **Specs**: `04-ux/08-component-spec.md`, `07-plugins/03-plugin-api.md`.
- **Status**: Automated native Chromium path.

#### E2E-060: Files tab browsing stays inside the workspace

- **Preconditions**: Workspace with file artifacts for nested source, large
  (>512KB), image, and binary files.
- **Steps**: 1) Activate each file artifact and verify a distinct path-keyed
  resource in the header switcher; browse the tree, expanding nested folders.
  2) Open a source
  file, the image, the binary, and the large file. 3) Use reveal-in-Finder.
  4) Attempt a traversal read (`../outside`) via devtools IPC. 5) Switch
  workspaces.
- **Expected**: Directories list lazily, folders first, with `.git` /
  `node_modules` / build outputs hidden; text renders with syntax highlight
  (capped at 5000 lines), images preview inline, binary and oversized files
  show fallbacks with reveal still available. Traversal attempts are
  rejected with `INVALID_ARGUMENT`; no workspace → empty state; switching
  workspaces resets the tree and viewer.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §13a, ADR 0019,
  `03-runtime/15-workspace-ignore-rules.md`
- **Acceptance**: D (workspace), Security
- **Milestone**: M5
- **Status**: Unit-covered (`fs-panel-guard.test.mjs`); full UI scenario Draft

---

#### E2E-059a: Transcript message plates follow WorkBuddy density

- **Preconditions**: A session contains at least one short user prompt, one
  longer user prompt, and a completed assistant answer; light and dark themes
  available.
- **Steps**: 1) Open the session in dark theme. 2) Inspect user and assistant
  rows at rest and on hover. 3) Start a streaming assistant answer. 4) Switch
  to light theme and repeat. 5) Focus the copy control with the keyboard.
- **Expected**: User turns are right-aligned, theme-neutral soft plates capped
  near 560px, derived from each theme's primary text ink rather than an accent
  tint, with a subtle border; assistant answers remain transparent full-width
  prose in the 720px content band, including while they stream — no left rail
  and no whole-turn `--ds-tile` (D323). The tile belongs only to a
  subagent/delegation card (D319). Row spacing is denser (~10px). Copy chips are
  hidden at rest, appear on hover/focus-within, and stay right-aligned under
  user turns. Both themes keep readable contrast on the user plate.
- **Specs linked**: `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md` §8.3 / §8.4, `04-ux/10-workbuddy-benchmark-ux.md`,
  decisions-log D101, D323
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`transcript-style.test.mjs`); full visual scenario Draft

#### E2E-CHAT-transcript-context-menu: Right-click a message or the transcript

- **Preconditions**: A session contains a completed user prompt and a
  completed assistant answer; the conversation pane is focused.
- **Steps**: 1) Right-click the user plate. 2) Choose Copy, then Select
  message text. 3) Select a phrase in the user plate, right-click that
  plate, and choose Copy; collapse the caret, right-click again, and
  choose Copy. 4) Right-click the assistant turn and choose Copy.
  5) Right-click empty space below the last turn and choose Copy
  conversation. 6) Press Escape on an open menu, then Tab. 7) Right-click
  a markdown link in the answer. 8) Edit the user message, replace its content,
  select a phrase, and right-click Copy. Repeat with a collapsed caret and
  Select message text, then cancel editing and copy the saved message.
- **Expected**: The user menu lists Copy, Select message text, Edit, and
  a separated Delete; the assistant menu lists Copy, Select message text,
  Regenerate, and Branch. Copy writes the live selection in the
  right-clicked turn when the menu opened over one; a collapsed caret
  or a selection outside that row falls back to the whole turn. Copy
  conversation writes the labelled thread. Both show a toast. Select
  text highlights the bubble. Escape and Tab dismiss the menu without
  running an item.
  A link still offers Open in default browser, Open in work panel, and
  Copy link address. Quote, Annotate, and Open side chat are absent
  (ADR 0268). The surface is a viewport-fixed body-level layer and does
  not resize the transcript. During editing, Copy uses the selected draft text
  or the full draft with a collapsed caret; Select message text selects the
  draft. Edit, Delete, and revision actions are absent until editing ends.
  Cancel preserves the original message. Automated Chromium component check:
  `node scripts/e2e-message-edit-copy.mjs`.
- **Specs linked**: `04-ux/08-component-spec.md` §8.3 / §8.5,
  `04-ux/09-interaction-patterns.md` (floating dropdown surfaces),
  ADR 0268
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`chat-context-menu.test.mjs`,
  `chat-context-menu-items.test.mjs`, `chat-context-menu-surface.test.mjs`);
  full UI scenario Draft

#### E2E-CHAT-radial-background-menu: Radial menu on the empty transcript background

- **Preconditions**: Settings → Appearance → Radial context menu is available. A
  session has a completed user prompt, a completed assistant answer, and enough
  history to scroll.
- **Steps**: 1) With the switch off, right-click empty space below the last
  turn and confirm the vertical conversation menu. 2) Turn the switch on and
  right-click the same space; inspect the four sectors and their at-rest
  icon-and-label stacks. 3) Move the pointer through each sector and click
  Copy conversation; reopen, press the right button over a sector and release
  it there, and confirm the action runs. 4) Set Up to Copy last
  answer and Right to Leave empty, then reopen the ring. 5) Click the hub
  without moving, then reopen and press Escape; repeat with an outside click,
  a scroll, and a window resize; reopen and right-press on a sector, then
  release over the hub and confirm nothing runs. 6) Reopen with Shift+F10, walk
  the sectors with the arrow keys, and run one with Enter. 7) Restart the app,
  confirm the switch and the four directions persist, then write an unknown
  action for one direction into the settings file and confirm that direction
  resolves to its default.
- **Expected**: With the switch off the vertical menu opens unchanged. With it
  on, a four-sector ring centred on the pointer replaces it and stays fully
  inside the window near an edge. Every sector shows its action's icon and
  label before any hover; the sector under the pointer highlights as a filled
  sector, with no focus rectangle over it. Clicking runs that action, closes
  the ring, and shows the usual toast where the action copies. A right-press
  started while the ring is open runs the sector it is released on; releasing
  over the hub dismisses without running, and the release trailing the
  right-click that opened the ring runs nothing. A **Leave empty** direction renders a disabled sector and
  runs nothing; Copy last answer is disabled until an answer exists.
  Open browser reveals the work panel on a blank browser tab, the work panel
  direction toggles — it reads Open work panel while the panel is collapsed and
  Close work panel while it is open, and the second click closes it — and Open
  project folder opens the session's project in the OS file manager and is
  disabled for a session without one. A click on
  the hub, an outside press, Escape, Tab, scroll, and resize all dismiss the
  ring without running anything. Arrow keys move the highlight and Enter runs
  the highlighted action. The switch and the four directions survive a restart,
  and an unknown stored action falls back to that direction's default. Message
  rows, links, file references, the sidebar, and the work panel keep their
  vertical menus.
- **Specs linked**: `04-ux/09-interaction-patterns.md` §1.11,
  `04-ux/06-settings-ia.md`
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Chromium component check (`node scripts/e2e-radial-menu.mjs`:
  at-rest sector labels, pointer highlight, click/hub/disabled/Escape paths,
  the right-press marking release paths, arrow-key focus, and viewport
  clamping) plus unit coverage (`radial-menu.test.mjs`,
  `settings-roundtrip.test.mjs`); full desktop journey Draft

### E2E-CHAT-delete-turn-preserves-other-live-outputs

- **Preconditions**: A session has three completed turns. The renderer has
  assistant and tool outputs for all three turns, while persistence is missing
  at least one output because its outbox append is still pending.
- **Steps**: Delete the middle user turn, then reload the session after the
  transcript replacement completes.
- **Expected**: The deleted user turn and its outputs remain absent. The first
  and third turns retain their user, assistant, and tool messages before and
  after reload. A pending append cannot run after transcript replacement and
  restore the deleted turn.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, ADR 0060
- **Acceptance**: C (chat stream), F (persistence), Quality
- **Milestone**: M6+
- **Status**: Unit-covered (`delete-message-preserves-transcript.test.mjs`,
  `persistence-outbox.test.mjs`); complete desktop journey remains Draft

- **Full-history regression**: Open a 140-message session without scrolling
  back and choose Copy conversation. The clipboard must contain messages
  1–140, not only the loaded tail. Repeat from a search context window and
  with a truncated long message. Preserve visible in-flight text; a failed
  history read must report an error and leave the clipboard unchanged.
  Copy must not load history until selected or change the reading position.
  Run `node scripts/e2e-copy-conversation.mjs`.

#### E2E-CHAT-copy-formula-as-tex: Copying rendered math yields its source

Math boundaries remain parseable after copying: touching inline fences get
one separator, and every prose dollar in the copied text is escaped, together
with backslash runs that would otherwise escape a fence.
Annotation whitespace is preserved; widened multiline inline math uses a
literal `<span>` wrapper to prevent a flow opener when pasted at column zero.
TeX newlines are not flattened because they can terminate `%` comments.
The wrapper is Markdown source in `text/plain`, not a `text/html` payload;
compatibility with external editors that disallow inline HTML is not promised.
Regression coverage checks both copy entry points and Markdown round trips
for adjacent formulas, prose dollars on either side, formatting wrappers,
line/block boundaries, padding, and multiline math including TeX comments.
Display math containing `- x`, `+ x`, `* x`, `> x`, or internal blank lines
must remain a single math node after copying. The shared remark grammar
keeps unclosed math in the streaming tail until its fence closes; subsequent
prose and its source offsets remain intact. A footnote whose definition
follows its reference — adjacently or streamed in later — renders as a real
reference and note section rather than a literal `[^1]`, which is what block
splitting costs when a slice is parsed without the rest of the message.
CRLF, ordinary lists, quotes, GFM tables, fenced code and the sources that
must keep splitting are covered by `markdown-blocks.test.mjs`.


- **Preconditions**: An assistant answer contains inline math inside a
  sentence, a display formula on its own lines, a `\[ … \]` formula inside a
  sentence and another on its own lines, a `\( … \)` formula, a formula
  carrying a literal `$`, an inline formula whose value carries a newline and
  another whose value carries one at each edge, a paragraph with
  no math, and — each sharing a selection with a formula — a paragraph whose
  source wrapped across several lines, a bulleted list, a table, a second
  table whose cell holds a `\[ … \]` formula, a fenced
  code block that contains blank lines, and a turn whose prose is interrupted
  by chrome that is unselectable only because it inherits the shell's
  `user-select: none` (a tool row's section head).
- **Steps**: 1) Select the sentence holding the inline formula and press
  Ctrl/Cmd+C. 2) Select the display formula and copy it. 3) Select from the
  middle of a formula to the end of its sentence and copy. 4) Select a
  paragraph, a formula, and another paragraph together and copy. 5) Select
  prose with no formula in it and copy. 6) Copy each of the wrapped paragraph,
  the list, both tables, and the code block. 7) Copy each `\[ … \]` formula, the
  `\( … \)` one, the formula carrying a literal `$`, and the two whose values
  carry newlines. 8) Select a formula backwards — from the end of the
  sentence to its start — and copy. 9) With a formula selected, right-click
  that turn and choose Copy, then right-click a different turn and choose Copy.
  10) Select a turn's whole contents the way the Select text item does, so the
  range is anchored on the turn while the copy is raised on a paragraph inside
  it, and copy. 11) Select without ever leaving one formula — a drag inside its
  rendering — and copy. 12) Render each result back through the same answer
  renderer — what pasting it into the composer and sending it produces — and
  compare the formulas it paints with the ones the selection covered.
- **Expected**: Every formula reaches the clipboard as the TeX it was written
  in — `$…$` inline, `$$…$$` on its own lines — instead of the glyphs KaTeX
  painted, or the same expression twice over from its two trees. A formula
  carrying a literal `$` widens its delimiter run past it, as a code span's
  fence does, and pastes back as the formula rather than as prose; an inline
  formula whose value carries a newline keeps the narrow run, because a `$$`
  run at the start of a line would open a flow block and swallow the
  paragraph; one whose value carries a newline at each edge is written with
  padding of its own, because the grammar drops a line ending there as it
  drops a space. A cut that
  starts inside a formula copies the whole formula, and a selection that never
  leaves one copies that formula alone. Everything else in the
  selection is byte for byte what the platform already copied: a wrapped
  paragraph stays one line, a list keeps one line per item, a table keeps tabs
  between cells and one line per row including the newline the platform closes
  the last row with, and a code block keeps its blank lines. Chrome the copy
  leaves behind stays out of the clipboard whether `base.css` marks it
  `user-select: none` by selector (a code block's language rail) or it is inert
  only by inheriting the shell's default (a tool row's section head, a compact
  thinking row). A selection with no formula in it is written by the platform
  unchanged; a selection that holds one reaches the clipboard as its source
  however deep inside it the copy was raised, so a range anchored on a turn —
  what Select text produces — copies as TeX even though Chromium raises the
  event on a paragraph within it. Right-click Copy and Ctrl/Cmd+C produce the
  same string for one selection, and a right-click on a turn that does not own
  the selection reads no excerpt from it, so Copy falls back to that turn's own
  source. A pasted formula renders as
  the one it came from — same TeX, and display math still display math —
  `\[ … \]` included: it is painted inside its sentence's paragraph, and copies
  with `$$` on a line of its own, which is enough to open a display block when
  it is pasted back. `\( … \)` stays
  inline. A table cell reaches it too, measured rather than assumed: the
  `.katex-display` box breaks the row for the platform's own reading as well,
  so no tab lands beside the fence and the formula copies as display math with
  the neighbouring cell intact on its own line. A backward selection is still
  backward after the copy. The copy
  writes `text/plain` only — no `text/html` flavour is put on the clipboard.
- **Specs linked**: `04-ux/08-component-spec.md` §8.7, ADR 0268,
  decisions-log D619, issue #414
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Automated (`pnpm test:e2e:copy-tex`, real Chromium) plus
  `selection-tex.test.mjs`

#### E2E-060b: Neutral gray accent across chrome

- **Preconditions**: App running in dark and light themes; plugins page and a
  chat with markdown links/blockquotes available.
- **Steps**: 1) Inspect focus rings, primary buttons, toggles, selected
  session ring, plugin market primary CTAs. 2) Open an assistant answer with
  links and a blockquote. 3) Switch theme and re-check.
- **Expected**: No blue brand accent remains. Interactive accent, markdown
  links/rules, and plugin primary actions resolve through the neutral gray
  accent tokens (`white/gray` dark, dark-ink light). The plugins
  installed/market UI (tabs, search, cards, permission modal, and primary /
  secondary buttons) uses only `--ds-*` tokens with no blue-slate fallbacks in
  either theme; button surfaces and ink remain visible in dark mode. Semantic
  success/warning/error colors are unchanged.
- **Specs linked**: `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md`
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Unit-covered (`neutral-accent.test.mjs`,
  `plugins-page-style.test.mjs`); visual scenario Draft

#### E2E-060c: Assistant markdown prose hierarchy and code chrome

- **Preconditions**: A completed assistant answer containing headings, a
  blockquote, a GFM table, a fenced code block with a language tag, inline
  code, a task list, and a remote image link; light and dark themes available.
- **Steps**: 1) Open the session in dark theme and scroll the answer. 2)
  Hover the code-block copy control and the table rows. 3) Expand a thinking
  disclosure that contains markdown. 4) Switch to light theme and re-check
  contrast on inline code, blockquote rule, and code card.
- **Expected**: Answer prose uses the `.prose-chat` hierarchy (h1–h6 ramp,
  accent-tinted blockquote, hairline-bordered inline code, zebra/hover table
  shell, inset code card with monospace language tag). A wide GFM table stays
  inside the transcript column: headers and cells wrap rather than overflowing.
  Thinking prose stays
  secondary/smaller and does not merge into the answer. Both themes keep
  readable contrast; copy still copies raw fence text.
- **Specs linked**: `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md` §8.7
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`user-select.test.mjs`, `thinking-ui.test.mjs`,
  `markdown-prose-style.test.mjs`); full visual scenario Draft

#### E2E-061: User message plaintext layout survives wrapping and reload

- **Preconditions**: Provider configured; composer can accept multi-line input
  via Shift+Enter (or Enter-to-send disabled).
- **Steps**: 1) Compose a three-line prompt with two hard newlines and a URL
  whose encoded path is wider than the user plate. 2) Send. 3) Inspect the user
  bubble in the transcript. 4) Copy the user message and paste into an external
  editor. 5) Reload the session.
- **Expected**: The user plate shows three distinct lines (not collapsed to a
  single paragraph). The linked URL wraps inside the plate without horizontal
  overflow, and every continuation line stays logical-start aligned with the
  first line instead of being centered. Copied text retains the original
  newlines. After reload the same line breaks remain.
- **Specs linked**: `04-ux/08-component-spec.md`
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`transcript-style.test.mjs`); full visual scenario Draft

#### E2E-060d: Assistant meta chips, compact context summary, and retry action

- **Preconditions**: A completed visual turn includes modelId and token usage
  across more than one assistant message; another completed assistant message
  has content but no usage. The selected model has a published 1m-class context
  window, while its provider binding still contains the legacy 128k generic
  seed.
- **Steps**: 1) Open the session. 2) Confirm the completed turn shows a model
  badge and no context inspector under the answer. Confirm the turn usage
  capsule follows the badge with its average speed and compact total, then
  hover or keyboard-focus it and inspect the cache-read/input/output exact
  counts, the turn total, and cache write only when non-zero. Move the pointer
  into the popover and confirm it stays open, then dismiss it with Escape and
  with an outside pointer press. 3) Hover the composer
  toolbar inspector trigger, confirm the panel stays closed, then click it.
  4) Inspect the remaining-token-plus-percentage heading, used/window counts,
  unboxed turn/speed values, total session duration, and three timing rows for
  network/provider wait, streamed model response (including thinking and
  answer), and tool execution, each with its share of session duration. Confirm
  overlapping top-level tool calls are counted once, nested delegate timings
  are excluded, and one inline provider-usage summary plus one aggregate
  tool-usage summary remain. There is no doubled heading rule or inner section
  hairline. For a transcript with more than one loaded page, wait for earlier
  timing metadata to finish loading and confirm the cumulative values include
  it. 5) Scroll the transcript and resize the window while the
  panel is open. Toggle and resize the sidebar and work panel while the panel
  remains open. 6) Move the pointer away from the panel, then dismiss it by
  clicking the trigger again, clicking outside it, and pressing Escape from
  the keyboard. 7) Open the work panel on a browser-preview artifact, open the
  context inspector, and confirm the summary stays inside the conversation pane:
  fully visible, clear of the panel column, and narrowed rather than clipped on
  a narrow pane. 8) Click Retry on that turn while idle. 9) Confirm a session
  without usage still offers Retry on completed turns and omits the composer
  inspector. 10) With an API-key provider whose model has catalog prices, open
  the inspector and the capsule popover; send another prompt with the
  inspector open; switch sessions; repeat on a subscription (OAuth) account.
- **Expected**: Model badge appears under completed assistant answers when a
  model id exists, followed immediately by the turn usage capsule when that
  turn has usage. The capsule's speed is summed output tokens over summed
  response duration, and its total sums input/output/cache read/cache write
  across the visual turn, counting reasoning inside output and excluding
  subagent spend. Its popover stays open while the pointer is over it, closes
  on pointer leave after a grace delay unless the trigger retains keyboard
  focus, on Escape, or on an outside press; it portals to the body, clamps to
  the conversation pane, and is absent on streaming turns. A priced
  pay-as-you-go turn shows its cost after the capsule total (`≈` for a catalog
  estimate) and in a popover cost row with a one-line explanation; the
  inspector shows the newest turn cost and the whole-session total, which
  refreshes in place after the next billed request without a loading flash and
  never shows another session's figure. Subscription usage reads
  "Subscription" with its API-price equivalent in the tooltip, adds nothing to
  the pay-as-you-go amount, and shows no inline capsule cost. Automated by
  `apps/desktop/test/usage-cost-user-path.test.mjs`.
  The compact Context inspector appears in the composer
  right toolbar, left of the model picker, once any usage exists, and always
  mirrors the newest usage-bearing assistant turn. The trigger shows the ring
  plus remaining-capacity percentage (no Context label) and low-space
  warning/error states; click or keyboard activation toggles the same compact
  summary while pointer hover alone never opens or closes it. An open panel
  survives the pointer leaving it and closes on a second trigger activation,
  an outside click, or Escape, which returns focus to the trigger. Session
  duration runs from session creation to the latest activity (or to now while
  running). Network request wait ends at the first model response event; model
  response includes streamed thinking and answer, and tool time excludes nested
  delegates and unions overlapping top-level calls. Each cumulative timing
  percentage is relative to that wall-time span. Earlier transcript pages load
  only while the inspector is open. Provider
  values remain exact, tool values remain visibly approximate through the `~`
  aggregate total, and no per-tool list, source badge, progress bar, or
  explanatory estimate paragraph is rendered. Occupancy, turn total, and
  provider cache/input/output/reasoning/hit-rate are the last usage-bearing
  assistant message, not the summed tool-loop, so cache read stays on the
  same scale as the context window; this last-request value remains distinct
  from the capsule's visual-turn aggregate. The cache hit rate is omitted
  when cache-read metadata is absent rather than inferred. A published 1m-class
  limit (for example `gpt-5.6-luna` at 1,050,000 tokens) is shown instead of
  128k, the same effective window is used by the agent runtime, and a non-default
  Advanced override remains honored. Generation rate remains a completed-turn
  value and does not update during streaming; Retry
  re-sends the nearest preceding user prompt and is disabled while a turn is
  running; the portaled panel stays inside the conversation pane so the work
  panel's native browser or plugin surface can never cover it, narrows with a
  narrow pane instead of crossing that edge, and follows the trigger after
  scrolling or resize; Copy still excludes thinking text.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `04-ux/10-workbuddy-benchmark-ux.md`, `03-runtime/01-ipc-protocol.md`
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`transcript-style.test.mjs`,
  `context-usage.test.mjs`, `latest-turn-context.test.mjs`, runtime
  usage mapping); full scenario Draft

#### E2E-061a: Regenerate replaces the current turn in place

- **Preconditions**: A session has user A → assistant A → user B → assistant B.
- **Steps**: 1) Hover assistant A and click Regenerate. 2) Wait for the new
  turn to complete. 3) Reload the session.
- **Expected**: Transcript truncates away assistant A / user B / assistant B
  before the redo starts; only user A plus the new assistant/tool tail remain.
  The regenerated answer does not leave the old branch above it. Reload keeps
  the truncated branch only.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `03-runtime/01-ipc-protocol.md`, `03-runtime/04-data-storage.md`
- **Acceptance**: C (chat stream), F (persistence)
- **Milestone**: M5
- **Status**: Unit-covered (store/main truncate wiring tests); full scenario Draft

#### E2E-062: Regenerate history pager restores prior variants

- **Preconditions**: A session where an assistant answer was regenerated at least once.
- **Steps**: 1) Click Retry/Regenerate on a completed assistant turn. 2)
  Observe the visible root user bubble while the replacement turn starts and
  after it completes. 3) Switch to a previous variant. 4) Switch forward
  again. 5) Reload the session.
- **Expected**: The root user bubble remains visible and shows the
  `current / total` pager inside its action toolbar once the row is hovered or
  focused; the toolbar, including the pager, is hidden by default. Retry does
  not move or detach the selector from that bubble. Switching restores the
  archived assistant/tool branch in place. Reload preserves the active variant
  and the full revision set.
- **Specs linked**: `04-ux/08-component-spec.md`, `03-runtime/04-data-storage.md`
- **Acceptance**: C (chat stream), F (persistence)
- **Milestone**: M5
- **Status**: Unit-covered (`sessions::tests::save_and_activate_message_revision`, schema v4 migration); full scenario Draft

#### E2E-063: Empty home keeps the primary task surface focused

- **Preconditions**: App running on empty chat home (no transcript) in light
  and dark themes; window can be resized to ~1200×690 and ~900×640.
- **Steps**: 1) Open empty home. 2) Confirm the hero contains the quiet logo,
  localized title, and short supporting line. 3) Confirm no developer starter
  cards or contextual quick-action row is rendered. 4) Dismiss onboarding and
  inspect again. 5) Repeat in the other theme. 6) Resize to a short height and
  scroll the content region if needed.
- **Expected**: The default empty state keeps the hero and bottom composer as
  the visual anchors, with optional onboarding as the only additional content.
  Dismissing the checklist leaves no empty spacer. The composer remains at the
  bottom without covering the hero or checklist, and short windows keep every
  content block reachable via scroll.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md`, `08-meta/decisions-log.md` (D111/D131/D204/D206)
- **Acceptance**: Quality (layout integrity)
- **Milestone**: M5
- **Status**: Unit-covered (`home-empty-layout.test.mjs`); full UI scenario Draft

#### E2E-094: Active turns keep the lower transcript surface clear

- **Preconditions**: A deterministic agent can emit thinking, tool start/end,
  streamed answer, permission, and terminal events for a durable session; a
  second session can run in the background.
- **Steps**: 1) Start a turn in the visible session. 2) Observe the transcript
  while the agent is thinking, using tools, and streaming an answer. 3) Trigger
  a permission request and inspect the approval card. 4) Switch to a second
  session while the first continues. 5) Return to the first session after
  completion.
- **Expected**: No generic Understanding, Working, Checking, or completion
  card appears below the transcript while the turn is active. Assistant and
  tool rows remain inline. One compact tail status remains visible throughout
  the running turn, including partial-answer pauses and completed-tool gaps.
  Runtime phases take precedence over Working or Planning/Goal; pending user
  interaction suppresses the status. Only an actual permission request renders
  an actionable permission card.
  Background activity never changes the visible session, transcript, composer
  focus, or project.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, `03-runtime/10-session-state-machine.md`
- **Acceptance**: C (chat stream), Quality (interaction and accessibility)
- **Milestone**: M5
- **Status**: Unit-covered (`active-turn-surface.test.mjs`); full UI scenario Draft

#### E2E-095: Terminal failures expose recovery without a success card

- **Preconditions**: A deterministic provider can recover from a failed
  directory `Read` with `Glob`, complete a turn with a workspace edit, and fail
  another turn with a retriable error; the session has a visible composer.
- **Steps**: 1) Run the failed-Read then successful-Glob recovery turn and
  inspect its activity group. 2) Complete the workspace-edit turn. 3) Confirm
  that no success outcome card appears and inspect the inline review card
  immediately after the change tool row. 4) Expand the inline card and verify
  its hunks. 5) Commit
  the edited file and confirm the recorded card remains, then use rollback
  once. 6) Trigger the retriable failure. 7) Inspect the failure card, then
  choose Retry. 8) Start another new prompt and inspect the old card.
- **Expected**: The recovered turn keeps the failed Read visible on its own row,
  labels the containing group as processed, completes its session outcome, and
  shows no failure card. Completion uses the transcript and inline review card
  as its evidence without adding a "Task complete" card. File status, counts,
  and hunks remain on the adjacent card after commit, and guarded rollback
  restores the pre-tool state. Failure shows that existing work remains,
  exposes Retry and Continue, and retry preserves the latest prompt. A new turn
  clears the previous failure card; an abort creates no failure outcome copy.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, `03-runtime/10-session-state-machine.md`,
  ADR 0069
- **Acceptance**: C (chat stream), Quality (completion and recovery)
- **Milestone**: M5
- **Status**: Unit-covered (`assistant-turns.test.mjs`,
  `interaction-performance.test.mjs`, `turn-outcome-card.test.mjs`); full UI
  scenario Draft

#### E2E-064: Durable notification inbox records terminal task outcomes

- **Preconditions**: Two durable sessions exist; a deterministic provider can
  complete one turn, fail one turn with a stable error code, and abort one
  turn; notification inbox starts empty.
- **Steps**: 1) Focus and view session A, then complete a turn in A. 2) While
  still focused on A, fail a turn in background session B. 3) Unfocus the
  window and complete another turn in A. 4) Restore/focus the app from its
  taskbar or Dock without switching sessions and confirm A's visible terminal
  outcome is acknowledged. 5) Abort a fourth turn. 6) Repeat each terminal
  RPC. 7) Confirm the main titlebar has no bell, then open the bell in
  the expanded sidebar footer and switch between All and Unread. 8) Mark one
  row read and confirm its session has no terminal sidebar mark, then
  close/reopen the popover and restart the app. 9) Select the other session
  from its terminal-marked sidebar row. 10) Generate a host fixture with 205
  eligible terminal turns. 11) Use Mark all read, then Clear. 12) While a
  native task banner and a renderer refresh are still in flight, deliver a
  delayed `notification.changed` payload for a cleared/read durable id and a
  duplicate payload for an id that is already present. 13) On Windows, create
  one unread successful outcome while the bell has no failure rows. Open the
  empty bell popover, use Mark all read, then create another success and use
  Clear. 14) Create enough unread outcomes for a two-digit count and inspect
  the taskbar overlay before and after marking all outcomes read.
- **Expected**: A's visible-current completion creates no row or terminal
  sidebar mark. Restoring/focusing the app with A already visible clears A's
  matching durable outcome and taskbar count without clearing B. Exactly two
  rows exist, newest first: the unfocused A completion and background B failure,
  with localized labels, snapshotted session titles, and B's stable code.
  Abort/repeated terminal calls create no row. The former footer Help shortcut
  is absent; the 32px footer bell and its upward-opening popover replace it.
  Badge and Unread show the exact unread count without opening implicitly
  reading rows. Read state and both
  records survive restart. Row selection marks it read and activates its bound
  project/session. The fixture retains exactly the newest 200 rows. Mark all
  preserves rows with zero unread. Selecting the other session clears its
  terminal sidebar mark and marks its task notification read; neither mark
  returns after refresh or restart. Clear empties only the inbox and leaves
  sessions, turns, and transcripts intact. Clear/read also dismisses any
  outstanding task-native object, a repeated durable id produces no second
  banner or row, and a delayed pre-clear event cannot resurrect the cleared
  item; a genuinely new post-clear turn still produces exactly one row and
  banner. Each newly accepted task notification plays one soft in-app chime;
  duplicate, delayed, and historical rows do not replay it. On Windows, the
  taskbar overlay is a smooth black circular badge with a centered white system-font numeral. Its visual weight matches common
  Windows taskbar badges for both single- and two-digit counts. A success-only
  outcome increments the taskbar badge without adding a bell row or bell
  count; both toolbar actions remain enabled when relevant and clear the
  taskbar badge. The badge also clears when no unread outcomes remain. The
  underlying taskbar button keeps the
  PI-Desktop `P` icon and PI-Desktop name while the overlay is present.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `03-runtime/01-ipc-protocol.md`,
  `04-ux/07-ui-design-system.md`, `04-ux/08-component-spec.md`,
  `08-meta/decisions-log.md` (D117/D130)
- **Acceptance**: C (turn completion), F (persistence), Quality
- **Milestone**: M5
- **Status**: Draft

#### E2E-065: Native task notifications are unfocused-only and activate sessions

- **Preconditions**: Native notifications are supported; sessions A and B
  exist; the main window can be focused, unfocused, hidden, and minimized. A
  Windows run uses the NSIS-installed app or the standard development command.
- **Steps**: 1) Keep the app focused on A and complete a turn in A. 2) While
  still focused on A, complete a turn in B. 3) Unfocus the app while A remains
  current and complete another turn in A. 4) Let A's notification move into
  the OS notification center, then click it. 5)
  Minimize the app, fail another turn, and click its native notification. 6)
  Unfocus the app and abort a turn. 7) Repeat with native delivery suppressed
  by the OS. 8) On Windows, inspect the native notification attribution,
  notification-settings entry, taskbar group, installed executable, and Start
  menu shortcut. 9) Deliver the same durable id twice, then mark it read and
  clear the inbox while its native object is still pending in the OS.
- **Expected**: Focused-current A creates neither inbox row, terminal sidebar mark, nor native banner.
  Focused-background B creates an inbox row without a native banner. Unfocused
  current A and the minimized failure each create one durable row and one
  localized, silent native notification plus one soft in-app chime. Clicking
  restores, shows, and focuses the main window before activating the matching
  session, including after the notification has moved to Windows Action Center;
  no event opens the wrong currently selected session. Abort shows neither surface. OS suppression does
  not lose the durable row or surface a misleading app error. Every inspected
  Windows system surface identifies `PI-Desktop`; no stock Electron application
  name or identity is exposed. Duplicate delivery is idempotent: one durable
  id owns at most one live native object, and mark-read/clear closes that
  object so a late activation or renderer event cannot show the old task again.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/07-ui-design-system.md`, `04-ux/09-interaction-patterns.md`,
  `08-meta/decisions-log.md` (D117/D141)
- **Acceptance**: C (turn completion), Quality
- **Milestone**: M5
- **Status**: Source-contract covered (`notification-contract.test.mjs`); packaged
  Windows Action Center activation remains runner validation; full UI scenario Draft

#### E2E-065A: App notifications use one soft chime

- **Preconditions**: A running desktop app with audio output; a second session
  for background notification delivery.
- **Steps**: 1) Trigger info, success, warning, and error toasts. 2) Complete or
  fail a background task. 3) Trigger an asktool request and a permission or plan
  approval request. 4) Replay a durable notification id and refresh the inbox.
- **Expected**: Each newly presented app toast, task notification, interactive
  prompt, and successfully shown plugin-native notification plays one short,
  low-volume chime. Rapid events coalesce; duplicate or historical notification
  rows do not replay it. Asktool's toast does not add a second chime, and native
  banners stay silent to prevent a second, platform-dependent sound. If Web
  Audio is unavailable or blocked, visual notifications still work and no app
  action fails.
- **Specs linked**: `03-runtime/17-asktool-questions.md`
- **Acceptance**: C (notification feedback), Accessibility
- **Status**: Unit/source-contract covered; audible desktop check Draft

#### E2E-066: Provider model catalog survives restart and offline refresh

- **Preconditions**: A saved provider matches a models.dev provider/API URL and
  has at least two catalog models; a deterministic fixture can make
  `https://models.dev/api.json` unavailable and can also make a provider
  discovery endpoint unavailable.
- **Steps**: 1) Open the provider model picker and confirm models.dev model
  names, limits, capability badges, and source label appear. 2) Inspect the
  network fixture and confirm the provider API key is never sent to models.dev.
  3) Quit and restart the app. 4) Disconnect models.dev and the provider
  endpoint. 5) Open the Composer model menu and wait for refresh fallback.
  6) Reconnect only the provider endpoint with one custom model, then reopen
  the picker. 7) Warm lookups for a known and an unknown model, then refresh
  the catalog fixture with changed metadata and the previously unknown model.
  8) Repeat after making that catalog refresh fail.
- **Expected**: The first picker open renders the configured/provider cache
  without starting from an empty list. On restart, the bundled models.dev
  release snapshot is used without network access. A failed Settings refresh
  preserves that in-memory snapshot; a custom provider then falls back to its
  endpoint only for IDs absent from models.dev and finally the configured
  bindings. Offline refresh preserves every cached/configured entry. A
  successful provider discovery may persist normalized IDs to Rust-owned SQLite,
  but it cannot replace models.dev metadata or user-defined bindings.
  A successful catalog refresh replaces both cached matches and cached misses;
  a failed refresh keeps the previous results. Editing a model binding or
  changing the default provider/model takes effect without restarting the app.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/12-provider-config-schema.md`,
  `03-runtime/13-model-catalog-and-selection.md`, `04-ux/08-component-spec.md`
- **Acceptance**: B (model config), F (persistence), Quality, Security
- **Milestone**: M5
- **Status**: Unit-covered (`providers::tests`, `model-cache.test.mjs`,
  `models-dev-catalog.test.mjs`); full restart/offline UI scenario Draft

#### E2E-080: Models.dev metadata and generic unknown models

- **Preconditions**: A provider/model exists in the models.dev fixture with
  limits, modalities, and reasoning options. A second fixture contains a
  provider-discovered model ID absent from models.dev.
- **Steps**: 1) Open the provider model picker and select the fixture model.
  2) Confirm its models.dev name, context/output limits, capability badges,
  modalities, cost fields, and thinking levels. 3) Start a short turn and
  inspect the sidecar model snapshot/request metadata. 4) Use Settings → Model
  configuration to force a models.dev refresh and confirm the new record is
  visible without changing the bundled file or writing a user cache. 5) Repeat
  with an ID absent from models.dev and confirm its limits display as unknown
  in Settings. 6) Open the picker at a wide but short
  viewport (1254 × 772 CSS px): confirm the model panes remain side by side,
  both lists scroll inside their panes, and a selected model's Advanced fields
  are reachable. Narrow the viewport to 520 × 480 CSS px and confirm the panes
  stack while both lists and Advanced remain reachable.
- **Expected**: The matching models.dev record is authoritative, including its
  `limit`, `modalities`, `reasoning_options`, `tool_call`,
  `structured_output`, dates, and cost fields; no provider secret is sent to
  the catalog. Vendor-prefixed records match providers whose configured model
  ID omits the prefix when the vendor/API identity is unambiguous. A PDF-capable
  model shows PDF in its modality metadata; PDF attachments remain bounded file
  references until the selected transport exposes a native PDF block. A
  provider-discovered or explicitly configured ID absent from models.dev remains
  runnable with the generic text-only, non-reasoning shape; Settings shows an
  em dash instead of presenting its 128k / 8.2k runtime fallback as a published
  model limit. Explicit user limits remain visible. pi-ai supplies only
  the selected wire adapter, OAuth flow, and fallback account IDs. The custom
  endpoint keeps its selected API style even if the published model adapter
  differs; named providers may retain a model-level route when required. A
  ChatGPT Plus/Pro or GitHub Copilot account lists IDs returned by its live
  account endpoint; matching models.dev records supply their published metadata, while
  live-only IDs absent from models.dev keep generic chat limits and capabilities.
- **Specs linked**: `02-architecture/02-tech-stack.md`,
  `03-runtime/11-provider-model-system.md`,
  `03-runtime/13-model-catalog-and-selection.md`, ADR `models-dev-catalog-authority`
- **Acceptance**: B (model config), C (conversation & stream), Security
- **Milestone**: M5
- **Status**: Unit-covered (`model-capabilities.test.ts`,
  `models-dev-catalog.test.mjs`); full UI scenario Draft


#### E2E-067: Platform application menus and window chrome

- **Preconditions**: Native macOS, Windows, and Linux runners; built desktop
  app; English and zh-CN locales available. The Windows/Linux harness can set
  `PI_DESKTOP_START_MAXIMIZED=1` before launch so Main maximizes the hidden
  native window before renderer mount.
- **Steps**: 1) On macOS, launch both `pnpm dev` and a packaged build. Confirm
  the application-menu title is PI-Desktop, open About PI-Desktop, and inspect
  its name, version, and icon. Then open every system menu and invoke New Task, Open
  Project, Settings, global search, sidebar toggle, editing,
  zoom/fullscreen, Window, Help, Logs, and Check for Updates actions. Verify
  the update status reports that the current fixture version is up to date.
  2) On Windows/Linux, confirm no File/Edit/View/Window/Help menubar appears
  inside the window and the left-side navigation occupies the reclaimed
  titlebar space. Verify F10 and Shift+F10 are not consumed by shell chrome;
  exercise New Task, Open Project, Settings, close-window, zoom, fullscreen,
  global search (Cmd/Ctrl+K and Cmd/Ctrl+Shift+P), sidebar, and standard editing shortcuts. Invoke
  Check for Updates from Settings -> Info with the same status result.
  3) Close the macOS window, immediately invoke two native menu
  commands, and acknowledge renderer readiness after the replacement loads.
  Verify one window and one delivery per command. 4) On Windows/Linux, repeat
  from the main chat, Settings, and an open work panel. With the work panel
  open, confirm the viewport-fixed toggle and native window controls stay at
  the window's right edge over the panel header, that resource switching plus
  close actions remain available from the panel menu to their left, and that
  the native window controls themselves still take hover and click — clicking a
  control must not move the window. In the
  main chat, send a first user message and confirm its full bubble starts below
  the 46px titlebar control band. Open the Extensions page and confirm its header
  actions, then the detail sheet's close button, also start below that band and
  take their own clicks instead of moving the window. Click the center plus the
  top, bottom, and
  titlebar-facing edges of each right-side control to minimize, maximize,
  restore, and close the window. 5) Start
  the renderer while its native window is already maximized and inspect the
  initial queried glyph/state. 6) Attempt unknown menu/window IPC actions
  while a window exists and after it closes. 7) Build each target on its
  native runner from a clean release-host directory. On Windows, inspect the
  installed app's taskbar button and Start menu shortcut icon.
- **Expected**: macOS development and packaged launches show PI-Desktop as the
  native application identity, and the About panel uses the canonical
  PI-Desktop icon; neither surface exposes the stock Electron name or icon.
  macOS follows native menu conventions and accelerators.
  Windows/Linux show no application menu inside the window; navigation and
  right-side controls do not collide with drag regions, keyboard shortcuts
  remain operational, and a viewport-fixed work-panel toggle is present on
  non-Settings routes (not an application-menu command). While the panel is
  open the native control band and that toggle overlay the panel header; the
  header ends its box before the band, so the resource tabs and close controls stay clear of the
  toggle and neither the window controls nor resource close sit under a drag
  rectangle. Check for Updates
  invokes the allowlisted update command from the macOS system menu and the
  Settings surface and shows the resulting up-to-date state. Replacement-window
  commands wait for renderer readiness without
  creating duplicate windows or losing events. No Main, Settings, or work-panel
  drag rectangle overlaps the reserved control zone. The 120px control band is
  an opaque `bg-primary` surface in both light and dark themes, with an 8px
  visual buffer separating it from adjacent work-panel actions, so destination
  content never bleeds through it. Window controls remain clickable across
  their full 46px-high hit targets, match native state, and
  have accessible names; the first user or assistant transcript row never
  paints beneath them, and neither do the Extensions page header actions or the
  plugin detail sheet close button. The titlebar and right-side control band
  share one continuous 1px `border-subtle` separator; the control band's
  leading divider uses the same token and its bottom edge does not disappear
  under the window buttons. Unknown actions fail closed. The installed Windows
  taskbar button and Start menu shortcut use the PI-Desktop icon, never
  Electron's default icon. Each package contains the target-native host binary
  (`.exe` only on Windows). Passing this scenario on Windows/Linux proves
  shell readiness, not first-release qualification.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/01-ui-ia.md`, `04-ux/02-i18n-english-first.md`,
  `04-ux/07-ui-design-system.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, `06-delivery/06-release-runbook.md`,
  `08-meta/decisions-log.md` (D118, D121, D129, D357)
- **Acceptance**: A (app startup), Quality
- **Milestone**: M5 on macOS; post-MVP release qualification on Windows/Linux
- **Status**: Unit-covered (`window-menu.test.mjs`,
  `development-branding.test.mjs`); Electron boot probe covers
  platform bridge, native menu installation, and the pre-render maximize
  fixture on Windows/Linux; native visual scenario Draft

#### E2E-143: Close behavior is asked once and stays configurable (D230)

- **Preconditions**: Windows/Linux run with a clean data dir (no
  `close-behavior.json`); the main window is visible; Settings → System is
  reachable. macOS is excluded: it keeps the native Dock lifecycle.
- **Steps**: 1) With the preference unset, click the close button (or press
  the close-window shortcut) and verify the themed in-app dialog opens with Cancel focused. Escape, a
  backdrop click, or Cancel keeps the window open and preference unset; Close to
  tray hides the window, shows the tray icon, and leaves a live turn running;
  Quit exits the app. Renderer-unavailable behavior uses the native fallback. 2) Re-run each choice and verify it is remembered across a
  full restart and that no second prompt ever appears once a choice exists.
  3) With `tray` set, click the tray icon: the window
  restores, shows, and focuses; the tray context menu offers Open and Quit,
  and Quit exits the app. 4) In Settings → System, switch between Close to
  tray / Quit app and verify the next close follows the new
  choice, that the D216 tray icon stays resident either way, that an unset
  preference shows no selection, and that search matches
  the row. 5) With `quit` stored, restart and close the window: the app
  exits even though the tray icon is present. 6) From any setting, use the
  renderer minimize control on Windows/Linux and verify the native taskbar
  entry remains available and restores the same window; on macOS verify its
  native minimize still hides to the tray. The Windows taskbar toggle is
  covered separately by E2E-124. 7) Invoke unknown values and `"ask"` on
  `pi-desktop/window/closeBehavior/set` and verify they fail closed, and
  verify the channel is rejected outright on macOS.
- **Expected**: The first close renders the themed dialog exactly once per unset state. Escape, backdrop click, or Cancel never persists a choice; if the renderer is unavailable, a bounded native fallback is used, and failure to show it does not trap close. Tray mode keeps the app alive with a
  localized tooltip/menu and no data loss; switching to Quit app leaves the
  tray icon in place, because close-to-tray and macOS minimize still need a
  restore surface. The preference survives restarts and is honored by both
  the window-control close button and the close shortcut, and a stored `quit`
  exits through the ordered `before-quit` shutdown rather than depending on
  `window-all-closed`. Windows/Linux renderer minimize remains taskbar-native;
  macOS native minimize remains tray-resident; the bounds watchdog never
  force-restores a minimized or tray-hidden window. The automated boot probe
  (`app.quit`) exits without prompting.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/01-ui-ia.md`, `04-ux/09-interaction-patterns.md`,
  `08-meta/decisions-log.md` (D216, D230, D256), ADR 0078, ADR 0090,
  ADR 0123
- **Acceptance**: A (app startup), Quality
- **Milestone**: M5 on Windows/Linux (release qualification)
- **Status**: Themed renderer path, broker fallback, and Main close/quit choices
  are covered by `lifecycle-confirmation-dialog-user-path.test.mjs`,
  `lifecycle-dialog-broker.test.mjs`, and `lifecycle-close-behavior-runtime.test.mjs`;
  the full persisted close-behavior journey remains Draft.

#### E2E-204: Explicit quit confirms before shutdown (D363)

- **Preconditions**: A normal interactive session is running (not a boot,
  supervision, or capture probe). The main window may be visible or tray-hidden.
- **Steps**: 1) Choose Quit from the tray menu, or press Cmd+Q / the
  application-menu Quit item. If tray-hidden, confirm the main window is restored.
  2) Verify the themed in-app confirmation, Cancel as initial focus, and distinct
  title/body. While it is open, issue a second Quit request and verify the same
  decision remains pending: no duplicate dialog and no shutdown bypass. Exercise
  Escape and a backdrop click; confirm the window, tray, host-core, and sidecar
  remain. 3) Repeat and Confirm; verify ordered shutdown. 4) On Windows/Linux
  with close behavior unset, close the window. Verify the themed D230 dialog
  offers Cancel / Close to tray / Quit: cancel leaves the preference unset, and
  choosing Quit causes no second dialog. 5) Launch with `PI_DESKTOP_BOOT_PROBE=1`
  (and supervision/capture equivalents) and confirm `app.quit()` exits without a
  dialog. 6) On packaged Windows NSIS or Linux AppImage, restart to install an
  update; confirm no quit warning appears and the installer completes upgrade
  and relaunch.
- **Expected**: Accidental explicit quit is cancellable. Repeated quit requests
  cannot duplicate or bypass an outstanding confirmation; Cancel clears the
  pending decision so a later quit asks again. Tray Quit presents the dialog
  even when the main window was hidden. A D230 Quit is not re-confirmed. When the
  renderer is unavailable, crashes, or fails to answer, the bounded native
  fallback is used; failure to show it does not hold shutdown. Probes never
  block on the warning. An in-app update restart is never deferred: the installer
  is spawned before `app.quit()` and aborts if the app stays alive past its wait
  window, so that quit goes directly into ordered shutdown.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, `08-meta/decisions-log.md` (D216, D230,
  D363), ADR 0022, ADR 0090
- **Acceptance**: A (app startup), Quality
- **Milestone**: M5
- **Status**: Broker, renderer user path, Main close/quit runtime, and pending
  shutdown lifecycle covered (`lifecycle-dialog-broker.test.mjs`,
  `lifecycle-confirmation-dialog-user-path.test.mjs`,
  `lifecycle-close-behavior-runtime.test.mjs`, `close-behavior-tray.test.mjs`,
  `shutdown-regenerate-persistence.test.mjs`). Full application shutdown and
  packaged update journey remains Draft; run in a capable release environment
  when lifecycle wiring changes.

#### E2E-067A: Prerelease install discovers newer stable release (D120)

- **Preconditions**: Packaged build whose embedded version is a prerelease such
  as `0.2.0-rc.6`; GitHub Releases latest stable tag is newer (for example
  `0.2.2`) with published `latest*.yml` feeds.
- **Steps**: 1) Launch the packaged prerelease install. 2) Wait for the
  automatic check or invoke Check for Updates from the application menu /
  Settings → Info.
- **Expected**: Update state reports `available` (manual platforms) or
  advances through in-app download for packaged macOS, Windows NSIS, and
  Linux AppImage with `availableVersion` equal to the newer stable tag. A
  Windows portable ZIP run stays on the manual notify-and-link path and must
  not download or run the NSIS installer; a legacy portable executable is
  likewise manual when `PORTABLE_EXECUTABLE_FILE` is present. The
  client must not report up-to-date merely because no newer release shares the
  same `rc` prerelease channel.
- **Specs linked**: `04-ux/09-interaction-patterns.md`,
  `05-security/01-security.md`, `08-meta/decisions-log.md` (D120),
  ADR 0022
- **Acceptance**: A (app startup), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`auto-update.test.mjs` asserts
  `allowPrerelease = false`); packaged discovery scenario Draft

#### E2E-067B: Shipped-locale update notes and full changelog dialog (D164/D345/D349)

- **Preconditions**: The shipped `packages/shared` CHANGELOG contains aligned
  `en`, `zh-CN`, `zh-TW`, `ko`, and `pt-BR` stable history; product language
  can be switched.
  For the compact update path, use a packaged or fixture updater state with a
  catalogued `availableVersion`.
- **Steps**: 1) With no available update, open Settings → Info and open Release
  notes. 2) Inspect the complete history, current-version marker, scrolling,
  and close behavior by close control, Escape, and backdrop. 3) Force or wait
  for update discovery so status is manual `available`, in-app `downloading`,
  or `downloaded`; inspect the ambient banner and Settings Updates row, then
  reopen Release notes. 4) Switch UI language to zh-CN, then zh-TW, then ko,
  then pt-BR and re-inspect without invoking a new check. 5) Repeat the compact
  update path with a version absent from the catalog.
- **Expected**: `UpdateState.releaseNotes` is plain multi-line product
  highlights selected by Main from the shipped-locale catalog — never a
  renderer-supplied URL. Both surfaces show a localized "What's new" block
  when notes exist and hide it when they do not. Locale change refreshes notes
  for the same version. The Release notes action remains available in every
  updater state and opens a localized, newest-first modal containing every
  shipped stable entry, with current and available versions identified when
  present. The modal traps focus, restores it after close, and does not expose
  a new IPC domain or feed configuration.
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/09-interaction-patterns.md`,
  `05-security/01-security.md`, `06-delivery/06-release-runbook.md`,
  `08-meta/decisions-log.md` (D164), ADR 0022
- **Acceptance**: A (app startup), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`auto-update.test.mjs`, `changelog.test.ts`);
  packaged UI scenario Draft

#### E2E-067C: Release version-surface preflight blocks a misaligned tag (D260)

- **Preconditions**: A clean worktree at the current stable version. No release
  tag has been created for the candidate version.
- **Steps**: 1) Run `node scripts/check-release-docs.mjs` on the aligned tree.
  2) Regress one surface at a time — replace the models.dev catalog with an
  empty object, remove the newest changelog entry from `en`, then from `zh-CN`,
  change a highlight count so the locales differ, set `docs/package.json` to
  an older version, and leave the READMEs stating the previous
  `<major>.<minor>.x` release line — then rerun the preflight after each. 3) Run
  `node scripts/release.mjs <next-version> --tag`
  with one surface still regressed. 4) Restore every surface, rerun the
  preflight, and repeat the release command.
- **Expected**: The aligned tree reports alignment and exits 0. Each regression
  is reported by name with the offending file and expected version, and exits
  non-zero. With a regressed surface, `release.mjs` bumps files but creates
  neither the release commit nor the tag, and says the documentation check
  failed. After restoration the preflight passes and the release command
  proceeds to commit and tag. `--skip-docs-check` bypasses only the check and
  is documented as non-release use.
- **Specs linked**: `06-delivery/06-release-runbook.md` §4.1,
  `06-delivery/05-change-checklist.md`, `06-delivery/03-ai-development-workflow.md`,
  `08-meta/decisions-log.md` (D164, D260)
- **Acceptance**: Quality (release process)
- **Milestone**: M5
- **Status**: Script-covered (`scripts/check-release-docs.mjs`); manual release
  rehearsal Draft

#### E2E-068: Fork a conversation into an independent session

- **Preconditions**: An idle project conversation has user, assistant,
  thinking, and tool history plus at least one regenerate variant. A second
  source conversation is running. A Temporary conversation and two retained
  project workspaces contain distinct same-named marker files. The idle source
  has a session-scoped tool grant.
- **Steps**: 1) Open the idle conversation overflow menu with keyboard. 2)
  Choose Create branch. 3) Append a prompt and change model/mode on the child.
  4) Switch the visible workspace, return to the child, and read the marker.
  5) Trigger the previously granted tool and verify confirmation is requested.
  6) Reopen the source. 7) Restart the app and inspect both sessions. 8) Open
  the running conversation overflow menu. 9) Fork the Temporary conversation
  and invoke a workspace-required tool.
- **Expected**: A localized branch title appears in the same project group and
  is activated with composer focus. Its visible active transcript and durable
  project/provider/model/mode/thinking/permission configuration match the
  source snapshot, but regenerate pager history is absent. Child messages and
  later configuration changes do not affect the source; both survive restart.
  The running source action is disabled. No turns, notifications, artifacts,
  permission grants, revisions, or scratch files are copied.
  The marker resolves under the child's inherited project; the Temporary child
  remains path-less and returns `WORKSPACE_REQUIRED`.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/04-data-storage.md`, `03-runtime/06-host-rpc-protocol.md`,
  `04-ux/01-ui-ia.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (sessions), D (workspace), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`sessions::tests::fork_session_clones_active_transcript_and_configuration`,
  `session-fork.test.mjs`); full restart UI scenario Draft

#### E2E-071: Fork an assistant response without changing its source

- **Preconditions**: An idle conversation contains two completed user/assistant
  exchanges and the second assistant response has cache-token usage metadata.
- **Steps**: 1) Hover the first assistant response and inspect its toolbar. 2)
  Click Fork. 3) Confirm the activated child ends at that response and append a
  prompt. 4) Reopen the source and inspect it. 5) Append a prompt to the child,
  restart, and inspect source and child. 6) Repeat while the source is running.
- **Expected**: The completed-assistant toolbar contains Copy, Fork, and
  Regenerate only — no Delete and no Edit (D137 moved Edit to user turns). Fork
  is disabled during a source turn. It activates a separately titled session
  whose history stops at the selected response; later source turns are absent.
  Source text, version history, token metadata, later turns, runtime, and cache
  state remain unchanged. Continuing the child affects only that child and
  reseeds from its own remapped transcript.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/04-data-storage.md`, `03-runtime/06-host-rpc-protocol.md`,
  `04-ux/08-component-spec.md`, `08-meta/decisions-log.md` (D134, D137)
- **Acceptance**: C (chat stream/sessions), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`sessions::tests::message_scoped_fork_stops_at_selected_assistant_response`,
  `session-fork.test.mjs`, `transcript-style.test.mjs`); full restart UI scenario Draft

#### E2E-071b: Forked session retains messages after the first AI turn completes

- **Preconditions**: A completed conversation with at least two user/assistant
  exchanges. The session history window feature is active (bounded loading).
- **Steps**: 1) Fork the conversation from the sidebar overflow menu. 2) In the
  forked session, send a new prompt and wait for the AI to finish responding.
  3) Observe the transcript after agent_end fires. 4) Click the forked session
  entry in the sidebar (re-select). 5) Restart the app and reopen the fork.
- **Expected**: All forked messages plus the new user prompt and AI response
  remain visible after agent_end. Re-selecting the session from the sidebar
  shows the same messages (no flash of empty state). After restart, messages
  persist. The session history window is `{ messageStart: 0, hasMoreBefore: false }`.
- **Specs linked**: `03-runtime/04-data-storage.md`, `04-ux/01-ui-ia.md`
- **Acceptance**: C (chat stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`session-fork.test.mjs`
  `fork actions commit the child through one durable helper`); UI scenario Draft

#### E2E-071c: A branch survives a navigation that lands during the fork

- **Preconditions**: A completed conversation with several exchanges, and at
  least one other session in the sidebar.
- **Steps**: 1) Start Branch from here on the source session. 2) While the fork
  request is in flight, immediately click another session in the sidebar (or
  press the history-back shortcut). 3) Wait for both to settle. 4) Inspect the
  sidebar. 5) Open the branch and scroll its transcript.
- **Expected**: The later navigation wins the view, and the branch is still
  listed in the sidebar with its title, with no manual refresh. Opening it shows
  its complete copied transcript from cache. Nothing is lost and no duplicate
  branch row appears if the fork is repeated.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, `03-runtime/04-data-storage.md`
- **Acceptance**: C (chat stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`session-fork.test.mjs`
  `a fork is recorded even when a newer navigation took over`); UI scenario Draft

#### E2E-071d: Opening a long session stays responsive and shows its newest turn

- **Preconditions**: One session whose transcript is far longer than the
  renderer page size (several hundred messages, including large tool results).
- **Steps**: 1) Open the long session from the sidebar. 2) Observe the first
  painted frame and the scroll position. 3) Scroll to the top edge to page older
  history, repeatedly, until the first message is reached. 4) Switch to another
  session and back, recording the frame and offset on return. 5) Scroll up a
  measured amount, switch away, and switch back again. 6) Send a new prompt and
  let it complete.
- **Expected**: The session opens at its newest turn without a blank or
  top-of-history frame, and opening it does not visibly slow down as the
  conversation grows. Each older page prepends without moving the message the
  user is reading. Paging back reaches the true first message with none skipped
  or duplicated. Re-selection paints from the retained pane: the first frame back
  is the same frame that was left, at the same scroll position, with no dim, no
  blank or skeleton frame, and no rebuild of the rows. A pane the user had
  scrolled up in returns to that measured offset rather than the bottom, and a
  pane left pinned re-anchors to the bottom. The new turn appends normally.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, ADR 0137
- **Acceptance**: C (chat stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`transcripts::tests::layout_window_reads_only_the_requested_tail`,
  `sessions::tests::bounded_reads_use_physical_line_positions_not_the_dedup_counter`);
  UI scenario Draft

#### E2E-SESSION-list-refresh-keeps-desktop-responsive: Large session-list refreshes keep Electron responsive

- **Preconditions**: A built Electron desktop, the bundled models.dev catalog,
  and a fresh temporary profile with no configured providers. The probe uses
  only a synthetic `authKind: none` provider and never starts an Agent turn.
- **Steps**: 1) Create 800 empty durable sessions through the Rust Host API,
  distributed over up to thirteen known model IDs. 2) After fixture creation,
  request eight session lists concurrently through the renderer preload bridge.
  3) Measure Electron Main timer gaps and renderer-to-Main version IPC latency
  during those reads. 4) Compare all returned session IDs and capability fields.
- **Expected**: Every list contains all fixture sessions with stable model and
  capability fields. Main remains responsive: no measured timer gap or version
  IPC round trip reaches one second. The probe records individual list/heartbeat
  durations and the largest Main gap. The ordinary sandboxed boot, platform
  window, and menu assertions still pass. The profile is discarded afterwards;
  existing user profiles and running desktop processes are untouched.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/13-model-catalog-and-selection.md`, ADR 0134
- **Acceptance**: C (sessions), Quality
- **Milestone**: M6+
- **Status**: Automated (`scripts/e2e-electron-boot.mjs` via
  `pnpm test:e2e:boot`, using the existing `PI_DESKTOP_BOOT_PROBE` entry point).

#### E2E-071e: Regenerating from a paged-back transcript replaces the right turn

- **Preconditions**: A session long enough that opening it loads only a bounded
  window, with several completed exchanges above that window.
- **Steps**: 1) Open the session and page older history until an earlier user
  turn is visible. 2) Regenerate that turn (or edit and resend it). 3) Wait for
  the new answer. 4) Walk the revision pager back to the original. 5) Reopen the
  session.
- **Expected**: Exactly the selected turn and its answer tail are replaced; no
  unrelated earlier or later exchange is truncated or archived. The pager
  restores the original tail. After reopening, the transcript matches what was
  shown, with no missing messages.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, `03-runtime/04-data-storage.md`
- **Acceptance**: C (chat stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`transcript-truncation.test.ts`,
  `transcript-style.test.mjs`); UI scenario Draft

#### E2E-071f: Long-transcript scrolling and minimap hover stay smooth

- **Preconditions**: One session with several hundred messages, including large
  tool results and at least one code block, so the minimap rail shows a dense
  dash stack.
- **Steps**: 1) Open the session. 2) Scroll continuously through the whole
  transcript, up and down. 3) Sweep the cursor slowly along the minimap rail from
  top to bottom and back. 4) Hover a dash until its preview popover appears, then
  click it. 5) Resize the window and repeat the rail sweep. 6) Type a long
  multi-line draft so the composer grows, then sweep the rail again. 7) Switch to
  another session and back.
- **Expected**: Scrolling holds a steady frame rate with no progressive
  slowdown as more history is traversed. The rail sweep magnifies dashes smoothly
  and does not degrade as the dash count grows; the dash stack never shifts
  vertically while magnifying. The popover names the correct turn and clicking
  scrolls to it. After a window resize, and after the composer grows under a
  multi-line draft, magnification still tracks the cursor against the dashes' new
  positions rather than their old ones. Returning to the session reveals its
  retained pane at the position it was left, with no rebuild of the earlier
  history and no dim. Switching back and forth repeatedly, the transcript text
  never jumps or scrolls up and down after the first painted frame. Scrolling up
  keeps the chosen position across later switches instead of being pulled back to
  the bottom.
- **Specs linked**: `04-ux/08-component-spec.md`, ADR 0137
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`interaction-performance.test.mjs`
  `minimap hover magnification never measures geometry per dash`,
  `session switch bounds the first transcript commit instead of rebuilding it`,
  `session-switch hydration expands without moving the transcript`,
  `minimap re-measures dash centers when the rail's own box changes`);
  UI scenario Draft

#### E2E-071g: Retained session panes are bounded and evict the oldest

- **Preconditions**: At least five sessions with distinct transcripts, each
  longer than one viewport, so a scroll position and a final record identify each
  one unambiguously.
- **Steps**: 1) Open sessions A, B, and C in that order, scrolling each one up a
  measured amount. 2) Switch back to A, then B, and confirm each returns to its
  own offset. 3) Open D and then E, so A and B fall outside the retained budget.
  4) Return to A and scroll to the lower boundary of the restored range without
  clicking any load control. 5) Return to E, then D, and confirm they are still
  warm. 6) Repeat the whole cycle once more and watch for a stuck progress track,
  an error toast, or a blank chat area.
- **Expected**: Only the visible pane and the two most recently visited ones are
  retained; visiting beyond that budget evicts the oldest pane. A warm return
  paints the retained frame and offset immediately. The returned pane keeps the
  page that already holds its anchor, so a warm return never offers to load later
  messages for rows that page already had. Returning to an evicted
  session restores the message and viewport offset recorded before eviction,
  including explicit expanded content, using a bounded historical read if the
  latest page no longer contains the anchor. If the anchor is already loaded but
  outside the mounted window, the saved absolute scroll offset is restored while
  the row window remains bounded. The cold selection's progress track
  and composer fence remain unchanged. No search highlight is introduced, live
  model-input messages are unchanged, and real input or a new turn cancels
  automatic alignment. First visits and pinned revisits still follow latest. Nothing is
  dimmed at any point, hidden panes stay non-interactive and out of the
  accessibility tree, and repeated cycling neither leaks a growing number of
  mounted transcripts nor leaves a pane showing another session's rows.
  A restored historical range has no Load later messages button: reaching its
  lower boundary automatically reads bounded newer pages without moving the
  visible anchor. Short ranges fill the viewport automatically; hidden panes do
  not initiate reads. Pending reads coalesce, obsolete results cannot replace
  a newer navigation, and failures do not cause automatic retry loops. After
  continuation reaches the tail, live updates resume without adding older
  cached rows above the reading position. Explicit search still uses manual
  later-message paging.
- **Specs linked**: `04-ux/08-component-spec.md` §1.6 / §3.5 / §7,
  `04-ux/09-interaction-patterns.md` §5, ADR 0130, ADR 0137
- **Acceptance**: C (switch sessions), Quality
- **Milestone**: M5
- **Status**: Renderer regression automated by
  `node scripts/e2e-transcript-reading-position.mjs` (isolated React/Electron,
  fixture IPC); live UI scenario Draft.

#### E2E-071h: Reopening a session while its response is streaming

- **Preconditions**: Session A has a completed transcript and is producing a
  long assistant response; at least one other session is available.
- **Steps**: 1) While A is streaming, open another session. 2) Wait long enough
  for A to emit several assistant or tool updates without finishing. 3) Open A
  again before the response ends. 4) Continue watching A until the turn
  completes. 5) Switch away and back once more.
- **Expected**: A's retained/live pane is revealed without a blank, skeleton,
  dim, or top-of-history flash. The first frame includes the latest in-memory
  assistant/tool tail available before the click. The delayed durable detail
  response may add completed rows, but it never replaces the partial reply with
  an older transcript; subsequent stream updates continue from the same row and
  the completed answer is not duplicated. A's background events do not change
  the other session's transcript, composer, workspace, or focus.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, ADR 0137
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`session-transcript.test.mjs`,
  `session-switch-performance.test.mjs`); UI scenario Draft

#### E2E-073: Icon-only message toolbars and editing a user prompt

- **Preconditions**: An idle conversation contains two completed user/assistant
  exchanges; one user turn was sent as a slash-template invocation.
- **Steps**: 1) Hover a completed assistant row and a user row, then hover and
  keyboard-focus each action chip. 2) Choose Edit on the first user prompt. 3)
  Press Escape, reopen Edit, retry the prompt unchanged. 4) Reopen Edit, change
  the text, and retry with Cmd/Ctrl+Enter. 5) After the new answer completes,
  use the `current / total` pager to return to the original exchange and
  forward again. 6) Reload the session. 7) Choose Edit on the slash-command
  turn and inspect the seeded text. 8) Start another response and inspect its
  assistant toolbar while it is streaming and after it completes. 9) Try Edit
  while a turn is running.
- **Expected**: Every toolbar chip shows its glyph only, with the label
  appearing as a fully visible tooltip 8px above the chip on hover and on
  keyboard focus (#74); the tooltip remains fully painted when it overlaps the
  sidebar edge and is never occluded by the sidebar background; no chip renders
  caption text. Clicking an action dismisses its tooltip immediately; it does not
  remain visible while the action retains focus. While an assistant response is
  streaming, its toolbar omits
  Copy; after the response settles, the assistant toolbar offers Copy, Fork,
  Regenerate. The user toolbar offers the pager (when variants exist), Copy,
  Edit, Delete. Edit replaces the prompt bubble with a wider composer-matched
  inline editor plate filled with `--ds-tile-deep` (no outer shadow, inset
  focus ring) so the light plate stays distinct from the white pane without
  a clipped glow, with Retry and Cancel controls; Escape or Cancel restores the bubble
  unchanged. Retry truncates the transcript from that prompt and streams a new
  answer whether or not the text changed, leaving a `current / total` pager on
  the user turn that restores the original prompt with its full answer tail in
  place — surviving reload. The slash turn seeds the typed `/command` form and
  re-expands the template on retry. Edit is disabled while a turn is running.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `03-runtime/01-ipc-protocol.md`, `03-runtime/04-data-storage.md`,
  `08-meta/decisions-log.md` (D137, D274)
- **Acceptance**: C (chat stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`transcript-style.test.mjs`); full UI scenario Draft

- **Long-message regression**: Send a log longer than 65,536 characters as
  message text, reopen the saved chat, then Edit and resend with a short
  clarification. The editor and outgoing request must retain the final log
  lines, without a display truncation marker. A failed full-history read must
  show an error without opening a clipped editor; switching chats while the
  read is pending, including A→B→A with the same retained message array, must
  not open a stale editor or publish stale history. A fresh Edit after returning
  must still load the complete text and resend successfully. Automated coverage also
  preserves attachments and the typed slash-command seed.

#### E2E-069: Platform-specific sidebar header behavior

- **Preconditions**: PI-Desktop is open with the expanded sidebar and a chat
  session is active.
- **Steps**: 1) Open Extensions on macOS windowed mode. 2) Inspect the expanded
  sidebar titlebar. 3) Confirm no PI-Desktop logo/title is visible and Collapse
  sidebar appears at the right of the traffic lights. 4) Enter
  fullscreen and inspect the same row. 5) On Windows/Linux, confirm the brand
  remains visible; activate it with a pointer, then with keyboard focus and
  Enter/Space.
- **Expected**: macOS uses one 46px row with native lights at left, a usable
  drag region, and an accessible Collapse button at right; the Logo/Home brand
  is absent in both windowed and fullscreen modes. Global search stays on the
  conversation topbar, shortcuts, and application menu, not the sidebar header.
  Windows/Linux render the canonical 20px logo beside the 15px shell name; the
  complete brand has a localized Home accessible name, visible hover/focus
  feedback, and returns the main pane to chat without clearing the active
  conversation or workspace. The logo itself is theme-aware: light mode shows
  `src/assets/brand/logo-light.png`,
  dark mode shows `src/assets/brand/logo-dark.png`, swapping live with
  `data-theme` (no reload).
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md`
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Unit-covered (`renderer-branding.test.mjs`,
  `sidebar-navigation.test.mjs`); rendered interaction scenario Draft

#### E2E-098: Sidebar collapse and expand animate as a docked transition

- **Preconditions**: PI-Desktop is open with the expanded sidebar and an active
  chat session; `prefers-reduced-motion` is off.
- **Steps**: 1) Click Collapse sidebar in the expanded sidebar header (or press
  the sidebar toggle shortcut). 2) Watch the sidebar during collapse. 3) Confirm
  the main pane expands and the collapsed titlebar now shows an Expand control.
  4) Press the sidebar toggle shortcut again from the collapsed state: each
  press must strictly alternate collapse and expand, so the second press
  re-expands the sidebar (regression: it must never re-collapse). 5) Collapse
  and re-expand once more via the shortcut, then repeat the full round trip
  with the pointer controls. 6) Repeat on Windows/Linux.
- **Expected**: Collapse plays the `sidebar-out` keyframe (opacity + ≤8px slide
  plus width/flex allocation) while the aside stays in the tree, then unmounts
  once the animation ends; the main pane fills the freed space continuously.
  Expand plays the `sidebar-in` keyframe and
  the controls return to the expanded header. On Windows the dock stays opaque
  during exit (`sidebar-out-windows`), matching the work-panel dock behavior. No
  layout jump precedes the animation, and focus returns to the sidebar/Expand
  control predictably.
- **Specs linked**: `04-ux/08-component-spec.md`, `04-ux/07-ui-design-system.md`
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Unit-covered (`sidebar-collapse-animation.test.mjs`); rendered
  interaction scenario Draft

#### E2E-208: Collapsed sidebar does not force a 640px chat band

- **Preconditions**: PI-Desktop is open with an active chat session at a
  viewport wide enough for the default 760px chat content band; reduced
  motion is off; the user has not resized the band.
- **Steps**: 1) Record the width of the centered transcript or empty-home
  composer band with the sidebar expanded. 2) Collapse the sidebar. 3) Inspect
  the same content band while the dock transition runs and after it settles.
  4) Expand the sidebar and inspect the return transition.
- **Expected**: The outer main pane fills the space released by the sidebar.
  The centered chat content band stays at its preferred 760px ceiling (or
  `min(available, preferred)` if the pane is narrower). It does not jump to
  640px. The transcript, empty-home stack, and Composer share that envelope.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md`, ADR 0277, D439
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Unit-covered (`sidebar-collapse-animation.test.mjs`,
  `chat-content-width.test.mjs`); rendered interaction scenario Draft

#### E2E-CHAT-content-width-handles: Dual edge handles resize the centered chat band

- **Preconditions**: PI-Desktop is open on chat (empty home or a transcript)
  at a viewport wider than 760px. Reduced motion off.
- **Steps**: 1) Confirm no divider is visible at rest. 2) Hover the left
  content edge and confirm a short faint capsule, then the right edge. 3) Drag
  the right handle outward and confirm both edges move, the composer matches,
  and both capsules lengthen slightly while dragging. 4) Open the work panel or
  expand the sidebar until the pane is narrower than the new preference; the band
  compresses without a horizontal scroll. 5) Close the panel / collapse the
  sidebar and confirm the preference returns. 6) Double-click a handle to
  restore 760px. 7) Repeat with Arrow keys on a focused handle.
- **Expected**: Default 760px. Drag floor 560px (or the pane if smaller).
  User bubbles stay compact. Handles stay keyboard-accessible
  (`role="separator"`). Preference persists as `chatContentMaxWidth`.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/08-component-spec.md`,
  ADR 0277, D439
- **Acceptance**: C (conversation), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`chat-content-width.test.mjs`,
  `packages/shared/src/chat-content-width.test.ts`); rendered scenario Draft

#### E2E-UI-tooltip-never-outlives-its-trigger: A themed tooltip always retreats

- **Preconditions**: PI-Desktop is open on a session with at least one message
  toolbar, a sidebar with two retained projects, and a window that can lose
  focus (another application or an OS dialog).
- **Steps**: 1) Hover an icon-only action and wait for its tooltip. 2) With the
  tooltip visible, move the pointer straight out of the window without clicking
  and then return it. 3) Hover one action, then move the pointer quickly across
  a row of adjacent actions. 4) Hover an action, then trigger a sidebar
  re-order or a project expand/collapse that moves its row in the DOM. 5) Hover an
  action, then press Escape. 6) Hover an action, switch to another application,
  then return to PI-Desktop. 7) Repeat step 1 for the project path tooltip
  (long absolute path), a session row's overflow control, and a message-toolbar
  chip.
- **Expected**: Each tooltip appears after its delay (300ms, 500ms for the
  project path) and retreats when the pointer leaves. No tooltip survives its
  trigger unmounting, a window blur, a hidden document, or Escape, and none is
  left painted after the pointer leaves the window entirely. Crossing adjacent
  actions shows at most one tooltip at a time. A move that keeps the same row
  element (list re-order, expand/collapse) keeps the tooltip instead of
  blinking it; a row that React truly unmounts and replaces drops it.
  placement near the top edge.
- **Specs linked**: `04-ux/09-interaction-patterns.md §6.4`
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Unit-covered (`icon-tooltip.test.mjs` source contract); rendered
  pointer/Escape/blur validation Draft

#### E2E-UI-row-actions-do-not-swallow-the-row-click: A hidden row action is inert

- **Preconditions**: PI-Desktop is open with two retained projects, each with
  at least three sessions, and one active conversation.
- **Steps**: 1) Without hovering it, click the right-hand gutter of an idle
  session row where its overflow control will appear, and note which
  conversation opens. 2) Repeat on an idle project header row. 3) Hover a row
  and activate the revealed overflow control on the first click. 4) Tab through
  the sidebar until a row action receives focus and activate it. 5) Repeat step
  1 with an emulated coarse pointer / touch device. 6) With the pointer resting
  on a row and its action revealed, switch focus to another application, then
  return without moving the pointer.
- **Expected**: The idle gutter belongs to the row — the first click there
  opens that conversation (a project header gutter activates and toggles that
  group) instead of an invisible menu, and a coarse pointer never meets a
  hidden control. The hover-revealed control still opens its menu on the first
  click, and keyboard focus reveals and keeps it operable. On window blur the
  row (and the project title tile) drops its hover paint and hides its revealed
  action; moving the pointer back over the row re-arms it.
- **Specs linked**: `04-ux/09-interaction-patterns.md §9.1c`
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Source-contract and style assertions cover the hidden/revealed
  `pointer-events` states and the blur release
  (`sidebar-navigation.test.mjs`); rendered pointer/touch validation Draft
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Unit-covered (`sidebar-navigation.test.mjs`,
  `interaction-polish.test.mjs`); rendered pointer/touch validation Draft

#### E2E-070: Native select menus follow the Windows theme across the app

- **Preconditions**: PI-Desktop is running on Windows with light and dark
  themes available.
- **Steps**: 1) In light theme, open remaining native selects (scheduled-task
  form) and confirm Settings pickers on Appearance, Behavior, Model configuration,
  and Import open as in-app menus rather than platform `<select>` popups. 2)
  Repeat every remaining native list in dark theme. 3) Open each list after
  switching themes without restarting the app.
- **Expected**: Settings compact pickers use the shared anchored menu. Every
  remaining closed native trigger and opened native option list uses the
  active theme's readable foreground/background pairing. No dark-theme list
  falls back to a light Windows surface with light text, no light-theme list
  uses dark-theme ink, and changing theme updates subsequent openings. The
  same result holds for native selects outside Settings.
- **Specs linked**: `04-ux/06-settings-ia.md`,
  `04-ux/07-ui-design-system.md`
- **Acceptance**: Quality (cross-platform theme readability)
- **Milestone**: M5
- **Status**: Unit-covered (`settings-general.test.mjs`); Windows rendered
  scenario Draft

#### E2E-071i: Long session opens under a settle veil and sends clear instantly

- **Preconditions**: One session with several hundred messages including code
  blocks and tool results; a configured model; the host made slow (for example a
  throttled sidecar or a large pending tool output) so a prompt round trip takes
  visibly longer than a frame.
- **Steps**: 1) From the home surface, open the long session and record the
  first painted frames. 2) Wait for the transcript to appear. 3) Leave and
  re-open the same session while its history page is being revalidated. 4) Type
  a multi-line prompt so the composer grows, then press Enter. 5) While the
  host is still busy, press Enter again on the now-empty box. 6) Make the host
  reject a send (for example disable the model's provider) and press Enter with
  a new draft. 7) Open a session with fewer than fifteen messages.
- **Expected**: The first frame of the long session is an opaque skeleton of
  alternating user and assistant lines under the composer; no transcript text is
  visible during the frames in which the history expands or row heights settle,
  and the skeleton fades out within roughly 600ms onto a transcript already
  positioned at its newest turn. The rows never move up and down after the
  reveal. While the multi-line draft grows, the newest turn moves up with the
  composer instead of disappearing behind it. Re-opening during revalidation
  and a repeated older-page response leave exactly one row per message id,
  including the existing user row. Pressing Enter clears the box and shows the
  user row at the bottom of the transcript in the same frame, before the host
  has answered; when the host echo arrives the row does not duplicate or jump.
  The second Enter on the empty box does nothing and queues no duplicate. When
  the send is rejected, the user row disappears and the draft
  returns to the box with the caret at its end. The short session shows no
  skeleton.
- **Specs linked**: `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, `08-meta/decisions-log.md` (D287, D288)
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`transcript-settle.test.mjs`,
  `composer-send-state.test.mjs` `send clears the composer before the round
  trip and restores a rejected draft (D287)` and `the user row is inserted
  before the host round trip and echoed under the same id (D288)`,
  `session-transcript.test.mjs` (`repeated transcript rows keep one position and
  the latest value`); UI scenario Draft

#### E2E-072: Keyboard shortcut mappings persist and stay conflict-safe

- **Preconditions**: App running on macOS and on one Windows/Linux target with
  Settings open; no custom shortcut overrides are stored.
- **Steps**: 1) Open Settings → Shortcuts and inspect Keyboard shortcuts. 2) Change
  Search to an unused modifier chord. 3) Invoke the new chord and then the old
  chord. 4) Attempt to assign that chord to the command shortcut (now opened via
  global search). 5) Attempt a bare letter and a reserved editing chord. 6)
  Disable Search and confirm its row shows Unbound. 7) Confirm neither the
  default nor custom Search chord invokes Search, then restart and check that it
  remains disabled. 8) Restore Search individually and confirm its default
  returns; choose Restore defaults and confirm all rows return to defaults. 9) On
  macOS inspect the corresponding native application-menu accelerator after
  each save/reset. 10) On Windows disable the plugin launcher and confirm its
  old global binding, focused fallback, and Alt+Space host fallback are all
  inactive. 11) Press and release Ctrl/Command alone, confirm an IME candidate,
  and hold the back/forward chord long enough to generate repeats.
  12) With the main window focused, press the window-visibility chord
  `Alt + Shift + W` and confirm the window hides to the tray with no
  close-behaviour prompt and with the app still running; from another
  application, press it again and confirm the window returns and focuses.
  13) Disable New task, assign its default chord to Search, then reset New task
  individually. Confirm the conflict error preserves both mappings and Search
  still opens with that chord. Repeat with New task customized instead of disabled;
  free the default by resetting Search, then retry New task reset.
  14) Seed one profile with a stored customized `closeWindow` binding and one
  with a customized `summonWindow` binding; confirm each profile keeps that
  binding on the single toggle row after restart and that `Cmd/Ctrl + Shift +
  W` registers nothing.
  15) With an unsent composer draft in the main window, press unmodified
  `Ctrl + R`; confirm the renderer remains loaded and the draft remains intact.
  On macOS, confirm `Cmd + R` and the explicit View → Reload menu action are
  unchanged.
- **Expected**: Actions are grouped as Navigation, Agent, and Window with
  platform-native key labels; recording has visible focus and `Escape` cancels;
  the custom Search chord takes effect immediately, replaces the old chord,
  survives restart, and updates the macOS menu; duplicate, modifier-free, and
  reserved assignments show an inline error without changing either action;
  Unbound displays as a localized explicit state, participates in no conflicts,
  dispatches no old or default chord, persists across restart, removes the
  macOS accelerator, and disables the Windows launcher fallback layers;
  individual reset rejects an occupied default without changing either action;
  conflict-free individual and global reset restore the shared defaults; Keyboard shortcuts is
  its own Settings destination. Modifier-only and IME keydowns dispatch nothing,
  an unmodified `Ctrl + R` is consumed before Chromium reloads the main renderer,
  preserving the unsent draft; macOS `Cmd + R` and View → Reload remain available.
  and a held history chord traverses only once per physical press. The
  window-visibility key is one toggle on `Alt + Shift + W` — a visible, focused
  window hides to the tray, anything else shows and focuses — and it never
  enters the close path, so it raises no close-behaviour prompt and never quits;
  it is globally registered and deliberately avoids `Cmd/Ctrl + W`, which macOS
  spends on its own close-window command; the retired `Cmd/Ctrl + Shift + W`
  chord registers nothing, and a stored `closeWindow`/`summonWindow` override
  folds into the toggle (D438, D439).
- **Specs linked**: `04-ux/06-settings-ia.md`, `04-ux/07-ui-design-system.md`,
  `03-runtime/01-ipc-protocol.md`
- **Acceptance**: F (settings persistence), Quality (keyboard accessibility)
- **Milestone**: M5
- **Status**: Shortcut unit-covered (`keyboard-shortcuts.test.ts`,
  `settings-keyboard-shortcuts.test.mjs`, `window-menu.test.mjs`,
  `window-toggle-shortcut.test.mjs`); `test:e2e:boot` verifies the main-window
  Ctrl+R input is consumed. The full rendered settings journey remains Draft.

#### E2E-073a: Developer mode gates the developer-tools console

- **Preconditions**: App running on macOS and on one Windows/Linux target;
  developer mode is absent or false in persisted settings and Settings ->
  Info is open.
- **Steps**: 1) Find the Developer card through Settings search. 2) Confirm the
  Open console action is disabled and invoke F12 plus the platform secondary
  shortcut. 3) Enable developer mode and open the console from Settings.
  4) Close it and reopen it with F12; on Windows/Linux repeat with
  Ctrl+Shift+I, and on macOS inspect and invoke the View-menu developer-tools
  item. 5) Restart the app and invoke an enabled entry point. 6) Disable
  developer mode while the console is open. 7) Attempt the console IPC directly
  while disabled.
- **Expected**: No disabled entry point opens developer tools, and macOS omits
  the View-menu item. Enabling the persisted switch unlocks the localized
  Settings action and applicable platform shortcuts; each toggles the same
  window console after restart. Disabling the switch closes the console,
  disables the Settings action, removes the macOS menu item, and makes direct
  IPC requests fail closed.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `04-ux/06-settings-ia.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`
- **Acceptance**: F (settings persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`settings-general.test.mjs`,
  `window-menu.test.mjs`); native interaction scenario Draft

#### E2E-074: Concurrent session events and permissions never steal focus

- **Preconditions**: Sessions A and B exist in Agent mode and can run
  concurrently; A is visible with a draft in its composer.
- **Steps**: 1) Start turns in A and B, then return to A. 2) Let B emit streamed
  messages, tool activity, completion, and a permission request. 3) Confirm A
  remains visible and continue editing its draft. 4) Trigger a permission
  request in A as well. 5) Open B explicitly, resolve only B's request, then
  return to A and resolve A's request. 6) Rapidly select A then B while session
  details load in opposite completion order. 7) While B is loading, resolve A's
  Write/Edit request so its tool completion records an inline review card, then
  let B emit a
  BrowserPreview artifact while A is visible. Switch back to each session.
- **Expected**: B's background events update only B's row and retained state;
  they do not change A's active session/project/page, transcript, draft, scroll,
  or keyboard focus, and no global modal appears. Opening B reveals only B's
  inline card with no countdown. Both requests remain independently
  actionable, and resolving B does not clear A. The final rapid selection stays
  on B even when A's older load finishes later. Only explicit notification or
  session activation may navigate. A's post-approval review card is retained only in
  A without a transient open/close flash in B; B's BrowserPreview carries B's
  session identity, updates only B's retained Browser resource, and never opens,
  navigates, focuses, or resizes A's panel. Explicitly returning to either
  session restores its own open state, tabs, active tab, and Browser resource.
- **Specs linked**: `04-ux/01-ui-ia.md`, `04-ux/03-permission-ux.md`,
  `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (session isolation), E (permission isolation), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`permission-inline.test.mjs` for scoped state,
  inline rendering contract, no-countdown behavior, and latest-selection guard;
  `work-panel.test.mjs` and `browser-preview-tool.test.mjs` for session-scoped
  artifact retention and routing); full UI scenario Draft

#### E2E-075: Sidebar section context menus create sessions and projects
- **Status**: Manual
- **Priority**: P1
- **Covers**: A, C, D / US-UI-57
- **Preconditions**: App running with the expanded home sidebar visible.
- **Steps**:
  1. Right-click the `Sessions` heading label (not a session row).
  2. Choose the single create item.
  3. Right-click empty chrome in the standalone session list.
  4. Right-click the `Projects` heading label.
  5. Choose the single create item and cancel or complete the project picker.
  6. Right-click empty chrome in the project list (outside any project group).
- **Expected**:
  - Sessions context menus apply the temporary-group empty-session reuse rule
    and focus the composer; a new durable row is visible before any message.
  - Projects context menus open the same Create project dialog as the heading
    folder-plus control.
  - Existing row context menus and heading glyph buttons remain available; the
    section menus stay one-item and theme-matched with other sidebar menus.
  - Section, session-row, and project-row right-click menus open to the right
    of the pointer when space permits, and remain fully within the viewport at
    the right edge.
  - Escape and outside click dismiss the menu without creating anything.

#### E2E-076: Startup splash appears then yields to the main shell
- **Status**: Partially automated (`startup-splash-motion.test.mjs` covers splash markup, motion tokens, reduced-motion, and catalog keys; `macos-sidebar-vibrancy.test.mjs` covers the darwin glass splash and shell cross-fade; `startup-animation.test.mjs` and `packages/shared/src/startup-animation.test.ts` cover the D679 animation's bounds, phase machine, discovery, surface, and boot-surface ranking; `pnpm test:e2e:startup-animation` boots the real app against a generated video and asserts `pi-startup:` decoding, advancing playback, the reveal, and that an unplayable file still yields the shell; full window timing remains Draft)
- **Priority**: P1
- **Covers**: A, Quality / US-UI shell polish
- **Preconditions**: App launch path available (dev or packaged).
- **Steps**:
  1. Launch PI-Desktop.
  2. Observe the first painted renderer surface before bootstrap completes.
  3. Wait until sessions/settings bootstrap finishes.
  4. Repeat with OS `prefers-reduced-motion: reduce` when available.
  5. On macOS, compare the splash surface with the sidebar glass after the shell appears.
  6. Repeat with `bootstrap` held unanswered past the watchdog bounds, and observe the boot surface at 30s and after 180s (issue #831).
  7. Drop a short playable video into `<dataDir>/startup/` and relaunch (D679).
  8. Replace it with an unplayable file (for example a renamed text file) and relaunch.
  9. With the animation present, relaunch under `prefers-reduced-motion: reduce`, then reload the renderer, then close the window and reopen it from the tray or Dock.
- **Expected**:
  - Before ready: full-window splash with brand mark, shell name, tagline, and accessible starting status (`data-testid="startup-splash"`).
  - After ready: splash exits with a short fade (or instantly under reduced motion) and the main shell (or settings page) is interactive underneath.
  - If the initial state never arrives, the splash is replaced rather than held: the boot surface gains logs, diagnostics, and quit at 30s (`STARTUP_SLOW_HINT_MS`) without reporting a failure, and at 180s (`STARTUP_STALLED_MS`) becomes the recovery surface, which also offers a retry (`data-testid="startup-recovery"`); every action works without a backend, the renderer-drawn window controls stay above the surface on Windows/Linux, and quit goes through `pi-desktop/app/quit`.
  - On macOS the splash uses the same glass tint and sheen as the sidebar over native `sidebar` vibrancy; the mounted shell stays hidden until the splash exit fade, then cross-fades in. Other platforms keep the opaque `--ds-bg-primary` fill.
  - Use a six-second playable fixture with skip-when-ready off. Observe advancing
    playback beyond the two-second first-frame bound and through at least 5.75s
    before reveal. A `playing` event must retire the first-frame timeout even
    if `loadeddata` was missed. The native fixture also suppresses that event
    in a fresh test renderer to exercise this path deterministically; it resets
    only the temporary window’s one-play mark before that test reload. Keep
    corrupt-media recovery coverage.
  - With a video in `<dataDir>/startup/` (D679): `data-testid="startup-animation"` replaces the splash in the first painted frame, plays over opaque black with no controls and no audio, then holds the same black until bootstrap finishes, then fades out over about a second with the shell already clickable during the fade. A boot slower than the video shows an indeterminate bar after 3s of black. `Escape` jumps straight to that fade.
  - An unplayable file never holds the launch: the animation ends within 2s (no first frame) or on `error`, and the reveal runs exactly as it does after a clean finish.
  - The animation is not played under reduced motion, on a renderer reload, or on a window reopened from the tray or Dock; the brand splash is used instead. Settings → Appearance → Interface names the resolved file, offers the folder, and applies a toggled switch on the next launch only.
  - A boot held past the watchdog bounds replaces the animation with the recovery surface — it is never left behind the opaque mask.
  - No plain unbranded “Starting…” centered text as the only boot UI.
  - Overlay/dialog enter motion uses shared tokens; reduced motion keeps state changes without decorative duration.
  - If a non-settings bootstrap request fails while the settings read is still
    in flight, opening Settings still renders the loaded controls. If the
    settings request itself fails, the active section shows a loading/failure
    state and retry action rather than a blank content pane; retrying after the
    local service recovers restores the controls without leaving Settings.
- **Specs linked**: `04-ux/07-ui-design-system.md` §8, `04-ux/02-i18n-english-first.md`, `04-ux/09-interaction-patterns.md` §1.12, ADR 0338, decisions-log D146 / D304 / D348 / D679
- **Acceptance**: A (app startup), Quality
- **Milestone**: M5

#### E2E-SESSION-reopen-restores-running: Recreated windows retain live turn status

- **Steps**: Start a Desktop turn in a session with an older completion
  notification. Close and recreate its renderer while Main keeps the turn
  alive. Inspect the sidebar and select the session before another agent event.
  Repeat after the turn ends, and with a start/end event arriving during bootstrap.
- **Expected**: Live tasks show running, and selecting one restores the running
  composer state. Completed tasks stay idle. A delayed snapshot never overrides
  a start/end event already received by the new renderer.
- **Automation**: `node scripts/e2e-running-session-reopen.mjs` recreates real
  Electron windows with the production bootstrap, Sidebar and selection flow,
  using fixture backend responses. `session-list-runtime.test.mjs` checks the
  Main snapshot; `session-running-bootstrap.test.mjs` covers event races and
  responses from older hosts. The native macOS close gesture remains a manual check.
- **Specs**: `03-runtime/01-ipc-protocol.md`, ADR 0090.

#### E2E-099: Brand logo follows the active theme
- **Status**: Draft
- **Priority**: P3
- **Covers**: Quality / US-UI shell polish
- **Preconditions**: App running; theme can switch between light and dark (and system) without restart.
- **Steps**:
  1. In light mode, open the app shell, an empty chat home, and the expanded sidebar (Windows/Linux) or startup splash.
  2. Inspect the rendered `BrandLogo` source in the sidebar and startup splash,
     and inspect the light eight-frame `HomeMascotLogo` GIF in the empty-home
     hero. Hover the mascot and verify that its cadence does not change.
  3. Switch the theme to dark (Settings → Appearance → Interface, or system appearance change).
  4. Re-inspect the same surfaces without reloading.
  5. Switch back to light and re-inspect.
- **Expected**:
  - Light and dark mode render `src/assets/brand/logo-light.png` /
    `src/assets/brand/logo-dark.png`
    live in the sidebar and startup splash without a window reload.
  - The empty-home hero renders the 100px eight-frame mascot GIF for the
    active theme (`home-mascot-light.gif` / `home-mascot-dark.gif`) with a
    short idle hold and a looping wave. Switching theme swaps the pair live
    without a window reload. Pointer hover does not change the cadence;
    under reduced motion the matching still first frame remains visible.
  - Sizes stay stable across theme changes (sidebar 20px, hero 100px, splash
    64px), and the marks stay decorative with no click, keyboard, or focus
    behavior.
- **Specs linked**: `04-ux/08-component-spec.md` §3.7, `04-ux/07-ui-design-system.md`
- **Acceptance**: Quality
- **Milestone**: M5
#### E2E-077: Theme-aware selection and CJK section labels

- **Status**: Partially automated (`user-select.test.mjs`, `interaction-polish.test.mjs`)
- **Priority**: P2
- **Covers**: A, Quality / US-UI shell polish
- **Preconditions**: App running with at least one selectable transcript or input; language can be switched to `zh-CN`.
- **Steps**:
  1. Select text inside a transcript message or the composer.
  2. Inspect sidebar Sessions/Projects section labels in English.
  3. Switch the app language to `zh-CN` and re-check the same labels.
  4. Hover jump-latest (when visible), stop, search rows, and profile menu items.
- **Expected**:
  - Selection highlight uses a neutral text-primary wash (not browser-default blue).
  - Caret/form accent colors stay on the monochrome token ramp.
  - English section labels may use uppercase + wide tracking; `zh-CN` labels use normal tracking without forced uppercase.
  - Listed chrome controls ease background/color changes via shared motion tokens.
- **Specs linked**: `04-ux/07-ui-design-system.md`, `04-ux/08-component-spec.md`
- **Acceptance**: D147
- **Milestone**: M5
- **Status detail**: Source-level coverage for CSS contracts; visual selection paint remains manual.

#### E2E-078: Work panel and settings light-surface polish

- **Status**: Partially automated (`surface-polish.test.mjs`)
- **Priority**: P2
- **Covers**: D, Quality / US-UI shell polish
- **Preconditions**: App running; theme can switch to light; a work-panel tab can be opened.
- **Steps**:
  1. Switch to light theme.
  2. Open Settings and inspect form fields, toggles, segment controls, and shortcut keycaps.
  3. Open the work panel (Review / Files / Browser) beside a chat session.
  4. Hover file-tree rows or diff headers; focus the browser URL field.
  5. Open a confirmation/provider dialog and inspect the scrim.
  6. In both light and dark palettes, inspect the settings rail, search, selected
     item, on-state knob, composer shell, plugin/capability searches, the code
     card's head band, the Mermaid canvas, tool output, the composer placeholder
     and disabled send chip, the dialog scrim and permission backdrop, and the
     dock question card with its option row. Apply custom surface variables,
     keyboard-focus both searches, then remove the custom theme.
- **Expected**:
  - Work panel body reads as quiet `#fafafa` inset paper with a white header band.
  - Settings fields, browser URL, segment tracks, and shortcut keycaps use light inset fills; focused fields lift with a neutral ring.
  - Toggle on-state keeps a white knob on the near-black track.
  - Hover fills on file-tree/diff/resize ease with shared motion tokens, and the divider matches the sidebar: a 32px centered grip on direct hover/focus, not a full-height hairline; keyboard focus and an in-progress drag use the solid accent.
  - Light dialog scrim is softer than the dark 45% veil (~28% ink).
  - The dock question card paints the composer plate in both palettes — light
    `#ffffff` with the composer shadow, dark 96% `#212121` — and its option rows
    are inlaid `--ds-tile-deep` fills with no raised shadow. A custom
    `--ds-bg-composer` / `--ds-tile-deep` repaints both, and removing it
    restores the built-in paint.
  - Tool output keeps its cascade: light paints the same lighter tile over error
    output and over plain tool blocks, while dark shows the error tint and leaves
    plain blocks transparent.
  - Custom variables repaint the corresponding fills, keycap ink, and search
    focus states; removing them restores the built-in 8-bit RGBA paint and the
    existing shadows/focus rings. Prose ink mixes follow `--ds-text-primary`,
    and the `one-dark-pro` / `one-light` Shiki plate and its ink stay with the
    Shiki theme by design. This batch does not change plugin APIs.
- **Specs linked**: `04-ux/07-ui-design-system.md`, `04-ux/08-component-spec.md`
- **Acceptance**: D148
- **Milestone**: M5
- **Status detail**: `pnpm test:e2e:theme-surfaces` exercises these ordinary fills,
  focus states, and built-in restoration with real Chromium, production CSS,
  and deterministic DOM fixtures; plugin installation/lifecycle is not covered.
  Branch runs do not replace post-integration E2E. Other surfaces in this
  scenario retain manual visual checks.

#### E2E-079: User-facing catalog copy in English and Chinese

- **Status**: Partially automated (`packages/i18n/test/user-facing-copy.test.mjs`, `catalogs.test.mjs`)
- **Priority**: P2
- **Covers**: A, Quality / US-UI copy
- **Preconditions**: App running; language can switch between English and zh-CN.
- **Steps**:
  1. Inspect empty-home hint, sidebar temporary-chat section, and status/connection toasts.
  2. Open Settings → Models and the marketplace refresh action.
  3. Switch the app language to zh-CN and re-check the same surfaces.
- **Expected**:
  - Copy explains outcomes in plain product language (AI provider, project, marketplace, connected/limited) rather than host/backend/repo jargon.
  - English and zh-CN catalogs keep identical keys and interpolation variables.
  - Crash chrome and empty-home titles remain catalog-backed in both locales.
- **Specs linked**: `04-ux/02-i18n-english-first.md`
- **Acceptance**: D149
- **Milestone**: M5
- **Status detail**: Source-level coverage for catalog contracts; visual wording review remains manual.

#### E2E-081: Send re-pins transcript and jumps to bottom

- **Preconditions**: Long transcript that overflows one viewport; provider configured.
- **Steps**:
  1. Start at the pinned bottom and use a trackpad to scroll upward with a
     small initial movement; observe the first movement and the
     jump-to-latest control.
  2. Type a new prompt in the composer and send it.
  3. Observe transcript position while the turn starts and streams.
  4. Scroll upward again with a small trackpad movement while streaming, wait
     for more content, then click jump-to-latest.
- **Expected**:
  - The first upward movement immediately releases follow mode and remains
    stable; it does not snap back, reverse direction, or oscillate while a
    pending stream or resize follow frame completes.
  - New streamed content does not move the manually positioned viewport, and
    jump-to-latest appears as soon as follow mode is released.
  - On send, the transcript re-pins, hides jump-to-latest, and jumps to the bottom so the new user message (and following stream) is visible.
  - Streaming continues to follow while pinned.
  - Long Markdown responses with nested lists keep their list container line
    boxes stable during streaming; the cursor follows the terminal inline text
    without adding a blank line below a nested list.
  - Manual scroll mid-stream pauses follow and shows jump-to-latest again; clicking it resumes follow.
- **Specs linked**: `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (chat stream), Quality / D151
- **Milestone**: M5
- **Status**: Partially automated (`apps/desktop/test/transcript-scroll.test.mjs`);
  full trackpad interaction remains Draft

#### E2E-082: New reasoning session defaults to the binding thinking level

- **Preconditions**: The app default provider/model resolves as reasoning-capable
  and publishes a sparse thinking-level set with a stored binding default that
  is not the strongest enabled level; a second default model is non-reasoning.
- **Steps**:
  1. Set the reasoning-capable model as the app default and create a new session.
  2. Inspect the Composer model × reasoning chip and the session configuration
     sent to the host.
  3. Select a lower level or Off, leave the session, and reopen it.
  4. Set the non-reasoning model as default and create another new session.
- **Expected**:
  - The first new session persists and displays the binding's stored default
    thinking level, clamped onto the enabled set, even when the provider returns
    its sparse levels out of order. It does not jump to the strongest enabled
    level merely because the model supports reasoning.
  - Reopening the first session preserves the user's later explicit selection.
  - The non-reasoning session starts at `off`; its combined chip keeps the Bot
    icon, omits level text, and its reasoning submenu exposes only Off. Missing
    capability metadata also falls back to `off`.
- **Specs linked**: `03-runtime/13-model-catalog-and-selection.md`,
  `04-ux/08-component-spec.md`, ADR 0018, D303
- **Acceptance**: B (model config), F (persistence), Quality
- **Milestone**: M5
- **Status**: Partially automated (`thinking-levels.test.ts`,
  `thinking-ui.test.mjs`); full UI scenario Draft

#### E2E-083: Long streaming turns keep shell interaction responsive

- **Preconditions**: Provider configured; an active session has enough user,
  assistant, and tool rows to overflow several viewports; work panel can be
  opened; both normal and reduced-motion preferences are available.
- **Steps**:
  1. Start a long assistant response that emits frequent streamed updates.
  2. While it streams, hover and focus sidebar rows, type in the composer when
     enabled, open/collapse the work panel, and scroll the transcript away from
     and back to latest.
  3. Observe the minimap, completed history rows, composer surface, and shell
     chrome throughout the stream.
  4. Navigate to Plugins or Settings and back, then repeat with reduced motion.
- **Expected**:
  - The current assistant row reveals content progressively and pinned follow
    stays at latest without visible oscillation.
  - Smooth text reveal on a simulated 120 Hz display commits no faster than
    60 Hz, and its animation frame loop stops after it catches up.
  - Replaceable message/tool partials are coalesced to the next paint, while
    terminal, permission, planning, and error states remain immediate.
  - A failed tool row remains error-hued and locally expandable, but never marks
    the containing activity group as terminally failed. The group reports only
    processing duration; terminal turn styling comes from the terminal agent
    outcome surfaces.
  - Sidebar, composer, completed message/activity rows, work panel, titlebar,
    and global overlays do not visibly repaint or lose pointer/keyboard
    responsiveness for each token update.
  - Completed history remains in its stable render boundary while the active
    tail changes; history stays selectable, copyable, and anchored in the
    minimap without being rebuilt as a React subtree for every token.
  - Within that same active turn, unchanged non-delegation activity groups do
    not render again just because text updates rebuild turn-wide delegation
    maps. Tool content changes still render; later TaskWait results update
    the original Task group's terminal status and completion duration.
  - Pressing and releasing standard, icon, sidebar, send, stop, and message
    action controls uses one eased transform rather than a snapped scale;
    active streaming labels keep their readable text while their compact status
    markers pulse at or below 1 second; loading skeletons retain their pulse.
  - Minimap overflow and active-marker state remain correct without marker
    jitter while streamed content changes height.
  - Destination, panel, focus, pressed, jump, and error feedback use one short
    bounded transition; no composer blur trails the transcript.
  - The initial shell does not eagerly evaluate secondary destination modules;
    first navigation may show a compact localized loading indicator, then
    preserves normal page interaction after the local chunk resolves.
  - Reduced motion preserves every state change and uses instant programmatic
    scrolling with near-zero transition duration.
- **Specs linked**: `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`interaction-performance.test.mjs`); automated
  React/Chromium render regression via `pnpm test:e2e:transcript` (no provider
  credentials; requires installed Electron and a graphical session, or Xvfb on
  Linux). It mounts production transcript components, counts ActivityGroup
  renders across 20 text updates with 100 completed groups, checks changed tool
  content, checks cross-part Task terminal status/timing updates, and exercises
  the production smooth-text hook against deterministic 120 Hz animation frames.
  The page links the app's built stylesheet, which the runtime-status scenario
  below measures real geometry against; full provider streaming and shell
  responsiveness remain Draft.

#### E2E-CHAT-long-history-stream-keeps-responsive

- **Preconditions**: Isolated Electron fixture with production React,
  `ChatTranscript`, Composer, event slice, store subscription, and session cache;
  synthetic Host reads, clipboard, and DOM input, no credentials or running Desktop.
- **Steps**: Keep three sessions running with 100, 1,000, and 10,784 canonical
  loaded rows. Stream warmed deltas into the foreground and both background
  caches, then switch through real session selection with 100-row revalidation.
  Correct an older row; inspect its minimap preview. Toggle a disclosure, scroll
  away from latest, complete/re-key the tail, copy its turn, and switch back.
  Separately stream a 256-fragment single turn and a 256-tool activity group;
  update a nested child through the real read-only subagent dock, stream the
  giant group's final thinking item, and deliver actual `tool_update` partials
  to a running tool in the middle of that group. Append three tool starts to the
  loaded 10,784-row session and switch away and back.
- **Expected**: Ordinary warmed deltas read zero unchanged bodies; unchanged
  groups do not rerender. Mounted history stays bounded despite full canonical
  input. Background updates never replace the foreground, and revalidation never
  discards its cached live tail. Content, minimap previews, disclosure choice,
  reader scroll ownership, completed Copy text and terminal identity remain
  correct. Changed tools/children/thinking still reach their real components.
  Structural tool appends read zero unchanged completed bodies and survive session
  reselection; immutable text facts are also reused for delegate answers.
- **Specs linked**: `04-ux/08-component-spec.md` §7.6.
- **Acceptance**: C (chat stream), Quality. **Milestone**: M5 maintenance.
- **Status**: Automated fixture in `scripts/e2e/transcript-long-history.tsx`,
  registered in `pnpm test:e2e:transcript`; requires built renderer CSS and the
  existing Electron environment. Assertions are work counts and DOM state, not
  timing thresholds. Event-to-settled-DOM latency, supported long-task entries
  and optional heap samples are diagnostic only. Elapsed-label wall time is
  controlled; the hidden-window fixture explicitly dispatches DOM `focusin`.
  Existing deterministic 120 Hz cadence coverage remains unchanged. This is renderer/store integration, not
  provider/IPC throughput, real-session profiling, or complete shell interaction
  acceptance; those broader E2E-083 facets remain Draft.

#### E2E-CHAT-running-status-survives-output-pauses

- **Preconditions**: Production `ChatTranscript`, real store and React DOM in
  Electron; deterministic messages/status transitions, no provider credentials.
- **Steps**: Send a turn, stream partial text, stop delivering deltas, start and
  finish a tool, clear/set runtime phases, resume text, then complete, stop, or
  fail. Repeat with `Show thinking` on and off. Exercise planning, permission,
  question and proposal waits, history reading, and switching sessions.
- **Expected**: Exactly one localized, accessible tail status remains through
  output pauses and completed-tool gaps. Runtime phases take precedence over
  Planning/Goal or Working. Pending user interaction suppresses it; terminal
  turns and history reading remove it. Switching sessions uses that session's
  status only. Existing content and permission actions remain available.
  Active and assistant-error turns mount no empty action toolbar. A partial
  answer has 24 CSS px between its fragment box and the status label
  at the default font scale; settled non-error content retains Copy, Fork,
  and Regenerate. Check the `Show thinking` preference on and off. History reading and
  permission cards retain normal message padding. Ending a turn keeps pinned
  follow at the bottom while restoring the normal toolbar height. A scrolled-up reader keeps the exact text position
  and scroll offset.
- **Specs linked**: `04-ux/08-component-spec.md`, `04-ux/09-interaction-patterns.md`
- **Acceptance**: C (chat stream), Quality (interaction and accessibility)
- **Milestone**: M5
- **Status**: Automated by `pnpm test:e2e:transcript`
  (`scripts/e2e/transcript-status.tsx`). Reproduces issue #669 on upstream
  `ecece8f570fc0c18f21e4941eafe52244a7c6e5f`; no real-provider claim.

#### E2E-CHAT-initial-wait-spacing

- Send a user message before any assistant output: retain the original user
  action row and spacing (52px bubble-to-status in the default text fixture).
- At wide and narrow transcript widths, Copy remains focusable and pointer
  reachable; edit/delete/revision controls retain their disabled running state.
  Status and action hit targets never overlap, including revision pagers.
- Right-click the status/background for the conversation menu and the message
  for its own menu. Change runtime phase, receive first output, or stop before
  output: exactly one status follows the active turn and terminal actions return.
- Coverage: `scripts/e2e/transcript-status.tsx`, `pnpm test:e2e:transcript`.

#### E2E-CHAT-runtime-status-keeps-row-position

- **Preconditions**: An active session whose transcript is taller than the
  conversation viewport, with a completed tool row owning the tail; the pane is
  built (`pnpm build:js`) and Electron is installed.
- **Steps**:
  1. Mount the production `ChatTranscript` with fixed messages, the tail owned
     by a completed activity group, and the session running.
  2. Record the content height, scroller scroll height/offset, and the first and
     last rendered row positions with no runtime activity reported.
  3. Switch the session's runtime activity to the waiting-for-model phase only;
     let the layout settle.
  4. Clear the runtime activity again and let the layout settle.
  5. Finish the turn (`isRunning` false) and inspect the tail.
- **Expected**:
  - The waiting row occupies the reserved status lane: the content height,
    scroll height, scroll offset, and the position of every already-rendered row
    are unchanged (within 0.01px) while Working switches to the named wait and back.
  - The lane stays reserved and transparent — no background, border, or
    shadow — in both themes. Clearing a runtime phase restores Working.
  - The status row keeps its live-region semantics (`role="status"`,
    `aria-live="polite"`); pending user interaction leaves the reserved lane empty.
  - An idle finished transcript renders no status lane at all, so its layout is
    unchanged.
- **Specs linked**: `04-ux/08-component-spec.md`
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`active-turn-surface.test.mjs`) and automated
  React/Chromium geometry regression via `pnpm test:e2e:transcript`
  (`scripts/e2e/transcript-render.tsx`, no provider credentials; requires an
  installed Electron and a graphical session, or Xvfb on Linux). The scenario
  fails by 40.125px of content height and 40px of row movement when the reserved
  lane is removed (issue #323).

#### E2E-263: Native interaction stays live during large transcript and tool-output rendering

- **Preconditions**: Isolated visible Electron window with the production
  `Markdown` and `ToolDetailBlocks` renderers and built app stylesheet. A
  separate local Node fixture emits ordered synthetic deltas; no provider, real
  Host, production session, or user data is used.
- **Steps**: Mount a 680 Ki-code-unit tool result, then stream a 90 Ki-code-unit
  unbroken message plus a final marker from the child process. Once the rendered
  message exceeds the streaming-tail threshold, use Electron
  `webContents.sendInputEvent` to click, move between tool-output pages, type
  into the draft, switch to another session and back, collapse and expand the
  transcript, and scroll while deltas continue. Finish the stream and compare
  every received source code unit, sequence number, final marker, and rendered
  source length.
- **Expected**: Every native action is acknowledged while streaming remains
  active, each completes within 250 ms, and the action P95 is at most 100 ms on
  the recorded environment. The independent producer advances all 180 sequence
  numbers in order; switching sessions does not move or lose the background
  stream, and the finished content retains the exact received source. The large
  tool result exposes page controls, renders one page at a time (at most 32 Ki
  code units plus one code unit where a surrogate pair crosses the boundary),
  and retains its final page marker.
- **Specs linked**: `04-ux/08-component-spec.md` §8.7, §9.6.
- **Status**: Automated by `pnpm test:e2e:renderer-responsiveness`. The parent
  Electron process drives native input under an external 25-second deadline;
  the renderer cannot self-report its own timeout. The fixture is deterministic
  and offline, not an incident replay or a claim about production-session root
  cause.

#### E2E-STREAM-long-turn-keeps-realtime

- **Preconditions**: Provider configured; an Agent session can run a long
  autonomous turn with thinking, tools, and at least one subagent.
- **Steps**:
  1. Start a long Agent task that streams thinking and answer text at a high
     upstream token rate and continues through many tool rounds.
  2. Observe streaming latency of later short thinking/answer blocks in the
     same turn, including a nested subagent.
  3. Stop the turn, send a new prompt in the same session, and compare the
     new turn's streaming latency.
  4. Confirm historical activity rows in the still-running turn do not flash
     or rebuild as the tail token updates.
- **Expected**:
  - Upstream 200+ tok/s streams stay visually caught up (batched to the
    display refresh is allowed; a growing backlog is not).
  - Later short chunks in the same long turn do not keep getting slower.
  - Stop plus a new prompt is not required to restore speed.
  - Parent and subagent streams both stay realtime.
  - Transcript text after `message_end` matches the streamed content.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, ADR 0242, D412, issue #299
- **Acceptance**: C (chat stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`message-stream.test.ts`,
  `stream-coalescer.test.ts`, `streaming-benchmark.test.ts`,
  `assistant-turns.test.mjs`); rendered long-turn scenario Draft

#### E2E-084: Long tool loop compacts before the provider context limit

- **Preconditions**: Provider configured with known pi-ai context/output
  limits; a fixture can produce repeated tool turns and large capped tool
  results without finishing the agent run. Automatic protection is always on
  and has no settings.
- **Steps**:
  1. Start one agent task whose tool loop grows past the hard budget.
  2. Let at least three `turn_end` events occur before `agent_end`; observe the
     composer/session controls, processing rows, transcript, and toasts.
  3. Continue until a checkpoint is installed, then allow the task to finish.
  4. Send further prompts until a second checkpoint is installed.
  5. Repeat the hard-boundary turn with multiple parallel capped tool results in
     the compacted range.
  6. Restart the app, reopen the session, and send a follow-up that depends on
     summarized old work while verifying that completed prompts are not replayed
     as naked historical user messages.
  7. Repeat with a provider fixture that returns Bedrock's
     `prompt is too long: N tokens > M maximum` once.
  8. Run a turn where the model calls `new_context` well below the hard budget.
  9. Invoke `/compact` manually while idle.
- **Expected**:
  - The summary request of every checkpoint carries the session's own
    conversation identity: on the Responses-shaped providers
    (`openai-responses`, `openai-codex-responses`) the outgoing payload keeps
    the session id as `prompt_cache_key`, exactly as the session's turns do, so
    a gateway fronting a Codex backend accepts it instead of answering 400
    `invalid_responses_request`. A provider on another wire API, or on a
    published vendor host, is unchanged; an unrecognized endpoint on Chat
    Completions gains the key for the reason
    `E2E-PROVIDER-custom-endpoint-session-identity` records.
  - Each `turn_end` is evaluated before another provider request and never
    marks the overall task idle; composer/config controls remain blocked until
    `agent_end`, `error`, or manual-only `compaction_end`. In-run follow-up
    assistant turns compact through `prepareNextTurn` (pi 0.84.4+ skips that
    hook on a terminating turn); a new user prompt still compacts before its
    first provider request.
  - Every successful compaction adds exactly one divider row to the transcript,
    positioned immediately after the last message that checkpoint covers, and
    raises exactly one warning toast. Two checkpoints produce two rows, in
    order, and neither row replaces or hides a message.
  - Once a checkpoint is installed, including the manual `/compact` in step 9,
    the composer context ring drops to the checkpoint's estimated next-request
    size without waiting for another turn; the provider usage rows in its
    panel still describe the last real request. The next request's reported
    usage replaces the estimate, and reopening the session after a restart
    shows the same estimate (#2015; unit coverage in
    `apps/desktop/test/compaction-context-usage.test.mjs`).
  - The `new_context` call appears as a normal tool activity row, returns
    immediately, and the checkpoint is created at the following turn boundary
    rather than mid-turn.
  - Opening the context usage inspector after a checkpoint shows one line with
    the compaction count and the newest summary's token estimate; before any
    checkpoint that line is absent.
  - The context usage indicator exposes the same localized remaining-context
    summary on hover and keyboard focus, and its tooltip remains visible above
    the home/docked composer without clipping.
  - At the hard boundary a durable checkpoint is created before the next model
    request. The complete visible transcript is unchanged, and the continued
    task stays below the model-aware safe budget.
  - After a checkpoint the next provider request contains no assistant or tool
    message from before the boundary — only the summary and, while an active
    turn continues, its latest user message, which may carry the
    checkpoint-truncation marker. A completed-turn checkpoint has an empty
    retained tail. The request contains no tool call without its result, and
    expanding the original transcript rows still shows their complete
    persisted results.
  - Restart restores the summary and the recorded active/completed retention
    mode, and every earlier compaction row is still drawn. A regenerate/fork
    before a checkpoint boundary drops that record specifically; records
    anchored on surviving messages are preserved/remapped.
  - The exact provider overflow removes only the failed assistant from model
    context, keeps the visible assistant bubble in a running state while
    compaction/retry is pending, retries once after compaction, and does not
    loop on a second overflow. A recoverable first overflow emits no terminal
    error message or `error` event; only a failed retry (or failed compaction)
    closes the bubble with `CONTEXT_TOO_LARGE` / the actual terminal error.
  - If a retryable provider stream failure arrives after compaction has already
    replaced the failed assistant with a summary or retained user message, the
    retry keeps that current compacted transcript and calls `continue()`; it
    does not surface the missing-assistant guard error (issue #1768).
  - If automatic summary generation fails, a durable retained-tail fallback
    checkpoint is appended, the run stays active, and one warning explains
    that older model context was reduced; the transcript row for that
    checkpoint reads "summary generation failed · recent context retained",
    never `summary ≈N tokens` (ADR 0282). Before that fallback, the summary
    request retries transient provider failures up to three times with
    2s/4s/8s backoff, Stop cancels the backoff, deterministic failures do not
    retry, and an input whose serialized prompt exceeds the window is sent
    once more with tool results cut to a short prefix rather than skipping the
    model. If fallback persistence or the safe budget guard fails,
    `CONTEXT_COMPACTION_FAILED` is emitted once.
  - If the newest checkpoint is already the transcript leaf when a follow-up
    prompt crosses the hard budget, the runtime rebuilds a smaller tail from
    the full transcript and carries the existing summary forward instead of
    reporting that there is no new context to compact.
  - The budget reminders appear at most once each per checkpoint window, never
    in the transcript, and never in a persisted system prompt.
  - Idle `/compact` succeeds and shows its own informational toast on top of the
    compaction warning, because the user asked for it. Compaction failures
    surface once through `CONTEXT_COMPACTION_FAILED` without duplicate error
    toasts.
  - Settings contains no context-management card and Settings search returns no
    compaction rows.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/04-data-storage.md`, `03-runtime/06-host-rpc-protocol.md`,
  `04-ux/06-settings-ia.md`, `04-ux/08-component-spec.md`,
  `04-ux/09-interaction-patterns.md`, ADR 0030, ADR 0049, ADR 0061, ADR 0064,
  ADR 0136, D158, D203, D275
- **Acceptance**: C (chat/stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Partially automated (`runtime.test.ts`,
  `context-compaction.test.mjs`, `assistant-turns.test.mjs`, host-core
  transcript/session unit tests); full provider/UI journey Draft

#### E2E-PROVIDER-custom-endpoint-session-identity: A self-hosted endpoint receives the session id

- **Preconditions**: Two independent sessions, each with several turns, bound to
  a provider row whose API style is `chat_completions` and whose base URL points
  at a local capture endpoint (not a published vendor host). A third row on a
  published vendor host, a fourth on `anthropic_messages`, and a fifth on
  `openai-responses`, use the same capture endpoint's stand-ins where
  applicable.
- **Steps**: 1) Send a turn in each session and capture the full request headers
  and body of both. 2) Compare the two requests field by field. 3) Trigger a
  context-compaction summary in the first session and capture it. 4) Run a
  subagent turn and a plugin one-shot that carry a session id, and capture both.
  5) Repeat step 1 on the row whose base URL host is a published vendor host.
  6) Repeat step 1 on a row whose API style is `opencode_go`.
- **Expected**:
  - Both captured requests carry a stable per-session identifier that differs
    between the two sessions: `x-session-affinity` and `x-client-request-id`
    beside `session_id`, plus `prompt_cache_key` in the body, all holding the
    session's own conversation id and unchanged across that session's turns.
  - The custom Responses request also carries `x-session-affinity` alongside
    the adapter's existing `session_id`, `x-client-request-id`, and
    `prompt_cache_key`, so a reverse proxy that drops underscore headers can
    still route the session.
  - The compaction summary, the subagent turn, and the one-shot carry the same
    id for their session, so a gateway pins the whole session to one backend.
  - The published-vendor-host row and the OpenCode row are byte-identical to
    their pre-change requests (the OpenCode row keeps `x-opencode-session`).
  - A one-shot call with no session id gains no `prompt_cache_key` or
    `x-session-affinity` header.
- **Specs linked**: `03-runtime/02-agent-runtime.md` (§6.2, §6.3),
  `03-runtime/11-provider-model-system.md`, issue #1634
- **Acceptance**: C (chat/stream) + Quality
- **Milestone**: M5
- **Status**: Unit-covered (`session-affinity.test.ts`); full gateway capture
  journey Draft

#### E2E-AGENTS-001: Project instruction chain configures an agent session

- **Preconditions**: A project contains root `AGENTS.md`, nested
  `packages/api/AGENTS.md`, and a provider is configured.
- **Steps**:
  1. Start an Agent-mode conversation and submit a task covered by the root
     instruction.
  2. Let the agent read or edit `packages/api/handler.ts`.
  3. Have the agent read an attachment outside the project root.
  4. Add `packages/api/AGENTS.override.md`, then have the agent access another
     file in that directory.
  5. Edit the root instruction while the session is idle, then submit a
     follow-up task.
- **Expected**: The initial runtime receives the root chain. Before the file
  tool executes, the nested instruction is appended after its root source and
  therefore takes precedence. In one directory, `AGENTS.override.md` wins over
  `AGENTS.md`; `CLAUDE.md` and `.claude/CLAUDE.md` are fallback names. The idle
  follow-up uses changed root content rather than reusing the prior runtime.
  Empty, unreadable, oversized, and out-of-root instruction files do not block
  the turn; the global file and the project chain each have an independent
  32 KiB UTF-8 budget, an oversized global file does not remove project
  entries, and a truncated file ends with a notice naming its source and the
  loaded and total byte counts. A file tool whose target
  is outside the project root, or targets the root itself, keeps the root chain
  rather than clearing the project instructions; instruction files are still
  read only from inside the root. A fixture-backed sidecar run verifies that a
  nested read applies nested rules and a following attachment read restores the
  root rules without loading an outside `AGENTS.md`. If path-specific resolution exceeds its
  two-second deadline or the host is unavailable, the
  file tool continues with the base chain and does not retain a sibling
  directory's rules. Repeated file tools in the same directory during one
  prompt reuse one path-resolution claim; the next prompt resolves again so
  changed instruction files are observed. The resolver uses the session-bound
  project root passed at runtime launch and does not issue a per-file
  `session.get` RPC.
- **Specs linked**: `03-runtime/02-agent-runtime.md`
- **Acceptance**: C (chat/stream), F (persistence)
- **Milestone**: M5
- **Status**: Resolver and runtime behavior are automated in
  `project-instructions.test.ts` and `runtime.test.ts`; the fixture-backed
  sidecar scenario runs through `pnpm test:e2e:hosted-search`. The broader full
  provider/UI journey remains Draft.

#### E2E-AGENTS-002: Global settings and project menus manage instruction files

- **Preconditions**: PI-Desktop is running; a project can be opened.
- **Steps**:
  1. Open Settings -> Instructions without an active project and save global
     content.
  2. Start a new agent session and verify its instruction context includes the
     global source.
  3. Open the Projects view and use a project's more menu to edit and save its
     displayed `AGENTS.md`.
  4. Submit a prompt in a new or idle session.
- **Expected**: The global editor targets only `~/.pi/agent/AGENTS.md`. The
  project editor is available only from a known project's Projects-view more
  menu and targets only that project's root `AGENTS.md`. Both editors show
  their resolved paths, preserve the typed text, and save through the dedicated
  IPC rather than a general file write API. Global content precedes project
  content in the next runtime; the saved project content follows it and takes
  precedence on conflicts. The project editor is a viewport-level dialog.
- **Specs linked**: `03-runtime/02-agent-runtime.md`, ADR 0037
- **Acceptance**: C (chat/stream), D (workspace), F (persistence)
- **Milestone**: M5
- **Status**: Unit-covered (`project-instructions.test.ts`); UI journey Draft

#### E2E-085: Expanded sidebar typography keeps list content compact

- **Preconditions**: The expanded sidebar contains at least one standalone
  session, one retained project with a session, and one empty project group;
  light and dark themes are available.
- **Steps**:
  1. Open the app at the default window width and inspect session titles,
     project/group titles, empty-state copy, section labels, and the footer's
     Settings, Plugins, and notification icons.
  2. Switch between light and dark themes, then narrow the window to the
     minimum supported expanded-sidebar width.
  3. Compare the sidebar hierarchy with 14px chat body text and inspect long
     session/project names.
- **Expected**:
  - Footer action icons use the shared 32px hit target and compact 14px icon
    sizing; Plugins sits immediately to the right of Settings.
  - Session titles, project/group titles, and empty-state copy use `--text-md`
    (13px); section labels and secondary metadata remain at `--text-sm` (12px).
  - The hierarchy remains readable in both themes, row pitch stays compact at
    approximately 28–32px, and long labels truncate without shell reflow.
- **Specs linked**: `04-ux/07-ui-design-system.md`,
  `04-ux/08-component-spec.md`, D161
- **Acceptance**: Quality
- **Milestone**: M5
- **Status**: Unit-covered (`sidebar-navigation.test.mjs`); rendered visual
  scenario Draft

#### E2E-086: Assistant Mermaid fences render safely without blocking streams

- **Preconditions**: A provider can stream an assistant answer containing a
  valid Mermaid flowchart, an invalid Mermaid fence, and ordinary fenced code;
  light and dark themes are available.
- **Steps**:
  1. Stream a valid `mermaid` fence slowly and observe it before and after the
     closing fence arrives.
  2. Scroll the completed diagram into view, toggle source, copy the source,
     and switch between light and dark themes.
  3. Scroll upward so transcript follow is paused, then bring another completed
     diagram near the viewport.
  4. Render invalid and over-20,000-character Mermaid sources plus a payload
     attempting an HTML label, external image, link, or Mermaid config override.
  5. Expand thinking content containing a `mermaid` fence.
- **Expected**:
  - The partial stream remains a normal source code block; only the complete
    answer fence starts rendering, and only near the viewport. Ordinary code
    fences and thinking Mermaid fences retain their source presentation.
  - The diagram uses bounded card chrome, remains within the transcript width,
    switches theme without stale colors, and exposes keyboard-accessible
    diagram/source and copy controls. Copy returns the original fence source.
  - Diagram height changes keep a pinned transcript at the bottom but never
    resume follow after the user scrolls upward.
  - Invalid, oversized, or unsafe input cannot fail the assistant turn, execute
    a link, load embedded media, add foreign HTML, or weaken strict settings;
    it falls back to readable copyable source when rendering is unavailable.
- **Specs linked**: `04-ux/08-component-spec.md` §8.7,
  `04-ux/09-interaction-patterns.md` §2, `05-security/01-security.md` §2, D165
- **Acceptance**: C (chat & stream), Security, Quality
- **Milestone**: M5
- **Status**: Unit-covered (`mermaid-rendering.test.mjs`); rendered security and
  visual scenario Draft

#### E2E-092: Packaged runtime is self-contained without duplicate dependencies

- **Preconditions**: Native macOS arm64 and Intel x64, Windows x64, and Linux
  x64 packages built from clean release-host directories; a clean application
  profile;
  English and zh-CN available; external network access can be disabled while
  loopback remains available; a deterministic loopback OpenAI-compatible
  fixture provider returns code, KaTeX, Mermaid, and a Bash command.
- **Steps**:
  1. Record every compressed artifact format plus the unpacked application,
     ASAR, Electron runtime, locale, and unpacked-native sizes on each native
     runner.
  2. Inspect ASAR and resource inventories for sidecar, host, production
     modules, source maps, tests/examples/declarations, Chromium locales, and
     native prebuild targets.
  3. On each macOS package, run `file` (or `lipo -info`) against the app
     executable and `Resources/bin/pi-desktop-host-core`; confirm arm64 and
     x86_64 packages contain only their declared architecture and that the
     Rust host matches the Electron app. Confirm the shared
     `apps/desktop/package.json` macOS configuration produces arm64 assets named
     `PI-Desktop-X.Y.Z-arm64.dmg` and `PI-Desktop-X.Y.Z-arm64-mac.zip`, while
     the Intel assets use `PI-Desktop-X.Y.Z-x64.dmg` and
     `PI-Desktop-X.Y.Z-x64-mac.zip`; confirm the release directory has both
     DMG and ZIP artifacts and one merged `latest-mac.yml` feed whose URLs and
     checksums match those generated assets.
  4. Inspect the renderer output for its size controls: emitted JS is minified,
     no `.woff` or `.ttf` files are present, only the KaTeX `woff2` faces remain
     (no application font face is emitted any more), and
     the brand marks are the renderer-sized `assets/brand/logo-*.png` rather
     than the 1024px installer icons.
  5. Configure the loopback fixture provider, disable external egress, and
     launch from a clean profile. Switch between English and Simplified
     Chinese, request the deterministic response, render common
     JavaScript/TypeScript, Python, Rust, shell, Mermaid, and unknown-language
     fences plus KaTeX and a Mermaid diagram, run the Bash fixture, and verify
     host and agent-sidecar health.
  6. Confirm typography and branding survive the stripped font fallbacks: KaTeX
     math renders with its own faces, Chinese text in both the UI chrome and
     assistant output stays readable through the system CJK fallback tier, and
     the sidebar plus startup-splash logos render crisply on a HiDPI display.
- **Expected**: Each macOS package contains exactly one bundled agent sidecar,
  one Rust host matching its declared architecture, and only configured
  Chromium locale packs. The release output contains both native macOS
  architectures, DMG/ZIP artifacts, and one merged updater feed. Each macOS
  DMG and ZIP carries its standard `-arm64` or `-x64` architecture marker, and
  no generic macOS DMG, ZIP, or blockmap remains in the release output. The
  per-architecture updater metadata points to those names without collisions.
  Renderer dependencies
  exist through Vite output rather than duplicate raw
  `node_modules`; dependency source maps, tests, examples, declarations,
  a second agent-runtime tree, and reliably excludable non-target native assets
  are absent. Curated Shiki grammars highlight locally while an unknown fence
  stays readable as plain text. The renderer ships minified chunks, carries no
  legacy `woff`/`truetype` payload, emits no application font face (only the
  KaTeX `woff2` faces remain), and imports only renderer-sized brand marks;
  math, Chinese text under the CJK fallback tier, and the chrome logos all
  render correctly. The offline shell starts and all
  fixture capabilities use local packaged assets; provider/update network
  failures do not block startup.
- **Specs linked**: `02-architecture/01-architecture.md`,
  `02-architecture/02-tech-stack.md`, `03-runtime/07-process-model.md`,
  `04-ux/02-i18n-english-first.md`, `05-security/01-security.md`,
  `06-delivery/06-release-runbook.md`, D008
- **Acceptance**: A (app startup), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`packaging-footprint.test.mjs` validates static
  dependency and builder configuration); native inventory and packaged offline
  launch Draft

#### E2E-093: Mutating tools serialize and recover from stale edit context

- **Preconditions**: A project-bound Agent session has a writable workspace;
  the provider fixture can emit two same-session `Write`/`Edit` calls in one
  tool batch; a second edit can be given a stale `tag`; a Bash command can
  return a non-zero exit code with diagnostics.
- **Steps**:
  1. Start a task that emits two mutations for the same session while also
     emitting independent read/search calls.
  2. Inspect the key tool result and transcript while the first mutation runs.
  3. Force the second `Edit` to carry a `tag` that no longer hashes the file,
     with anchors that recovery cannot remap, then allow the agent to re-read
     the file and retry from the current contents.
  4. Run a Bash command that exits non-zero and inspect its tool result and
     inline state.
  5. Repeat with an `ops` payload whose ranges overlap.
  6. If the task uses a dedicated worktree outside the advertised workspace,
     verify its guarded Bash edit and resulting `git diff`.
- **Expected**:
  - Read/search calls may overlap. A session may execute two independent
    identified local writes with validated batch tickets; conservative writes
    remain exclusive within the session. Queued mutations consume no global
    mutation capacity while waiting; total running writes stay bounded by two.
  - The stale-tag edit fails without changing the file and returns
    `EDIT_TAG_MISMATCH` carrying the live tag and current content at the
    anchors; the overlapping-range payload fails with `EDIT_RANGE_INVALID`
    before any write.
  - The non-zero Bash command is marked failed while retaining its exit code,
    stdout, and stderr for the agent and diagnostics.
  - The retry performs one fresh read and operates on the current file; once
    that path has spent its recovery graces, the third counted same-path failure
    — or a third failed shell patch command — returns a terminating tool result
    plus a visible `MUTATION_RETRY_BUDGET_EXHAUSTED` row, stops the mutation
    workflow, and does not repeatedly modify an old patch artifact or its hunk
    headers.
  - The final file contains exactly the intended change, and diff/review data
    contains no partial or interleaved mutation.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/06-host-rpc-protocol.md`, `03-runtime/08-error-codes.md`
- **Acceptance**: E (tools & permissions), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`tool_budget.rs`, `tools/mod.rs`,
  `agent-runtime/runtime.test.ts`); full provider/UI journey Draft

#### E2E-096: Recover transient provider stream failures in place

- **Preconditions**: A project-bound Agent session uses a deterministic
  provider fixture that emits a partial assistant stream, terminates once, then
  succeeds on the next request; a second fixture run can terminate eleven times; a
  third fixture returns `OpenAI API error (502)` before headers on one attempt
  and mid-stream on the next; a fourth fixture returns eleven consecutive 502s; a
  fifth fixture returns a 503 with `Retry-After`; a sixth fixture returns a
  pre-stream opaque 400/422 once and succeeds when the output-limit fields are
  omitted; the fixture supports both Chat Completions and Responses payloads and
  aborting after the opaque failure.
- **Steps**:
  1. Start an Agent turn with the one-termination fixture and observe the
     partial assistant response.
  2. Wait for the bounded retry and inspect the transcript, session state, and
     terminal diagnostics after recovery.
  3. Repeat with the eleven-termination fixture and inspect the terminal error
     message/event and its diagnostic details.
  4. Run the mixed-phase 502 fixture and inspect the request count and terminal
     diagnostics for both the pre-header and the mid-stream 502.
  5. Run the persistent eleven-502 fixture and inspect the terminal error.
  6. Run the 503 `Retry-After` fixture and inspect the observed wait.
  7. Run the opaque 400/422 fixture with both API styles and inspect the two
     request payloads, request count, and terminal diagnostics.
  8. Abort immediately after the first opaque 400/422 failure and inspect that
     no repair request starts.
  9. Reload the session and verify that only the completed response or the
     single terminal failed assistant remains durable.
  10. Open Settings → Behavior → Execution, enable infinite provider retry, and repeat
      a network fixture that fails beyond ten attempts before recovering. Stop the
      turn during backoff and verify no later request starts; disable the setting
      and verify a fresh persistent outage stops after ten retries.
  11. Alternate one socket failure and one successful tool-call response for
      eleven actual Read calls, then fail once and return a final answer.
      Verify all twelve independent failures recover in the same user turn,
      each beginning at retry 1, with no repeated tool execution.
  12. After a recovered tool response, keep the next response failing. Verify
      it receives ten fresh retries and terminates once with `retryAttempt: 10`.
      Restore the fixture, click Continue, and verify completion in the UI.
- **Expected**:
  - `terminated` is classified as `STREAM_FAILED`, and an upstream gateway
    `502`/`503`/`504` as retryable `PROVIDER_ERROR`.
  - Non-429 transient failures share one bounded budget of ten retries after
    the initial attempt, for eleven provider attempts total, shared by request
    setup and stream delivery. Each retry waits for an abortable bounded
    backoff, removes the entire failed assistant suffix from model context,
    and produces no duplicate assistant bubble or terminal error notification. A retry never
    calls native continuation while an assistant remains the last model message.
  - A mid-stream 502 is retried rather than surfacing immediately. The
    mixed-phase fixture spends one counter across both phases and makes eleven
    attempts in total, not one retry per phase. A complete successful response
    replenishes both retry budgets for the next tool round. Headers and partial
    output do not. Observed waits without a
    `Retry-After` header are 1, 2, 4, then 8 seconds for every later retry,
    identical in both phases.
  - Only the failed request is replayed: the session, its transcript, and any
    completed tool call are untouched across every retry.
  - The recovered turn emits one terminal lifecycle and keeps the same visible
    assistant message id. Its terminal diagnostics retain the bounded retry
    outcome and attempt number.
  - The eleventh termination emits one terminal `STREAM_FAILED` assistant error
    and lifecycle event; the persistent 502 fixture emits one terminal
    `PROVIDER_ERROR`. Both carry `retryAttempt: 10`. Available details include
    phase, stream timing, and provider status, without credentials or an
    unrestricted provider body.
  - The 503 fixture waits for the server's `Retry-After` instead of the client
    backoff. Non-429 server and fallback waits are capped at 8 seconds.
  - A pre-stream 400/422 with the `(no body)` marker gets one silent repair
    request with `max_tokens`, `max_completion_tokens`, and `max_output_tokens`
    removed. The caller's payload rewrite remains active, the repair consumes no
    transient retry budget or backoff, and both Chat Completions and Responses
    fixtures complete on their second request. A second opaque failure remains
    terminal. A 400/422 that names an output ceiling (`at most N completion
    tokens`, `max_tokens: N > M, which is the maximum allowed number of output
    tokens`, or `expected a value <= N`) gets one silent repair that clamps
    those fields to that ceiling instead of removing them. Credit exhaustion
    and context overflow do not take this repair.
  - If the turn is aborted after the first opaque failure, the repair request is
    not started and the result is `aborted`.
  - A mid-stream HTTP 429 is covered by E2E-149's separate ten-retry path; the
    two budgets do not draw from each other.
  - Authentication, model-selection, context, and descriptive
    malformed-request failures do not enter either provider replay path. The
    opaque empty-body 400/422 case and the explicit output-ceiling case are
    the bounded repair exceptions described above. Infinite mode changes no
    classification and only removes the retry
    ceiling for admitted network/transient failures; it remains abortable and
    is visibly marked with an unbounded retry indicator.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, `03-runtime/08-error-codes.md`,
  `08-meta/decisions-log.md` (D186, D259, D378), ADR 0050, ADR 0128, ADR 0206
- **Acceptance**: C (chat & stream), F (persistence), H (diagnostics), Quality
- **Milestone**: M5
- **Status**: Retry and successful-response budget boundaries covered by
  `provider-recovery-flow.test.ts` through real agent loops. Desktop socket
  failure, partial-stream recovery, Responses recovery, exhaustion, Continue,
  and eleven-tool-round recovery run in `scripts/e2e-provider-recovery.mjs`.
  Existing classification coverage: `agent-errors.test.ts`,
  `provider-retry.test.ts`, `runtime.test.ts`, `subagent.test.ts`.
  Other scenario variants remain Draft.

#### E2E-1174: Return a paired tool denial in Plan/Goal

- Seed earlier tool-call history, then switch an Agent session to Plan or Goal.
  A loopback Responses gateway emits Edit, Write or Task only if that tool is
  declared in the request; an undeclared name would cause a 502.
- Verify all six mode/tool combinations reach the normal tool-result path:
  the next request contains the original call id and a mode-denial error,
  preserves old call/result pairs, and adds no synthetic user correction.
- Assert that no host call occurs and no delegate starts. The tool event is an
  error while the model can continue with a read-only answer.
- A handler reference retained from Agent must refuse execution after Plan/Goal
  is entered; switching back to Agent restores the normal permission path.
- Automation: `mode-tool-access.test.ts` runs real runtime/SDK loops against a
  loopback HTTP/SSE fixture; `runtime.test.ts` covers catalog/mode transitions.
  Existing host permission tests keep Write/Edit denied regardless of grants or
  permission mode. No paid provider or user Desktop profile is used.

#### E2E-149: Recover provider rate limits (429) silently in place

- **Preconditions**: A project-bound Agent session uses deterministic provider
  fixtures for a setup HTTP 429 and a mid-stream HTTP 429. Each fixture can
  succeed after a retry and can return eleven consecutive 429 responses. Fixtures
  cover `retry-after-ms`, `retry-after` seconds, and HTTP-date headers, and
  support aborting during the wait. A builtin subagent uses a
  fixture with the same responses. Billing/account-exhaustion fixtures also
  return HTTP 429 with `insufficient_quota`, `credit_balance_exhausted`,
  organization usage-limit, spend-limit, and OpenCode Zen
  `FreeUsageLimitError` codes.
- **Steps**:
  1. Start an Agent turn with a setup-429 fixture whose next request succeeds.
  2. Repeat with a mid-stream-429 fixture whose next request succeeds.
  3. Inspect the transcript, lifecycle events, request count, and terminal
     diagnostics for both recoveries.
  4. Repeat with eleven consecutive 429 responses, then inspect the terminal
     assistant error and diagnostic details.
  5. Start the subagent fixture, then repeat the persistent eleven-429 case.
  6. Start another 429 turn and abort while it is waiting; inspect that no
     later provider request or terminal retry is started.
  7. Repeat with authentication, model-selection, malformed-request, and
     context-error fixtures.
  8. Repeat with the billing/account-exhaustion 429 fixtures and inspect the
     terminal assistant error and provider request count.
- **Expected**:
  - Throughput rate-limit 429s are classified as retryable
    `PROVIDER_RATE_LIMITED` in both setup and post-start recovery, including a
    response body that omits rate-limit wording when the captured HTTP status
    is 429. Diagnostics retain `providerStatus: 429`.
  - Explicit billing/account exhaustion is terminal `PROVIDER_ERROR` even
    when returned with HTTP 429, including `insufficient_quota`,
    `credit_balance_exhausted`, organization usage-limit, and organization/
    project spend-limit codes, and OpenCode Zen's `FreeUsageLimitError`.
    It retains the provider's message and status, starts no retry, and
    consumes neither retry budget.
  - Setup and mid-stream failures share one budget of ten retries after the
    initial attempt. A persistent fixture therefore makes eleven provider
    attempts, never multiplies attempts through nested pi-ai retries, and
    emits no intermediate assistant error, lifecycle `error`, `turn_end`, or
    `agent_end`.
    A complete successful response, including a tool-call response, resets both
    budgets before the next model request. Independent recovered rate limits
    across more than ten tool rounds must not terminate the user turn or a
    builtin subagent; partial output alone must not replenish either budget.
  - A recovered attempt removes the failed assistant from model context and
    reuses its visible assistant message id. The transcript has one assistant
    bubble and one terminal lifecycle; bounded retry diagnostics retain the
    phase, delay, and attempt number.
  - Delay precedence is `retry-after-ms`, `retry-after` seconds, HTTP-date,
    then exponential backoff with positive jitter. Server and fallback waits
    are capped at 30 seconds and the wait is abortable.
  - Exhaustion emits one terminal `PROVIDER_RATE_LIMITED` assistant error and
    lifecycle event with `retryAttempt: 10` and `providerStatus: 429`; no
    eleventh retry occurs after the eleven provider attempts. The structured
    assistant error card remains the only failure
    surface, exposing one localized **Continue** action and no **Regenerate**
    action; the generic TurnOutcomeCard is omitted. Activating **Continue**
    appends the localized continuation prompt (`Continue the user's unfinished
    task.` / `继续用户未完成的任务`) to the same session and starts the next turn
    without discarding the failed turn.
  - The subagent uses the same ten-retry budget and one visible child bubble;
    its final report is failed only after the budget is exhausted, while
    intermediate 429s never become a parent-visible error report.
  - Aborting during a backoff cancels the pending timer and starts no later
    provider request. Authentication, model-selection, malformed-request, and
    context fixtures make no automatic retry.
  - The 429 budget is separate from the non-429 transient budget in E2E-096.
    A 429 does not consume transient retries and a 502 does not consume 429
    retries.
- **Specs linked**: `03-runtime/02-agent-runtime.md` (D245, D378),
  `03-runtime/08-error-codes.md`, `08-meta/decisions-log.md` (D245, D378),
  ADR 0091, ADR 0206
- **Acceptance**: C (chat & stream), H (diagnostics), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`provider-retry.test.ts`, `runtime.test.ts`,
  `subagent.test.ts`); full provider/UI journey Draft

## 7A. M6 Plan and shell scenarios

#### E2E-104: Legacy contract values migrate to schema v11

- **Preconditions**: Schema-v8 fixtures contain sessions, app defaults, and
  scheduled records with legacy `chat` values plus transcripts and permissions;
  schema-v7 and schema-v9 fixtures cover both guarded entry paths.
- **Steps**: 1) Start host-core and allow the guarded migration (v7 first
  reaches v8). 2) Inspect sessions, settings, scheduled modes,
  `plan_approvals` fields/indexes, and the exact readable v8/v9 backup. 3)
  Restart and inspect the same records. 4) Repeat with malformed app settings,
  malformed scheduled config, invalid top-level operating modes, and an unknown
  or wrong-platform default shell. 5) Repeat with a platform-valid persisted
  shell marked temporarily unavailable and nested extension `mode` fields.
- **Expected**: Every legacy mode is `plan`, Agent remains the new-session and
  new-task default, transcripts/permissions survive, `plan_approvals` retains
  approval data and has artifact/execution fields, v8→v11 is one atomic
  transaction after its WAL checkpoint and v8 backup, v9 and v10 create
  readable backups, and migration failure leaves the source schema
  authoritative. Every malformed or
  invalid fixture fails closed before schema promotion. The temporarily
  unavailable platform-valid shell remains persisted for runtime fallback, and
  nested extension modes remain unchanged.
- **Specs linked**: `00-baseline.md`, `03-runtime/04-data-storage.md`,
  `03-runtime/01-ipc-protocol.md`, `04-ux/06-settings-ia.md`, ADR 0053
- **Acceptance**: F (persistence), H (diagnostics)
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-05): host-core 139/139, including 15
  focused DB tests, covers schema-v7→v8→v11, v8→v11, v9→v11, and v10→v11
  guarded paths,
  exact readable backups, fail-closed rollback, restart, transcript, settings,
  scheduled-mode, approval-field, and index tests

#### E2E-105: Plan policy remains host-authoritative

- **Preconditions**: A project-bound session is idle in Plan with BrowserPreview,
  a plugin tool, and a forged `requestedMode = "agent"` fixture.
- **Steps**: 1) Inspect visible Plan tools. 2) Use Read/Glob/Grep and
  BrowserPreview. 3) Attempt Write, Edit, plugin, and
  unknown tools through the host with every permission mode. 4) Run Bash under
  Ask, Accept edits, and Auto.
- **Expected**: Plan denies Write/Edit/plugin/unknown tools regardless of the
  forged mode, grants, or Auto; Bash follows the selected permission mode. The
  runtime remains one pi Agent and all denials are audited.
- **Specs linked**: `03-runtime/02-agent-runtime.md`,
  `03-runtime/03-tools-and-permissions.md`, `03-runtime/05-host-core-rust.md`,
  `03-runtime/06-host-rpc-protocol.md`, `05-security/01-security.md`, ADR 0053
- **Acceptance**: E (tools and permissions), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` plus host-core
  permission/policy and agent-runtime tool-composition tests

#### E2E-PLAN-WORKSPACE: Missing workspace does not strand a contract turn

- **Preconditions**: Isolated host, active global workspace, temporary session
  without a persisted project workspace; repeat for Plan and Goal.
- **Steps**: Enter the contract from Agent mode and submit. In the runtime,
  submit from a workspace-less contract session, receive the tool error, deliver
  a final explanation, and repeat on
  the user's next "continue" turn. Use a bound project as the success control.
- **Expected**: Entry succeeds and leaves the session in planning state.
  Submission fails with `PLAN_WORKSPACE_REQUIRED` without an approval or
  artifact. The runtime returns a non-terminating error with workspace binding
  guidance and permits a final assistant response. No execution is authorized.
  Bound-project submission still produces a pending immutable checkpoint.
- **Status**: Automated by `scripts/e2e-plan.mjs` and the runtime Plan transition
  tests with a scripted provider boundary.

#### E2E-106: SubmitPlan rejects into editable planning and resubmits a new artifact

- **Preconditions**: A project-bound session is idle in Plan with a provider;
  `.pi/plan/` is absent or empty and the workspace permits host artifact
  creation.
- **Steps**: 1) Let the Agent call `SubmitPlan` with fixed title, Markdown, and
  question. 2) Inspect the new `.pi/plan/*.md` file byte-for-byte and the
  `plan_approvals` row. 3) Inspect the card's title and artifact opener; confirm
  the opener uses the bundled file view when it is launchable and the host
  file tab otherwise (D452), and that the question/description,
  validity/deadline, and status are absent with only Approve and Reject
  offered. 4) Open the approval mode menu, choose Auto,
  and verify the next approval defaults to Auto. 5) Reject the
  proposal. 6) Confirm durable mode is Plan, live state is editable `planning`,
  the approval gate is cleared, and a later prompt is accepted. 7) Let the
  Agent revise and call `SubmitPlan` once in that new turn with a complete
  snapshot. 8) Approve the second proposal with the remembered Auto mode.
- **Expected**: Host preserves the exact submitted Markdown bytes in a new
  unique artifact, records its relative path/hash/size with structured
  title/question, and never lets the renderer or sidecar write or replace it.
  The title-derived artifact filename is recognizable from the title, including
  non-ASCII title characters. The card shows the title and opens the artifact in
  the bundled file view, falling back to the host file tab when that view is not
  launchable (D452);
  it does not require inline question/Markdown/hash/size or a validity/deadline
  indicator. The selected approval mode is remembered locally for the next
  approval.
  Rejection is terminal for the first row, leaves durable mode Plan, and returns
  live state to editable planning. The later prompt/resubmission creates a
  second complete Markdown snapshot and a different `.pi/plan/*.md` artifact;
  the first artifact bytes remain unchanged. Approving the second proposal with
  the remembered Auto mode still changes the same Agent to Agent and queues execution.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `04-ux/03-permission-ux.md`,
  `04-ux/08-component-spec.md`, `05-security/01-security.md`, ADR 0053
- **Acceptance**: C (conversation/stream), E (permissions), F (persistence)
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-05): `test:e2e:plan` verifies the Host
  artifact/approval lifecycle. The optional live `test:e2e:plan-ui` case
  requires an env-provided OpenAI-compatible provider; the authorized run with
  model `gpt-5.6-luna` passed 6/6 with zero console diagnostics. It used the
  real controlled Composer and Send, the live Agent called `EnterPlanMode` then
  `SubmitPlan`, normal rendered Ask approval resolved through preload/Main,
  approved execution emitted the exact durable marker, and a private
  env-gated WeakMap check proved the same `DesktopAgentRuntime` object before
  and after approval. Main/Host/sidecar PIDs remained stable; credentials never
  entered CDP or output. The default no-key run remains 5/5 with the live case
  explicitly skipped.

#### E2E-CHAT-opaque-floating-decision-and-retry-surfaces: Dock, Plan approval, and retry surfaces occlude transcript text

- **Status**: Automated (`pnpm test:e2e:composer-occlusion`, `pnpm test:e2e:theme-surfaces`, `apps/desktop/test/plan-mode-source-contract.test.mjs`, `apps/desktop/test/active-turn-surface.test.mjs`)
- **Priority**: P2
- **Covers**: C, Quality / floating composer and retry surfaces
- **Preconditions**: Renderer CSS is the production source under `apps/desktop/src/styles`.
- **Steps**:
  1. Inspect the computed background of `.composer-dock-docked` (fully transparent) and the `.thread-scroll` mask with two different `--composer-dock-height` values, in both built-in themes and a custom theme.
  2. Scroll a long transcript until a row crosses the Composer boundary.
  3. Inspect `.plan-approval-bar` in the composer dock styles.
  4. Inspect `.run-activity-error-popover.message-error` in the transcript styles.
  5. Hover or focus a retrying active-turn row in a live session.
- **Expected**:
  - The dock paints no backing surface. Transcript text fades out across the
    `.thread-scroll` mask at the Composer boundary and cannot remain visible
    below the shell or around its rounded corners. The mask's two stops sit
    `--composer-dock-height + 16px` and `--composer-dock-height - 2px` above the
    scrollport's bottom edge, so a transcript pinned to its end keeps its last
    row fully opaque and the conversation pane's own surface - including a
    contributed theme's background - stays visible behind the dock.
  - The Plan/Goal approval bar paints `--ds-bg-composer` with `--ds-shadow-composer` rather than the in-flow `--ds-tile` wash, so it remains a readable plate over the transparent composer dock.
  - The retry hover tooltip mixes the error tint over `--ds-bg-elevated-opaque`, so transcript text does not show through.
  - The retry tooltip is capped to the room above the tail status row and
    scrolls the remainder, so a long provider message keeps its first lines
    inside the transcript scrollport and below the conversation bar instead of
    being hidden by either.
- **Specs linked**: `04-ux/03-permission-ux.md`, `04-ux/08-component-spec.md`
- **Acceptance**: C, Quality
- **Milestone**: M6
- **Status detail**: Source contracts assert the CSS tokens. Live hover remains a visual check.

#### E2E-107: Plan approval uses one absolute 30-minute expiry

- **Preconditions**: A pending Plan request exists with a controllable clock.
- **Steps**: 1) Record `createdAt` and `expiresAt`. 2) Reload the renderer and
  reopen the request. 3) Advance time to the deadline without resolving. 4)
  Attempt approval after expiry.
- **Expected**: Renderer reload rehydrates only the still-pending row while the
  host remains alive, and the displayed countdown retains the original absolute
  deadline; rejected, expired, approved/completed, and interrupted terminal
  cards are not part of reload hydration. Expiry records `expired`, leaves the
  session Plan, returns `PLAN_APPROVAL_TIMEOUT`, and rejects the late response
  without changing mode or permission.
- **Specs linked**: `03-runtime/06-host-rpc-protocol.md`,
  `03-runtime/08-error-codes.md`, `03-runtime/10-session-state-machine.md`,
  `04-ux/03-permission-ux.md`, ADR 0053
- **Acceptance**: E (permissions), H (diagnostics), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan-ui` covers pending
  renderer reload; `test:e2e:plan` and the deterministic host-core late-expiry
  test cover the absolute deadline, timeout persistence, and fail-closed
  resolution. No terminal-card reload hydration is claimed.

#### E2E-108: Startup fence interrupts pending Plan work

- **Preconditions**: A Plan request is pending with a live approval waiter and
  running planning turn; host and renderer can restart independently.
- **Steps**: 1) Reload the renderer and list the live request. 2) Restart the
  host/app before resolution. 3) Inspect the `plan_approvals` row, turn, and
  session after startup. 4) Submit the pre-restart response.
- **Expected**: Renderer reload while the host remains alive preserves the
  still-pending row and original deadline. Full Host/app restart transactionally
  marks the pending row and turn interrupted/aborted before RPC service, leaves
  the session Plan, and returns `PLAN_APPROVAL_STALE` for the old response. No
  actionable stale card or execution is restored, and the UI is not required to
  present the interrupted terminal snapshot after restart. No process epoch
  field is persisted or sent.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `03-runtime/07-process-model.md`,
  `03-runtime/10-session-state-machine.md`, `04-ux/08-component-spec.md`, ADR 0053
- **Acceptance**: F (persistence), H (diagnostics), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` performs a real
  Host restart and host-core recovery tests verify interrupted durable state;
  the pending renderer-reload assertion is covered by the E2E-107 UI lane.

#### E2E-109: Approved Plan execution is not replayed after restart

- **Preconditions**: A Plan request has been approved with Ask and is captured
  once in `queued` and once in `running` state.
- **Steps**: 1) Restart the host during each state. 2) Inspect the
  `plan_approvals.execution_state` and turn records after startup. 3) Observe
  provider/tool invocations and session mode. 4) Start a new user turn
  explicitly.
- **Expected**: Queued/running execution fields become `interrupted`,
  associated turns abort, no provider/tool call is replayed, and the session
  remains Agent because approval already committed. A new turn is accepted only
  after the user starts it; no interrupted terminal card or stale action is
  required after restart.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `03-runtime/07-process-model.md`,
  `03-runtime/10-session-state-machine.md`, ADR 0053
- **Acceptance**: C (conversation/stream), F (persistence), H (diagnostics), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` restarts real queued
  and claimed executions and verifies no replay plus Agent retention

#### E2E-110: Scheduled Plan is rejected before any work

- **Preconditions**: A scheduled task is Plan and an unattended runner is
  available; provider, artifact, and queue writes can be observed.
- **Steps**: 1) Trigger the task through the unattended path. 2) Inspect the
  provider trace, `.pi/plan/`, and `plan_approvals` table. 3) Switch the
  task/session explicitly to Agent and run it again.
- **Expected**: Plan is rejected before provider, artifact, approval, or queue
  work with `PLAN_REQUIRES_INTERACTIVE_SESSION`; no background auto-approval
  occurs. Explicit Agent selection permits normal unattended policy.
- **Specs linked**: `03-runtime/04-data-storage.md`,
  `03-runtime/08-error-codes.md`, `04-ux/01-ui-ia.md`, ADR 0053
- **Acceptance**: F (persistence), H (diagnostics), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` verifies Plan
  rejection before side effects and explicit Agent execution independent of the
  global default

#### E2E-111: Active-turn, pending-approval, and configuration boundaries are enforced

- **Preconditions**: A session has one active Agent turn and another session is
  idle; a Plan run can be made pending/queued/running.
- **Steps**: 1) Attempt a second prompt, mode/provider/model/permission/shell
  configuration change, and second Plan submission during the active turn. 2)
  Let the turn become pending approval and repeat the prompt and configuration
  attempts. 3) Reject the approval. 4) Submit a later prompt and let the Agent
  create a revised Plan snapshot. 5) Repeat configuration after the session is
  editable planning.
- **Expected**: Active-turn/configuration changes, prompts, and a second Plan
  submission fail with `AGENT_BUSY`/`CONFLICT` while the turn or active pending
  approval exists; only the originating session is blocked. Reject returns the
  durable session to Plan and the live state to planning, clears the gate, and
  permits the later prompt/new artifact. Terminal proposal snapshots do not
  disable input, the Composer mode chip, or model selection during the current
  renderer lifetime. Idle/planning configuration succeeds and no cross-session
  event or workspace root leaks.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md`, `03-runtime/06-host-rpc-protocol.md`,
  `03-runtime/10-session-state-machine.md`, `04-ux/08-component-spec.md`, ADR 0053
- **Acceptance**: C (conversation/stream), E (permissions), Quality
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` verifies Host
  boundaries and `test:e2e:plan-ui` verifies pending-only gating plus editable
  rejected/terminal states during the current renderer lifetime

#### E2E-111a: A staged mode switch does not move the live planning indicator mid-turn

- **Preconditions**: A project-bound session is running an Agent turn with a
  provider; the renderer shows the working indicator and no
  `Plan / planning` indicator.
- **Steps**: 1) While the Agent turn is still running, switch the Composer mode
  chip from Agent to Plan. 2) Inspect the transcript status area before the
  turn ends. 3) Let the turn reach its terminal event. 4) Inspect the status
  area again while idle, then send a new prompt.
- **Expected**: The staged Plan choice updates the chip immediately, but the
  live planning indicator stays away while the in-flight Agent turn runs; it
  does not show `Plan / planning` until the new prompt starts under the staged
  mode, and the Composer chip does not pulse until that live state projects
  `planning`. After the terminal event flushes the configuration the session is
  durable Plan with editable planning state, and the sent prompt surfaces the
  `Plan / planning` indicator in the reserved tail slot while the chip pulses.
  Tools and answers do not hide it; runtime phases take precedence, and
  pending user interaction or turn completion suppresses it.
- **Specs linked**: `03-runtime/02-agent-runtime.md`,
  `03-runtime/10-session-state-machine.md`, `04-ux/08-component-spec.md`
- **Acceptance**: C (conversation/stream), Quality
- **Milestone**: M6
- **Status**: Draft

#### E2E-112: Selectable shell catalog persists the default

- **Preconditions**: Host has an available platform catalog entry, a fixture can
  make a persisted choice unavailable, and a project-bound Agent session is
  idle. The Windows lane exercises the multi-choice ordering.
- **Steps**: 1) Inspect the catalog for the platform-valid IDs
  `windows-powershell`, `windows-pwsh`, `cmd`, `git-bash`, and `bash`. 2) Verify settings
  rejects an unavailable or wrong-platform ID. 3) Select an available shell
  and persist `defaultCommandShell`. 4) Make that persisted choice unavailable,
  restart, and verify the catalog selects the first available platform shell
  with `fallback: true`. 5) Execute the unchanged `Bash` tool.
- **Expected**: Settings persists only a valid stable shell ID; unavailable
  entries remain unavailable with guidance and a later unavailable persisted
  choice uses the intentional first-available fallback. The host invokes the
  effective shell while the tool/protocol name stays `Bash`, and shell
  selection follows the idle configuration boundary.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/03-tools-and-permissions.md`, `03-runtime/06-host-rpc-protocol.md`,
  `04-ux/06-settings-ia.md`, `04-ux/08-component-spec.md`, ADR 0054
- **Acceptance**: B (model/config), E (tools/permissions), F (persistence)
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` verifies catalog,
  validation, persistence, and restart; the deterministic host-core catalog
  test verifies first-available fallback when a stored shell becomes unavailable

#### E2E-SHELL-windows-pwsh-msix-store-alias-is-available

- **Preconditions**: Windows host with PowerShell 7 installed via MSIX /
  Microsoft Store (`winget` `msixbundle`). `%ProgramFiles%\PowerShell\7\pwsh.exe`
  is absent. `pwsh.exe` on PATH is the `WindowsApps` app-execution alias
  (`IO_REPARSE_TAG_APPEXECLINK`).
- **Steps**: 1) Open Settings → command shell. 2) Inspect `windows-pwsh`
  availability. 3) Select PowerShell 7 and persist `defaultCommandShell`.
  4) Run `Bash`.
- **Expected**: `windows-pwsh` is available and selectable. The host resolves
  the Store alias without treating it as missing. `Bash` launches PowerShell 7.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `04-ux/06-settings-ia.md`, ADR 0054, ADR 0209
- **Acceptance**: B (model/config), E (tools/permissions)
- **Milestone**: M6
- **Status**: Documented; host-core unit tests cover the Win32-attribute
  decision (alias attrs `0x420` + tag `0x8000001B`). Live Store-alias probe is
  Windows-only and is not run in Linux CI.

#### E2E-113: Stale shell identity fails closed

- **Preconditions**: A Bash turn has a pinned effective shell ID/dialect; the
  fixture can change the effective catalog selection before spawn.
- **Steps**: 1) Change the effective shell ID or dialect. 2) Execute Bash with
  the old expected ID. 3) Inspect process creation, fallback attempts, audit,
  and UI error. 4) launch a fresh turn and retry.
- **Expected**: The first call returns `COMMAND_SHELL_CHANGED`, starts no
  process, and does not change shell after the turn pin. The audit records the
  selected ID and dialect. A fresh turn snapshot is required for a later run.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/05-host-core-rust.md`, `03-runtime/06-host-rpc-protocol.md`,
  `03-runtime/08-error-codes.md`, `05-security/01-security.md`, ADR 0054
- **Acceptance**: E (tools/permissions), H (diagnostics), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` verifies stale
  dialect rejection before marker creation plus host-core stale ID/dialect tests

#### E2E-114: Bash streams stdout and stderr independently

- **Preconditions**: A selected shell is available and a deterministic command
  writes interleaved stdout and stderr chunks.
- **Steps**: 1) Execute the command through `Bash`. 2) Observe host/RPC/UI
  output events. 3) Inspect the final bounded result and transcript row.
- **Expected**: stdout and stderr remain separate, ordered per tool call, and
  visible while the process runs. Final output preserves truncation metadata;
  no chunks cross sessions or turns and the Bash protocol name is unchanged.
- **Specs linked**: `03-runtime/06-host-rpc-protocol.md`,
  `03-runtime/09-logging-and-observability.md`,
  `03-runtime/16-tool-result-limits.md`, `04-ux/09-interaction-patterns.md`, ADR 0054
- **Acceptance**: C (stream), E (tools), Quality
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` verifies distinct
  stdout/stderr notifications and final tool identity; host/runtime stream tests
  cover bounded accumulation and session isolation

#### E2E-115: Bash timeout uses 60 seconds and a bounded override

- **Preconditions**: A selected shell can run a command longer than 60 seconds;
  host clock is observable.
- **Steps**: 1) Run without a timeout override. 2) Observe the 60-second
  deadline. 3) Run with an in-range override including values above 300
  seconds. 4) Submit zero, negative, and over-21,600-second overrides.
- **Expected**: Missing timeout uses exactly 60 seconds and returns
  `TOOL_TIMEOUT` after process-tree shutdown; the error names the effective
  `timeoutMs` budget and suggests raising it or splitting the command. In-range
  values work within 1–21,600 seconds; out-of-range values fail validation and
  never spawn.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/06-host-rpc-protocol.md`, `03-runtime/08-error-codes.md`,
  `03-runtime/16-tool-result-limits.md`, `05-security/01-security.md`, ADR 0054,
  ADR 0167
- **Acceptance**: E (tools), H (diagnostics), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): long-timeout `test:e2e:plan`
  measured the no-override timeout at 60,024 ms and verified in-range plus
  invalid bounds without delayed marker writes

#### E2E-116: Bash abort shuts down the complete process tree

- **Preconditions**: A Bash command starts a child and grandchild that emit
  delayed output; the originating session is running.
- **Steps**: 1) Start the command. 2) Abort the active turn. 3) Inspect process
  descendants, output events, audit, and turn state after the shutdown grace.
- **Expected**: The process group/job tree is terminated, no descendant remains,
  no later output arrives, the turn returns `TURN_ABORTED`, and the workspace is
  not rolled back automatically. On Windows, the hidden runner requests
  `CREATE_BREAKAWAY_FROM_JOB` only when the job that contains the host grants
  `JOB_OBJECT_LIMIT_BREAKAWAY_OK`, then enters its own kill-on-close job. A host
  job that withholds breakaway leaves the runner in a nested job instead of
  failing the tool closed; termination is still scoped to that job, so the
  Desktop tree never becomes the termination scope.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/07-process-model.md`, `03-runtime/08-error-codes.md`,
  `03-runtime/16-tool-result-limits.md`, `05-security/01-security.md`, ADR 0054
- **Acceptance**: C (abort), E (tools), H (diagnostics), Security
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): `test:e2e:plan` aborts a real
  descendant process tree and verifies no late marker/output; host-core tests
  verify cancellation registry cleanup

#### E2E-265: Background Bash tasks outlive their turn

- **Preconditions**: A project session whose catalog shell supports background
  execution, and a port the test server may bind.
- **Steps**: 1) Ask the agent to start a long-lived process with
  `runInBackground` (a local web server) and watch the running-tasks bar above
  the composer. 2) Abort the turn, send a second prompt in the same session,
  then reload the renderer. 3) Expand the row's `Output`. 4) Press `Stop`.
  5) Start ten tasks with 100,000 lines of 100 characters on both streams,
  then inspect their final output. 6) Show Todo and Ask alongside the task list
  at wide and narrow widths, scroll to the tenth task, and switch output previews
  while an earlier read is pending. 7) Fail a Stop request and retry it.
  8) Start two more tasks and quit the app during output capture.
- **Expected**: The tool result carries `backgroundTaskId` and resolves without
  waiting for the command; the bar lists the task as running with a growing
  elapsed time and shows its streamed output; the process stays alive across the
  abort, across the 60-second Bash timeout, and across a renderer reload.
  `Stop` settles the row to `Stopped` and kills the process tree; quitting the
  app leaves no orphan process behind. The ten-task list scrolls within its
  height cap without displacing Todo, Ask, or input. Only the selected log is
  fetched and refreshed; old responses cannot erase it. Each stream remains
  bounded to 256KiB and retains its final marker after exit. A Stop failure is
  visible without an unhandled rejection and the control remains retryable.
  An ended task keeps its row only for a short grace window and can be closed
  from the bar, so finished commands do not accumulate above the composer.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md` (§5),
  `03-runtime/06-host-rpc-protocol.md` (§4)
- **Acceptance criterion**: C, E, F
- **Milestone**: M6+
- **Status**: Partially automated (host-core `background_tasks::tests` and the
  renderer contract test `apps/desktop/test/background-tasks.test.mjs`;
  `node scripts/e2e-background-tasks-host.mjs` runs the real Host/process/pipe
  stress path without providers, and `node scripts/e2e-background-tasks.mjs`
  exercises production React components in isolated Electron at 1280px, 700px,
  and 390px widths. Host tests cover exit-before-drain and shutdown under output
  lock contention. The full agent-to-Desktop journey and an 83-minute paced
  100,000-line soak remain manual; the automated volume test is accelerated.
  Renderer visibility (grace window, close action, pinned output preview) is
  covered by `apps/desktop/test/background-tasks-bar-visibility.test.mjs` with a
  controlled clock; the multi-second hand-off itself is not timed in Electron.)

#### E2E-117: Agent/Plan/Goal UX and locales contain no Chat controls

- **Preconditions**: App can run in English and zh-CN with an idle session,
  Plan artifact fixture, shell settings, and global search's Commands section
  available.
- **Steps**: 1) Inspect Agent/Plan/Goal, permission, artifact approval, and shell
  controls in English. 2) Enter Plan and inspect planning/approval/queue/
  terminal states while the renderer remains alive. 3) Approve and reject a
  proposal, confirming that the approval surface disappears after host
  confirmation. 4) Inspect the Commands section and confirm it contains exactly
  `builtin.session.new`, `builtin.agent.compact`, and the three
  `builtin.mode.*` commands, with only `/new`, `/compact`, `/agent-mode`,
  `/plan-mode`, and `/goal-mode` in the builtin `/` group. Confirm the removed
  command IDs and `newChat` / `openProject` / `openSettings` dispatch aliases are
  absent. Use `/plan-mode` / `/agent-mode` slash aliases to switch the active
  idle session, confirming the Composer chip changes immediately. Type a prompt
  after either alias in the same draft and send it; confirm the mode changes and
  the prompt remains as a visible user turn. Send an alias alone and confirm it
  remains a local mode switch without creating an empty transcript turn. If
  prompt dispatch fails, confirm the complete draft remains editable. 5) Reload
  after a terminal proposal and inspect the session while asserting that
  Electron Main and Host process identities did not change. 6) Repeat in
  zh-CN. 7) Search visible commands for the removed Chat mode and
  request-changes controls. Host/app restart recovery is exercised separately
  by E2E-108 and E2E-109.
- **Expected**: Agent is the default; the left-of-input Composer chip is the
  sole active-session Agent/Plan/Goal control; Plan and Goal show
  Ask/Accept edits/Auto, the submitted title, an artifact opener,
  remembered approval mode, approve/reject only, shell catalog/fallback status,
  and localized failed-closed states. No
  Chat mode, `/chat-mode`, request-changes action, inline Markdown/hash/size
  requirement, or stale actionable queue is exposed; terminal checkpoint
  metadata may remain non-actionable only for the current renderer lifetime,
  while the composer approval surface is removed after host-confirmed
  resolution.
  Renderer reload does not rehydrate rejected, expired, approved/completed, or
  interrupted terminal cards. Host/app restart does not replay work or restore
  stale actions, and the UI is not required to present the interrupted terminal
  snapshot; `page = "chat"` remains an internal route.
- **Specs linked**: `01-product/01-product-scope.md`, `04-ux/01-ui-ia.md`,
  `04-ux/04-builtin-commands.md`, `04-ux/03-permission-ux.md`,
  `04-ux/06-settings-ia.md`, `04-ux/08-component-spec.md`,
  `04-ux/02-i18n-english-first.md`, ADR 0053, ADR 0054
- **Acceptance**: C (conversation), Quality
- **Milestone**: M6
- **Status**: Automated (passed 2026-08-04): raw-CDP
  `test:e2e:plan-ui` uses an env-gated Electron Main probe against the existing
  Host, asserts stable Electron/Host PIDs, covers pending restore, live terminal
  controls, rejected and approved/completed terminal-card absence after
  renderer reload, EN/zh-CN, and 1280×800 / 900×700 rendering. E2E-108/E2E-109
  cover Host restart interruption, stale-action rejection, and no replay.

#### E2E-118: A regenerated turn keeps its final answer after the branch archive

- **Preconditions**: A project-bound Agent session whose transcript already has
  one completed exchange, a provider that streams a multi-tool turn long enough
  for the final assistant message to land through the persistence outbox, and
  read access to `<data_dir>/sessions/<id>.jsonl`,
  `<id>.revisions.jsonl`, and the `messages` index.
- **Steps**: 1) Regenerate the assistant answer so the root user turn carries
  `revisionCount` / `activeRevision` and revision 1 is archived. 2) Let the
  re-run finish a turn that ends with tool calls followed by a final assistant
  message. 3) Immediately after `agent_end`, inspect the transcript file, the
  `messages` rows, and the archived revision payload. 4) Reload the session.
  5) Page the root bubble back to revision 1 and forward again.
- **Expected**: The final assistant message is present in the transcript file,
  in the index, and as the last message of the archived branch. Every message of
  the turn keeps its owning `turn_id`. The root carries `revisionCount = 2` and
  `activeRevision = 2`, reload shows the complete turn, and paging restores each
  branch whole. No `session.replaceMessages` call is made on the
  turn-completion path.
- **Specs linked**: `03-runtime/04-data-storage.md` §4.9/§7,
  `03-runtime/06-host-rpc-protocol.md` §4, ADR 0041, ADR 0060
- **Acceptance**: C (conversation), F (persistence), H (diagnostics), Quality
- **Milestone**: M6
- **Status**: Covered by host-core unit tests (2026-08-06):
  `save_active_branch_revision_keeps_a_message_appended_after_its_read` archives
  with a message appended after the read and asserts the transcript, the
  archived payload, and the index `(seq, turn_id)` rows;
  `replace_messages_preserves_owning_turn_ids` covers the remaining rewrite
  callers. UI paging remains manual.

- **Bounded-history regression (#1870)**: Regenerate an older prompt, then
  continue until the root is outside the newest 100-message page. Complete
  another turn while viewing that page, then repeat after switching to another
  session. The archive must not append the older user root after the latest
  answer in the active transcript, retained pane, or session cache. If the root
  is loaded, its pager updates in place using its current message identity,
  which can differ from the stable family key. A root removed during the
  archive RPC stays absent. Previous variants remain available after restart.
  With neither a cached nor retained background transcript, the acknowledgement
  must leave the cache absent and allow the next prefetch to read the Host.
  Automated event-to-projection coverage:
  `apps/desktop/test/regenerate-root-projection.test.mjs`.
  `node scripts/e2e-regenerate-root.mjs` exercises the real Host process,
  production main persistence and renderer projections with an isolated
  3,484-message transcript, three follow-up turns, restart, and a revision
  round trip. Set `PI_DESKTOP_HOST_BIN` to a host built from the candidate.

#### E2E-REVIEW-append-state: Rolling back a historical tool card does not rewrite its session

- **Preconditions**: An isolated real Host process, a temporary workspace with
  a file changed by `Write`, and a transcript with 16 MiB of synthetic retained
  tool output after the review-owning message. Use `--large` for 384 MiB.
- **Steps**: Run `review.rollback`, compare the transcript prefix hash and
  appended bytes, read the review with a one-message `messageAround` window,
  read the tail, restart the Host, and retry the same rollback.
- **Expected**: Workspace bytes are restored. The original transcript prefix
  is unchanged and fewer than 256 bytes are appended. The selected card reads
  `rolledBack` before and after restart, its original position and the last
  message remain correct, and message count is unchanged. Retrying returns
  `alreadyRolledBack` without appending another state record.
- **Specs linked**: `03-runtime/04-data-storage.md` §2.0; ADR
  [append-only-review-state](../../adr/append-only-review-state.md).
- **Acceptance**: C (conversation), F (persistence), Quality.
- **Milestone**: M6.
- **Status**: Automated by `pnpm test:e2e:review-state`; set
  `PI_DESKTOP_HOST_BIN` to the candidate Host binary. No provider or user data
  is used. `transcripts::review_state_tests` additionally covers duplicate IDs,
  snapshot isolation, disk cache reuse, intentional rewrites and torn appends.
  `equal_length_state_appends_replay_in_file_order_across_cached_reads` pins
  file-order precedence for equal-sized state appends through warm and cold
  layouts. `truncate_from_folds_review_state_into_the_retained_prefix` verifies
  that a later truncate removes the state log while retaining the effective
  state in the surviving canonical tool message.
  This validates the review-state trigger in #1836; it does not assert Windows
  UI timing or eliminate full rewrites for deliberate history replacement.

#### E2E-246: Retrying a large session truncates without a whole-transcript RPC


- **Preconditions**: An Agent session whose live transcript is thousands of
  messages (large enough that a `session.replaceMessages` JSON-RPC line would
  exceed tens of megabytes), with a completed or failed last user turn.
- **Steps**: 1) Retry or regenerate the last user prompt. 2) Inspect host RPC
  traffic, `turns.status`, the live jsonl, and `message_revisions`. 3) Retry
  again immediately if the first attempt is still on screen as running.
- **Expected**: Electron main calls `session.truncateFrom` with
  `fromMessageId` only — no `session.replaceMessages` and no
  `session.saveRevision` of the discarded array. The kept prefix never appears
  in an NDJSON request. The leftover running turn is `aborted` before
  `beginTurn`. The discarded tail is archived (refresh of the stamped variant,
  or a new inactive variant). A second retry while a cut is in flight does not
  ship another full transcript. The UI error is not
  `host RPC timeout: session.replaceMessages`.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/04-data-storage.md` §4.9/§7,
  `03-runtime/06-host-rpc-protocol.md` §4, ADR 0216, D390
- **Acceptance**: C (conversation), F (persistence), Quality
- **Milestone**: M6
- **Status**: Covered by host-core unit tests (2026-09-10):
  `truncate_from_drops_the_tail_and_archives_the_discarded_branch`,
  `truncate_from_rejects_an_unknown_message`,
  `truncate_from_refreshes_the_stamped_revision`,
  `truncate_from_rpc_cuts_without_shipping_the_kept_prefix`. Desktop journey
  remains Draft.

#### E2E-247: Windows host-core exits after stdin EOF and oversize RPCs fail immediately

- **Preconditions**: Windows host-core with the Alt+Space keyboard hook
  installed; a JSON-RPC request whose NDJSON line exceeds 64 MiB.
- **Steps**: 1) Send stdin EOF to a running host-core. 2) From Electron, call
  a host method whose stringified payload exceeds 64 MiB. 3) If a line still
  reaches host-core, inspect the `LIMIT_EXCEEDED` reply id.
- **Expected**: After stdin EOF, host-core exits without waiting 130 s. The
  Windows keyboard hook does not keep the stdout writer alive. Electron
  rejects the oversize call with `LIMIT_EXCEEDED` before `stdin.write`. A
  host-side oversize reply uses the request id peeked from the prefix, not
  `null`. The UI error is not `host RPC timeout`.
- **Specs linked**: `03-runtime/07-process-model.md`,
  `03-runtime/06-host-rpc-protocol.md` §7, ADR 0217, D391
- **Acceptance**: Quality
- **Milestone**: M6
- **Status**: Covered by unit and source-contract tests (2026-09-11):
  `start_does_not_keep_the_stdout_channel_open`,
  `peek_jsonrpc_id_reads_a_string_id_from_a_truncated_prefix`,
  `apps/desktop/test/windows-host-runtime.test.mjs` (weak sender),
  `apps/desktop/test/rpc-lifecycle-contract.test.mjs` (client precheck),
  `packages/shared/src/rpc-limits.test.ts`. Desktop journey remains Draft.

#### E2E-248: Subagent details open as closable work-panel tabs with a read-only composer

- **Preconditions**: A project-bound Agent session whose assistant emits at
  least two `Task` calls — one named `explorer` and one resumed `explorer`
  follow-up — plus one `Task` that ends in failure; the work panel closed.
- **Steps**:
  1. Run the turn. Without clicking anything, verify the panel stays closed
     while the delegates run (no tab is opened automatically).
  2. Click the `explorer` topology node. Verify a `subagent` tab opens in the
     work panel's normal tab strip (labeled `explorer`, bot icon) and the
     tab strip keeps its other tabs.
  3. Click the second (resumed) `explorer` node. Verify a second tab opens
     labeled `explorer#2`, both tabs coexist, and each can be activated,
     drag-reordered, and closed via ×, middle-click, or Delete.
  4. In the resumed tab, verify the conversation reads `user: first prompt`,
     delegate rows, `user: follow-up prompt`, delegate rows — the same
     message-list language as the main transcript (user bubbles, tool rows,
     thinking rows, markdown answers).
  5. Verify the composer at the foot is a disabled two-row textarea whose
     placeholder reads the read-only hint, in every supported locale.
  6. Wait for the failed delegate to settle, open its tab, and verify the
     ended tab persists until manually closed.
  7. Switch to another session and back. Verify the tabs are restored per
     session and closed tabs stay closed.
- **Expected**: No auto-open on delegate start; N subagents = N coexisting
  closable tabs with deduplicated `name#n` labels; the tab body is the
  delegation's user/assistant message stream with follow-up prompts as user
  turns; the composer is disabled with the in-field hint and has no send
  path; ended delegates' tabs persist until closed; tabs are session-scoped.
- **Specs linked**: `04-ux/08-component-spec.md` (delegation tab),
  `04-ux/09-interaction-patterns.md` (work panel tabs)
- **Acceptance**: Quality
- **Milestone**: M6
- **Status**: Draft

#### E2E-119: Parallel subagents report back without entering the parent's context

- **Preconditions**: A project-bound Agent session with the user home containing
  `~/.agents/subagents/scout.md` (read-only, no `tools` key), `~/.agents/subagents/fixer.md`
  (`tools: Read, Edit`), `~/.agents/subagents/pinned.md` (`model:` naming a second
  configured provider) and `~/.agents/subagents/broken.md` (missing `name`); a provider
  whose stream can be driven to emit two `Task` calls in one assistant message;
  permission mode `ask` so a delegate's `Edit` is gated; read access to
  `<data_dir>/sessions/<id>.jsonl` and the `messages` index.
- **Steps**:
  1. Prompt a turn in which the assistant emits two `Task` calls — `scout` and
     `pinned` — in one message. Observe the delegation card while both run and
     after each one settles; collapse it, then expand each node.
  2. Prompt a turn whose assistant message emits a single `Task` call — `scout`
     — and compare its presentation with step 1's.
  3. Prompt a turn in which two `fixer` delegates each edit a different file, and
     answer only the first permission card.
  4. Answer the second card, then prompt a third turn where two `fixer`
     delegates edit the **same** file.
  5. Start a fan-out and press Stop while one card is on screen and another is
     queued.
  6. Prompt a `Task` call naming `broken`, then one naming an agent that does not
     exist, then one whose definition pins an unconfigured provider.
  7. Switch the session to Plan, then to Goal, and inspect the tool catalog.
  8. Reload the session and re-expand the delegation card and every `Task`
     node.
  9. Open a node with a long description and long tool paths. Resize the work
     panel to its minimum, default, and a wider width and inspect the topology
     card and the delegation tab at each width. Long content wraps inside the
     committed width without dragging the divider to read a complete line.
- **Expected**:
  - Both delegates in step 1 run concurrently, and `pinned` streams on its own
    provider/model while the parent keeps the session's.
  - The two `Task` calls in step 1 form one full-width delegation card. While
    active it opens once and its header updates the subagent and settled counts;
    after settlement it keeps the user's expansion choice and reports aggregate
    success, warning, or issue state plus elapsed time.
  - The lone `Task` in step 2 draws the same card with a single delegate node —
    same root, connector, outcome, runtime and step count — and never the
    compact one-line tool row (D265). Its aggregate line is worded for one
    subagent, so no locale reads "1 个 Subagents" or "Subagents working".
  - The expanded card shows one main-agent root connected to `scout` and
    `pinned` in parent-row order, with no invented edge between delegates. Each
    node shows its agent, short description, explicit outcome, duration and step
    count. Expanding a node shows the brief, report exactly once, and
    `status`/`turns`/`toolCalls`. Delegate rows appear only inside that node,
    never in the turn stream or the minimap.
  - At narrow, default, and wide panel widths, topology titles, descriptions,
    and step summaries reflow within the card instead of using a fixed
    one-line ellipsis. Long tool paths, commands, and answer fragments in the
    delegation tab wrap inside the committed width, produce no horizontal
    overflow, and retain the tab as the only scroll owner.
  - If the parent keeps working after those `Task` calls — thinking, `Read`,
    `Grep`, or a lifecycle row — that work is a separate processing group, not
    rows inside the delegation card (D319). The card's tile, “Subagent working”
    header, and topology canvas contain only the `Task` nodes.
  - The parent's next request contains the reports and **no** delegate message or
    tool row; the rows are nonetheless present in the transcript file and the
    index with `meta.parentToolCallId` and `meta.agentName`.
  - Only the head permission card is rendered; it names the asking delegate and
    the number waiting behind it. Answering it reveals the next card, and neither
    answer resolves the other request.
  - `scout` cannot call `Edit` or `Write` at all; `fixer` can. Same-file edits in
    step 4 apply in a defined order and neither loses the other's write.
  - Stop denies both the shown and the queued request, and both delegates end
    `aborted` in text and icon inside their own `Task` nodes — the parent turn
    ends once and the aggregate card settles with a warning.
  - `broken` is absent from the catalog with a launch diagnostic and the session
    keeps its other three delegates; an unknown agent and an unresolvable model
    pin each fail as a `Task` tool error naming the cause, with no fallback to
    the session provider and no turn failure.
  - `Task` is absent from the catalog in Plan and Goal.
  - After reload the card is collapsed by default; re-expanding preserves node
    order, attribution, outcome and nested content exactly as they appeared
    live.
- **Specs linked**: `03-runtime/02-agent-runtime.md` §5f/§7.2b/§8,
  `03-runtime/03-tools-and-permissions.md` §10.2,
  `03-runtime/04-data-storage.md` §4.7a, `04-ux/03-permission-ux.md` §6a,
  `04-ux/08-component-spec.md` §9.9, ADR 0062, decisions-log D201, D265, D319
- **Acceptance**: C (conversation), E (tools & permissions), F (persistence),
  Security, Quality
- **Milestone**: M6
- **Status**: Covered by unit tests (2026-08-06): `packages/shared`
  `subagent-definition.test.ts` and `packages/agent-runtime`
  `subagent-definitions.test.ts` (frontmatter, tool filtering, malformed
  documents, global-user-shadows-builtin, legacy-`maxTurns` ignored);
  `subagent.test.ts` (report bounding, abort, event attribution, prompt
  framing) and `path-lock.test.ts`
  (same-path ordering, concurrency cap); desktop `permission-inline.test.mjs`
  (queue order, id-matched removal, tool-call removal, abort denying the queue,
  card copy), `subagent-wiring.test.mjs` (main-process discovery and model pins)
  and `subagent-transcript.test.mjs` + `assistant-turns.test.mjs` (nesting,
  single report print, memoization, the card gate that admits a lone delegation
  and the count-aware aggregate copy in both locales), plus
  `subagent-topology.test.mjs` (delegate detection, structured outcomes and
  aggregate counts). Full multi-provider fan-out and rendered topology
  interaction remain manual.

#### E2E-SUBAGENT-legacy-turn-limit-frontmatter-is-ignored

- **Preconditions**: Agent mode. A user document
  `~/.agents/subagents/legacy-worker.md` whose frontmatter declares
  `maxTurns: 2` next to a valid `description` and `tools`, a second document
  that spells the same key `max-turns: 2`, and a third that never mentions it.
- **Steps**: 1) Open Settings → Subagents and confirm every row in the
  Built-in and Global groups renders with its tool grant and that no
  turn-limit field exists anywhere in the page or the editor's Advanced
  disclosure. 2) Delegate to `legacy-worker` and let it make more than two
  tool-calling turns. 3) Read the document back through the settings API and
  again as a raw file. 4) Open the editor on that row, save it without
  changing anything, and re-read the file.
- **Expected**: Both spellings load as valid definitions. The declared key is
  ignored exactly like any other unrecognized frontmatter key: no parse error,
  no warning or diagnostic naming it, the definition still resolves, and the
  file is not rewritten. The delegate is never stopped at two turns and never
  reports `truncated`; it ends only when it finishes or is `TaskStop`'d. No
  surface in the app, and no locale's `chat.subagentStatus` copy, reports a
  turn limit or a “Turn limit reached” status.
- **Specs linked**: `03-runtime/02-agent-runtime.md` §5f,
  `04-ux/06-settings-ia.md` §7, ADR 0253, decisions-log D423
- **Acceptance**: C (conversation), Quality
- **Milestone**: M6
- **Status**: Draft — unit covered in `packages/shared`,
  `packages/agent-runtime`, and the host-core `user_subagents` regression test;
  the full UI journey needs a capable environment.

#### E2E-SUBAGENT-inherit-parent-tools

- **Preconditions**: Agent mode. A user document
  `~/.agents/subagents/worker.md` with `tools: inherit` (no assignable extras),
  at least one plugin or MCP tool in the parent catalog, and a non-empty Skill
  catalog. Built-in `explorer` remains on its whitelist.
- **Steps**:
  1. Confirm Settings → Agent → Subagents lists `worker` and that Edit shows
     Inherit parent tools on. Save without changing tools and reopen the file.
  2. Delegate `Task` to `worker` with a brief that needs a Skill id and a plugin
     tool the parent already had.
  3. Delegate `Task` to builtin `explorer` in the same session.
  4. Confirm `worker` cannot call `Task`, `ToolSearch`, `asktool`, or
     `new_context`.
- **Expected**:
  - Step 1 round-trips `tools: inherit`; the document does not disappear from
    `agents.active` and save does not rewrite it to `Read, Glob, Grep`.
  - `worker` receives Skill, the plugin/MCP tool, and the parent builtins minus
    the deny list. Its system prompt lists those names, includes the `# Skills`
    catalog, and says it may change files when the parent catalog includes
    Bash/Edit/Write.
  - `explorer` still has only `Read, Glob, Grep, Bash` and cannot call Skill.
  - The Task catalog line for `worker` reads `(tools: inherit)`.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md` §10.2,
  `03-runtime/02-agent-runtime.md` §5f/§7.2b, ADR 0246, issue #215
- **Acceptance**: E (tools & permissions), Security
- **Milestone**: M6+
- **Status**: Automated by `test:e2e:subagents` (host-core create/read/on-disk/active/loader inherit round-trip) and `test:e2e:subagent-models` (real sidecar/local transport Task spawn, inherited Skill/plugin catalog minus the deny list, and builtin explorer isolation). Unit coverage remains in `packages/shared`, `packages/agent-runtime`, and host-core `user_subagents`; the UI inherit-checkbox journey remains Draft. Required suites: `test:e2e`, `test:e2e:subagents`, `test:e2e:subagent-models`.

#### E2E-145: Tool results read as structured blocks, never JSON

- **Preconditions**: A project-bound Agent session with permissions allowed for
  the turn; a plugin tool whose result is an arbitrary record is installed; the
  workspace contains a file large enough to trip host truncation.
- **Steps**:
  1. Run one turn that reads a source file, globs a directory, greps a token,
     greps again with `outputMode: filesWithMatches` and `count`, edits a
     workspace file, edits a scratch-root file, runs a failing shell command,
     and calls the plugin tool.
  2. Inspect each collapsed activity row, then expand every row in light and
     dark.
  3. Click a Glob path and a Grep hit heading.
  4. Trigger a high-risk tool so the inline permission card appears.
  5. Read a truncated file and copy each block.
- **Expected**:
  - No expanded row shows escaped JSON, and no payload appears twice.
  - Read/Write show highlighted content; Bash shows command, output, and
    error-hued stderr as separate blocks with empty channels omitted; Glob shows
    a path list; Grep shows hits grouped per file with line numbers in `content`
    mode, a path list in `filesWithMatches`, and per-file totals in `count`; the
    failing command carries an `exit 1` chip.
  - A Read row's collapsed chip shows the returned window as
    `{lineCount},L{offset+1}-L{offset+lineCount}` (for example,
    `50,L16-L65`), never `fileBytes`; a Read result without valid window
    metadata has no size chip. Write continues to show its byte-size chip.
  - Each Glob/Grep path-list row is start-aligned with natural character
    spacing; glyphs are not distributed across the block width.
  - The workspace edit shows no inline diff (its ReviewChangeCard owns it); the
    scratch edit shows a compact diff and a `scratch` chip.
  - The plugin result renders label/value fields and labeled blocks, not a blob.
  - Clicking a path opens it in the work panel; paths outside the workspace root
    are not clickable.
  - The permission card's args preview uses the same blocks.
  - Host truncation markers stay visible, a `truncated` chip appears, a host
    `notice` renders as a neutral note under the block it qualifies, capped
    lists report the hidden remainder, and copy yields the full payload.
- **Specs linked**: `04-ux/08-component-spec.md` §9, §10.2,
  `08-meta/decisions-log.md` (D192)
- **Acceptance**: C (chat & stream), E (tools & permissions), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`tool-presentation.test.mjs`,
  `transcript-style.test.mjs`); full UI journey Draft

#### E2E-146: A turn that produces no visible text re-runs once

- **Preconditions**: A project-bound Agent session uses a deterministic provider
  fixture that ends one turn with no tool call and no text — once with reasoning
  content present, once with nothing at all; a second fixture run ends both the
  first turn and the re-run that way.
- **Steps**:
  1. Start an Agent turn with the reasoning-only fixture and watch the
     transcript while the runtime recovers.
  2. Inspect the transcript, session state, and terminal diagnostics afterwards.
  3. Repeat with the nothing-at-all fixture.
  4. Repeat with the twice-silent fixture and inspect the terminal error message,
     its details disclosure, and its action button.
  5. Click the error's retry action.
  6. Reload the session and verify what stayed durable.
- **Expected**:
  - The recovered turn keeps the same visible assistant message id, emits one
    terminal lifecycle, and shows no error. The user sees only the answer.
  - The empty assistant is removed from model context before the re-run, so the
    provider never receives two assistant messages in a row, and it is never
    appended to the durable transcript.
  - The terminal diagnostics identify the empty-response recovery and the
    re-run's outcome.
  - The second silence emits one terminal retriable `EMPTY_MODEL_RESPONSE`
    assistant error and lifecycle event; the message names both attempts, and
    the retry action re-sends the last prompt.
  - A turn whose text is empty because it requested tools is untouched, and so
    is an aborted or already-failed turn.
  - Only one re-run happens per prompt, including after context-overflow
    recovery within the same prompt.
- **Specs linked**: `03-runtime/02-agent-runtime.md` §5e, §7,
  `03-runtime/08-error-codes.md` §3.2, `08-meta/decisions-log.md` (D193)
- **Acceptance**: C (chat & stream), F (persistence), H (diagnostics), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`runtime.test.ts`); full provider/UI journey Draft

#### E2E-146a: Approved Plan/Goal progress text continues once

- **Preconditions**: A project-bound session has an approved Plan or Goal and a
  deterministic provider fixture. One fixture ends with short forward-looking
  progress text and no tool call; a second ends with a normal final report;
- **Steps**:
  1. Start the approved execution with the progress-only fixture and inspect
     the transcript while the runtime recovers.
  2. Inspect the model request context, lifecycle events, and visible message
     ids after the continuation completes.
  3. Repeat with the normal final-report fixture.
  4. Repeat the progress fixture with a continuation that emits a real tool
     call, then inspect the tool result and final report.
- **Expected**:
  - The progress text remains in one assistant bubble and causes exactly one
    continuation. The provider receives the user/execution context without the
    prior assistant message at the end, and the continuation carries the
    progress nudge.
  - The first attempt's `agent_start`, `turn_start`, `turn_end`, and
    `agent_end` are suppressed; the reused bubble id and one terminal lifecycle
    are visible to the UI. The nudge is removed after the run.
  - A continuation tool call proceeds through the ordinary autonomous loop;
    it does not create a duplicate assistant bubble or lifecycle.
  - A normal final report, including one recovered after silent-turn recovery,
    does not cause an unnecessary progress continuation. Ordinary Agent text
    answers remain unchanged.
- **Specs linked**: `03-runtime/02-agent-runtime.md` §5e/§5e.1/§7,
  `03-runtime/08-error-codes.md` §3.2
- **Acceptance**: C (chat & stream), F (persistence), H (diagnostics), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`runtime.test.ts`, `progress-turn.test.ts`); full
  provider/UI journey Draft

#### E2E-147: Scoped search stays inside its budget and the agent narrates

- **Preconditions**: A project-bound Agent session; the workspace contains a
  multi-megabyte source file, a minified bundle with a `.map` sibling (one line,
  megabytes long), a binary file, and a dependency tree excluded by `.gitignore`.
- **Steps**:
  1. Inspect `tools.list` for `Read`, `Glob`, and `Grep`.
  2. Read the multi-megabyte file, then read it again from the reported next
     offset.
  3. Grep a token that hits the minified bundle and its `.map`.
  4. Grep the same token with `path` pointing into the ignored dependency tree,
     then with `include` narrowing to one extension, then with
     `outputMode: filesWithMatches` and `count`.
  5. Glob a broad pattern, and Glob with `path` and `limit`.
  6. Read the binary file.
  7. Run a shell command that prints far past the shell budget on stdout, then
     one that fails after printing progress noise on stderr, and open the spill
     file named in each marker.
  8. Ask a question that needs several tool batches, and watch the transcript
     between batches.
- **Expected**:
  - Every description carries its parameters and the real limit numbers.
  - No single tool result exceeds its budget: 128 KB for Read/Glob/Grep, 96 KB
    for Bash. Read reports `offset`, `lineCount`, `fileBytes`, and a next-offset
    `notice`; the second read continues without overlap; `totalLines` is always
    reported from the first read so the model knows the file scale upfront. A
    filled default or requested window reports `truncated: false` even when the
    file continues.
  - No file size is ever refused. Lines from the bundle and the `.map` arrive
    clipped at 16,384 chars and the clip count appears in `notice`, so one line
    cannot consume the result.
  - An explicit `path` reaches into the ignored tree; without it the same search
    returns nothing from there. `include`, `outputMode`, and `headLimit` each
    shrink the payload, and results order newest-modified first. When `rg` is
    on PATH, Grep uses it and still matches that contract; when it is missing
    or exits 2, Grep falls back in-process (D315).
  - The binary read fails with `TOOL_BINARY_CONTENT` and no binary reaches the
    model; Grep skips it silently.
  - Bash stdout keeps its head, stderr keeps its tail, both markers name which
    end survived and the spill path, and each spill file opens with the fuller
    output.
  - The agent answers in the language the user wrote in, precedes each tool
    batch with a sentence about what it is doing, never leaves more than one
    batch without new visible text, and ends with a self-contained result.
- **Specs linked**: `03-runtime/16-tool-result-limits.md`,
  `03-runtime/02-agent-runtime.md` §7, `08-meta/decisions-log.md` (D194, D306, D315)
- **Acceptance**: C (chat & stream), E (tools & permissions), Quality
- **Milestone**: M5
- **Status**: Unit-covered (host-core `tools` tests, `runtime.test.ts` prompt
  assertions); full provider/UI journey Draft

#### E2E-100: A pasted MCP server runs, and only where it is scoped

- **Preconditions**: Two projects on disk, `~/work/api` and `~/personal/site`.
  A local stdio MCP server available on PATH. An Agent session per project.
- **Steps**:
  1. Extensions → MCP → Import from JSON. Paste a `mcpServers` document holding
     three servers: one valid stdio entry, one remote HTTP entry at a trusted LAN
     address such as `http://192.168.1.20:8080/mcp` with no `type`, and one stdio
     entry with no `command`.
  2. Confirm the import, then open the imported stdio server and press Test
     connection.
  3. Leave the server at **Everywhere** and ask the agent in each project to
     list its available tools. Have the stdio fixture report its working
     directory and process id; open a second session in `~/work/api` as well.
  4. Set the server to **These projects**, with only `~/work/api` picked.
  5. Ask again in each project.
  6. In the already-open `~/personal/site` session — assembled while the server
     was global — ask the agent to call one of the server's tools by name.
  7. Edit the server's `env`, set a 45-second connection timeout, and save.
     Reopen it to confirm the value persisted, then clear the timeout and save.
     Ask in `~/work/api` again.
  8. Rename the server and re-scope it; ask once more.
  9. Point the server's command at a binary that does not exist, save, and open
     a new session.
  10. Restore the valid command and Test connection. Activate a tool through
      `ToolSearch`, then terminate the stub server process between calls. Call
      the same tool in the existing session without searching again.
  11. Repeat with the restarted stub omitting that tool, and with the server
      disabled or scoped away before recovery. Also try concurrent calls after
       a disconnect and a server that fails its recovery handshake.
  12. Connect the HTTP server, stop it, and refresh the MCP settings page.
      Test connection again after restarting the server.
- **Expected**:
  - The activated tool works after a transport restart without a second search;
    concurrent calls share one handshake. The fresh server list must still
    advertise the tool. Removed tools and inactive servers are refused without
    executing a call; inactive servers are not reconnected. Recovery failure
    returns `UNAVAILABLE` and does not trigger repeated handshake attempts until
    an edit or Test connection. A failed tool execution is never replayed.
  - Two servers import; the third is listed as skipped with "a stdio server
     requires command". The LAN HTTP entry lands as `http` with its url intact,
     and the editor shows the unencrypted-connection warning.
  - Test reports connected with the tool names it found, and the row's glyph
     turns from connecting to ready.
  - While global, both sessions see `mcp_<serverId>_<tool>` names.
  - The stdio fixture runs from each session's project directory. Sessions in
    `~/work/api` share one process, while `~/personal/site` uses a separate
    process. A projectless session uses the user's home directory.
  - After narrowing, only the `~/work/api` session sees them; the summary chip
     reads "1 project" and names it.
  - The stale call from step 6 fails with `TOOL_NOT_FOUND` and "not active for
     this session" — scope holds at dispatch, not only in the catalog.
  - The `env` edit drops the connection: the next assembly or call re-handshakes, and
     the tool's behaviour reflects the new value. The rename in step 8 does not
     reconnect anything.
  - The editor restores a saved timeout when reopened. Clearing it removes the
    override so the next connection uses the default handshake timeout.
  - The broken command records `failed` with a message, contributes no tools,
     and is not re-dialled on the following session assembly; pressing Test
     retries it.
   - A stopped HTTP server loses its `ready` status on settings refresh and
     reports `failed`; Test connection restores `ready` after it restarts.
- **Specs linked**: `07-plugins/01-plugin-system.md` §12,
  `03-runtime/01-ipc-protocol.md` §12a, `08-meta/decisions-log.md` (D192, D193)
- **Acceptance**: E (tools & permissions), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`apps/desktop/test/user-mcp.test.mjs`,
  `packages/shared/src/mcp-import.test.ts`, host-core `mcp_servers` tests); full
  UI journey Draft

#### E2E-100B: Remote HTTP MCP server OAuth 2.1 authorization and token lifecycle

- **Preconditions**: An HTTP MCP server endpoint configured requiring OAuth 2.1 authentication (RFC 9728 discovery and PKCE S256).
- **Steps**:
  1. Open Settings > Agent > MCP. Add an HTTP MCP server URL.
  2. The server status displays `Authorization required`.
  3. Click `Authorize`. Main spins up loopback on `127.0.0.1`, launches external browser to the authorization endpoint with RFC 8707 `resource`.
  4. Complete login in browser, redirecting to `http://127.0.0.1:<port>/callback`.
  5. The loopback callback validates state/code, completes token exchange with PKCE verifier, saves token to encrypted secret `secret:mcp:<id>:oauth`, renders escaped success page, and emits `done` event.
  6. Settings UI updates status to `Ready` with discovered tools, shows localized success toast, and displays `OAuth` badge.
  7. When access token expires, `UserMcpRuntime` transparently uses refresh token to obtain a fresh access token without user prompt.
  8. Moving the server via `mcp.transfer` preserves and re-keys the OAuth token secret under the destination ID.
- **No-DCR case**: When authorization-server metadata omits `registration_endpoint` and there is no reusable client, Authorize does not open a browser. The error event contains `MCP_OAUTH_DCR_UNAVAILABLE` and Settings shows localized recovery guidance to request a client ID from the server operator or use a DCR-capable server.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, ADR 0283, ADR 0142
- **Acceptance**: E (tools & permissions), Security
- **Milestone**: M5
- **Discovery regression (#1221):** Local HTTP authorization flow covers root and path issuers, ordered OAuth/OIDC fallbacks, challenge-scope precedence, all protected-resource scopes, and omitted scope when absent. It checks the real callback, PKCE token exchange and storage handoff using synthetic tokens; no external account is contacted.
- **Status**: Unit-covered (`apps/desktop/test/mcp-oauth.test.mjs`, `apps/desktop/test/user-mcp.test.mjs`); local HTTP flow covered by `apps/desktop/test/mcp-oauth-discovery.test.mjs`; full UI journey Draft

#### E2E-261: Clear a per-server MCP timeout override

- **Preconditions**: Isolated Electron profile and a saved MCP server with a 45-second timeout override; no live server or provider.
- **Steps**: Open the production MCP editor, enter an out-of-range value and confirm Save is disabled, then clear the timeout field and save.
- **Expected**: An invalid timeout cannot be saved. Clearing an existing override is valid and serializes as `timeoutSeconds: null`, allowing host-core to remove the override and use the default.
- **Acceptance**: `node scripts/e2e-mcp-timeout-clear.mjs` exercises the production editor and save serialization. `apps/desktop/test/mcp-editor-timeout.test.mjs` covers value conversion; host-core MCP tests cover null clearing and default behavior. No live MCP server is contacted.
- **Milestone**: M6+

#### E2E-SKILL-import-multiple-folders

- **Preconditions:** An isolated Desktop profile and three sibling folders:
  `alpha/SKILL.md` and `beta/SKILL.md` are valid; `broken/` has no
  `SKILL.md`. A project is selected in Settings > Agent > Skills.
- **Steps:** Choose Import folder for that project, select all three folders,
  and confirm. Check the project list and the result message. Reopen Import
  folder and confirm it starts at the parent containing `alpha/`, `beta/`,
  and `broken/`. Cancel, reopen it, and confirm the parent is unchanged.
  Import a single Markdown file through Import file.
- **Expected:** Both valid skills appear at project level with their sibling
  resources, the invalid folder is reported without blocking the others, and
  the picker remembers their shared parent across cancellation. The single-file
  action still selects only one file.
- **Coverage:** Folder import service, preference, and settings source contract
  tests. Native multi-folder picker and remembered location remain desktop E2E.

#### E2E-101: A user skill is written once and scoped per project

- **Preconditions**: Two projects on disk. An Agent session in each.
- **Steps**:
  1. Extensions → Skills → New. Save with an empty description.
  2. Fill in a description, write a body, and save.
  3. Ask the agent in each project to use the skill by name.
  4. Set the skill to **These projects** with only the first project picked,
     then switch it Off and back to **These projects**.
  5. Ask again in each project.
  6. In the first project's session, narrow the skill to the *second* project
     and immediately ask the agent to invoke it.
  7. Paste a body over 128 KB.
  8. Switch the app language to 中文 and revisit every surface above.
- **Expected**:
  - Saving without a description is refused with a message naming the field:
    the description is the only part that enters the prompt.
  - The base prompt carries the skill's id, name and trimmed description and
    not its body; the body arrives only through the `Skill` tool.
  - Toggling Off and back restores the picked project without re-picking it.
  - After narrowing, only the scoped project's session can invoke it; the other
    gets "not enabled for this project".
  - Step 6 fails in the already-open session too — the scope is re-read when the
    body is loaded, not trusted from the catalog that listed it.
  - The byte counter warns before the 128 KB cap and the save is refused past it.
  - Every label, empty state, error and count renders in Chinese, with counts
    reading naturally at 0, 1 and many.
- **Specs linked**: `07-plugins/01-plugin-system.md` §12.3,
  `03-runtime/01-ipc-protocol.md` §12b, `08-meta/decisions-log.md` (D174, D192,
  D194)
- **Acceptance**: E (tools & permissions), Quality
- **Milestone**: M5
- **Status**: Unit-covered (host-core `user_skills` tests,
  `apps/desktop/test/extensions-page.test.mjs`); full UI journey Draft

#### E2E-102: Composer file and image paste keeps structured attachment metadata

- **Preconditions**: The app is running with an Agent session in a project and
  a home composer available. The OS clipboard contains a text snippet no
  longer than the configured large-paste threshold, one or more local files
  (including a filename with whitespace), and an image in separate paste
  attempts. Record the app data directory and the session id.
- **Steps**:
  1. Paste text-only within the configured threshold and confirm editable text.
     Copy a Word selection with text plus a generated image representation;
     confirm text wins, including multiline/CRLF, blank/trailing lines, literal
     `<>&` and quotes, replacing selections across line breaks/attachment chips,
     caret position, and native undo/redo.
     Repeat above the threshold and confirm a TXT chip rather than an image.
     Paste a real native image file with accompanying filename text and confirm
     it remains an image attachment.
  2. Paste one local file, then paste multiple files including a spaced name.
  3. Paste an image from the OS screenshot/clipboard provider.
  4. Inspect the draft before sending: confirm each materialized item is a
     removable leaf-name chip and no scratch absolute path occupies the
     textarea. Hover/focus chips to inspect their full paths, remove one, then
     send the prompt and inspect the session message's attachment metadata.
    Before sending, verify each image is a compact inline chip in the draft and
    that hovering it reveals its preview card. Replacing all text removes the
    inline image chips while undo restores them; image-only drafts must survive
    session switching and retain submission metadata.
    Mount the complete Composer: click Send for image-only input, verify
    attachment delivery and successful clearing, and immediately reject a
    text-plus-image send to verify full draft restoration. In a narrow pane,
    prefill 20 images, confirm 20 inline chips inside the composer, and remove
    one without losing the others.
    Send a prompt that puts text, an image, then more text in that order:
    confirm the sent message renders the image chip at that position instead of
    after the body, and that an image the draft did not name inline still
    follows the text. The provider-facing prompt keeps the same order; the
    runtime placement tests assert those content blocks.
    Inspect the chip and open it with click, Enter, and
     Space. Confirm a centered modal preview opens, the work panel stays
     unchanged, and the draft is neither edited nor sent. Check small images
     stay at natural size, wide images fit without distortion, zoom/reset and
     download target the selected original, and multiple images support button
     and arrow-key navigation with zoom reset. Drag at fit size and after zoom,
     including releasing outside the image; check cancellation and ordinary wheel
     panning. Fit and image navigation must reset position; dragging must not
     dismiss the preview or leave capture active after close/session changes. Close with Escape, the close
     button, and blank space; verify focus/caret restoration and modal focus
     containment. Native plugin surfaces must hide while the preview is open.
     Repeat without a project. Remove an attachment; it must neither preview
     nor send. Switch session/project or remove the selected attachment during
     a delayed read; the old preview must close and late results must not
     overwrite a newer image. Missing/undecodable images show retry and keep
     the draft. Text chips must still expand as editable text.
  5. Inspect `<data_dir>/scratch/<sessionId>/pasted/` and compare the saved
     bytes with the source files/image. Check the project `git status`.
  6. Delete the session, then confirm its scratch directory and pasted files
     are removed.
- **Expected**:
  - Text-only paste within the configured threshold remains native and is not
    routed through the file bridge. Oversized text behavior is covered by
    E2E-102g.
  - Each file/image is saved with a sanitized, UUID-backed unique name under
    the session scratch root, while its chip shows only the sanitized original
    leaf name. Duplicate leaf names remain separate references.
  - The dispatched prompt carries ordinary files through the existing path
    reference flow and carries pasted files/images as structured attachments;
    the persisted user message contains refs and metadata, never binary bytes.
    The agent can use its normal file tools to read the materialized files.
  - A home paste creates or reuses a durable session before writing. The
    workspace remains clean and no workspace artifact row is created.
  - Image preview preserves the draft and attachment metadata, uses
    `fs/readImageDataUrl` with bounded reads and path containment, and works
    without a workspace for allowed scratch files. Preview preserves the draft
    attachment format and leaves work-panel tabs unchanged. Closing/unmounting
    releases modal/native-view blocking.
  - Deleting the session removes the pasted files with the rest of scratch.
  - Deleting text immediately before an inline file chip must not insert a
    blank line or move the chip to the next line; native undo/redo stay intact.
- **Specs linked**: `04-ux/08-component-spec.md` §11.7–11.8,
  `03-runtime/01-ipc-protocol.md` §13c,
  `03-runtime/03-tools-and-permissions.md` §4b,
  `03-runtime/04-data-storage.md`, `08-meta/decisions-log.md` (D197, D209,
  D243, D392), ADR 0059, ADR 0070, ADR 0101, ADR 0218
- **Acceptance**: C (conversation & stream), E (tools & permissions),
  F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`composer-paste-files.test.mjs`,
  `composer-clipboard.test.mjs`, `composer-native-deletion.test.mjs`);
  `prompt-inline-attachments.test.mjs` covers where an inline image's `@path`
  is recorded and that a replayed fallback copy still travels,
  `session-message-presentation.test.mjs` renders the row order, and
  `packages/agent-runtime/src/runtime.test.ts` asserts the prompt content
  blocks. `pnpm test:e2e:composer-paste` mounts the real
  ComposerInput, draft/paste hooks, file viewer, production CSS and sandboxed
  preload. It dispatches Chromium ClipboardEvents with synthetic mixed data
  and native File objects, exercises the real scratch writer and contained
  file reader, compares saved bytes and decodes the preview image. Requires
  a desktop build, installed Electron and a graphical session (Xvfb on Linux).
  It does not modify the OS clipboard or automate Word; Word/platform journeys
  and full provider dispatch remain manual. Run against the refreshed request
  candidate and record its revision; PR integration validation follows the
  authoritative `AGENTS.md` workflow without merging into local main first.

#### E2E-102h: Composer picker imports files into session scratch

- **Preconditions**: The app is running with a home or Agent composer and a
  durable session. The native picker can select a text file and an image outside
  the active workspace.
- **Steps**: 1) Click the Composer `+` button twice in quick succession;
  confirm that only one native file picker opens, directly without an
  intermediate type-choice menu. 2) Select both
  fixtures. 3) Inspect the draft chips and send a prompt asking the agent to
  read the text fixture and identify the image marker. 4) Inspect the renderer
  request, session transcript, and the session scratch directory.
- **Expected**: While the native picker or its renderer import is in flight,
  repeated `+` clicks are ignored. While the native picker is open, the main
  process rejects duplicate picker requests instead of opening another dialog.
  The native picker returns a short-lived one-shot token, never a
  source absolute path, and the selections are copied into
  `<data_dir>/scratch/<sessionId>/pasted/` before they enter the draft. The app
  classifies each selected item from its MIME/extension metadata, so the same
  picker handles both regular files and images. Chips show sanitized leaf names
  while prompt attachments reference only the copied paths; the workspace is
  unchanged. The agent can call `Read` on the text fixture, and a
  vision-capable model receives the image as an image block. Durable messages
  retain metadata and refs only, never the source absolute path or binary bytes.
  The file picker does not offer directory selection; missing files,
  expired/replayed tokens, and oversized files return a visible IPC error and
  write nothing.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §13c,
  `03-runtime/04-data-storage.md`, `04-ux/08-component-spec.md` §11.7–11.8,
  ADR 0059, ADR 0101, ADR 0218
- **Acceptance**: B (model config), C (conversation & stream), E (tools &
  permissions), F (persistence), Security, Quality
- **Milestone**: M5
- **Status**: Unit-covered (`apps/desktop/test/composer-paste-files.test.mjs`);
  provider/UI journey Draft (run only in a capable environment when this surface changes)

#### E2E-102i: Composer accepts native file and folder drops

- **Preconditions**: The app is running with an Agent session and a visible
  Composer. The OS file manager exposes one regular file, one folder, and a
  mixed multi-selection; place the caret in the middle of a non-empty draft.
- **Steps**: 1) Drag the regular file over the Composer and observe the target
  outline, then drop it. 2) Drag the folder into the same draft. 3) Repeat with
  a mixed file/folder selection while the caret is between existing text. 4)
  Inspect the draft, remove the file chip, and send the prompt. 5) Inspect the
  saved scratch file and the persisted user message.
- **Expected**: File-system drag-over prevents the browser default and marks
  the whole Composer shell without layout movement. Regular files are saved
  through the existing bounded session-scratch bridge and appear as removable
  leaf-name chips; folders are not read, copied, or traversed, and their full
  native paths appear at the caret as `@<path>/` literal directory references.
  Mixed drops preserve OS order, retain surrounding text, and restore the
  caret after asynchronous file saving. Sending keeps the file's existing
  attachment metadata/path behavior and the folder path as prompt text; no
  workspace files are created.
- **Specs linked**: `04-ux/08-component-spec.md` §11.5–11.8,
  `04-ux/09-interaction-patterns.md` §8.2/§8a.2,
  `03-runtime/01-ipc-protocol.md` §13c, ADR 0059, ADR 0070, ADR 0222
- **Acceptance**: C (conversation & stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`apps/desktop/test/composer-drag-drop.test.mjs`);
  full desktop gesture journey Draft (run only in a capable environment when this surface changes)

#### E2E-102a: Composer file reference results show leaf names with full relative paths

- **Preconditions**: The app is running with an Agent session in a workspace
  containing nested files, duplicate leaf names in different directories, and
  a directory whose name contains whitespace.
- **Steps**: 1) Type `@` and filter to the nested and duplicate entries. 2)
  Inspect the visible rows, then hover for full-path tooltips and inspect their
  accessible names. 3) Accept a file with Enter and confirm a leaf-name chip
  remains in the draft at the caret while the `@` token and full path stay
  hidden. Accept a second file with Tab or click. Accept a directory result
  and continue to a child file. 4) Send the completed references and inspect
  the persisted user message.
- **Expected**:
  - Each result persistently renders its leaf name followed by the entry's
    complete workspace-relative path in a de-emphasized span; directories
    retain a trailing `/` on the leaf name, the span carries the raw
    `entry.path`, and it ellipsizes before the leaf name can while the row
    never overflows the menu.
  - The tooltip and accessible name retain the complete relative path so
    duplicate leaf names remain distinguishable.
  - In a Git workspace containing accented, CJK, and emoji file names,
    indexing and filtering retain each name exactly, including when Git's
    stdout chunks split a UTF-8 character. Accepting the result names the
    existing file, without replacement characters in its path.
  - Enter/Tab/click on a file replaces the `@` token with an inline chip that
    stays in the draft; that key does not send. File acceptance retains the
    original complete `entry.path` behind the chip; directory acceptance
    retains literal path continuation. At dispatch the sent and persisted
    prompt contains each complete path with existing whitespace quoting, and
    the agent can read both selected files normally.
- **Specs linked**: `04-ux/08-component-spec.md` §11.8,
  `04-ux/09-interaction-patterns.md` §8a, `03-runtime/01-ipc-protocol.md` §13c,
  `08-meta/decisions-log.md` (D124, D209, D362, D660), ADR 0024, ADR 0070
- **Acceptance**: C (conversation & stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered
  (`apps/desktop/test/composer-file-reference-display.test.mjs` and
  `packages/host-runtime/src/fs-index-encoding.test.ts`); Unicode filtering and
  file acceptance run in `composer-deep-file-search-user-path.test.mjs`; file-mode row
  layout covered by `scripts/e2e-composer-autocomplete.mjs`; full UI journey
  Draft (run only in a capable environment when this surface changes)

#### E2E-COMPOSER-deep-file-mentions: `@` reaches deep files in a large workspace

- **Preconditions**: The app is running with an Agent session in a workspace
  whose index is truncated (more than 8000 files and directories), with a
  script several folders below thousands of shallow assets — for example a
  Unity project's `Assets/_Game/Scripts/Gameplay/Player/FeatureController.cs`.
  Run once with the workspace under git and once without.
- **Steps**: 1) Type `@` and inspect the footnote. 2) Type the script's name
  and pause. 3) Accept the script's row with Enter. 4) Edit the query quickly
  through several prefixes. 5) Repeat in a small workspace and in a remote
  session.
- **Expected**:
  - The bare `@` lists the index and shows the truncation footnote.
  - After the pause the deep script appears as a row, ranked like any other
    match, and the footnote disappears once that search has answered; files
    excluded by `.gitignore` or the ignore set never appear.
  - Accepting it inserts the same file chip as any other reference.
  - Rows never belong to an earlier query. The menu keeps the local matches
    while a search is pending.
  - A small workspace issues no search request; a remote session keeps its
    snapshot and footnote.
- **Specs linked**: `04-ux/08-component-spec.md` §11.8,
  `03-runtime/01-ipc-protocol.md` §13c, `08-meta/decisions-log.md` (D124,
  D669), ADR 0024
- **Acceptance**: C (conversation & stream), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`packages/host-runtime/src/fs-index.test.ts`
  covers the git and walk listings, ignore rules, directories, and the result
  limit); the renderer journey — search after the pause, merge, accept, stale
  answers, the footnote, and the complete-index path — is covered by
  `apps/desktop/test/composer-deep-file-search-user-path.test.mjs` in a real
  Electron renderer. The full desktop journey against a large real tree is
  Draft (run only in a capable environment when this surface changes).

#### E2E-102k: `@agent` mention delegates to a named subagent

- **Preconditions**: An Agent session in a project with the builtin
  `explorer` subagent enabled and no workspace-root entry named `explorer`.
- **Steps**: Type `look @expl`, accept the `@explorer` row from the **Agents**
  group, finish the sentence and send. Repeat in Plan mode. Add a root file
  named `explorer` and type `@` again.
- **Expected**: The chip is atomic; the user row shows the typed text with
  `@explorer` chipped; the model is instructed to call `Task` with
  `explorer` and a Task card appears. Plan mode lists no Agents group and sends
  the text literally. A same-named root file hides the agent row. Stop before
  any reply restores the typed text, not the model instruction.
- **Spec**: `04-ux/08-component-spec.md` §11.8, ADR 0346
- **Acceptance**: C (conversation & stream)
- **Milestone**: M5
- **Status**: The renderer journey (group, shadowing, Plan omission, chip,
  serialization) runs in `apps/desktop/test/composer-agent-mention-user-path.test.mjs`
  in a real Electron renderer; send-time rewriting, mode gating, file
  precedence and Skill composition in `composer-agent-mention.test.mjs`;
  transcript chips in `session-message-presentation.test.mjs`; persistence in
  `host-core` `agent_mentions_round_trip_through_record_meta`; Stop restoration
  in `composer-smart-stop.test.mjs`. The live Task card against a real
  provider is Draft (requires a configured model).

#### E2E-102b: Unanswered Stop restores compact file-reference drafts

- **Preconditions**: An Agent session can delay its first assistant event. The
  draft contains ordinary text, one workspace reference, two pasted references
  with duplicate leaf names, and a canonical path containing whitespace.
- **Steps**: 1) Send the mixed draft and stop before assistant text, thinking,
  or any tool row begins. 2) Inspect the restored composer and transcript. 3)
  Send the restored draft again and inspect the persisted user message. 4)
  Repeat, allow partial assistant output to begin, then stop.
- **Expected**:
  - Unanswered Stop removes the just-sent user row and restores the original
    ordinary text plus leaf-name chips in stable order.
  - Relative and scratch absolute paths never appear in the restored textarea;
    duplicate labels remain distinct references.
  - Resending serializes each exact canonical path once with existing
    whitespace quoting.
  - Stop after reply start preserves the partial aborted transcript and does
    not restore or duplicate text or chips.
  - Scratch bytes remain under the existing session lifecycle.
- **Specs linked**: `04-ux/08-component-spec.md` §11.5/§11.8,
  `04-ux/09-interaction-patterns.md` §3.2/§8a.2,
  `03-runtime/10-session-state-machine.md`, `08-meta/decisions-log.md` (D209),
  ADR 0070
- **Acceptance**: C (conversation & stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered
  (`composer-file-reference-display.test.mjs`, `transcript-style.test.mjs`);
  full UI journey Draft (run only in a capable environment when this surface changes)

#### E2E-102c: Vision-capable models receive pasted images as image input

- **Preconditions**: A deterministic vision-capable models.dev model whose
  resolved record contains `modalities.input: ["text", "image"]`; an Agent
  session; one pasted PNG and one text prompt. Capture the renderer request,
  main-to-sidecar payload, provider request, durable transcript, and
  `<data_dir>/attachments/`.
- **Steps**:
  1. Select the vision-capable model and paste the PNG into Composer.
  2. Confirm the PNG appears as a removable image chip above the textarea and
     no separate explanatory vision-status row is rendered.
  3. Send a prompt asking the model to identify one visible detail.
  4. Inspect the provider request and durable session message after completion.
  5. Reload the session and ask a follow-up about the same image.
- **Expected**:
  - The model picker/session capability state comes from the exact models.dev
    record, and Composer shows the image as a removable chip without a
    separate explanatory status row. If a remote refresh fails, the bundled
    release snapshot remains authoritative for the process.
  - Main writes one content-addressed image blob and sends the sidecar a
    transient image attachment; the provider adapter emits an image content
    block/data URL, not only `@<scratch-path>` text.
  - The durable message contains `kind`, display `name`, MIME/size, and the
    `attachments/<sha256>` ref, but no base64 or image bytes.
  - After reload, history hydration restores the image block from the bounded
    attachment root and the follow-up still has image context.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §5.1/§13c,
  `03-runtime/02-agent-runtime.md` §5c,
  `03-runtime/04-data-storage.md`, `03-runtime/13-model-catalog-and-selection.md`
  §11.2, `04-ux/08-component-spec.md` §11.7–11.8,
  `08-meta/decisions-log.md` (D243), ADR 0101
- **Acceptance**: B (model config), C (conversation & stream), F (persistence),
  Quality, Security
- **Milestone**: M5
- **Status**: Unit-covered (`model-capabilities.test.ts`, host-core attachment
  roundtrip); provider/UI journey Draft (run only in a capable environment when this surface changes)

#### E2E-102j: Historical vision replay uses a bounded aggregate byte budget

- **Preconditions**: A vision-capable model, a session with no compaction boundary
  across the fixture turns, six distinct user image turns whose combined raw
  image size is below 30 MB, and a later text-only user turn. Capture the
  provider request during runtime recreation and edit/resend.
- **Steps**:
  1. Send the six image turns and then a text-only turn.
  2. Reload/recreate the runtime and edit/resend the text-only turn.
  3. Inspect the provider request and the durable transcript.
- **Expected**:
  - All six historical images are replayed as image blocks; being older than
    five image messages does not drop visual context while the aggregate stays
    within budget.
  - The current text row is removed before history hydration and is not
    double-counted against the restored-history budget.
  - Durable turns retain only attachment refs/metadata, never base64. A unit
    case with a deliberately small budget verifies that many images in one
    message are capped and newest attachments win.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §5.1,
  `03-runtime/02-agent-runtime.md` §5c, `03-runtime/04-data-storage.md`, ADR 0101
- **Acceptance**: C (conversation & stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Documented; provider/UI journey Draft (run only in a capable environment when this surface changes)


#### E2E-ATTACHMENTS-svg-file-fallback: SVG inputs are sent as files, not model images

- **Preconditions**: A vision-capable model; an Agent session; one SVG file
  (clipboard paste or native file picker) and one PNG.
- **Steps**:
  1. Paste or attach an SVG file into Composer alongside a PNG.
  2. Send a prompt asking the model about both attachments.
  3. Inspect the provider request body.
  4. Reload the session and inspect restored attachments.
- **Expected**:
  - The SVG appears as a file chip, not an image chip. It is classified as
    `kind: "file"` with `.svg` extension (even if the original had none).
  - The PNG still appears as an image chip and is sent as a model image block.
  - The provider request contains no `inlineData` for the SVG; it uses a safe
    `@path` file reference.
  - Legacy content-addressed SVG attachments from older sessions are restored
    as files, not images; stale temporary image data is cleared.
  - Non-SVG image attachments and vision capability detection are unaffected.
- **Specs linked**: `03-runtime/svg-attachment-input.md`,
  `03-runtime/01-ipc-protocol.md` §5.1, `04-ux/08-component-spec.md` §11.7
- **Acceptance**: C (conversation & stream), F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`svg-attachments.test.mjs`); Desktop E2E Draft

#### E2E-102d: Non-vision and oversized images use the path fallback

- **Preconditions**: One known non-vision model and one known vision-capable
  model; an Agent session; a normal PNG and a deterministic image just above
  the 10 MB inline bound.
- **Steps**:
  1. Select the non-vision model, paste the normal PNG, and inspect Composer's
     removable image chip.
  2. Send the prompt and inspect the sidecar/provider request.
  3. Select the vision model, paste the oversized image, and send it.
  4. Retry each turn after disposing/recreating the runtime.
- **Expected**:
  - Composer shows the pasted image as a removable chip without a separate
    vision-status explanation. Both cases show a safe `@path` fallback and no
    image block/base64 payload.
  - The non-vision request references the session scratch file; the oversized
    vision request references a safe path while the image remains available to
    the normal file tools.
  - Retries and runtime recreation use the content-addressed image ref and a
    session `replayed/` path where needed; no duplicate binary blobs are made.
  - The transcript still stores attachment metadata/ref and the UI does not
    claim that the image was sent visually.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §5.1,
  `03-runtime/03-tools-and-permissions.md` §4b,
  `03-runtime/02-agent-runtime.md` §5c,
  `03-runtime/04-data-storage.md`, ADR 0101
- **Acceptance**: B (model config), C (conversation & stream), E (tools &
  permissions), F (persistence), Security
- **Milestone**: M5
- **Status**: Draft (run only in a capable environment when this surface changes)

#### E2E-102e: Unknown model ids fail closed for vision transport

- **Preconditions**: A custom provider/model id absent from the models.dev catalog,
  discovery data that incorrectly labels it `vision`, no explicit
  `supportsImages` binding override, and a pasted PNG.
- **Steps**:
  1. Refresh the provider model list and select the discovered custom id.
  2. Paste the PNG and inspect the model picker and Composer image chip.
  3. Send the prompt and inspect the sidecar/provider payload.
- **Expected**:
  - The unknown model is runnable as a generic text model but is not promoted
    to `vision` by discovery/cache metadata.
  - Composer keeps the image chip without rendering a model-dependent status
    message, and the provider receives no image block or base64 value; the safe
    file path remains available.
  - The durable attachment ref is still recorded so a later known vision model
    can replay the image correctly.
- **Specs linked**: `03-runtime/11-provider-model-system.md` §6.2/§11,
  `03-runtime/13-model-catalog-and-selection.md` §11.2,
  `04-ux/08-component-spec.md` §11.8, ADR 0101, ADR 0218
- **Acceptance**: B (model config), C (conversation & stream), E (tools &
  permissions), Security
- **Milestone**: M5
- **Status**: Unit-covered (`model-capabilities.test.ts`); provider/UI journey
  Draft (run only in a capable environment when this surface changes)

#### E2E-102f: Oversized image references do not block session startup

- **Preconditions**: A project contains an image larger than the 10 MB inline
  bound; a known vision-capable model is selected; the session has a valid
  provider and workspace.
- **Steps**: 1. Reference the oversized image from the Composer and send a
  prompt. 2. Observe the turn lifecycle while the attachment is prepared. 3.
  Dispose/recreate the runtime and send a follow-up about the image. 4. Inspect
  the session transcript, the content-addressed attachment blob, and the
  session `replayed/` path.
- **Expected**: The session accepts the prompt and reaches the provider without
  hanging the Electron main process or crashing the sidecar. Main hashes and
  copies the image without constructing a whole-file in-memory buffer. The
  provider receives the safe `@path` fallback rather than an oversized image
  block/base64 payload. Runtime recreation copies the stored blob into the
  scratch fallback path without reading the whole blob into memory. The durable
  message retains only attachment metadata and the content-addressed ref.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §5.1,
  `03-runtime/02-agent-runtime.md` §5, `03-runtime/04-data-storage.md`,
  ADR 0101
- **Acceptance**: C (conversation & stream), E (tools & permissions),
  F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered; full UI journey Draft (run only in a capable environment when this surface changes)

#### E2E-102g: Large text paste becomes an inline session-scratch reference

- **Preconditions**: The app is running with an Agent session in a project and
  a home composer available. The large paste threshold is first left at its
  default, then changed to a small test value. Record the app data directory,
  session id, and a multiline Unicode text fixture.
- **Steps**:
  1. Open Settings → Conversation → Input & links and confirm the large paste threshold is
     600. Set it to a deterministic lower value, save it, then return to the
     composer.
  2. Paste text exactly at the threshold and confirm native textarea behavior;
     paste text one character above it at the beginning, middle, and end of
     drafts, including multiline and Unicode content.
  3. Inspect the draft after each oversized paste: confirm the exact prefix and
     suffix remain, a generated `pasted-text-*.txt` chip appears at the original
     selection, the editor does not contain the scratch absolute path, and the
     composer reports its busy/error state correctly during the transfer.
  4. Click the generated TXT chip and repeat with keyboard focus plus Enter and
     Space. Confirm the exact UTF-8 contents replace the chip at its position,
     the text is editable, the caret lands after it, and subsequent send uses
     the edited text. While a read is pending, switch drafts or remove the chip
     and confirm a stale response does not change the current draft.
  5. Inspect the session `scratch/<sessionId>/pasted/` file bytes, send a mixed
     draft that still contains a chip, and inspect the renderer request,
     persisted user message, and agent-readable path. Switch projects and
     sessions before sending a cached draft, then remove the chip and confirm it
     is no longer dispatched.
  6. Delete the owning session and confirm its temporary paste files are
     removed.
- **Expected**:
  - The threshold is persisted as an AI default, defaults to 600 on older
    settings, and accepts only integer values from 1 through 1,000,000.
  - Text at or below the threshold remains native. Text above it is saved
    byte-for-byte as UTF-8 `text/plain` under the owning session's scratch
    `pasted/` directory, without changing the project or creating an artifact.
  - The sentinel-backed TXT chip is inserted at the exact paste selection,
    including in the middle of a multiline draft. Clicking or pressing Enter /
    Space expands it to editable exact text and removes its reference; edits
    made afterward are what dispatch sends. A failed, binary, image, or
    oversized read leaves the chip and mapping intact.
  - Any remaining chip is resolved to its canonical path in place exactly once;
    it is neither appended as a basename nor duplicated as an attachment.
    Removing the chip removes that mapping.
  - Session switching, project switching, unanswered Stop restoration, and
    session deletion respect the existing session ownership and cleanup rules.
- **Specs linked**: `04-ux/06-settings-ia.md`,
  `04-ux/07-ui-design-system.md` §8.1, `04-ux/08-component-spec.md` §11.7–11.8,
  `04-ux/09-interaction-patterns.md` §8a,
  `03-runtime/01-ipc-protocol.md` §8,
  `03-runtime/04-data-storage.md` §7, `08-meta/decisions-log.md` (D262),
  ADR 0059, ADR 0070, ADR 0131
- **Acceptance**: C (conversation & stream), E (tools & permissions),
  F (persistence), Quality
- **Milestone**: M5
- **Status**: Unit-covered (`composer-trigger.test.ts`,
  `apps/desktop/test/composer-paste-files.test.mjs`); full UI journey Draft
  (run only in a capable environment when this surface changes)

#### E2E-103: Settings Agent pages manage file-backed capabilities

- **Preconditions**: The app is running with two registered projects, A and B,
  and an Agent session available in each. The fixtures use only
  `~/.agents/skills`, `~/.agents/servers`, `~/.agents/subagents`, and the two
  projects' `.agents` directories; no `.pi` capability directory exists.
- **Steps**:
  1. Open Settings > Agent and verify Skills, MCP, and Subagents are three
     independent navigation destinations. Open Extensions and verify that only
     Installed and Marketplace tabs are present.
  2. Open Skills. Confirm one toolbar sits above one panel, the panel shows a
     global group header rooted at `~/.agents/skills` and a project group header
     rooted at project A's `.agents/skills`, both flow in one column at natural
     page height, and the project picker changes the selected project. Confirm
     the Skills toolbar has the same single primary action shape as MCP, with
     the concise New label; the level-specific Import action is available in
     each Skills group header.
     On first paint confirm skeleton rows appear; on a later refresh confirm
     the rows already on screen stay and the list dims instead.
  3. Exercise the level filter and the search field. Confirm All / Global /
     Project carry counts that agree with the rendered rows, that selecting a
     level hides the other group without hiding the toolbar or its actions, that
     search narrows both groups and its counts, that clearing the search
     restores every row, and that a search with no matches reports it and
     suggests widening the filter.
  4. Toggle a global skill off while project A is selected. Confirm the switch
     flips immediately without the list reverting to skeletons, the row is
     dimmed, a toast names the skill, every other row stays interactive while
     the request is in flight, and the global document remains unchanged. Switch
     to project B and confirm the global skill remains enabled there. Force a
     host rejection and confirm the switch returns to its previous position.
  5. Create a skill from the page. With the filter on Global confirm the primary
     action names the global destination and the new document lands in
     `~/.agents/skills`; with the filter on Project confirm it names the project
     and lands in project A. With Project selected and no project chosen,
     confirm the attempt reports it instead of failing silently. Edit the new
     skill, save, and confirm the body round-trips.
  6. From a project skill's overflow menu choose Reveal and confirm the project
     file is revealed, not a global file of the same id. Choose Remove and
     confirm the first press only arms and relabels the item, the second press
     deletes, and dismissing the menu disarms it.
  7. Put a same-name project skill in A and disable it. Confirm the effective
     runtime catalog does not fall back to the global skill; the project record
     shadows first and filtering happens second.
  8. Use the Import action to choose exactly one Markdown file. Confirm it is
     physically copied to the level the filter points at, appears immediately,
     and a second file cannot be selected in the same picker invocation.
  9. Open MCP. Add a project server and a global server, edit the project server,
     and test an existing connection from the row's overflow menu. Confirm the
     modal locks the id while editing, rejects a same-level duplicate id or
     label, and reports ready or failed through the row badge and a toast.
     Delete a server through the same two-press menu action and confirm its file
     is gone.
  10. Delete a skill or MCP file outside the app, reload its page, and confirm the
      row disappears and its local state has no orphaned entry. Confirm deleting
      a global file also removes its project overrides.
  11. Open Subagents. Confirm it is one global-only panel rooted at
      `~/.agents/subagents`, with no level filter, no project picker, and no
      project-level controls. Confirm a Built-in group lists the five shipped
      defaults (`explorer`, `code-reviewer`, `test-runner`, `fixer`,
      `ui-designer`) even when the user directory is empty, each with a
      Built-in badge, its tool grant, and an enablement switch, but no reveal
      or delete. Confirm the Global group header carries the global level label
      and item count, that create/edit/delete/reveal all work from the page
      for user-owned rows, that leaving the output limit empty writes a
      definition with no `maxTokens`, and that an empty user
      directory still resolves `settings.subagentsEmpty` to localized
      empty-state copy under the Global group rather than displaying a raw
      translation key. Open New subagent and confirm the
      Model field is a select of the same configured, runnable models as the
      Composer, grouped by provider, with an inherit-session option, not a
      free-typed `provider/model` input. Pin a configured model, save, and
      confirm the document's `model:` frontmatter is `vendorKey-or-name/modelId`.
      When two configured providers share a generic or vendor key, confirm each
      provider remains a separate group and its model pin uses a unique display
      name (or provider id when the names also collide).
      Edit a definition whose pin is no longer configured and confirm that pin
      remains selected instead of snapping to inherit.
  12. Narrow the window to the toolbar's stacking breakpoint. Confirm the
      segmented control spans the width, search moves below it, actions wrap
      left-aligned, group headers drop the resolved path, and the page gains no
      horizontal overflow. With a pointer that cannot hover, confirm the row's
      edit and overflow controls are visible without hovering.
- **Expected**:
  - The three Settings pages use no tabs for switching capabilities, flow at
    natural page height for empty and populated states, support dark and light
    themes, and begin with quiet page-specific descriptions plus
    project-over-global scope copy where relevant. Each page is one toolbar
    above one panel: the toolbar carries the level filter with live counts, one
    search field with a clear affordance, the project picker, and the primary
    actions; the panel divides levels with group headers naming the level, its
    resolved `.agents` path, and a localized count. Rows use quiet capability
    icons, a level badge plus localized source/transport badges, descriptions,
    and persistent enablement switches; edit and the overflow menu stay quiet
    until the row is hovered, focused, or has its menu open, and are always
    visible where hover is unavailable. Skeleton rows appear on first paint
    only, later refreshes dim the rows already on screen and announce the
    refresh, busy state is confined to the row with the in-flight request, and
    counts are exposed to assistive technology. Empty states stay centered
    inside the panel without a decorative frame, show a host Lucide icon in a
    chip wrapper (not a padded raw SVG), and offer the page's primary
    action, and no capability-specific color system is introduced.
  - Create, edit, and delete are available for all three capabilities without
    leaving Settings. New capabilities land at the level the filter points at,
    destructive actions require two presses of the same relabelled menu item,
    and revealing a project-level skill opens that project's file rather than a
    global file sharing its id. The Subagents editor Model field is a grouped
    select of configured runnable models plus inherit-session, not a free-typed
    id; saving writes `vendorKey-or-name/modelId` (using a unique provider name
    or id when aliases collide), and an unconfigured existing pin remains
    selected. The Advanced disclosure also carries the delegate's own output
    limit: it starts empty, shows the model-default
    placeholder rather than an unlimited one, and a value round-trips through
    the document's `maxTokens` frontmatter and back into the field — while
    clearing it removes the key so the delegate follows the model again.
  - Capability files contain configuration/frontmatter only; enablement is
    persisted in the app-local `agent-capabilities` state files.
  - Project records shadow global records by id or name even when disabled,
    and the next runtime activation reflects the same result as the UI.
  - Physical import is single-file and level-specific, and disk deletion is
    removed by scanning rather than represented as a pending row.
- **Specs linked**: `03-runtime/01-ipc-protocol.md` §12a–§12d,
  `03-runtime/02-agent-runtime.md` §5f,
  `03-runtime/13-model-catalog-and-selection.md` §2 (Subagent editor),
  `04-ux/01-ui-ia.md` §3.4–§3.5,
  `04-ux/06-settings-ia.md` §2 (Agent capability destinations), §4.21–§4.25,
  `07-plugins/01-plugin-system.md` §12.2–§12.3,
  `08-meta/decisions-log.md` (D193, D194, D202, D257), ADR 0112, ADR 0126
- **Acceptance**: D (workspace), E (tools & permissions), F (persistence),
  Quality
- **Milestone**: M6+
- **Status**: Source/unit covered by
  `apps/desktop/test/agent-capability-settings.test.mjs`,
  `apps/desktop/test/extensions-page.test.mjs`,
  `apps/desktop/test/subagent-models.test.mjs`,
  `apps/desktop/test/subagent-output-limit.test.mjs` (the output cap's path from
  the editor draft through host-core to the built delegate model), and host-core
  capability tests;
  full native-picker, rendered modal, project-switch, and runtime journey remain
  Draft (run only in a capable environment when this surface changes)

#### E2E-CAPABILITY-move-across-levels: MCP servers and skills move between the global and project `.agents` levels

- **Preconditions**: The app runs against a disposable global `.agents` root
  (an isolated HOME, or `PI_DESKTOP_AGENTS_DIR` when the bare host is driven
  directly). Projects A and B are registered. The global root owns
  `~/.agents/servers/echo.json` (id `echo`, label `Echo`),
  `~/.agents/skills/review.md` (frontmatter name `Review`), and nothing else
  that uses the names used below. Project A owns no `echo` server and no
  `review` skill, and owns `<project A>/.agents/skills/with-resources/` holding
  `SKILL.md` plus `scripts/run.sh` and `templates/report.md`. The MCP and
  Skills pages show the project picker described in the Settings IA spec.
- **Steps**:
  1. Open Settings > Agent > MCP with project A selected. Disable the global
     `echo` row, then choose Move into A. Confirm the row leaves the global
     group, appears under project A, and stays disabled there.
  2. Confirm `~/.agents/servers/echo.json` no longer exists and
     `<project A>/.agents/servers/echo.json` does, byte-identical. Read
     `<data>/agent-capabilities/mcp.json` and confirm it holds no global `echo`
     entry and no project-A override for the old id, and that project A's entry
     carries the disabled value.
  3. Create a new global `echo` server again (id `echo`, label `Echo`). With
     project A selected choose Move into A and confirm the arriving row is
     `echo-2` with label `Echo (2)`, that project A's original `echo.json` is
     byte-identical to before the move, and that both project rows list.
  4. Open Skills with project A selected. Create a project `review.md` whose
     frontmatter carries `name: Review`, a description, and an extra custom
     field, plus a body; disable it, then choose Move to Global. Confirm it
     appears globally as `review-2`, arrives disabled, and leaves the global
     `review.md` unchanged.
  5. Diff the moved document against the project original: only the frontmatter
     `name` line differs (`name: Review (2)`); the description, the custom
     field, blank lines, line endings, and every body byte are identical.
  6. Move project A's `with-resources` skill to Global. Confirm
     `<project A>/.agents/skills/with-resources/` is gone and
     `~/.agents/skills/with-resources/` holds `SKILL.md`, `scripts/run.sh`, and
     `templates/report.md` with identical bytes, and that the Skill tool still
     resolves the document's resources.
  7. Reload the global and project pages. Confirm the moved rows keep the
     enablement they had across the reload, that project B lists none of the
     project-A capabilities, and that the moved global `review-2` applies to
     project B with the value it had after the move.
  8. Clear the project selection in the toolbar. Confirm Move into <project> is
     no longer offered on the remaining global rows and the project group asks
     for a project selection instead; re-select project B and confirm the
     action returns.
  9. Drive `mcp.transfer` and `skills.transfer` with `from` and `to` naming the
     same directory and confirm the response returns the current record and
     neither directory changes.
- **Expected**:
  - A move relocates the document: the destination directory gains the file,
    the source level stops listing the entry, and no copy is left behind.
  - Enablement follows the document. A global row disabled for project A
    arrives in project A disabled; a project row arrives globally with its
    visible value as the new global default. The source level keeps no state
    entry — including project overrides — for the old id.
  - A destination collision is resolved by renaming only the colliding name:
    an id collision gives the arriving id a `-2`/`-3` suffix, a case-insensitive
    display-name / label collision gives the display name a ` (2)`/` (3)`
    suffix, and the existing entry is never overwritten or merged. Renaming a
    skill rewrites only the frontmatter `name` line and preserves every other
    byte.
  - A directory-shaped skill moves as one unit with its sibling resources, and
    a transfer whose two targets name the same directory is a no-op.
  - Without a selected project the move action is unavailable with an explicit
    explanation, and no capability file or state entry changes.
- **Specs linked**: `03-runtime/06-host-rpc-protocol.md` §4 (Agent
  capabilities), `03-runtime/01-ipc-protocol.md` §12a–§12b,
  `04-ux/06-settings-ia.md` §2 (Agent capability destinations), ADR 0112,
  ADR 0269
- **Acceptance**: E (tools & permissions), F (persistence), Quality
- **Milestone**: M6+
- **Status**: Host-covered (`pnpm test:e2e:capability-move` drives the same RPC
  surface Electron main calls against a real host-core and an isolated global
  root, asserting the documents and the state file on disk; host-core
  registry/state tests cover the rename, the id the scan derives, and directory
  resources; the source contract is pinned by
  `apps/desktop/test/agent-capability-settings.test.mjs`). The rendered Settings
  journey — row menu, toggle, toast — remains Draft.

#### E2E-120: Global plugin launch, next-turn editing, and stopped throughput

- **Preconditions**: Install and enable a panel plugin whose Chinese display
  name is `无限画布`, plus a second panel plugin (for example `邮件助手`).
  Configure a provider that streams slowly enough to stop a partial answer. Run
  once on macOS and once on Windows.
- **Steps**:
  1. Immediately after PI-Desktop finishes booting, leave it unfocused and press
     Option+Space on macOS or Alt+Space on Windows while another application
     owns the foreground window. Confirm the first invocation promptly reveals
     a fully rendered, centered launcher on the pointer's display without a
     blank initialization frame, native close, minimize, maximize, resize, or
     taskbar controls. Confirm Windows does not show the active application's
     system menu.
  2. Search separately for `无限`, `wuxianhuabu`, and `wxhb`. Use Up/Down and
     Enter for one run and click for another; confirm the existing plugin panel
     opens. Confirm Chinese IME candidate Enter does not open a result.
  3. Open the launcher again with an empty query and confirm the plugin opened
     in step 2 is the first result. Open the other panel plugin, then reopen
     the launcher and confirm the two plugins appear in reverse opening order.
     Restart the application and confirm the same most-recently-used order
     survives the restart.
  4. Start an Agent answer. While it streams, type the next draft and change
     Thinking, permission mode, and Agent/Plan/Goal. Confirm every selection is
     editable, Stop remains present, and Send cannot dispatch.
  5. Stop after partial output. Confirm the partial answer remains, the queued
     configuration becomes durable only after termination, and the next turn
     uses the final selection rather than any intermediate selection.
  6. Inspect the stopped answer's conversation statistics, reload the session,
     and inspect again.
- **Expected**:
  - Early warm-up starts before backend boot completes and removes BrowserWindow
    and renderer loading from the first shortcut's visible path. On macOS the
    panel is activated once without a second app/window-stack hop, so the reveal
    does not visibly stutter. Launcher search returns only enabled, ready panel
    plugins and every invocation starts with an empty, focused query ordered by
    most-recently-used history across restarts; typing a query still ranks
    relevance first. Escape and focus loss hide it without closing the main
    application.
  - No running turn observes the staged mode/model/thinking/permission change,
    and a second prompt cannot be sent concurrently.
  - Changing Thinking during a stream keeps the selected model's enabled levels
    visible. The submenu never collapses to Off-only, including for unpinned
    sessions that inherit the app default model.
  - Stopped throughput is present before and after reload. It uses exact output
    usage when the provider supplied it; otherwise the UI labels the persisted
    four-code-point estimate as approximate.
  - Completed-response throughput uses pi-ai 1.1.0's monotonic request duration;
    stopped partial responses retain the sidecar duration fallback.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`,
  `03-runtime/02-agent-runtime.md` §5b/§9,
  `04-ux/07-ui-design-system.md` §8.2–8.3,
  `04-ux/08-component-spec.md` §11,
  `04-ux/09-interaction-patterns.md` §1/§3, D211, D212, D219, ADR 0072,
  ADR 0073
- **Acceptance**: C (conversation & stream), F (persistence), G (plugins),
  Quality
- **Milestone**: M6
- **Status**: Unit/source-contract covered; full cross-platform UI journey Draft
  (run only in a capable environment when this surface changes)

#### E2E-121: Goal approval resumes autonomous acceptance-criteria execution

- **Preconditions**: A project-bound session has a configured provider and is
  idle in Agent mode; the workspace permits host artifact creation and has no
  prior test goal artifact.
- **Steps**: 1) Switch the session to Goal and let the Agent call
  `EnterGoalMode`, then `SubmitGoal(title, markdown, question)`. 2) Inspect the
  exact Markdown bytes in the new `.pi/goal/*.md` artifact and the matching
  `plan_approvals` row. 3) Confirm the shared approval card exposes only
  Approve/Reject and that Goal denies Write/Edit/plugin tools while Bash follows
  the selected permission mode. 4) Approve with Ask and observe the same Agent
  resume in Agent mode. 5) Inspect the final response for criterion-by-criterion
  verification or an explicit boundary, then reload the session.
- **Expected**: Goal uses the Plan approval pipeline without a second planner;
  the artifact is immutable and the row records `kind = goal`, path, hash,
  size, and execution state. Approval is a separate user decision, transitions
  the session to Agent, and starts autonomous work only after approval. The
  transcript remains reviewable after reload and no scheduled/unattended Goal
  run can bypass the approval boundary.
- **Specs linked**: `03-runtime/02-agent-runtime.md`,
  `03-runtime/03-tools-and-permissions.md`, `03-runtime/04-data-storage.md`,
  `03-runtime/06-host-rpc-protocol.md`, `03-runtime/10-session-state-machine.md`,
  `04-ux/01-ui-ia.md`, `04-ux/08-component-spec.md`, D198
- **Acceptance**: C (conversation & stream), E (tools & permissions),
  F (persistence), H (diagnostics), Security
- **Milestone**: M6+
- **Status**: Unit/source-contract covered (`packages/agent-runtime` and
  host-core Goal tests); full UI journey Draft (run only in a capable environment when this surface changes)

#### E2E-122: Plugins request and deliver native notifications

- **Preconditions**: An installed plugin declares and is granted `notify`; the
  desktop platform supports Electron native notifications; the OS notification
  permission is in its initial or previously denied state.
- **Steps**: 1) From the plugin process, call
  `getNotificationPermission()`. 2) Call `requestNotificationPermission()` and
  observe the native permission/probe result. 3) Call
  `showNativeNotification({ title, body })`. 4) Repeat with a plugin that lacks
  `notify`, and on a platform where native notifications are unsupported.
- **Expected**: The first status is `unknown`, `denied`, or `unsupported`; the request
  returns a best-effort `granted`, `denied`, or `unsupported` result; a granted
  plugin receives `{ shown: true, permission: "granted" }` for native delivery,
  while denied/unsupported delivery returns `shown: false` without crashing the
  plugin. Missing `notify` fails with `PERMISSION_DENIED`. Clicking a delivered
  native plugin notification restores and focuses the main window, but native
  plugin notifications do not add durable task inbox rows or activate a chat
  session.
- **Specs linked**: `07-plugins/01-plugin-system.md`,
  `07-plugins/03-plugin-api.md`, `07-plugins/13-plugin-permissions-matrix.md`,
  ADR 0074
- **Acceptance**: E (tools & permissions), G (plugins), Security, Quality
- **Milestone**: M6+
- **Status**: Unit/source-contract covered; full cross-platform OS permission
  journey Draft (run only in a capable environment when this surface changes)

#### E2E-148: Plugin settings and local shortcuts are editable

- **Preconditions**: An enabled plugin declares string, boolean, JSON, and
  `shortcut` settings; the shortcut points to a declared plugin command.
- **Steps**: 1) Open Plugins and open the plugin settings surface. 2) Change a
  normal field and the shortcut, then save. 3) Reload the plugin list and press
  the new shortcut while the app window is focused. 4) Try a reserved app
  shortcut and repeat with the plugin scoped away from the current project.
- **Expected**: Controls are generated from the manifest, values persist in the
  plugin-private settings file, and `plugin:settingsChanged` is delivered. The
  new shortcut invokes the plugin command only in the focused app window and
  matching activation scope. Reserved/conflicting bindings are rejected; no OS
  global shortcut is registered.
- **Specs linked**: `07-plugins/02-plugin-manifest-schema.md`,
  `07-plugins/03-plugin-api.md`, `07-plugins/11-plugin-storage-isolation.md`,
  ADR 0159
- **Acceptance**: F (persistence), G (plugins), Security, Quality
- **Milestone**: M6+
- **Status**: Source-contract and focused integration coverage; full desktop
  journey Draft (run only in a capable environment when this surface changes)

#### E2E-OAUTH-anthropic-rate-limit-retry: Bounded token retries preserve the account

- **Preconditions**: A local HTTP fixture intercepts only Anthropic's token URL;
  the production pi-ai flow and Desktop `VendorOAuth` run with an in-memory Host
  RPC fixture. No real account, browser authorization or remote endpoint is used.
- **Steps**: Run `pnpm test:e2e:oauth-retry`. Exercise exchange and refresh
  429 → success, repeated 429, seconds/date/malformed/over-budget `Retry-After`,
  invalid grants (including after 429), 5xx, socket disconnect, invalid success
  JSON, cancellation during request/body/wait, and an earlier caller deadline.
  Resolve the same account concurrently and retry after a failed refresh.
- **Expected**: At most three requests share one deadline and original signal;
  no retry precedes a server hint. Only explicit 429 is retried; grant rejection
  and ambiguous failures stop. Request grant fields and custom headers remain
  unchanged. Failed refresh retains the old credential and releases its lock;
  concurrent resolves rotate/write once. Failed/cancelled login removes only
  its newly created row. HTTP/token-JSON errors contain no token-body canary, URL
  or embedded stack and provide recovery guidance without claiming every 429
  consumes code. Existing network-error diagnostics are unchanged.
- **Specs linked**: `03-runtime/11-provider-model-system.md` §8a; ADR 0095.
- **Acceptance**: B (vendor accounts), Security, Quality.
- **Status**: All 20 local HTTP scenarios passed against the installed patch;
  the existing 20 login/session regressions also passed. This is a pre-merge
  transport and orchestration integration test, not live OAuth, visual UI or
  Host persistence validation. Post-integration main E2E is NOT RUN.

#### E2E-OAUTH-anthropic-copy-code: Anthropic copy-code login uses the existing prompt bridge

- **Preconditions**: A local token-endpoint fixture intercepts only Anthropic's
  OAuth token URL. The production pi-ai Anthropic flow and Desktop `VendorOAuth`
  use an in-memory Host RPC fixture. No real account or remote endpoint is used.
- **Steps**: Start an Anthropic vendor login; choose `copy_code` from the
  `select` prompt; inspect the generated authorization URL; provide a synthetic
  `code#state` to the manual-code prompt; finish token exchange against the
  fixture; resolve request auth and inspect the stored Host credential.
- **Expected**: The select options retain `browser` and `copy_code`; the
  authorization URL uses `https://platform.claude.com/oauth/code/callback`;
  the token exchange succeeds; refresh credentials stay under the
  provider-scoped Host OAuth reference and only the short-lived access token is
  returned to runtime auth. No API-key secret is created.
- **Specs linked**: `03-runtime/14-secrets-storage.md` §10; `07-plugins/16-trusted-extensions.md` §4.
- **Acceptance**: B (vendor accounts), Security, Quality.
- **Status**: Local provider-flow integration fixture; no live account or visual
  renderer validation.

#### E2E-151: Multiple vendor accounts stay isolated through login, use, and removal

- **Preconditions**: A build with `registerBunOAuthFlows()` running at startup
  and a real subscription for at least one PKCE vendor (Anthropic) and one
  device-code vendor (xAI, GitHub Copilot, or Meta/Muse). No provider row exists yet for
  either vendor.
- **Steps**: 1) Open Settings -> Model configuration, confirm the Vendor
  accounts card starts empty, and open Add account — the picker lists every
  `models.getProviders().filter(p => p.auth.oauth)` vendor, including vendors
  with existing accounts; when accounts exist, confirm their rows use the same
  single-level list surface as AI services and that Add account matches the
  primary button treatment of Add provider. 2) Pick Anthropic and complete
  the browser login;
  confirm one connected account row and one OAuth provider row appear. 3) Use
  Add account again, pick Anthropic again, and complete a second login with a
  different account; confirm two account rows and two provider ids. 4) Edit
  the first account, change its display name, select multiple catalog/custom
  models, configure context window, max output tokens, and thinking levels for
  one model, then save; confirm the row shows the account label once while the
  Defaults selector reflects the edited model and each option shows only one provider name,
  without an appended account label or model ID. Before saving, focus the
  default-model field and confirm the authenticated suggestions open as an
  app-styled list with aligned model IDs/display names, that typing filters it,
  ArrowDown/ArrowUp plus Enter selects an option, Escape closes it, and the
  fixed list is portaled above the dialog without changing dialog height or
  being clipped by the dialog's overflow. Confirm a custom model ID can still
  be entered. Press Test connection and confirm the result resolves the edited
  account. Open the Composer model menu and confirm the edited account label is
  used as the OAuth provider group heading, while the configured model alias is
  shown on its model row. With both Anthropic accounts configured, open the
  Defaults picker and confirm the one provider name each group shows is that
  account's own label, so the two accounts are not two identical `Anthropic`
  groups, that the summary line above the Change action names the account
  holding the current default, and that typing an account label filters to that
  account's models while typing the vendor name still reaches both. Repeat the
  5) Resolve and use each account separately, including model discovery and one streamed
  turn per account. 6) Start the device-code login on a second vendor, including
  Meta/Muse when available, then press Cancel while the dialog is polling;
  confirm no row or credential is left. 7) Remove the first Anthropic account,
  then confirm its provider row and OAuth secret are gone while the second
  Anthropic account remains usable. 8) If the removed account was default,
  confirm Defaults points to another ready provider or shows no default. 9) Grep
  sidecar and renderer logs for token material.
- **Expected**: Each successful login creates a distinct row with
  `authKind: "oauth"`, `hasSecret` and `hasOauth` both true, a non-secret
  account label, and `baseUrl`/`apiStyle`/`defaultModelId` filled from that
  account's own catalog. Each row has its own
  `secret:provider:<providerId>:oauth` ref and row-scoped pi-ai collection;
  resolving one account never returns the other account's token. The model list
  is the authenticated catalog (a Copilot account lists only what its
  subscription includes; a Meta account lists Muse Spark models), not a
  `/models` probe. Matching models.dev metadata supplies each newly logged-in
  binding's limits, modalities, and thinking levels; an ID missing from
  models.dev uses the conservative generic text-only/non-reasoning shape.
  label/model fields and the full per-model bindings, and Test connection
  resolves that exact account. Both turns run without a
  pasted key and reuse the same warm runtime — the launch payload carries
  `apiKey: ""` and each request resolves auth through `provider.resolveAuth`,
  which Electron main answers locally and refuses with `PROVIDER_NOT_BOUND` for
  an unbound provider id. Cancel aborts the local callback server /
  device-code polling and leaves no row and no credential. The connection test
  proves the account by resolving auth rather than probing with a key. Remove
  account delegates to `providers.delete`, clearing both secret refs and
  metadata for exactly that row. No log, event, or IPC payload contains an
  access token, refresh token, or authorization code.
- **Specs linked**: `03-runtime/11-provider-model-system.md` §8a,
  `03-runtime/12-provider-config-schema.md` §3,
  `03-runtime/14-secrets-storage.md` §10,
  `03-runtime/01-ipc-protocol.md` §8, `04-ux/06-settings-ia.md`,
  `08-meta/decisions-log.md` (D237/D240), ADR 0095, ADR 0098
- **Acceptance**: B (model config), C (conversation & stream), F (persistence),
  Security, Quality
- **Milestone**: M6+
- **Status**: Unit coverage in `packages/agent-runtime` (auth resolution and
  runtime reuse) and host-core secret-ref tests; full desktop journey Draft and
  needs live vendor accounts (run only in a capable environment when this surface changes)

#### E2E-197: GitHub Copilot accepts the default Enterprise domain

- **Preconditions**: A build with the GitHub Copilot OAuth flow registered;
  the device-code login can reach the GitHub endpoint.
- **Steps**: 1) Open Settings -> Model configuration -> Add account and choose
  GitHub Copilot. 2) Leave the Enterprise URL/domain field empty. 3) Confirm
  Continue is enabled and submit the empty value. 4) Complete the device-code
  login and inspect the resulting account row.
- **Expected**: The empty text prompt is submitted as an empty string, the
  provider uses github.com, and the device-code flow completes normally. Secret
  and manual-code prompts remain disabled while empty. No OAuth token or device
  credential is rendered or logged.
- **Specs linked**: `04-ux/06-settings-ia.md`,
  `04-ux/08-component-spec.md` §19, `03-runtime/12-provider-config-schema.md`
  §3, `08-meta/decisions-log.md` (D237/D240)
- **Acceptance**: B (model config), Security, Quality
- **Milestone**: M6+
- **Status**: Unit-covered (`apps/desktop/test/oauth-login-prompt.test.mjs`);
  live device-code journey Draft (run only in a capable environment when this surface changes)

#### E2E-152: A plugin contributes a work panel view

- **Preconditions**: A development plugin declaring `ui.view` and one
  `contributes.views` entry whose `entry` is a small HTML page calling
  `window.pluginBridge.invoke("ui.showToast", …)`. Two projects open, with the
  plugin's activation scope limited to the first.
- **Steps**:
  1. Load the plugin as a development plugin. Confirm the Plugins page shows a
     work-panel-views capability badge.
  2. Press `Cmd/Ctrl + J` to reveal the work panel, then click `+` to create a
     New launcher tab. Confirm the fixed `+` trigger, the maximize control, and
     the viewport-fixed work-panel toggle resolve to one button group — one
     4px control gap, no divider between maximize and the toggle — while the
     `+` trigger and the toggle stay separate, non-overlapping hit regions with
     more than 24px of visual gap. Confirm the launcher lists the built-in
     Review row and the plugin view's localized title and icon (or a lettered
     tile if the manifest names an unknown token).
  3. Activate the plugin row. Confirm the plugin's page renders inside the panel body
     with no window-control capsule and no reserved 46px band, and that its
     button reaches the host toast.
  4. Drag the inner panel divider and resize the conversation area. Confirm
     the page tracks the panel rect without lag or tearing, then drag the outer
     right window edge and confirm the panel width changes while the base chat
     width stays fixed.
  5. Open global search, then Settings. Confirm the page is hidden while each
     overlay is up and returns when it closes.
  6. Click `+` again, then choose the same view from the new launcher. Confirm
     it returns to the live page — same scroll position, no reload — rather than
     stacking a second tab.
  7. Switch to the second project. Confirm the view disappears from the New
     launcher and from the no-tab entry list.
  8. Switch back, reopen the view, then disable the plugin. Confirm the tab
     closes and the view's renderer process exits (Activity Monitor / Task
     Manager).
  9. Re-enable, reopen, then edit the plugin's HTML on disk to trigger a
     development reload. Confirm the view reloads rather than going blank.
- **Expected**: A plugin view is reachable, isolated, correctly positioned, and
  bounded by the plugin's lifecycle and activation scope. The panel remains an
  in-flow internal column; its renderer-owned divider resizes the panel and
  native window edges never change that target. It never renders while a
  blocking overlay is open, and it never obtains window controls.
- **Specs linked**: `07-plugins/02-plugin-manifest-schema.md` §4/§5,
  `07-plugins/13-plugin-permissions-matrix.md` §2,
  `04-ux/08-component-spec.md` §5, ADR 0104, ADR 0092
- **Acceptance**: G (plugins), Security, Quality
- **Milestone**: M6+
- **Status**: Unit coverage in
  `apps/desktop/test/plugin-work-panel-views.test.mjs` (addressing, launcher
  grouping, isolation parity, scope filtering, lifecycle teardown),
  `packages/plugin-sdk` and host-core manifest validation; the desktop journey
  is Draft (run only in a capable environment when this surface changes)

#### E2E-153: The vendored file manager replaces the built-in Files tool

- **Preconditions**: A packaged build (so `resources/plugins` is copied outside
  the asar) and a project with nested directories, a `node_modules`, a `.env`,
  a binary file, an image, a CSV, and a Markdown file. The project is a group
  whose second folder is registered as another root (ADR 0249).
- **Steps**:
  1. Open the Plugins page. Confirm **File Manager** is listed as a bundled
     plugin, enabled, showing a work-panel-views capability, and that it offers
     no Uninstall action.
  2. Reveal the work panel and click `+` to create a New launcher tab. Confirm
     its rows include Review and the plugin-contributed File Manager and Browser
     views. Trigger an agent edit and confirm the panel does not open itself:
     Review appears under Open resources only after the user selects its row.
  3. Open the File Manager view. Confirm the tree lists the project, expands
     directories lazily, and omits `node_modules`, `.git`, and `.env`. Switch
     the view's top-left folder control to the project's second folder and
     confirm the tree follows it while the app's visible workspace does not,
     then switch back to the project's primary folder.
  4. Right-click an HTML file and confirm **Open in built-in Browser** appears
     under Open With. Select it and verify a new Browser resource tab opens the
     file in the active local session while the File Manager tab remains open.
     Right-click a non-HTML file and confirm that item is absent. Confirm
     **Open with default app** and **Show in folder** remain available for files
     and work. For directories, confirm the built-in Browser and Show in folder
     actions are absent, the default-app action is disabled, and editor choices
     remain available.
  5. Open a text file, edit it, and save. Confirm the file on disk changed and
     the editor keeps the saved content. In dark appearance, press `Ctrl/Cmd+F`
     and confirm the find text, replace text, and action labels remain readable
     against their themed fields and buttons; repeat after switching to light
     appearance. Change the same file outside the app, edit and save again, and
     confirm the conflict is reported instead of the external change being
     overwritten. Click the binary file and confirm it reports as unsupported
     rather than printing replacement characters; open the image, the CSV, and
     the Markdown file and confirm each gets its own viewer. Switch the app to
     Simplified Chinese and confirm the tree, viewer, and context menu are
     localized. Switch projects and confirm the tree updates without waiting on
     a poll.
  6. Click a project file path in the conversation. Confirm it opens in this
     view on that file — a chat click now prefers the file view over the host
     `file:` tab.
  7. Click a conversation reference to `src/example.ts:42`. Confirm the host
     `file:` tab opens at line 42 even though the File Manager plugin is enabled.
  8. Disable the File Manager plugin. Confirm the view disappears from the menu
     and the panel. Click a project file path in the conversation; the host
     should enable the bundled plugin and open that file in its view.
  9. Restart the app. Confirm the enabled state and the tree return, and that
     the registry did not gain a duplicate row.
- **Expected**: A panel surface runs entirely on the public plugin contribution
  channel, is user-disableable, cannot be uninstalled, and survives restart. Its
  host-mediated actions obey the declared `fs.read` scope, and its own reads and
  writes stay inside the jail of the one project folder it is browsing
  (ADR 0241, ADR 0263). Plain project-file links open in the bundled view,
  bringing it up on demand after a direct click when its scope and permission
  allow it; a positioned `path:line` reference opens the host file tab and
  scrolls the requested line even while the plugin view is available.
- **Specs linked**: `07-plugins/03-plugin-api.md` §3,
  `07-plugins/13-plugin-permissions-matrix.md` §2,
  `04-ux/08-component-spec.md` §5, ADR 0104, ADR 0109, ADR 0111,
  ADR 0169, ADR 0241, ADR 0249, ADR 0263, ADR 0330
- **Acceptance**: G (plugins), D (workspace), Security, Quality
- **Milestone**: M6+
- **Status**: `pnpm test:e2e:file-manager-theme` loads the shipped plugin view
  in Electron, opens a text file through a fixture public bridge, invokes
  `Ctrl/Cmd+F`, and checks the rendered find/replace fields and actions in dark
  and light appearances. `apps/desktop/test/bundled-plugins.test.mjs` also
  covers the manifest contract, public-bridge-only page, vendored checksums,
  and themed CodeMirror controls. `apps/desktop/test/plugin-fs-scope.test.mjs`
  covers `fs.openDefault`, `fs.openInBrowser`, and `fs.reveal` guards;
  `apps/desktop/test/browser-preview-tool.test.mjs` covers Browser resource-tab
  event routing; `apps/desktop/test/plugin-work-panel-views.test.mjs` covers
  docked-view event broadcast; and host-core covers
  `bundled_plugins_refresh_from_disk_but_keep_user_state`. The remaining
  packaged journey is Draft (run only in a capable environment when this
  surface changes).

#### E2E-PLUGIN-file-view-collapse-persists

- **Preconditions**: The bundled File Manager view is open on a project with
  nested folders and a text file, and the work panel is wide enough for the
  two-pane layout.
- **Steps**:
  1. Drag the divider between the file list and the content pane to a
     non-default width, then activate the toolbar's left-most toggle from the
     keyboard alone (Tab to it, then Enter or Space).
  2. Click a file reference in the conversation.
  3. Activate the same toggle again.
  4. Collapse the file list, then close and reopen the view, and finally
     restart the app.
  5. Expand the file list by hand and click another chat file reference.
- **Expected**: The toggle hides the view's own left file list and gives the
  content pane the full width, and it stays keyboard-reachable with an
  accessible name that swaps between `Hide file list` and `Show file list`.
  The open request that follows a chat click shows the requested file with its
  ancestor folders expanded and the file list collapsed, whether the view was
  already open or was opened by that click. Expanding again restores the
  previously dragged split width together with the expanded folders and the
  selected file, not the default split or the project root. The collapsed state
  is persisted: it survives closing and reopening the view and a full app
  restart, and a manual expansion holds until the next host open request
  collapses it again.
- **Specs linked**: `07-plugins/02-plugin-manifest-schema.md` §4/§5,
  `04-ux/08-component-spec.md` §5.2.2, ADR 0104, ADR 0241, ADR 0262
- **Acceptance**: G (plugins), Quality
- **Milestone**: M6+
- **Status**: The bundle's manifest, entry page, and upstream checksum are
  unit-covered (`apps/desktop/test/bundled-plugins.test.mjs`); the plugin-side
  journey is Draft (run only in a capable environment when this surface changes)

#### E2E-PLUGIN-file-view-switches-folder-per-project

- **Preconditions**: A project group whose two folders each hold a text file the
  other folder does not, and a second, single-folder project. The work panel is
  open on the bundled File Manager view, browsing the first project's primary
  folder.
- **Steps**:
  1. Switch the view's top-left folder control to the project's second folder.
     Confirm the tree, the filename search, and open/save all follow it.
  2. Save an edit in the text file only that second folder holds.
  3. Close and reopen the view, then restart the app. Confirm the second folder
     is still the one being browsed.
  4. Switch to the other project and back. Confirm each project remembers its
     own folder.
  5. Click a chat reference that resolves in the project's second folder, then
     one that resolves in its primary folder.
  6. With the second folder selected, search the tree for the primary folder's
     own file name, and try to open a `.env` and a symlink or junction inside
     the second folder that points outside it. 7) With the second folder
     selected, right-click the text file only that folder holds and use **Open
     with default app**, then **Show in folder**; switch to the primary folder
     and do the same for a file only *it* holds. 8) Back in the second folder,
     use the same two actions on a file whose name both folders contain.
- **Expected**:
  - The control lists the project's folders in group order, primary first, and
    names the one being browsed; the tree, search, and editing all work inside
    that one folder, and a single-folder project offers just its one folder.
  - Switching folders changes only what this view browses: the app's visible
    workspace, the agent's tool roots, the session's primary path, project
    instructions, and project memory are all unchanged (ADR 0263).
  - The choice is remembered per project: it survives closing and reopening the
    view and a full app restart, and the other project keeps its own folder.
  - Both chat references open in this view on the file they name — the one from
    the second folder included, in that folder — with no host `file:` tab.
  - The selected folder is the jail, not the group: the filename search does not
    reach a file that only another project folder holds, and the credential path
    and the symlink/junction escape are still refused (ADR 0241).
  - The two system actions reach the file that was clicked, in the folder being
    browsed: a file only the second folder holds opens or reveals its real self
    instead of reporting "not found", and the file whose name both folders share
    opens the second folder's copy, not the primary folder's (ADR 0264).
- **Specs linked**: `07-plugins/03-plugin-api.md` §3,
  `04-ux/08-component-spec.md` §5.2.2, ADR 0241, ADR 0249, ADR 0263, ADR 0264
- **Acceptance**: G (plugins), Security, Quality
- **Milestone**: M6+
- **Status**: The host-side resolution and addressing are unit-covered
  (`apps/desktop/test/chat-ref-resolve.test.mjs`,
  `apps/desktop/test/transcript-file-chips.test.mjs`); the plugin-side journey
  is Draft (run only in a capable environment when this surface changes)

#### E2E-PLUGIN-bundled-plugin-keeps-a-marketplace-update

- **Preconditions**: A build that ships a bundled plugin whose marketplace entry
  offers a newer version, and a data directory the user can install into.
- **Steps**:
  1. Open the Plugins page. Confirm the plugin is listed as bundled and enabled,
     and that it offers no Uninstall action.
  2. Update it from the marketplace. Confirm the row moves to the catalog
     version and still offers no Uninstall action.
  3. Restart the app. Confirm the updated version is still the installed one,
     the plugin is still enabled, and the registry holds exactly one row for it.
  4. Disable the plugin, restart again, and confirm it stays disabled at the
     updated version.
- **Expected**: Bundled means default and non-removable, not frozen. A user's
  update outlives the launch that reconciles the shipped copy, an app that ships
  a strictly newer version still wins, and a catalog version that is not newer
  is never offered as an update.
- **Specs linked**: `07-plugins/07-plugin-marketplace.md`, ADR 0104, ADR 0241
- **Acceptance**: G (plugins), Quality
- **Milestone**: M6+
- **Status**: Unit coverage in host-core
  `a_bundled_plugin_keeps_the_update_the_user_installed`,
  `a_newer_shipped_version_replaces_an_older_user_install`,
  `a_plugin_a_build_stops_shipping_is_no_longer_bundled`, and
  `market_entry_offers_an_update_only_when_the_catalog_is_newer`; the packaged
  journey is Draft

#### E2E-154: Model additions use models.dev metadata and generic unknown IDs

- **Preconditions**: A custom provider dialog matches a models.dev provider/API
  URL and exposes at least two model records with limits, modalities, and
  reasoning options. A deterministic fixture also exposes a provider-discovered
  ID absent from models.dev.
- **Steps**:
  1. Select two models from the models.dev list and inspect their names,
     context/output limits, capability badges, source labels, and thinking
     chips. 2. Save the provider and start a session; confirm the request keeps
     the provider's configured base URL/API style. 3. Force a Settings catalog
     refresh and confirm it refetches models.dev without changing the bundled
     release file or writing a user cache. 4. Add an ID absent from models.dev
     and inspect its generic fallback card. 5. In the OAuth protocol fixture,
     sign in to an account that offers a new Claude ID absent from models.dev
     while a same-tier Pi sibling exists. Resolve its runtime binding, apply
     runtime model configuration without a saved model binding, and send a
     request through the real Anthropic adapter to an intercepted HTTP boundary.
     Confirm the sibling does not supply chat limits, reasoning levels or effort
     mappings.
- **Expected**: models.dev fields prefill known model bindings and remain the
  published metadata source. Provider keys are never included in the fixed
  models.dev request. Custom IDs without metadata retain generic defaults.
  An OAuth live-only ID does not inherit metadata from a Pi sibling; only an
  exact models.dev match supplies its chat limits and reasoning shape. The
  selected adapter keeps its wire behavior, and Copilot Bearer authentication
  remains unchanged.
- **Specs linked**: `03-runtime/11-provider-model-system.md` §6.2 and §8a,
  `03-runtime/13-model-catalog-and-selection.md` §11.1–§12, ADR 0134
- **Acceptance**: B (model config), C (conversation & stream), Security
- **Milestone**: M6+
- **Status**: OAuth-to-runtime-binding-to-adapter HTTP contract automated in
  `apps/desktop/test/vendor-oauth-login.test.mjs`. Full provider-dialog journey
  Draft. No live account or paid provider request is required for this fixture.

#### E2E-NAV-plugins-button-goes-back: Plugins footer reuses navigation history

- **Preconditions**: An isolated profile has a named conversation and visible
  messages. No model credentials or external marketplace access are required.
- **Steps**: 1) Select the conversation, type an unsent draft, enter Plugins
  from the footer, and click the same button again. 2) Reopen Plugins, type a
  search in Installed, return and reopen. 3) In the navigation fixture, repeat
  from `scheduled` and Settings; test a history containing both
  Scheduled and Settings before Plugins. 4) Exercise Forward then the Plugins
  button again. 5) Open Plugins with no previous history entry and click it.
- **Expected**: The second click performs the existing Back action exactly once;
  it does not append a return entry or skip Settings. A chat history entry uses
  existing session selection/loading behavior. The conversation and unsent draft
  remain usable on return. If Back is unavailable, the button opens chat.
  Its pressed state reflects whether Plugins is active. Plugin browsing tab,
  search fields, and category survive route unmounts; dialogs and listeners
  are released rather than kept hidden. Settings navigation is unchanged.
- **Specs linked**: `04-ux/01-ui-ia.md` §2/§5, `04-ux/08-component-spec.md` §3
- **Acceptance**: C (session navigation), G (plugin browsing), Quality
- **Milestone**: M6+
- **Status**: Actual footer-handler/history-slice and browse-state regression
  tests passed. Real macOS UI validation of the rebuilt history-based revision
  passed two open/back cycles: the same two conversation messages and unsent
  draft remain, the button clears its active state on return, and reopening
  retains the Installed search filter. Non-chat history entries, Forward, and
  no-history fallback are covered by tests, not native UI. The layout journey
  also activates the footer button a second time and asserts the previous
  destination; it passed 37/37 checks from integrated main `d6ffaa3b`. No
  external marketplace or live model was required.

#### E2E-PROVIDER-custom-form-excludes-account-formats: Keep account APIs out of new custom services

- **Preconditions**: Isolated profile, English and Simplified Chinese. Seed
  non-OAuth legacy rows using Codex and Pi account formats, including an OpenAI
  preset URL; use synthetic models and no real credentials. Include a synthetic
  OpenAI Codex OAuth account with one configured model binding.
- **Steps**: 1) Add a Custom service and inspect its format choices. 2) Edit each
  legacy row and save unchanged, then explicitly select Responses and save.
  3) Copy each original legacy row, inspect the current format and explanatory
  hint, wait past discovery debounce, and cancel. 4) Copy again, choose Anthropic
  Messages and save. 5) Check saved payloads and the unchanged source row.
  6) Edit the synthetic Codex OAuth account; confirm Native web search is
  enabled but unchecked, check it, save, and inspect the model binding payload.
- **Expected**: New custom choices are the four general protocols; Codex and Pi
  are available through vendor accounts, not as new API-key choices. Legacy
  editing preserves format, name, URL and authentication unless explicitly
  changed. A copied account format is visible but cannot be newly selected;
  saving and discovery are blocked until an explicit supported choice. The
  explanation is localized. Cancel performs no create; a valid copy never uses
  the source id or credentials. For Codex OAuth, Native web search is enabled
  for the supported Responses wire, defaults off, and saves as
  `nativeWebSearch: true` on that model only. Named OpenCode Go and OAuth account
  flows remain unchanged.
- **Automation**: `pnpm test:e2e:provider-api-style` renders the production React
  form and `VendorAccountDialog` in Electron/Chromium with a stubbed API boundary;
  it checks create/update/discovery payloads and the Codex model binding save.
  This does not verify Host storage, live OAuth or live model/search calls.
- **Specs linked**: `03-runtime/11-provider-model-system.md`,
  `03-runtime/12-provider-config-schema.md`, ADR 0095, ADR 0297.
- **Acceptance**: B (model configuration), Security.
- **Status**: The Electron/React scenario passed in English and Simplified
  Chinese: eight scenario groups, four creates and eight provider updates through
  the stubbed API; both locales also verify the Codex OAuth search opt-in save.
  Host persistence, live OAuth/model calls and visual layout were not exercised.
  Post-integration main E2E is NOT RUN.

#### E2E-PROVIDER-stepfun-plan-setup: Save the StepFun subscription preset

- **Preconditions**: Isolated Electron profile, English and Simplified Chinese,
  synthetic API key and a discovered `step-5-preview` model; no live provider.
- **Steps**: Select StepFun Plan in Add AI service, enter the test key, wait for
  model discovery, explicitly select Step 5 Preview, then save.
- **Expected**: The chooser and connection summary both visibly include
  `api.stepfun.com/step_plan/v1`. Discovery receives `https://api.stepfun.com/step_plan/v1`,
  `anthropic_messages`, and the entered key sent as `Authorization: Bearer` rather
  than the Anthropic `x-api-key`. Save retains that URL and format,
  the catalog vendor `stepfun-step-plan`, and the selected model. The ordinary
  StepFun `/v1` endpoint is not substituted for the subscription endpoint.
- **Automation**: `pnpm test:e2e:provider-api-style` uses real settings components
  with only the API boundary stubbed. `provider-presets.test.ts` checks the
  preset contract and ordinary-endpoint separation; `service-catalog.test.mjs`
  checks discoverability by localized label, name, vendor key, and URL;
  `provider-stepfun-plan-discovery.test.mjs` drives the real provider handlers
  and pins the Bearer model list for both discovery and the connection test.
- **Scope**: Save/discovery payloads are covered; host persistence, live model
  calls, and visual layout are not asserted by this fixture.
- **Specs linked**: `03-runtime/12-provider-config-schema.md`, `guide/stepfun.md`.

#### E2E-PROVIDER-copy-config-without-credentials: Copy configuration into an independent provider

- **Preconditions**: Settings contains an ordinary provider with a saved API
  key, custom headers, and two model bindings with distinct aliases, limits,
  thinking levels, and modality overrides; an OAuth account also exists.
  Record the source configuration and global default provider/model. Use a
  deterministic endpoint to capture discovery requests without real secrets.
- **Steps**: 1) Copy the ordinary provider. 2) Confirm the custom-service
  draft retains the name, URL, API format, and model bindings while the key
  and custom headers are blank and an omission notice is visible. 3) Change
  the API format, a model alias/limit, and its thinking levels; cancel.
  4) Confirm provider count, source data, and global defaults are unchanged.
  5) Copy again and trigger discovery before entering a new key, then with a
  distinct fixture key. 6) Save under a distinct name with the changed API
  format. 7) Reopen both providers and edit the copy. 8) Inspect the OAuth
  account row for absence of Copy. 9) In the draft-construction fixture, add
  unknown source/model fields and verify they are not copied. 10) Copy an
  OpenCode Go provider, confirm its named service and fixed format are kept,
  then select Custom service and choose another ordinary API format.
- **Expected**: Cancel creates no provider or secret. Draft model objects and
  thinking arrays do not share references with the source. Discovery and
  connection testing do not use the source provider id or stored credential;
  authenticated discovery uses only the new draft key. Copy never reads the
  secret store. Save creates a distinct provider through the existing create
  path with independent model bindings and credentials, while the source and
  global defaults remain unchanged. Custom headers and unknown fields are
  omitted even if they contain credential-like values. OAuth accounts cannot
  be copied through this action.
- **Specs linked**: `03-runtime/12-provider-config-schema.md`,
  `03-runtime/14-secrets-storage.md`
- **Acceptance**: B (model configuration), F (independent persistence), Security
- **Milestone**: M2
- **Status**: Real Host/helper fixture verified independent creation, edits,
  deletion, retained source credentials/defaults, and restart persistence.
  Actual UI validation on an isolated no-secret profile confirmed cancel
  leaves one provider; saving a copy with Responses changed to Anthropic
  Messages and a changed name/alias creates a second provider without changing
  the global default. Reopening both rows confirmed the source retained
  Responses and its original alias, while the copy retained Anthropic Messages
  and its edited alias. Credential-bearing network discovery, external-model
  calls, and the OpenCode Go UI variant were not exercised.

#### E2E-PLUGIN-global-shortcut-owns-only-its-own-command

- **Preconditions**: Two local fixture plugins are installed in an isolated
  profile. Plugin A declares `keyboard.globalShortcut`, `contributes.commands`
  with one command, and `contributes.globalShortcuts` mapping `Alt+Shift+V` to
  it. Plugin B declares the same permission and asks for `Alt+Shift+V` while A
  holds it. A second application is available for a cross-application keypress.
- **Steps**: 1) Install and load A and confirm the accelerator is held through
  `listGlobalShortcuts`. 2) Focus another application, press `Alt+Shift+V`, and
  confirm A's command runs; drive the registered handler through the host's
  test seam when no cross-application input is available. 3) Attempt a shortcut
  whose `command` belongs to another plugin. 4) Attempt B's registration of
  `Alt+Shift+V` and inspect the answer. 5) Disable and uninstall A and confirm
  the accelerator becomes free and B can take it; repeat after terminating A's
  runtime (crash) and while A's panel is closed. 6) Attempt the app's own
  launcher accelerator `Alt+Space`, the `Alt+Shift+W` window toggle, a
  reserved binding such as `Mod+C`, an invalid accelerator, and a ninth
  shortcut for one plugin.
- **Expected**: Only A's own command runs for the accelerator; a shortcut whose
  `command` is not registered by the plugin is refused with `INVALID_ARGUMENT`.
  B receives a refusal (`registered: false`, code `SHORTCUT_CONFLICT`) and keeps
  no accelerator while A holds it. The host's own `Alt+Space` launcher and
  `Alt+Shift+W` window-toggle shortcuts and OS-reserved bindings are refused with
  `SHORTCUT_CONFLICT` or `SHORTCUT_UNAVAILABLE`; an invalid accelerator is
  refused with `INVALID_ACCELERATOR` and the ninth per-plugin shortcut with
  `LIMIT_EXCEEDED`. Disabling, unloading, or crashing a plugin releases every
  accelerator it held, after which another plugin can take it, and app quit
  releases all shortcuts. Audit records each register/unregister attempt with
  the plugin id and result, and never records key contents.
- **Specs linked**: `07-plugins/03-plugin-api.md`,
  `07-plugins/04-plugin-security.md`,
  `07-plugins/13-plugin-permissions-matrix.md`, ADR 0257
- **Acceptance**: G (plugins), Security, Quality
- **Milestone**: M6+
- **Status**: Registry, host wiring, and manifest validation are unit-covered
  (`apps/desktop/test/plugin-shortcuts.test.mjs`,
  `packages/plugin-sdk/src/index.test.ts`,
  `crates/host-core/src/plugins/tests.rs`); the cross-application keypress
  journey is Draft and needs a capable desktop environment.

#### E2E-PLUGIN-permission-gate-for-real-time-capabilities

- **Preconditions**: A fixture plugin whose manifest can be changed between
  runs, and a data directory in which the user can re-grant permissions.
- **Steps**: 1) Install a build that requires `keyboard.globalShortcut` and
  inspect the install dialog. 2) Load a plugin that calls
  `pi.keyboard.listGlobalShortcuts()` without declaring the permission.
  3) Declare but do not grant the permission, then call the same API. 4) Grant
  the permission and call the same API again. 5) Revoke the permission with the
  plugin loaded and press the accelerator. 6) Repeat steps 2–5 for
  `audio.capture.background`, `audio.playback.background`, and `net.websocket`.
- **Expected**: Undeclared and declared-but-ungranted calls are refused with
  `PERMISSION_DENIED` and an audit entry, so an ungranted capability fails
  closed instead of degrading. After a grant the same call is allowed — for
  `net.websocket` that is a connect that proceeds past the gate — while the
  callable audio methods answer a coded `UNSUPPORTED` because the host has no
  device backend yet, audited as
  `{ api: "audio.<method>", ok: false, errorCode: "UNSUPPORTED" }`, never a
  silent success. Revoking the permission with the
  plugin loaded stops the accelerator immediately and the host releases it. The
  four permissions appear with their risk tiers (high for
  `audio.capture.background` and `net.websocket`, medium for
  `audio.playback.background` and `keyboard.globalShortcut`) and localized copy
  in the install dialog and in the plugin detail sheet, ordered by descending
  risk.
- **Specs linked**: `07-plugins/04-plugin-security.md`,
  `07-plugins/13-plugin-permissions-matrix.md`, ADR 0257
- **Acceptance**: G (plugins), Security
- **Milestone**: M6+
- **Status**: The gates and validator behaviour are unit-covered
  (`packages/plugin-sdk/src/index.test.ts`,
  `packages/plugin-devkit/src/check.test.ts`,
  `crates/host-core/src/plugins/tests.rs`); the dialog journey is Draft.

#### E2E-PLUGIN-background-audio-and-realtime-connection

- **Preconditions**: A voice-assistant fixture plugin holding
  `background.service`, `audio.capture.background`,
  `audio.playback.background`, `keyboard.globalShortcut`, `net.websocket`, and
  `desktop.control`, with a mock audio backend and a local mock WebSocket
  server so CI never needs a real microphone.
- **Steps**: 1) Load the plugin with no panel open and confirm that its
  background service starts. 2) Register the push-to-talk accelerator. 3) Open
  the input device and receive PCM frames. 4) Connect the mock server and send
  PCM. 5) Receive the response audio and play it. 6) Interrupt playback with
  `stopOutput`. 7) Call `pi.desktop.invoke({ operation: "session/create" })`
  and then `agent/prompt`. 8) Unload the plugin.
- **Expected**: Frames flow with bounded buffering and no unbounded queue
  growth, and `stopOutput` clears queued audio immediately. Egress to a host
  outside `manifest.net.domains` is refused. On unload the microphone, the
  audio output, the socket, and the accelerator are all released with no orphan
  process, listener, or timer. `session/delete`-class dangerous desktop
  operations still require the host's native confirmation even when the plugin
  passes `confirm: true`.
- **Specs linked**: `07-plugins/03-plugin-api.md`,
  `07-plugins/04-plugin-security.md`,
  `07-plugins/12-plugin-ipc-and-host-services.md`, ADR 0257
- **Acceptance**: G (plugins), Security, Quality
- **Milestone**: M6+
- **Status**: Partially implemented — the socket half is implemented and
  unit-covered by `apps/desktop/test/plugin-websocket.test.mjs` (allowlist,
  bounds, lifecycle); the background-audio half answers a coded `UNSUPPORTED`
  because the host has no device backend yet, so this scenario stays Draft until
  audio lands.

<a id="e2e-config-sync-webdav-portable-configuration"></a>

### E2E-CONFIG-SYNC-s3-portable-configuration

- **Preconditions:** A built task candidate, isolated Host processes with
  separate data, HOME and agent directories, and a local S3 fixture with strong
  ETags and conditional PUT. No real model provider or running desktop instance.
  A live S3 run is separately opt-in and requires explicit authorization.
- **Steps:**
  1. In a packaged build, confirm Cloud sync appears in Settings navigation
     and search with Experimental badges on its row and page title. Open the
     destination and confirm only the new S3 setup is offered; old formats are
     not detected, migrated or deleted.
  2. Confirm initial setup shows only required connection/password fields and
     automatic runs use the shared switch. Expand Advanced to edit region,
     prefix, addressing, device label and optional token; collapse/reopen it
     without losing values. Select categories before the first save, keeping
     credentials/memory opt-in. Test conditional creation, readback, matching
     update, stale-write rejection and probe cleanup.
     Reject ignored preconditions, weak ETags, redirects, public HTTP and 403;
     never interpret 502 as a missing object. LAN HTTP follows network policy.
  3. Configure two sync devices. Publish a provider and mapped packaged skill,
     receive them as pending where approval is required, approve, and verify
     visible persisted configuration and resource bytes. Verify there is no
     projects category and publishing project/group metadata neither registers
     nor changes projects/groups on the receiving device. Register its workspace
     locally, then map and approve the project skill; its resources must arrive
     without changing local group names, roots or ordering. Existing vault
     `projects` entities are ignored on sync/restore, preserving local projects
     and cloud history. Exercise disjoint edits,
     same-entity conflicts and explicit choice convergence, remote deletion
     versus offline edit, and repeated polling. Credential opt-out must not
     manufacture local edits or prevent deletion convergence. No real executable
     capability is run.
  4. Configure backup mode. Verify remote configuration is not applied, backup
     history is separate, unchanged snapshots do not duplicate revisions, and
     a local restore does not change either cloud head.
  5. Restore an older sync revision with propagation acknowledgment. Verify a
     local recovery point, a new shared revision and propagation to the second
     device, with sensitive activation still requiring approval. Rewrap the
     password without claiming revocation of already unlocked devices.
  6. Reopen Settings with saved and unfinished drafts. Preserve typed S3 choices
     and automatic-run preferences, but never persist secret keys, tokens or
     passwords. Test blank credential reuse, explicit token clearing and full
     replacement. Invalidate history on destination/mode changes and ignore
     outstanding responses from the old connection. Unsaved mode changes must
     not alter restore confirmation or propagation flags.
     Saved connections reopen collapsed while status, manual run and inline
     unlock remain visible above them. Open History and Security/connection
     to restore, change password or disconnect. Pending approvals and errors
     remain visible. At narrow content widths the form becomes one column
     without horizontal overflow. In light/dark themes, activate shared
     checkboxes by label and Space; verify focus, disabled and mixed states.
  7. Restart an isolated Host and verify persisted state, then disconnect without
     deleting unrelated data. Inspect remote object bytes for known fixture
     plaintext and verify there is no automatic immutable-object GC.
  8. Hold an in-flight manual sync, navigate away from Settings and return.
     Verify Host still reports `syncing`, duplicate actions stay disabled, and
     releasing the fixture completes the operation and refreshes Host state.
- **Expected:** Only S3 is supported, with mandatory conditional writes and
  encrypted vault contents. Identical/disjoint edits converge; conflicts and
  tombstones preserve changes; excluded categories do not imply deletion.
  Backup never downloads/applies remote configuration during normal runs.
  History queries index at most 30 revisions; stored immutable objects are not
  automatically deleted. Import recovery remains observable; per-file atomic
  replacement is not asserted to be a whole-filesystem transaction.
- **Live S3 safety:** `--live-s3 --env-file <authorized-file>` reads credentials
  programmatically without logging/copying them. Use a new random test prefix,
  confirm it is initially empty, run actual isolated Host processes, delete
  only objects created under that prefix, and verify it is empty afterward.
  Never use an existing backup prefix or production desktop profile. Record
  tested base/candidate and distinguish this run from a standalone SDK probe.
- **Automation:** `pnpm test:e2e:config-sync` is the multi-Host harness.
  Rust `config_sync::` and `user_skills::` suites cover transport, merge,
  application and resource safety. `config-sync-user-path.test.mjs` runs the
  real settings page and shared checkbox with a mocked external IPC boundary,
  actual styles and isolated Electron input, without network access;
  `config-sync-ipc.test.mjs` covers Main notification shape. Visibility remains
  covered by `settings-developer-only-destinations.test.mjs`.
- **Specs:** `03-runtime/22-config-sync.md`, `04-ux/06-settings-ia.md`,
  `03-runtime/14-secrets-storage.md`, `05-security/01-security.md`,
  `docs/adr/s3-only-configuration-backup-sync.md`.
- **Acceptance:** F (persistence), Security, Quality. **Milestone:** M6+.
- **Status:** Candidate validation required; full checkpoint-recovery fault
  injection is not claimed by the settings or multi-Host happy-path suites.

**E2E-CHAT-session-todo-checklist: TodoWrite to session-aware TodoDock**

- **Preconditions**: An isolated local Electron profile with a deterministic
  Agent/host fixture, two Desktop sessions, and no real provider or paid API.
- **Steps**: Start a multi-step Agent turn that calls `TodoWrite` with ordered
  pending and `in_progress` items. Observe the TodoDock above the Composer;
  confirm its progress text is left-aligned, its separate arrow button is at
  the right edge, measures at least 36px square, and contains an independently
  sized 18px arrow icon. Confirm clicking the text does not expand it. Click
  the upward arrow to expand, then confirm the arrow points down. Switch
  sessions and confirm the checklist stays session-scoped.
  Expand a checklist longer than the dock's height cap: every row must render
  and the list must scroll inside the dock without growing the Composer stack.
  Complete and cancel items, confirm the all-cancelled label, then clear the
  checklist and reload/restart the host.
  Deliver an out-of-order older `todos.changed` event and confirm it cannot
  replace the newer snapshot. Exercise invalid payload, Plan/Goal, delegated,
  and remote-session paths.
- **Expected**: Host SQLite is authoritative; each successful full replacement
  advances revision, including clear, and emits one committed `todos.changed`
  snapshot. Invalid or unauthorized writes do not mutate or emit. TodoDock
  renders plain text, separates collapsed progress from the current item,
  uses glyph status marks in a flat expanded list, does not take focus,
  strikes through completed task text, sweeps a light band across the working
  step's text only (the header line while collapsed, its row while expanded),
  resets expansion on session changes,
  lists every ordered row with the dock's
  own list as the scrollport, and keeps a collapsed dock to its header height,
  rejects stale events, and skips local recovery for `remote:` sessions because
  RACP v1 has no Todo snapshot operation.
- **Specs**: `03-runtime/03-tools-and-permissions.md`,
  `03-runtime/04-data-storage.md`, `03-runtime/06-host-rpc-protocol.md`,
  `04-ux/08-component-spec.md`, ADR 0312.
- **Acceptance**: C / E / F / Quality / Security.
- **Milestone**: M6+.
- **Automation**: `pnpm test:e2e:todos` exercises the isolated Electron
  checklist journey through the production Agent's ToolSearch/TodoWrite path,
  the production renderer, and a real host/SQLite profile. Only the external
  model stream and preload transport are fixtures; no live provider or user
  profile is used. The scenario includes Unicode truncation with warning replay,
  single-active-item normalization, full-list rendering with the dock's
  internal scroll, a failed initial read followed by host recovery without
  changing sessions,
  cached-snapshot reconciliation, and stale-event rejection. Runtime
  `runtime-todos.test.ts` exercises Agent tool validation, overlong content
  normalization, and continuation through a deterministic provider.
- **Status**: Run against the exact request candidate after building the
  desktop and host. Host-core and targeted renderer tests are companion checks,
  not substitutes for the Electron journey.

## 8. Traceability Matrix

| Acceptance | Scenarios |
|---|---|
| C / E / Security / Quality — Gemini work setup | E2E-LIVE-VOICE-gemini-work-schema |
| C / Quality — Continue after malformed tool output | E2E-RUNTIME-malformed-tool-call-continue-recovery |
| B / Security / Quality — Optional provider client certificate requests | E2E-PROVIDER-optional-client-certificate |
| C / E / F / Quality / Security — Session Todo checklist | E2E-CHAT-session-todo-checklist |
| C / E / Security / Quality — Live Voice four-stage interaction | E2E-LIVE-VOICE-four-stage-ui |
| C / F — Hourly task updates | E2E-SCHEDULED-manual-to-hourly |
| C / F / Quality — Saved project isolation | E2E-SCHEDULED-manual-workspace-binding |
| C / F / Quality — Desktop automations | E2E-SCHEDULED-desktop-automation-lifecycle |
| F / Security / Quality — Portable configuration sync | E2E-CONFIG-SYNC-s3-portable-configuration |
| A / C — Unicode stdio framing | E2E-RPC-unicode-separators |
| C / G / Quality — Plugins navigation | E2E-NAV-plugins-button-goes-back |
| C / D / Quality — Sidebar row states | E2E-LAYOUT-sidebar-row-states |
| E / Quality — Browser screenshot timeout recovery | E2E-BROWSER-capture-resize |
| A / C / Quality — Sidebar material and settings return | E2E-LAYOUT-sidebar-settings |
| C / Quality — Destination loading and focus | E2E-087b |
| A / H / Quality — Renderer process crash recovery | E2E-RUNTIME-renderer-crash-recovery |
| C / F / Quality — Project folder with chats detaches and deletes safely | E2E-048c |
| B / F / Security — Provider copy | E2E-PROVIDER-copy-config-without-credentials |
| C / Quality — Self-hosted endpoint receives the session id | E2E-PROVIDER-custom-endpoint-session-identity |
| B / F / Quality — Selected model order | E2E-MODEL-selected-order-persists |
| E / F / Quality — MCP server timeout override | E2E-261 |
| A — App startup | E2E-001, E2E-002, E2E-003, E2E-004, E2E-067, E2E-076, E2E-079, E2E-092, E2E-097, E2E-143, E2E-150, E2E-168, E2E-204 |
| A / C / F / Quality — Tray session navigation | E2E-TRAY-bounded-session-navigation |
| B — Model config | E2E-005, E2E-PROVIDER-custom-endpoint-no-api-key, E2E-006, E2E-007, E2E-038, E2E-050, E2E-052, E2E-055, E2E-066, E2E-080, E2E-082, E2E-102c, E2E-102d, E2E-102e, E2E-151, E2E-154, E2E-163, E2E-166, E2E-172, E2E-174, E2E-197, E2E-005G, E2E-005J, E2E-199, E2E-201, E2E-202, E2E-203, E2E-205, E2E-206, E2E-209, E2E-PLUGIN-provider-catalog-add-service |
| C — Conversation & stream | E2E-CHAT-long-history-stream-keeps-responsive, E2E-CHAT-running-status-survives-output-pauses, E2E-008, E2E-008d, E2E-008e, E2E-008a, E2E-009, E2E-010, E2E-011, E2E-011a, E2E-011b, E2E-011d, E2E-011e, E2E-011g, E2E-031, E2E-040, E2E-047, E2E-048, E2E-048A, E2E-049, E2E-052, E2E-053, E2E-054, E2E-055, E2E-059, E2E-059a, E2E-060c, E2E-060d, E2E-061, E2E-061a, E2E-062, E2E-064, E2E-065, E2E-068, E2E-071, E2E-073, E2E-074, E2E-075, E2E-081, E2E-083, E2E-084, E2E-086, E2E-087, E2E-088, E2E-088b, E2E-089, E2E-090, E2E-COMPOSER-narrow-controls, E2E-094, E2E-095, E2E-096, E2E-097, E2E-098, E2E-099, E2E-102, E2E-102a, E2E-102b, E2E-102c, E2E-102d, E2E-102g, E2E-106, E2E-109, E2E-111, E2E-114, E2E-116, E2E-117, E2E-118, E2E-119, E2E-120, E2E-121, E2E-218, E2E-259, E2E-219, E2E-AGENTS-001, E2E-142, E2E-144, E2E-145, E2E-146, E2E-146a, E2E-147, E2E-151, E2E-154, E2E-155, E2E-158, E2E-159, E2E-161, E2E-162, E2E-166, E2E-172, E2E-173, E2E-174, E2E-177, E2E-178, E2E-179, E2E-180, E2E-182, E2E-183, E2E-187, E2E-198, E2E-199, E2E-202, E2E-203, E2E-207, E2E-208, E2E-CHAT-content-width-handles, E2E-250, E2E-102i, E2E-PLUGIN-session-orchestrator-real-workers, E2E-SUBAGENT-settlement-updates-before-parent-poll, E2E-SUBAGENT-resume-a-settled-delegation |
| C — Conversation & stream (composer drafts) | E2E-011c, E2E-011c-1, E2E-011c-2 |
| D — Workspace | E2E-012, E2E-013, E2E-022B, E2E-024I, E2E-047, E2E-049, E2E-057, E2E-058, E2E-060, E2E-068, E2E-075, E2E-078, E2E-153, E2E-158, E2E-182, E2E-187, E2E-252 |
| C / D / Quality — Project session history resets after collapse | E2E-263 |
| D — Workspace (project ordering) | E2E-253 |
| E — Tools & permissions | E2E-008a, E2E-014, E2E-015, E2E-016, E2E-017, E2E-018, E2E-019, E2E-024I, E2E-024K, E2E-040, E2E-049, E2E-074, E2E-093, E2E-097, E2E-099, E2E-100, E2E-101, E2E-102, E2E-102d, E2E-102e, E2E-102g, E2E-103, E2E-105, E2E-106, E2E-107, E2E-111, E2E-112, E2E-113, E2E-114, E2E-115, E2E-116, E2E-119, E2E-121, E2E-122, E2E-142, E2E-145, E2E-147, E2E-155, E2E-158, E2E-166, E2E-181, E2E-PLUGIN-imported-pi-package-skills |
| F — Persistence | E2E-020, E2E-021, E2E-021a, E2E-038, E2E-SETTINGS-inline-capability-imports, E2E-040, E2E-042, E2E-047, E2E-048, E2E-051, E2E-054, E2E-056, E2E-061, E2E-062, E2E-064, E2E-066, E2E-068, E2E-071, E2E-072, E2E-073, E2E-082, E2E-084, E2E-096, E2E-098, E2E-102, E2E-102b, E2E-102c, E2E-102d, E2E-102g, E2E-102i, E2E-103, E2E-AGENTS-001, E2E-061a, E2E-073a, E2E-104, E2E-106, E2E-107, E2E-108, E2E-109, E2E-110, E2E-112, E2E-118, E2E-119, E2E-120, E2E-121, E2E-123, E2E-142, E2E-146, E2E-146a, E2E-148, E2E-151, E2E-158, E2E-160, E2E-168, E2E-171, E2E-177, E2E-178, E2E-183, E2E-186, E2E-005J, E2E-PROVIDER-custom-endpoint-no-api-key, E2E-PLUGIN-session-orchestrator-real-workers, E2E-PLUGIN-provider-catalog-add-service, E2E-SESSION-outbox-unclassifiable-failure-does-not-stall-the-queue |
| F — Persistence (project ordering) | E2E-251 |
| G / Update — Bundled Official Enhancements defaults | E2E-PLUGIN-bundled-enhancements-defaults |
| G / Security — Fetch redirect policy | E2E-PLUGIN-fetch-redirect-policy |
| G — Plugins | E2E-022, E2E-022A, E2E-022B, E2E-022C, E2E-023, E2E-024, E2E-024B, E2E-024C, E2E-024D, E2E-024AA, E2E-024E, E2E-024W, E2E-024F, E2E-024G, E2E-024H, E2E-024I, E2E-024J, E2E-024K, E2E-024L, E2E-024M, E2E-024N, E2E-024O, E2E-024P, E2E-025, E2E-026, E2E-105, E2E-117, E2E-120, E2E-122, E2E-123, E2E-024Q, E2E-148, E2E-152, E2E-153, E2E-PLUGIN-imported-pi-package-skills, E2E-PLUGIN-imported-pi-package-wrapper, E2E-PLUGIN-import-extension-installs-dependencies, E2E-PLUGIN-import-extension-reports-missing-dependency, E2E-PLUGIN-global-shortcut-owns-only-its-own-command, E2E-PLUGIN-permission-gate-for-real-time-capabilities, E2E-PLUGIN-background-audio-and-realtime-connection, E2E-PLUGIN-fs-root-follows-the-calling-session, E2E-PLUGIN-provider-catalog-add-service, E2E-PLUGIN-reviews-public-reads |
| H — Diagnostics | E2E-027, E2E-031, E2E-034, E2E-042, E2E-096, E2E-098, E2E-104, E2E-107, E2E-108, E2E-109, E2E-110, E2E-113, E2E-115, E2E-116, E2E-118, E2E-121, E2E-146, E2E-146a, E2E-155, E2E-159, E2E-176, E2E-194, E2E-195 |
| Security | E2E-SETTINGS-inline-capability-imports, E2E-028, E2E-029, E2E-030, E2E-024J, E2E-024K, E2E-024M, E2E-049, E2E-068, E2E-086, E2E-102c, E2E-102d, E2E-102e, E2E-105, E2E-106, E2E-107, E2E-108, E2E-109, E2E-110, E2E-112, E2E-113, E2E-115, E2E-116, E2E-117, E2E-119, E2E-121, E2E-122, E2E-123, E2E-142, E2E-148, E2E-151, E2E-153, E2E-158, E2E-187, E2E-196c, E2E-196b, E2E-196, E2E-PROVIDER-custom-endpoint-no-api-key, E2E-PLUGIN-fs-root-follows-the-calling-session, E2E-PLUGIN-provider-catalog-add-service, E2E-PLUGIN-reviews-public-reads |
| Quality | E2E-SETTINGS-inline-capability-imports, E2E-CHAT-long-history-stream-keeps-responsive, E2E-CHAT-running-status-survives-output-pauses, E2E-032, E2E-033, E2E-039, E2E-043, E2E-044, E2E-045, E2E-046, E2E-047, E2E-048, E2E-048A, E2E-049, E2E-050, E2E-053, E2E-055, E2E-056, E2E-057, E2E-058, E2E-059, E2E-060, E2E-061, E2E-062, E2E-063, E2E-064, E2E-065, E2E-066, E2E-067, E2E-068, E2E-069, E2E-070, E2E-071, E2E-072, E2E-073, E2E-074, E2E-075, E2E-076, E2E-077, E2E-078, E2E-079, E2E-080, E2E-081, E2E-082, E2E-083, E2E-084, E2E-085, E2E-086, E2E-092, E2E-093, E2E-094, E2E-095, E2E-096, E2E-097, E2E-098, E2E-099, E2E-100, E2E-101, E2E-102, E2E-102a, E2E-102b, E2E-102c, E2E-102d, E2E-102e, E2E-103, E2E-AGENTS-001, E2E-021a, E2E-024N, E2E-059a, E2E-060b, E2E-060c, E2E-061a, E2E-073a, E2E-111, E2E-114, E2E-117, E2E-118, E2E-119, E2E-120, E2E-122, E2E-123, E2E-142, E2E-143, E2E-144, E2E-145, E2E-146, E2E-147, E2E-148, E2E-150, E2E-151, E2E-153, E2E-155, E2E-158, E2E-159, E2E-160, E2E-161, E2E-162, E2E-163, E2E-168, E2E-172, E2E-173, E2E-174, E2E-011g, E2E-176, E2E-177, E2E-178, E2E-179, E2E-180, E2E-181, E2E-182, E2E-183, E2E-186, E2E-187, E2E-194, E2E-195, E2E-196a, E2E-196b, E2E-196c, E2E-198, E2E-199, E2E-200, E2E-196, E2E-201, E2E-204, E2E-202, E2E-203, E2E-205, E2E-206, E2E-207, E2E-208, E2E-209, E2E-210, E2E-UPDATE-preference-and-once-only-reminder, E2E-218, E2E-259, E2E-219, E2E-250, E2E-252, E2E-102i, E2E-SUBAGENT-settlement-updates-before-parent-poll, E2E-PLUGIN-imported-pi-package-skills, E2E-PLUGIN-fs-root-follows-the-calling-session, E2E-SUBAGENT-resume-a-settled-delegation, E2E-PLUGIN-provider-catalog-add-service |
| Quality (sidebar menu placement) | E2E-021c |
| Quality (project ordering) | E2E-253 |
| Quality (work-panel tab close visibility) | E2E-WORK-PANEL-active-tab-close-visibility |
| Quality (turn changed-files disclosure) | E2E-CHAT-turn-changed-files-summary |
| C / E / G / Quality — Pi kernel upgrade | E2E-PI-130-kernel-upgrade |
| C / E / G / Quality — Pi kernel upgrade | E2E-PI-140-kernel-upgrade |
| C — Conversation & stream (IME slash alias) | E2E-255 |
| E — Tools & permissions (Skill residency) | E2E-254 |
| Quality (Skill residency and IME slash alias) | E2E-254, E2E-255 |
| C / E / F / Quality — Built-in skill activation | E2E-SKILL-builtin-activation |
| Quality — Market catalog retry recovery | E2E-MARKET-CATALOG-RETRY |
| C — Conversation & stream (plugin session import visibility) | E2E-257 |
| F — Persistence (plugin session import visibility) | E2E-257 |
| G — Plugins (session import visibility) | E2E-257 |
| Quality (plugin session import visibility) | E2E-257 |
| Quality (Windows updater cache) | E2E-260 |
| G — Plugins (Session Orchestrator) | E2E-PLUGIN-session-orchestrator-real-workers |
| Security (Session Orchestrator) | E2E-PLUGIN-session-orchestrator-real-workers |
| Quality (Session Orchestrator) | E2E-PLUGIN-session-orchestrator-real-workers |
| C — Conversation & stream (Session list responsiveness) | E2E-SESSION-list-refresh-keeps-desktop-responsive |
| Quality (Session list responsiveness) | E2E-SESSION-list-refresh-keeps-desktop-responsive |
| Security (imported extension dependencies) | E2E-PLUGIN-import-extension-installs-dependencies, E2E-PLUGIN-import-extension-reports-missing-dependency |
| Quality (imported extension dependencies) | E2E-PLUGIN-import-extension-installs-dependencies, E2E-PLUGIN-import-extension-reports-missing-dependency |
| F / G / Security / Quality — Imported extension npm recovery | E2E-PLUGIN-import-extension-recovers-missing-npm |
| G — Plugins (desktop tool dispatch budget) | E2E-PLUGIN-slow-tool-is-not-cut-off-by-host-dispatch |
| C — Conversation & stream (Independent session communication) | E2E-SESSION-independent-top-level-communication |
| D — Plugin security (Independent session communication) | E2E-SESSION-independent-top-level-communication |
| G — Plugins (Independent session communication) | E2E-SESSION-independent-top-level-communication |
| Quality (Independent session communication) | E2E-SESSION-independent-top-level-communication, E2E-SESSION-hover-card-model-and-links |
| C — Conversation & stream (Hover card model and links) | E2E-SESSION-hover-card-model-and-links |
| C — Conversation & stream (Chat file references) | E2E-CHAT-shorthand-file-ref-opens-the-matching-file, E2E-CHAT-file-ref-opens-the-surface-that-owns-it |
| C / Quality / Security (Conversation MP4 attachments) | E2E-CHAT-mp4-attachment-opens-in-system-player |
| G — Plugins (Chat file references) | E2E-CHAT-file-ref-opens-the-surface-that-owns-it, E2E-PLUGIN-file-view-collapse-persists |
| Quality (Chat file references) | E2E-CHAT-shorthand-file-ref-opens-the-matching-file, E2E-CHAT-file-ref-opens-the-surface-that-owns-it, E2E-PLUGIN-file-view-collapse-persists |
| C / Quality (Composer deep file mentions) | E2E-COMPOSER-deep-file-mentions |
| G — Plugins (project folder roots) | E2E-PLUGIN-file-view-switches-folder-per-project |
| Security (project folder roots) | E2E-PLUGIN-file-view-switches-folder-per-project |
| Quality (project folder roots) | E2E-PLUGIN-file-view-switches-folder-per-project |
| D — Workspace (project delete) | E2E-PROJECT-delete-removes-project-and-owned-sessions |
| F — Persistence (project delete) | E2E-PROJECT-delete-removes-project-and-owned-sessions |
| Quality (project delete) | E2E-PROJECT-delete-removes-project-and-owned-sessions |
| Quality (two-click delete) | E2E-SESSION-two-click-delete-arms-first |
| Security (plugin real-time capabilities) | E2E-PLUGIN-global-shortcut-owns-only-its-own-command, E2E-PLUGIN-permission-gate-for-real-time-capabilities, E2E-PLUGIN-background-audio-and-realtime-connection |
| C — Conversation & stream (disclosure reading position) | E2E-CHAT-disclosure-toggle-keeps-reading-position |
| E — Tools & permissions (disclosure reading position) | E2E-CHAT-disclosure-toggle-keeps-reading-position |
| D (surfaces) / Quality — Remote-host Add and Pair form disclosure | E2E-REMOTE-HOST-settings-compact-inventory |
| E — Tools & permissions (capability level move) | E2E-CAPABILITY-move-across-levels |
| F — Persistence (capability level move) | E2E-CAPABILITY-move-across-levels |
| Quality (capability level move) | E2E-CAPABILITY-move-across-levels |

| Milestone | Scenarios |
|---|---|
| Post-MVP experimental interaction maintenance | E2E-LIVE-VOICE-four-stage-ui |
| M1 | E2E-001, E2E-002, E2E-003, E2E-028, E2E-029 |
| M2 | E2E-004, E2E-005, E2E-006, E2E-007, E2E-008, E2E-008d, E2E-008e, E2E-009, E2E-010, E2E-011, E2E-011a, E2E-011b, E2E-011d, E2E-011e, E2E-011g, E2E-020, E2E-021, E2E-021a, E2E-027, E2E-031, E2E-042, E2E-087, E2E-088, E2E-088b, E2E-089, E2E-090, E2E-COMPOSER-narrow-controls, E2E-144, E2E-005J, E2E-201, E2E-202, E2E-207, E2E-206 |
| M2 (sidebar menu placement) | E2E-021c |
| M3 | E2E-012, E2E-013, E2E-014, E2E-015, E2E-016, E2E-017, E2E-018, E2E-019, E2E-040 |
| M4 | E2E-022, E2E-023, E2E-024, E2E-025, E2E-026, E2E-030, E2E-038 |
| M5 | E2E-CHAT-long-history-stream-keeps-responsive, E2E-CHAT-running-status-survives-output-pauses, E2E-008a, E2E-032, E2E-033, E2E-034, E2E-039, E2E-043, E2E-044, E2E-045, E2E-046, E2E-047, E2E-048, E2E-048A, E2E-049, E2E-050, E2E-051, E2E-052, E2E-053, E2E-054, E2E-055, E2E-056, E2E-057, E2E-058, E2E-059, E2E-060, E2E-061, E2E-062, E2E-063, E2E-064, E2E-065, E2E-066, E2E-067, E2E-068, E2E-069, E2E-070, E2E-071, E2E-072, E2E-073, E2E-074, E2E-075, E2E-076, E2E-077, E2E-078, E2E-079, E2E-080, E2E-081, E2E-082, E2E-083, E2E-084, E2E-085, E2E-086, E2E-092, E2E-093, E2E-096, E2E-097, E2E-098, E2E-099, E2E-100, E2E-101, E2E-102, E2E-102a, E2E-102b, E2E-102c, E2E-102d, E2E-102e, E2E-AGENTS-001, E2E-059a, E2E-060b, E2E-060c, E2E-061a, E2E-073a, E2E-094, E2E-095, E2E-143, E2E-145, E2E-146, E2E-146a, E2E-147, E2E-177, E2E-178, E2E-180, E2E-181, E2E-182, E2E-183, E2E-186, E2E-187, E2E-194, E2E-195, E2E-204, E2E-208, E2E-CHAT-content-width-handles, E2E-250, E2E-252, E2E-102i, E2E-BROWSER-capture-resize |
| M5 (project ordering) | E2E-253 |
| M2 (IME slash alias) | E2E-255 |
| M5 (Skill residency) | E2E-254 |
| M6 | E2E-104, E2E-105, E2E-106, E2E-107, E2E-108, E2E-109, E2E-110, E2E-111, E2E-112, E2E-113, E2E-114, E2E-115, E2E-116, E2E-117, E2E-118, E2E-119, E2E-120, E2E-103, E2E-172 |
| M6+ | E2E-121, E2E-122, E2E-148, E2E-150, E2E-151, E2E-154, E2E-155, E2E-158, E2E-159, E2E-160, E2E-161, E2E-162, E2E-163, E2E-166, E2E-168, E2E-173, E2E-174, E2E-176, E2E-179, E2E-196a, E2E-196b, E2E-196c, E2E-198, E2E-199, E2E-200, E2E-202, E2E-203, E2E-205, E2E-209, E2E-SETTINGS-inline-capability-imports, E2E-210, E2E-UPDATE-preference-and-once-only-reminder, E2E-212, E2E-213, E2E-214, E2E-215, E2E-216, E2E-217, E2E-218, E2E-259, E2E-219, E2E-257, E2E-SUBAGENT-settlement-updates-before-parent-poll, E2E-PLUGIN-fs-root-follows-the-calling-session, E2E-SUBAGENT-resume-a-settled-delegation |
| M6+ (Session Orchestrator) | E2E-PLUGIN-session-orchestrator-real-workers |
| M6+ (Selected model order) | E2E-MODEL-selected-order-persists |
| M6+ (MCP server timeout override) | E2E-261 |
| M6+ (Destination loading and focus) | E2E-087b |
| M6+ (Session list responsiveness) | E2E-SESSION-list-refresh-keeps-desktop-responsive |
| M6+ (Windows updater cache) | E2E-260 |
| M6+ (Independent session communication) | E2E-SESSION-independent-top-level-communication, E2E-SESSION-hover-card-model-and-links |
| M5 (Chat file references) | E2E-CHAT-shorthand-file-ref-opens-the-matching-file, E2E-CHAT-file-ref-opens-the-surface-that-owns-it |
| M5 (Composer deep file mentions) | E2E-COMPOSER-deep-file-mentions |
| M5 (Conversation MP4 attachments) | E2E-CHAT-mp4-attachment-opens-in-system-player |
| M6+ (Chat file references) | E2E-PLUGIN-file-view-collapse-persists |
| M6+ (project folder roots) | E2E-PLUGIN-file-view-switches-folder-per-project |
| Post-MVP | E2E-022A, E2E-022B, E2E-022C, E2E-024I, E2E-024J, E2E-024K, E2E-024L, E2E-024M (plugin roadmap R2/R3/R6) |
| Post-baseline local automation | E2E-220 |
| Post-baseline local automation (MCP `pi_session_get` large compaction) | E2E-MCP-session-get-projects-large-compaction |
| Post-MVP remote control | E2E-221, E2E-222, E2E-223, E2E-224, E2E-225, E2E-226, E2E-227, E2E-228, E2E-229, E2E-230, E2E-231, E2E-232, E2E-REMOTE-HOST-settings-compact-inventory |
| Trusted extensions (R7 v1) | E2E-DIALOG-long-text-boundaries, E2E-241, E2E-242, E2E-HOOKS-prompt-chain, E2E-HOOKS-context-every-request, E2E-HOOKS-cancel-and-dispose, E2E-TRUSTED-EXTENSION-custom-agent-stream-and-binding, E2E-243, E2E-TRUSTED-EXTENSION-temporary-session-cwd-is-scratch, E2E-244, E2E-245, E2E-PLUGIN-imported-pi-package-skills, E2E-PLUGIN-import-extension-installs-dependencies, E2E-PLUGIN-import-extension-reports-missing-dependency, E2E-PLUGIN-declared-provider-appears-in-the-native-provider-list, E2E-PLUGIN-provider-catalog-add-service |
| Trusted extensions (R7 v1 npm recovery) | E2E-PLUGIN-import-extension-recovers-missing-npm |
| Post-MVP regression coverage (plugin tool dispatch) | E2E-PLUGIN-slow-tool-is-not-cut-off-by-host-dispatch |
| M6+ (Project delete) | E2E-PROJECT-delete-removes-project-and-owned-sessions |
| M6+ (Two-click delete) | E2E-SESSION-two-click-delete-arms-first |
| C — Conversation & stream (model fallback) | E2E-SUBAGENT-ordered-model-fallback-preserves-work |
| Quality (model fallback isolation) | E2E-SUBAGENT-ordered-model-fallback-preserves-work |
| C — Conversation & stream (legacy subagent turn limit) | E2E-SUBAGENT-legacy-turn-limit-frontmatter-is-ignored |
| Quality (legacy subagent turn limit) | E2E-SUBAGENT-legacy-turn-limit-frontmatter-is-ignored |
| M6+ (disclosure reading position) | E2E-CHAT-disclosure-toggle-keeps-reading-position |
| M6+ (capability level move) | E2E-CAPABILITY-move-across-levels |
| E — Tools & permissions (builtin subagent defaults) | E2E-SUBAGENT-settings-lists-builtin-defaults |
| Quality (builtin subagent defaults) | E2E-SUBAGENT-settings-lists-builtin-defaults |
| C — Conversation & stream (opaque floating surfaces) | E2E-CHAT-opaque-floating-decision-and-retry-surfaces |
| Quality (opaque floating surfaces) | E2E-CHAT-opaque-floating-decision-and-retry-surfaces |
| M6 (opaque floating surfaces) | E2E-CHAT-opaque-floating-decision-and-retry-surfaces |
| B — Model config (catalog window provenance) | E2E-MODEL-catalog-window-correction-reaches-saved-bindings |
| F — Persistence (catalog window provenance) | E2E-MODEL-catalog-window-correction-reaches-saved-bindings |
| Quality (catalog window provenance) | E2E-MODEL-catalog-window-correction-reaches-saved-bindings |
| M6+ (catalog window provenance) | E2E-MODEL-catalog-window-correction-reaches-saved-bindings |
| C — Conversation & stream (delegate context budget) | E2E-SUBAGENT-context-overflow-compacts-before-failing, E2E-SUBAGENT-context-overflow-reports-actionable-failure, E2E-SUBAGENT-resume-seeds-within-context-budget |
| Quality (delegate context budget) | E2E-SUBAGENT-context-overflow-compacts-before-failing, E2E-SUBAGENT-context-overflow-reports-actionable-failure, E2E-SUBAGENT-resume-seeds-within-context-budget |
| M6+ (delegate context budget) | E2E-SUBAGENT-context-overflow-compacts-before-failing, E2E-SUBAGENT-context-overflow-reports-actionable-failure, E2E-SUBAGENT-resume-seeds-within-context-budget |
| C / F / Quality — The context estimate stays safe (calibration) | E2E-CONTEXT-estimate-calibration-stays-safe |
| C — Conversation & stream (unique tool-call ids) | E2E-RUNTIME-unique-tool-call-ids-per-request |
| F — Persistence (stored model binding array) | E2E-PROVIDER-stored-binding-array-reads-entry-by-entry |
| Quality (stored model binding array) | E2E-PROVIDER-stored-binding-array-reads-entry-by-entry |
| Quality (unique tool-call ids) | E2E-RUNTIME-unique-tool-call-ids-per-request |
| C — Conversation & stream (system update during a tool call, restored) | E2E-RUNTIME-system-update-during-tool-call-restore |
| Quality (system update during a tool call, restored) | E2E-RUNTIME-system-update-during-tool-call-restore |
| C — Conversation & stream (loop context ownership) | E2E-RUNTIME-loop-context-ownership |
| C / F / Quality — Transcript invalid UTF-8 recovery | E2E-TRANSCRIPT-invalid-utf8-window-remains-readable |
| Quality (loop context ownership) | E2E-RUNTIME-loop-context-ownership |
| G — Plugin host lifecycle (crash report) | E2E-PLUGIN-crash-report-names-the-exit-code |
| Quality (crash report) | E2E-PLUGIN-crash-report-names-the-exit-code |
| C / E / F / Quality — Background Bash tasks outlive their turn | E2E-265 |
| C / E / Security / Quality — Codemode sandboxed nested calls | E2E-CODEMODE-sandboxed-nested-calls |

The `US-UI-*` visual scenarios (§UI shell visual scenarios) trace to the
Codex parity decisions in [decisions-log §D](../08-meta/decisions-log.md)
rather than the A–H criteria; their gold source is the capture suite.

The release artifact paths are covered by E2E-192, E2E-192a, E2E-196a,
E2E-196b, E2E-196c, and E2E-200 (Quality, M6+).

---

## 9. How AI Must Update This Doc

When adding or changing a feature that affects user-visible or protocol-visible behavior:

1. **Add a new scenario** using the template in §6 to the domain catalog that
   owns it (see [Scenario catalogs](#scenario-catalogs)). Assign the next available ID
   (`E2E-<N>`). IDs retired by ADR 0268 are never reused.
2. **Link it** to the relevant acceptance criterion (A–H) and milestone (M1–M6
   or M6+ for the current product increment).
3. **Set status** to `Draft` unless an automated test already exists.
4. **Update the traceability matrix** in §8.
5. **Commit** the update as part of the change (per [ai-development-workflow](03-ai-development-workflow.md) R3).

---

## 10. Future Automation Mapping

When E2E automation is implemented (post-M5):

- Each `Draft` scenario → Playwright test file.
- Scenario ID becomes test case name: `e2e-001-app-launches`.
- Fixtures and test data paths defined in a `tests/e2e/fixtures/` directory.
- CI gate: all E2E scenarios must pass before release.

Automation section will be expanded in a future ADR when the tooling decision is finalized.

---

## 11. Acceptance Criteria

This test plan spec is accepted when:

- [ ] All MVP acceptance criteria (A–H) have at least one E2E scenario.
- [ ] All security acceptance items have at least one E2E scenario.
- [ ] Every scenario links to at least one spec document.
- [ ] Traceability matrix is complete (scenarios ↔ acceptance ↔ milestones).
- [ ] Scenario template is defined and all entries follow it.
- [ ] AI update rules are documented and cross-linked to workflow spec.
- [ ] Environment requirements match baseline (native macOS arm64/Intel x64,
  clean profile).
