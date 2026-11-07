/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useIcons } from "@equicordplugins/_core/concatenatedModules";
import { Icon } from "@vencord/discord-types";
import { useMemo } from "@webpack/common";

export function useDiscordFolderIcon(name?: string): Icon | undefined {
    const iconsModule = useIcons(name ?? "");
    if (!name) return;

    const icon = iconsModule[name];
    return typeof icon === "function" && name.endsWith("Icon") ? icon : undefined;
}

export function useDiscordFolderIconNames(): string[] {
    const iconsModule = useIcons();
    return useMemo(() => Object.keys(iconsModule)
        .filter(name => name.endsWith("Icon") && typeof iconsModule[name] === "function")
        .sort((a, b) => a.localeCompare(b)), [iconsModule]);
}
