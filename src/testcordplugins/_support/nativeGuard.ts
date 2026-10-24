/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { RendererSettings } from "@main/settings";

const cleanup: Record<string, readonly string[]> = {
    AnonLi: ["abortUpload"],
    AutoRedeem: ["cancelCaptchaSolves", "cancelAll"],
    FloeP2PService: ["cancelLatestSession", "cancelAllSessions"],
    MediaDownloader: ["stop"],
    DiscordHardened: ["restore"],
    RamOptimizer: ["restore"],
    MultiInstance: ["closeInstance", "closeAllInstances"],
    Socket: ["stopServer"],
    YMusicSync: ["disconnect"]
};
export function guardNativeMethods<T extends Record<string, (...args: never[]) => unknown>>(plugin: string, methods: T): T {
    return Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, (...args: never[]) => {
        const stoppingSoundcloud = plugin === "SoundcloudRPC" && name === "configure" && args[1] === false;
        const restoringIcon = plugin === "ClientIcon" && name === "configure" && args[1] === "original" && args[2] === false;
        if (RendererSettings.store.plugins?.[plugin]?.enabled !== true && !cleanup[plugin]?.includes(name) && !stoppingSoundcloud && !restoringIcon)
            throw new Error(`${plugin} is disabled.`);
        return method(...args);
    }])) as T;
}
