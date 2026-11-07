/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconsDef } from "@equicordplugins/iconViewer/types";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { React, useEffect } from "@webpack/common";

export let iconsModule: IconsDef = {};
type IconLoader = ((path: string) => Promise<IconsDef>) & { keys(): string[]; };
let iconLoader: IconLoader | undefined;
let revision = 0;
let generation = 0;
const iconVersions = new Map<string, number>();
const listeners = new Set<() => void>();
const imports = new Map<string, Promise<IconsDef | undefined>>();
let iconPaths: string[] = [];
const pathsByName = new Map<string, string>();
let bufferedIcons: IconsDef = {};
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let publication: Promise<void> | undefined;
let finishPublication: (() => void) | undefined;
function flushIcons() {
    if (flushTimer !== undefined) clearTimeout(flushTimer);
    flushTimer = undefined;
    if (Object.keys(bufferedIcons).length) {
        iconsModule = { ...iconsModule, ...bufferedIcons };
        for (const name of Object.keys(bufferedIcons)) iconVersions.set(name, revision + 1);
        bufferedIcons = {};
        notify();
    }
    finishPublication?.();
    publication = undefined;
    finishPublication = undefined;
}
function publishIcons(value: IconsDef) {
    Object.assign(bufferedIcons, value);
    if (flushTimer === undefined) {
        publication = new Promise(resolve => { finishPublication = resolve; });
        flushTimer = setTimeout(flushIcons, 16);
    }
}
function notify() {
    revision++;
    listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export async function loadIcons(names = "*", signal?: AbortSignal): Promise<IconsDef> {
    if (signal?.aborted) return iconsModule;
    if (!names) return iconsModule;
    if (!iconLoader) throw new Error("Discord's icon loader is not ready");
    const loader = iconLoader;
    const requestedGeneration = generation;
    const paths = names === "*" ? iconPaths : names.split(",").map(name => name.trim()).flatMap(name => {
        if (iconsModule[name]) return [];
        const path = pathsByName.get(name);
        return path ? [path] : [];
    });
    for (const path of paths) {
        if (imports.has(path)) continue;
        imports.set(path, Promise.resolve().then(() => loader(path)).then(value => {
            if (generation === requestedGeneration) publishIcons(value);
            return value;
        }).catch(error => {
            if (generation === requestedGeneration) {
                imports.delete(path);
                new Logger("ConcatenatedModules").warn("Could not load icon", path, error);
            }
            return undefined;
        }));
    }
    let unsubscribe = () => {};
    let onAbort = () => {};
    const replaced = new Promise<void>(resolve => {
        onAbort = resolve;
        signal?.addEventListener("abort", onAbort, { once: true });
        unsubscribe = subscribe(() => {
            if (generation !== requestedGeneration) resolve();
        });
    });
    try {
        await Promise.race([Promise.all(paths.map(path => imports.get(path))), replaced]);
        if (signal?.aborted) return iconsModule;
        if (generation !== requestedGeneration) return loadIcons(names, signal);
        await Promise.race([publication, replaced]);
        if (signal?.aborted) return iconsModule;
        if (generation !== requestedGeneration) return loadIcons(names, signal);
        return iconsModule;
    } finally {
        unsubscribe();
        signal?.removeEventListener("abort", onAbort);
    }
}
export function useIcons(names = "*"): IconsDef {
    names = names.split(",").map(name => name.trim()).filter(Boolean).join(",");
    React.useSyncExternalStore(subscribe, () => names === "*" ? revision : names ? `${generation}:${names.split(",").map(name => iconVersions.get(name) ?? 0).join(",")}` : "");
    useEffect(() => {
        if (!iconLoader) return;
        const controller = new AbortController();
        void loadIcons(names, controller.signal);
        return () => controller.abort();
    }, [names, iconLoader]);
    return iconsModule;
}

export default definePlugin({
    name: "ConcatenatedModules",
    description: "Extract modules that have been concatenated by the bundler",
    authors: [Devs.thororen],
    loadIcons,
    patches: [
        {
            find: ".web.tsx`",
            replacement: {
                match: /(?:^|(?<=[;{}]))function \i\(\i\)\{let \i,\{(?=[^}]{0,200}badgeIcon:)(?=.{0,400}?\?\?=(\i\(\d+\));let \i=`\.\/\$\{\i\}\.web\.tsx`)/,
                replace: "$self.setIconLoader($1);$&"
            }
        }
    ],
    setIconLoader(load: IconLoader) {
        if (load === iconLoader) return load;
        generation++;
        iconLoader = load;
        iconsModule = {};
        bufferedIcons = {};
        iconVersions.clear();
        if (flushTimer !== undefined) clearTimeout(flushTimer);
        flushTimer = undefined;
        finishPublication?.();
        publication = undefined;
        finishPublication = undefined;
        imports.clear();
        iconPaths = load.keys();
        pathsByName.clear();
        for (const path of iconPaths) {
            const name = path.match(/\/([^/]+)\.web\.tsx$/)?.[1];
            if (name) pathsByName.set(name, path);
        }
        notify();
        return load;
    },
    setIconsModule(value: IconsDef) {
        iconsModule = value;
        iconVersions.clear();
        for (const name of Object.keys(value)) iconVersions.set(name, revision + 1);
        notify();
    },
    get iconsModule() {
        return iconsModule;
    },
});
