<!-- CAT-COUNTER:START -->
<p align="center">
  <img src="https://count.himiku.com/@chunma-chuncord?theme=capoo-2&amp;padding=6&amp;scale=0.8&amp;darkmode=1" alt="Cute cat project visits counter" />
</p>
<!-- CAT-COUNTER:END -->

<p align="center">
  <a href="https://discord.com/users/891081797318897715"><img src="https://lanyard.cnrad.dev/api/891081797318897715?theme=dark&bg=0d1117&borderRadius=16px&showDisplayName=true&animated=true" alt="chunma Discord profile and activity" /></a>
</p>

# ChunCord

[![Build](https://github.com/chunma-san/ChunCord/actions/workflows/custom-release.yml/badge.svg?branch=custom)](https://github.com/chunma-san/ChunCord/actions/workflows/custom-release.yml)

My Equicord fork, with extra plugins and updates delivered inside Discord.

ChunCord keeps the Equicord plugin collection and adds **123 selected TestCord plugins** and **45 Illegalcord plugins**. Each collection has its own filter in the plugin settings, so you can find what you want without searching through everything.

## Get started

1. Download **[ChunCord Installer](https://github.com/chunma-san/ChunCord-Installer/releases/latest/download/ChunCord-Installer.exe)** for Windows x64.
2. Close Discord, open the installer, select your Discord installation and click **Install**.
3. Open Discord and go to **Settings → ChunCord → Plugins**.

You do not need Git, Node.js or a source folder. Once setup finishes, you can delete the downloaded installer. ChunCord keeps its installed files in your application data folder.

Imported plugins start disabled. Use **Show TestCord** or **Show Illegalcord** to browse the extra collections and enable the plugins you want.

## Staying up to date

Open **Settings → ChunCord → Updater** to check for updates or change your update preferences. Updates are verified and downloaded while Discord is running, then applied on the next start. Keep notifications enabled if you want a reminder to restart.

If Discord stops loading ChunCord after an update, close Discord and run **Repair** with the latest installer. Repair also fixes the `EPERM` update error on older installations. Choose **Uninstall** in the installer to remove ChunCord.

The installer is currently unsigned, so Windows may show an unknown publisher warning. Download it from the [ChunCord Installer releases](https://github.com/chunma-san/ChunCord-Installer/releases).

## What gets updated

The release workflow checks upstream every six hours. Equicord supplies the base client and Vencord changes. The selected plugins are synced from TestCord and Illegalcord, with ChunCord compatibility fixes applied before building.

A release is published only after the build checks pass. Merge conflicts or failed checks leave the previous release available. Native code changes require review. Discord changes can still break individual plugins after a successful build; read each plugin's description and settings before enabling it.

| Collection | Details |
| --- | --- |
| Equicord and Vencord | Base client and standard plugins, maintained through Equicord |
| TestCord | [The 123 selected plugins](TESTCORD_PLUGINS.md) |
| Illegalcord | [The 45 included plugins and exclusions](ILLEGALCORD_PLUGINS.md) |

For source builds, compatibility changes and release details, see [CUSTOM.md](CUSTOM.md).

## Maintainer and credits

Maintained by [chunma-san](https://github.com/chunma-san).

Built on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), with selected plugins from [TestCord](https://github.com/TestcordDev/TestCord) and [Illegalcord](https://github.com/ImHisako/Illegalcord). Original authorship and license notices are preserved. ChunCord is an independent fork.

- [Equicord documentation](https://equicord.org/)
- [Equicord plugin catalog](https://equicord.org/plugins)
- [GPL license](LICENSE)

ChunCord is not affiliated with Discord. Client modifications can violate Discord's terms. Cosmetic badges do not grant Nitro, verification or partnership.
