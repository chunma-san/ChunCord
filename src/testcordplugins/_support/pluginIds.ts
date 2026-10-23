/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { Plugin } from "@utils/types";
export function getPluginId(plugin: { name: string; }) { return plugin.name; }
export function findPlugin(name: string, plugins: Record<string, Plugin>): Plugin | undefined {
    return plugins[name] ?? Object.values(plugins).find(plugin => plugin.name.toLowerCase() === name.toLowerCase());
}
