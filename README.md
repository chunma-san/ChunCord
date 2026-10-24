<p align="center">
  <a href="https://discord.com/users/891081797318897715"><img src="https://lanyard.cnrad.dev/api/891081797318897715?theme=dark&bg=0d1117&borderRadius=16px&showDisplayName=true&animated=true" alt="chunma Discord profile and activity" /></a>
</p>

# ChunCord

[![Custom build](https://github.com/chunma-san/ChunCord/actions/workflows/custom-release.yml/badge.svg?branch=custom)](https://github.com/chunma-san/ChunCord/actions/workflows/custom-release.yml)

ChunCord is my Equicord fork, with the regular Equicord plugins, three custom additions and 123 selected plugins ported from TestCord.

The base stays with [Equicord](https://github.com/Equicord/Equicord). Vencord changes arrive through Equicord. Only the [selected TestCord plugins](TESTCORD_PLUGINS.md) and their required helpers come from [TestCord](https://github.com/TestcordDev/TestCord); its client, settings and updater are not imported.

## Install on Windows

1. Download **[ChunCord-Installer.exe](https://github.com/chunma-san/ChunCord-Installer/releases/latest/download/ChunCord-Installer.exe)**.
2. Close Discord, open the installer, select your Discord installation and click **Install**.
3. Start Discord and open **Settings → ChunCord → Plugins**.

Git, Node.js and a source folder are not needed. You can delete the downloaded installer after setup. ChunCord stores its own installed files in the application data folder.

New TestCord plugins start disabled. Enable only the ones you want. BadgeSelector, FakeMuteAndDeafen and ServerBadges are also included.

Updates download through ChunCord inside Discord. A notification tells you when to restart. You can also use **Settings → ChunCord → Updater**. The installer includes Repair and Uninstall. Keep the installer available if a Discord update needs a repair.

Updates are verified and staged while Discord is running, then applied before ChunCord loads on the next start. If an older installation reports an `EPERM` update error, close Discord and run **Repair** with the latest installer once.

Windows installers are currently unsigned. Windows may show an unrecognized publisher prompt. Official ChunCord downloads are hosted only under the two GitHub repositories linked here.

See [CUSTOM.md](CUSTOM.md) for source builds and release details.

## Updates

The release workflow checks upstream every six hours. It merges Equicord, syncs the fixed TestCord selection, reapplies the compatibility fixes and runs the checks before publishing. Conflicts or failed checks leave the previous release available. Native code changes require review before they can enter an automatic release.

Compilation checks cover both desktop targets and TypeScript. They do not guarantee that every plugin works with every Discord release. The TestCord selection includes optional automation and system integrations; read a plugin's settings before enabling it.

## Contributors

- [chunma-san](https://github.com/chunma-san): ChunCord maintenance, custom integrations and releases.

## Credits

Based on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), with selected plugins from [TestCord](https://github.com/TestcordDev/TestCord). Original authors and license notices remain in the source. This is an unofficial fork, not an official release from those projects.

- [Equicord documentation](https://equicord.org/)
- [Equicord plugin catalog](https://equicord.org/plugins)
- [Vencord](https://vencord.dev/)
- [GPL license](LICENSE)

Discord is a trademark of Discord Inc. This project is not affiliated with Discord. Client modifications can violate Discord's terms; cosmetic badges do not grant Nitro, verification or partnership.
