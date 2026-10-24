/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { build } from "esbuild";
import ts from "typescript";

const selection = JSON.parse(fs.readFileSync("scripts/custom/illegalcord-allowlist.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("scripts/custom/illegalcord-lock.json", "utf8"));
assert.equal(selection.plugins.length, 47);
assert.equal(lock.plugin_count, selection.plugins.length);
assert.equal(new Set(selection.plugins.map(p => p.name)).size, 47);
assert(!selection.plugins.some(p => p.name === "GhostSelfbot"));
for (const [file, hash] of Object.entries(lock.ported_files)) {
    const data = fs.readFileSync(file);
    const normalized = /\.(png|webp)$/.test(file) ? data : Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"));
    assert.equal(createHash("sha256").update(normalized).digest("hex"), hash, `${file} differs from the recorded port`);
}
const providers = new Map();
function registrations(file, callback) {
    const code = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "definePlugin") {
            const object = node.arguments[0];
            assert(ts.isObjectLiteralExpression(object));
            const properties = new Map(object.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast), p.initializer]));
            callback(properties, ast);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
}
for (const directory of ["src/plugins", "src/equicordplugins", "src/testcordplugins", "src/illegalcordplugins", "src/userplugins"].filter(fs.existsSync)) {
    for (const name of fs.readdirSync(directory, { recursive: true })) {
        if (!/\.(ts|tsx)$/.test(name)) continue;
        registrations(`${directory}/${name}`, properties => {
            const name = properties.get("name");
            if (!name || !ts.isStringLiteral(name)) return;
            assert(!providers.has(name.text), `Duplicate plugin: ${name.text}`);
            providers.set(name.text, directory);
        });
    }
}
for (const plugin of selection.plugins) {
    let found = 0;
    registrations(plugin.entry, (properties, ast) => {
        assert.equal(properties.get("name").text, plugin.name);
        assert.equal(properties.get("enabledByDefault").getText(ast), "false");
        assert.equal(properties.get("required").getText(ast), "false");
        const dependencies = properties.get("dependencies");
        if (dependencies) {
            assert(ts.isArrayLiteralExpression(dependencies));
            for (const dependency of dependencies.elements) {
                assert(ts.isStringLiteral(dependency));
                assert(providers.has(dependency.text), `${plugin.name} needs ${dependency.text}`);
            }
        }
        found++;
    });
    assert.equal(found, 1);
}
for (const name of ["BadgeSelector", "FakeMuteAndDeafen", "ServerBadges"])
    assert.equal(providers.get(name), "src/illegalcordplugins");

async function fixture(entry, stubs, state) {
    const output = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "cjs", plugins: [{
        name: "isolated-fixtures",
        setup(builder) {
            builder.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
            builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path] }));
        }
    }] });
    const sandbox = { module: { exports: {} }, fixture: state };
    vm.runInNewContext(output.outputFiles[0].text, sandbox);
    return sandbox.module.exports;
}
const state = { settings: { plugins: { DiscordHardened: { enabled: false }, SoundcloudRPC: { enabled: false }, ClientIcon: { enabled: false } } }, listeners: new Map(), permissions: 0, restores: 0 };
const session = { webRequest: { onBeforeRequest() {} } };
const originalRequest = session.webRequest.onBeforeRequest;
state.session = session;
state.app = {
    on(event, listener) { state.listeners.set(event, listener); },
    once(event, listener) { state.listeners.set(event, listener); },
    removeListener(event) { state.listeners.delete(event); },
    whenReady() { throw new Error("Import must not prepare a session"); }
};
const sessionModule = await fixture("src/illegalcordplugins/DiscordHardened/nativeSession.ts", {
    "@main/settings": "export const RendererSettings={store:globalThis.fixture.settings};",
    "@utils/Logger": "export class Logger { error(){} }",
    "@utils/text": "export const escapeRegExp=s=>s;",
    "electron": "export const app=globalThis.fixture.app;export const session={defaultSession:globalThis.fixture.session};",
    "./nativePermissions": "export function installPermissionControls(){globalThis.fixture.permissions++;return ()=>globalThis.fixture.restores++;}",
    "./network": "export const DEFAULT_ALLOWED_PATTERNS=[],DEFAULT_BLOCKED_PATTERNS=[],DEFAULT_FIREWALL_URLS=[];export const getBlockedRequestKind=()=>null;"
}, state);
assert.equal(state.listeners.size, 0);
assert.equal(state.permissions, 0);
assert.equal(session.webRequest.onBeforeRequest, originalRequest);
state.settings.plugins.DiscordHardened.enabled = true;
sessionModule.prepareSession(session);
assert.equal(state.listeners.size, 2);
assert.equal(state.permissions, 1);
assert.notEqual(session.webRequest.onBeforeRequest, originalRequest);
await sessionModule.releaseSession(session);
assert.equal(state.listeners.size, 0);
assert.equal(state.restores, 1);
assert.equal(session.webRequest.onBeforeRequest, originalRequest);

const { guardNativeMethods } = await fixture("src/testcordplugins/_support/nativeGuard.ts", {
    "@main/settings": "export const RendererSettings={store:globalThis.fixture.settings};"
}, state);
const cloud = guardNativeMethods("SoundcloudRPC", { configure: (_event, enabled) => enabled });
assert.throws(() => cloud.configure(null, true), /disabled/);
assert.equal(cloud.configure(null, false), false);
const icon = guardNativeMethods("ClientIcon", { configure: (_event, mode) => mode });
assert.throws(() => icon.configure(null, "illegalcord", true), /disabled/);
assert.equal(icon.configure(null, "original", false), "original");
const music = guardNativeMethods("YMusicSync", { connect: () => "connected", disconnect: () => "closed" });
assert.throws(() => music.connect(), /disabled/);
assert.equal(music.disconnect(), "closed");
console.log("47 Illegalcord registrations, unique providers, port hashes, disabled native access and session lifecycle checks passed.");
