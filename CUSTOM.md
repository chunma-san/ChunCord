# Building and updating

Use the `custom` branch. Install the package-manager version declared in `package.json`, then:

```sh
pnpm install --frozen-lockfile
node scripts/custom/test-testcord.mjs
pnpm testTsc
pnpm buildStandalone --disable-updater
```

Use the normal Equicord source injection procedure for your client. Release downloads contain the desktop bundle, source revisions and licenses; downloading a ZIP does not install it or restart Discord.

The standalone ZIP disables Equicord's built-in ASAR updater because this fork publishes desktop ZIPs. Use the source updater below for automatic updates, or replace a standalone bundle manually with a newer checked download. Source installations should keep the local branch named `custom` and track `origin/custom`.

## Source ownership

| Source | What it supplies |
| --- | --- |
| Equicord `main` | Client, built-in Equicord plugins and its Vencord updates |
| TestCord `main` | Exactly the 123 entries in `scripts/custom/testcord-allowlist.json` and listed helpers |
| This fork | Three user plugins, compatibility helpers, reviewed patches and release workflow |

`scripts/custom/testcord-lock.json` records the upstream revision and source hashes. `patches/testcord/compat.patch` preserves the Equicord adaptations, including the encrypted vault migration and AI action confirmations. Plugin authorship remains with the original contributors. The imported GPL license is in `patches/testcord/LICENSE`.

To refresh the selection from a clean public upstream checkout:

```sh
python3 scripts/custom/sync-testcord.py /path/to/TestCord
```

The importer checks repository identity, file paths, source types and the fixed plugin count. It stages changes in a temporary directory and applies the port before replacing source. New upstream files are not imported automatically. A failed patch or an unreviewed native code change stops the update. Review such changes before using `--review-native`, update the patch if needed, then repeat the checks above. Changes to the selection itself require an explicit manifest edit.

The existing release workflow runs every six hours, on pushes to `custom` and on manual dispatch. Source and downloads publish only after the candidate build passes. Scheduled GitHub runs can be delayed or paused after inactivity.

## Local Windows updater

`scripts/custom/Update-Equicord.ps1 -Project <checkout>` updates an existing source installation. Its untracked `local-tools.json` contains local executable paths for `node`, `git` and `pnpm`; keep it out of commits. Reuse the existing scheduled task. The updater builds separately, keeps rollback files and activates the new bundle on the next Discord restart. It preserves uncommitted plugin edits by refusing to overwrite them.

Add your own plugin source under `src/userplugins/<PluginName>/`. Upstream ignores that directory, so explicitly stage only the intended files. Keep credentials, account settings, logs and local deployment files outside Git.

## Compatibility

All imported plugins start disabled and none is required. The three existing plugins retain their settings. Current Equicord modal, toast, layout and music APIs are used through local adapters. TestCord's full core, update system and unrelated plugins are excluded.

Imported native methods also check that their plugin is enabled. A small set of cleanup methods remains callable after disabling a plugin so it can stop its own server, sessions or subprocesses. This is an activation guard, not a sandbox for enabled plugins.

PasswordManager now starts locked and derives its encryption key from the entered password with PBKDF2 and a random salt. Existing legacy vaults migrate only after a successful unlock. AI Discord actions are disabled by default and require confirmation when enabled. These changes do not make a complete password-manager or third-party plugin security audit.

Some plugins depend on external services, API keys, operating-system tools or private Discord internals. A successful build establishes compilation, not a runtime test of all 123 plugins. Automation plugins can send messages or change server state when enabled; fake badges and profiles are local simulations.
