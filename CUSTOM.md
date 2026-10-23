# Equicord Custom

This unofficial fork combines official [Equicord](https://github.com/Equicord/Equicord) source with three preserved user plugins: BadgesSelector, FakeMuteAndDeafen and ServerBadges. Original author credits and GPL notices remain in each plugin. Cosmetic badges are local previews; they do not grant Discord verification, partnership or Nitro.

The `custom` branch is the customized source. `main` is the original fork snapshot. The default branch is `custom` so the scheduled workflow can run. Every six hours, or on a manual run, the workflow merges official `main` in an isolated checkout, builds the desktop bundle and checks TypeScript. Only after success does it fast-forward `custom` and publish the desktop ZIP under **Releases → Equicord Custom**. A merge conflict, failed build, or concurrent source change prevents publication and preserves the previous build. GitHub scheduled jobs may be delayed and can be paused after repository inactivity; workflow_dispatch remains available.

For a source installation, clone this repository with `--branch custom`, install the package-manager version declared in `package.json`, run `pnpm install --frozen-lockfile`, then `pnpm build` and the normal Equicord injection procedure. The release ZIP is a standalone bundle, not a full Discord installer. The owner's existing source installation uses its separate local updater; downloading a release alone does not inject or restart Discord.

Add plugins under `src/userplugins/<PluginName>/`. The directory is ignored upstream, so add the intended source explicitly with `git add -f src/userplugins/<PluginName>`. Never add settings, tokens, logs, local tool configuration or Discord account data. The build includes tracked userplugin source and preserves it across upstream merges. Third-party code retains its original licenses and authorship.

Do not replace a local customized installation with an upstream build that omits these plugins. The local updater should follow the validated `custom` branch, retain rollback files and activate changes on the next Discord restart.

Discord client modifications are unofficial and may violate Discord's terms. Build checks establish compilation, not continued runtime compatibility with every Discord release. Plugin settings stay local and are never included in this repository.
