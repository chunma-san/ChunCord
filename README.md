<p align="center">
  <a href="https://discord.com/users/891081797318897715"><img src="https://lanyard.cnrad.dev/api/891081797318897715?theme=dark&bg=0d1117&borderRadius=16px&showDisplayName=true&animated=true" alt="chunma Discord profile and activity" /></a>
</p>

# Equicord Custom

[![Custom build](https://github.com/chunma-san/Equicord/actions/workflows/custom-release.yml/badge.svg?branch=custom)](https://github.com/chunma-san/Equicord/actions/workflows/custom-release.yml)

My Equicord setup, with the regular Equicord plugins, three custom additions and 123 selected plugins ported from TestCord.

The base stays with [Equicord](https://github.com/Equicord/Equicord). Vencord changes arrive through Equicord. Only the [selected TestCord plugins](TESTCORD_PLUGINS.md) and their required helpers come from [TestCord](https://github.com/TestcordDev/TestCord); its client, settings and updater are not imported.

## Downloads

The latest checked desktop bundle is in [Releases](https://github.com/chunma-san/Equicord/releases/tag/custom-latest). It is a standalone bundle for an existing source installation, not a Discord installer. See [CUSTOM.md](CUSTOM.md) for building and updating.

The added TestCord plugins start disabled. Enable the ones you want in settings. BadgeSelector, FakeMuteAndDeafen and ServerBadges remain in `src/userplugins`; existing preferences stay local.

## Updates

The release workflow checks upstream every six hours. It merges Equicord, syncs the fixed TestCord selection, reapplies the compatibility fixes and runs the checks before publishing. Conflicts or failed checks leave the previous release available. Native code changes require review before they can enter an automatic release.

Compilation checks cover both desktop targets and TypeScript. They do not guarantee that every plugin works with every Discord release. The TestCord selection includes optional automation and system integrations; read a plugin's settings before enabling it.

## Credits

Based on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), with selected plugins from [TestCord](https://github.com/TestcordDev/TestCord). Original authors and license notices remain in the source. This is an unofficial fork, not an official release from those projects.

- [Equicord documentation](https://equicord.org/)
- [Equicord plugin catalog](https://equicord.org/plugins)
- [Vencord](https://vencord.dev/)
- [GPL license](LICENSE)

Discord is a trademark of Discord Inc. This project is not affiliated with Discord. Client modifications can violate Discord's terms; cosmetic badges do not grant Nitro, verification or partnership.
