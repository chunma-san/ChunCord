# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later
param([string]$Project, [switch]$Force)
$ErrorActionPreference = 'Stop'
if (!$Project) { throw 'Specify the ChunCord project folder.' }
$Project = (Resolve-Path -LiteralPath $Project).Path
$state = Join-Path (Split-Path $Project) '.equicord-updater'
New-Item -ItemType Directory -Path $state -Force | Out-Null
$lock = $null
try {
    $lock = [IO.File]::Open((Join-Path $state 'update.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
} catch { exit 0 }
$log = Join-Path $state 'update.log'
try {
    $tools = Get-Content (Join-Path $Project 'local-tools.json') -Raw | ConvertFrom-Json
    foreach ($tool in @($tools.node, $tools.git, $tools.pnpm)) {
        if (!(Test-Path -LiteralPath $tool)) { throw 'A configured build tool is missing.' }
        $env:PATH = (Split-Path $tool) + ';' + $env:PATH
    }
    $env:CI = 'true'
    function Run([string]$Exe, [string[]]$Arguments) {
        $output = & $Exe @Arguments 2>&1
        $code = $LASTEXITCODE
        $output | Out-File $log -Append -Encoding utf8
        if ($code -ne 0) { throw "Build or source command failed with exit code $code. See update.log." }
        return $output
    }
    "`n$(Get-Date -Format o) Checking validated custom fork" | Out-File $log -Append -Encoding utf8
    $origin = (Run $tools.git @('-C', $Project, 'remote', 'get-url', 'origin') | Out-String).Trim()
    if ($origin -notmatch '^https://github\.com/chunma-san/(?:Equicord|ChunCord)(?:\.git)?$') { throw 'Unexpected custom fork repository.' }
    Run $tools.git @('-C', $Project, 'fetch', 'origin', 'custom') | Out-Null
    $target = (Run $tools.git @('-C', $Project, 'rev-parse', 'FETCH_HEAD') | Out-String).Trim()
    $head = (Run $tools.git @('-C', $Project, 'rev-parse', 'HEAD') | Out-String).Trim()
    $statusFile = Join-Path $state 'status.json'
    $installed = if (Test-Path $statusFile) { Get-Content $statusFile -Raw | ConvertFrom-Json } else { $null }
    if (!$Force -and $target -eq $head -and $installed.commit -eq $target) {
        "$(Get-Date -Format o) Already current: $head" | Out-File $log -Append
        exit 0
    }
    $modifiedPlugins = (Run $tools.git @('-C', $Project, 'status', '--porcelain', '--untracked-files=all', '--', 'src/userplugins', 'src/testcordplugins', 'scripts/custom', 'patches/testcord') | Out-String).Trim()
    $ignoredPlugins = (Run $tools.git @('-C', $Project, 'ls-files', '--others', '--ignored', '--exclude-standard', '--', 'src/userplugins', 'src/testcordplugins', 'scripts/custom', 'patches/testcord') | Out-String).Trim()
    if ($modifiedPlugins -or $ignoredPlugins) { throw 'Custom plugin edits are not committed to the fork yet. Preserving the installed build.' }
    Run $tools.git @('-C', $Project, 'merge-base', '--is-ancestor', 'HEAD', $target) | Out-Null
    $stage = Join-Path $state 'stage'
    if (!(Test-Path -LiteralPath $stage)) {
        Run $tools.git @('-C', $Project, 'worktree', 'add', '--detach', $stage, $target) | Out-Null
    } else {
        $actual = (Run $tools.git @('-C', $stage, 'rev-parse', '--show-toplevel') | Out-String).Trim().Replace('/', '\')
        if ($actual -ne $stage) { throw 'Unexpected staging checkout.' }
        Run $tools.git @('-C', $stage, 'reset', '--hard', $target) | Out-Null
    }
    $plugins = Join-Path $Project 'src\userplugins'
    Push-Location $stage
    try {
        Run $tools.pnpm @('install', '--frozen-lockfile') | Out-Null
        Run $tools.node @('scripts/custom/test-testcord.mjs') | Out-Null
        Run $tools.pnpm @('testTsc') | Out-Null
        Run $tools.node @('scripts/build/build.mjs') | Out-Null
    } finally { Pop-Location }
    foreach ($name in @('patcher.js', 'renderer.js', 'preload.js')) {
        if (!(Test-Path (Join-Path $stage "dist\desktop\$name"))) { throw 'Build output is incomplete.' }
    }
    $backup = Join-Path $state ('backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $backup | Out-Null
    Copy-Item (Join-Path $Project 'dist') (Join-Path $backup 'dist') -Recurse
    Copy-Item $plugins (Join-Path $backup 'userplugins') -Recurse
    $head | Set-Content (Join-Path $backup 'previous-commit.txt')
    Run $tools.git @('-C', $Project, 'merge', '--ff-only', $target) | Out-Null
    try {
        Copy-Item -Path (Join-Path $stage 'dist\*') -Destination (Join-Path $Project 'dist') -Recurse -Force
    } catch {
        Copy-Item -Path (Join-Path $backup 'dist\*') -Destination (Join-Path $Project 'dist') -Recurse -Force
        throw
    }
    @{ updated = (Get-Date -Format o); commit = $target; restartDiscordRequired = $true } |
        ConvertTo-Json | Set-Content (Join-Path $state 'status.json')
    "$(Get-Date -Format o) Updated successfully: $target. Effective on the next Discord restart." | Out-File $log -Append
} catch {
    "$(Get-Date -Format o) FAILED: $($_.Exception.Message)" | Out-File $log -Append
    Write-Error $_
    exit 1
} finally {
    if ($lock) { $lock.Dispose() }
}
