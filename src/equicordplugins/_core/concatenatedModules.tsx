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
function publishIcons(value: IconsDef) {
    Object.assign(bufferedIcons, value);
    if (flushTimer !== undefined) return;
    flushTimer = setTimeout(() => {
        iconsModule = { ...iconsModule, ...bufferedIcons };
        for (const name of Object.keys(bufferedIcons)) iconVersions.set(name, revision + 1);
        bufferedIcons = {};
        flushTimer = undefined;
        notify();
    }, 16);
}
function notify() {
    revision++;
    listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export function useIcons(names = "*"): IconsDef {
    React.useSyncExternalStore(subscribe, () => names === "*" ? revision : names ? `${generation}:${names.split(",").map(name => iconVersions.get(name) ?? 0).join(",")}` : "");
    useEffect(() => {
        if (!iconLoader || !names) return;
        const loader = iconLoader;
        const requestedGeneration = generation;
        const paths = names === "*" ? iconPaths : names.split(",").flatMap(name => {
            if (iconsModule[name]) return [];
            const path = pathsByName.get(name);
            return path ? [path] : [];
        });
        const pending = paths.filter(path => !imports.has(path));
        for (const path of pending) {
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
    }, [names, iconLoader]);
    return iconsModule;
}

export default definePlugin({
    name: "ConcatenatedModules",
    description: "Extract modules that have been concatenated by the bundler",
    authors: [Devs.thororen],
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
