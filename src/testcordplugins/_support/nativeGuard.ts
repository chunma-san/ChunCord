/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { RendererSettings } from "@main/settings";

const cleanup: Record<string, readonly string[]> = {
    AutoRedeem: ["cancelCaptchaSolves", "cancelAll"],
    FloeP2PService: ["cancelLatestSession", "cancelAllSessions"],
    MediaDownloader: ["stop"],
    MultiInstance: ["closeInstance", "closeAllInstances"],
    Socket: ["stopServer"]
};
export function guardNativeMethods<T extends Record<string, (...args: never[]) => unknown>>(plugin: string, methods: T): T {
    return Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, (...args: never[]) => {
        if (RendererSettings.store.plugins?.[plugin]?.enabled !== true && !cleanup[plugin]?.includes(name))
            throw new Error(`${plugin} is disabled.`);
        return method(...args);
    }])) as T;
}
