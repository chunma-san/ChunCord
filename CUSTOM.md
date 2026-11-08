# Building and updating

Use the `custom` branch. Install the package-manager version declared in `package.json`, then:

```sh
pnpm install --frozen-lockfile
node scripts/custom/test-testcord.mjs
node scripts/custom/test-illegalcord.mjs
pnpm testTsc
pnpm buildStandalone
```

Use the normal Equicord source injection procedure for your client. Release downloads contain the desktop bundle, source revisions and licenses; downloading a ZIP does not install it or restart Discord.

Public releases include `desktop.asar` and SHA-256 checksums. The ChunCord installer downloads the ASAR, and the standalone updater checks this fork's latest release, verifies its checksum and replaces it only after validation. Users do not need a source checkout. Existing source installations can keep using the local source updater. Source installations should keep the local branch named `custom` and track `origin/custom`.

## Source ownership

ChunCord retains the legacy `Button`, `Text`, `Forms`, `Switch` and tooltip adapters used by its selected plugin collections. Keep these adapters and their types when merging upstream UI migrations. Package updates use upstream's dependency catalog while preserving the additional dependencies needed by the selected plugins. The ChannelGallery endpoint adaptation is included in the import patch so a later sync preserves it.

| Source | What it supplies |
| --- | --- |
| Equicord `main` | Client, built-in Equicord plugins and its Vencord updates |
| ChunCord maintained collection | The 123 entries in `scripts/custom/testcord-allowlist.json`, originally imported from TestCord; maintained locally |
| Illegalcord `main` | The 45 entries in `scripts/custom/illegalcord-allowlist.json`, including the three previous user plugins |
| This fork | Compatibility helpers, reviewed patches and release workflow |

`scripts/custom/testcord-lock.json` records the upstream revision and source hashes. `patches/testcord/compat.patch` preserves the Equicord adaptations, including the encrypted vault migration and AI action confirmations. Plugin authorship remains with the original contributors. The imported GPL license is in `patches/testcord/LICENSE`.

The TestCord import is retired. Maintain these plugins directly in this repository and refresh only the affected entries in `ported_files` after reviewing a local change. Keep `source_files`, `native_sources`, `source`, and `revision` as historical import provenance, not as the current update source. Legacy `testcord` paths and plugin IDs are retained to preserve user settings, imports, and dependencies. The offline regression and hash checks remain mandatory.

To refresh Illegalcord from its reviewed upstream checkout:

```sh
python3 scripts/custom/sync-illegalcord.py /path/to/Illegalcord
```

The Illegalcord selection, exclusions, compatibility details and source links are documented in [ILLEGALCORD_PLUGINS.md](ILLEGALCORD_PLUGINS.md). Its importer and compatibility patch remain independent of the locally maintained collection.

The existing release workflow runs every six hours, on pushes to `custom` and on manual dispatch. Source and downloads publish only after the candidate build passes. Scheduled GitHub runs can be delayed or paused after inactivity.

If a plugin repository cannot be cloned, the workflow retains the committed selection and still requires its offline lock verification to pass. Illegalcord native changes stop its importer with exit code 3 before it writes any files; automated releases keep the existing verified selection while those changes await review. Other import errors still stop the build. The locally maintained ChunCord collection never fetches TestCord; its original provenance and GPL license remain recorded. Build timestamps come from the final source commit after synchronization.

ChunCord integration maintained by [chunma-san](https://github.com/chunma-san); original plugin authors and licenses remain preserved.

## Local Windows updater

`scripts/custom/Update-Equicord.ps1 -Project <checkout>` updates an existing source installation. Its untracked `local-tools.json` contains local executable paths for `node`, `git` and `pnpm`; keep it out of commits. Reuse the existing scheduled task. The updater builds separately, keeps rollback files and activates the new bundle on the next Discord restart. It preserves uncommitted plugin edits by refusing to overwrite them.

Add your own plugin source under `src/userplugins/<PluginName>/`. Upstream ignores that directory, so explicitly stage only the intended files. Keep credentials, account settings, logs and local deployment files outside Git.

## Compatibility

The upstream settings-modal resynchronization and numeric range UI are deferred in this release because their interaction with delayed writes introduced draft regressions. The previous settings controls remain unchanged. Imported TestCord and Illegalcord files are excluded from formatting to preserve their verified source hashes.

The November 2026 upstream merge retains JSON reporter metadata and handles an unavailable build number during early startup. Discord icon chunks load on demand; folder bookmarks and icon viewers update when those chunks arrive, with fallbacks while loading. Console and plugin callers can await `Vencord.Plugins.plugins.ConcatenatedModules.loadIcons()` to load all icons, or pass a comma-separated list of icon names. Calls made before Discord registers its loader reject with a not-ready error; mounted React consumers wait for registration. The public `WebpackPatcher.getBuildNumber()` accessor reads the current build number on each call. Run `node scripts/custom/test-icons.mjs` for deferred loading, import reuse and failed-chunk recovery checks.

All imported plugins start disabled and none is required. The three existing plugins retain their settings. Current Equicord modal, toast, layout and music APIs are used through local adapters. TestCord's full core, update system and unrelated plugins are excluded.

Imported native methods also check that their plugin is enabled. A small set of cleanup methods remains callable after disabling a plugin so it can stop its own server, sessions or subprocesses. This is an activation guard, not a sandbox for enabled plugins.

PasswordManager now starts locked and derives its encryption key from the entered password with PBKDF2 and a random salt. Existing legacy vaults migrate only after a successful unlock. AI Discord actions are disabled by default and require confirmation when enabled. These changes do not make a complete password-manager or third-party plugin security audit.

Some plugins depend on external services, API keys, operating-system tools or private Discord internals. A successful build establishes compilation, not a runtime test of all 123 plugins. Automation plugins can send messages or change server state when enabled; fake badges and profiles are local simulations.
