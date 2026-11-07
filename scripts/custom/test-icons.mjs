/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";

async function waitFor(predicate) {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
        assert(Date.now() < deadline, "Timed out waiting for icon publication");
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

const effects = [];
const subscriptions = [];
const timers = new Map();
function flushTimers() {
    for (const [timer, callback] of timers) {
        clearTimeout(timer);
        timers.delete(timer);
        callback();
    }
}
const sandbox = { effects, subscriptions, AbortController, module: { exports: {} },
    setTimeout(callback, delay) {
        const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
        timers.set(timer, callback);
        return timer;
    },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); }
};
const stubs = {
    "@utils/constants": "export const Devs = { thororen: {} };",
    "@utils/Logger": "export class Logger { warn() {} }",
    "@utils/types": "export default value => value;",
    "@webpack/common": `export const useEffect = effect => globalThis.effects.push(effect);
    export const React = { useSyncExternalStore(subscribe, snapshot) {
        const entry = { values: [snapshot()] };
        globalThis.subscriptions.push(entry);
        subscribe(() => { const value = snapshot(); if (value !== entry.values.at(-1)) entry.values.push(value); });
        return entry.values[0];
    } };`
};
const result = await build({
    entryPoints: ["src/equicordplugins/_core/concatenatedModules.tsx"],
    bundle: true, write: false, format: "cjs", platform: "node",
    plugins: [{ name: "fixtures", setup(b) {
        b.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
        b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path] }));
    } }]
});
vm.runInNewContext(result.outputFiles[0].text, sandbox);
const api = sandbox.module.exports;
await assert.rejects(api.loadIcons("FolderIcon"), /not ready/, "Early imperative requests must signal an unavailable loader");
const calls = [];
const FolderIcon = () => {};
let rejectBroken = true;
const loader = Object.assign(async path => {
    calls.push(path);
    if (path.includes("Broken") && rejectBroken) throw new Error("Chunk unavailable");
    return path.includes("Folder") ? { FolderIcon } : { BrokenIcon: () => {} };
}, { keys: () => ["./FolderIcon.web.tsx", "./BrokenIcon.web.tsx"] });
api.default.setIconLoader(loader);
assert.equal(calls.length, 0, "Registering the loader must not fetch chunks");
assert.equal(api.useIcons(" FolderIcon ").FolderIcon, undefined);
const mountedFolder = subscriptions.at(-1);
effects.splice(0).forEach(effect => effect());
await waitFor(() => api.iconsModule.FolderIcon === FolderIcon);
assert.deepEqual(calls, ["./FolderIcon.web.tsx"]);
assert.equal(mountedFolder.values.length, 2, "An existing subscriber updates when its icon arrives");
assert.equal(api.useIcons("FolderIcon").FolderIcon, FolderIcon);
effects.splice(0).forEach(effect => effect());
await api.loadIcons("FolderIcon");
assert.equal(calls.length, 1, "Resolved chunks must not be fetched twice");
api.useIcons();
effects.splice(0).forEach(effect => effect());
await api.loadIcons();
assert.equal(api.iconsModule.FolderIcon, FolderIcon, "One failed chunk must not discard loaded icons");
rejectBroken = false;
api.useIcons("BrokenIcon");
effects.splice(0).forEach(effect => effect());
await waitFor(() => typeof api.iconsModule.BrokenIcon === "function");
assert.equal(typeof api.iconsModule.BrokenIcon, "function", "Failed chunks can be retried");
assert.equal(api.default.iconsModule, api.iconsModule, "The public plugin registry stays current");
let finishSlow;
let keyReads = 0;
const ReadyIcon = () => {};
const slowLoader = Object.assign(path => path.includes("Slow") ? new Promise(resolve => { finishSlow = resolve; }) : Promise.resolve({ ReadyIcon }), {
    keys() { keyReads++; return ["./ReadyIcon.web.tsx", "./SlowIcon.web.tsx"]; }
});
api.default.setIconLoader(slowLoader);
api.useIcons();
effects.splice(0).forEach(effect => effect());
await waitFor(() => api.iconsModule.ReadyIcon === ReadyIcon);
assert.equal(api.iconsModule.ReadyIcon, ReadyIcon, "A pending chunk must not hide a ready icon");
api.useIcons("ReadyIcon");
effects.splice(0).forEach(effect => effect());
assert.equal(keyReads, 1, "Named consumers reuse the loader's path index");
finishSlow({ SlowIcon: () => {} });
await waitFor(() => typeof api.iconsModule.SlowIcon === "function");
assert.equal(typeof api.iconsModule.SlowIcon, "function");
let finishOld;
const oldLoader = Object.assign(() => new Promise(resolve => { finishOld = resolve; }), { keys: () => ["./FolderIcon.web.tsx"] });
api.default.setIconLoader(oldLoader);
api.useIcons("FolderIcon");
effects.splice(0).forEach(effect => effect());
const oldRequest = api.loadIcons("FolderIcon");
await waitFor(() => typeof finishOld === "function");
const NewFolderIcon = () => {};
const newLoader = Object.assign(async () => ({ FolderIcon: NewFolderIcon }), { keys: () => ["./FolderIcon.web.tsx"] });
api.default.setIconLoader(newLoader);
assert.equal(api.iconsModule.FolderIcon, undefined, "Replacing the loader clears stale icons");
api.useIcons("FolderIcon");
effects.splice(0).forEach(effect => effect());
await oldRequest;
assert.equal(api.iconsModule.FolderIcon, NewFolderIcon, "The original request follows a replacement loader without waiting for the old chunk");
finishOld({ FolderIcon });
await new Promise(setImmediate);
flushTimers();
assert.equal(api.iconsModule.FolderIcon, NewFolderIcon, "An old import cannot overwrite the replacement registry");
api.default.setIconLoader(loader);
const previousCalls = calls.length;
await api.default.loadIcons(" FolderIcon, FolderIcon, BrokenIcon ");
assert.equal(calls.length - previousCalls, 2, "Repeated names reuse the same import");
assert.equal(typeof api.default.iconsModule.BrokenIcon, "function", "Comma-separated names allow whitespace");
assert.equal(api.default.iconsModule.FolderIcon, FolderIcon, "Imperative callers can load icons without React");
const patch = api.default.patches[0].replacement;
const pattern = new RegExp(patch.match.source.replaceAll("\\i", "[A-Za-z_$][\\w$]*"));
const moduleSource = 'let saved=function helper(x){return x};function badge(p){let cache,{first:f,badgeIcon:b}=p;cache??=r(42);let path=`./${b}.web.tsx`;}';
const patchedSource = moduleSource.replace(pattern, patch.replace.replaceAll("$self", "plugin"));
let registered;
vm.runInNewContext(patchedSource, { plugin: { setIconLoader(value) { registered = value; } }, r: () => newLoader });
assert.equal(registered, newLoader, "The context loader registers without calling the badge function");
assert(patchedSource.includes('let saved=function helper(x){return x}'), "A preceding function expression stays unchanged");
api.useIcons("FolderIcon");
const removedIcon = subscriptions.at(-1);
api.default.setIconsModule({});
assert.equal(removedIcon.values.length, 2, "Removing an icon invalidates its mounted subscriber");
effects.splice(0);
let finishCancelled;
const cancelledLoader = Object.assign(() => new Promise(resolve => { finishCancelled = resolve; }), { keys: () => ["./FolderIcon.web.tsx"] });
api.default.setIconLoader(cancelledLoader);
api.useIcons();
const cleanup = effects.pop()();
await waitFor(() => typeof finishCancelled === "function");
cleanup();
let replacementCalls = 0;
api.default.setIconLoader(Object.assign(async () => { replacementCalls++; return { FolderIcon }; }, { keys: () => ["./FolderIcon.web.tsx"] }));
await new Promise(setImmediate);
assert.equal(replacementCalls, 0, "Unmounted consumers must not follow replacement loaders");
finishCancelled({ FolderIcon });
await new Promise(setImmediate);
flushTimers();
console.log("Icon registry: deferred loading, named requests, cached imports and partial failure recovery PASS");
