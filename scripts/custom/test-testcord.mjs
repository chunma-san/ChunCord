/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import ts from "typescript";

async function load(file, plugins = []) {
    const output = await build({ entryPoints: [file], bundle: true, write: false, platform: "node", format: "esm", plugins });
    return import("data:text/javascript;base64," + Buffer.from(output.outputFiles[0].contents).toString("base64"));
}
const manifest = JSON.parse(fs.readFileSync("scripts/custom/testcord-allowlist.json", "utf8"));
assert.equal(manifest.plugins.length, 123);
assert.equal(new Set(manifest.plugins.map(p => p.name)).size, 123);
const lock = JSON.parse(fs.readFileSync("scripts/custom/testcord-lock.json", "utf8"));
for (const [file, hash] of Object.entries(lock.ported_files)) {
    const data = fs.readFileSync(file);
    const normalized = /\.(png|webp)$/.test(file) ? data : Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"));
    assert.equal(createHash("sha256").update(normalized).digest("hex"), hash, `${file} differs from the recorded port`);
}
const available = new Set(manifest.plugins.map(p => p.name));
for (const directory of ["src/plugins", "src/equicordplugins", "src/userplugins"])
    for (const entry of fs.readdirSync(directory, { recursive: true })) {
        if (!/\.tsx?$/.test(entry)) continue;
        const code = fs.readFileSync(path.join(directory, entry), "utf8");
        for (const match of code.matchAll(/\bname:\s*["']([^"']+)["']/g)) available.add(match[1]);
    }
for (const plugin of manifest.plugins) {
    const code = fs.readFileSync(plugin.entry, "utf8");
    const ast = ts.createSourceFile(plugin.entry, code, ts.ScriptTarget.Latest, true);
    let found = 0;
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "definePlugin") {
            const object = node.arguments[0];
            assert(ts.isObjectLiteralExpression(object), plugin.name);
            const properties = new Map(object.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast), p.initializer.getText(ast)]));
            assert.equal(JSON.parse(properties.get("name")), plugin.name);
            assert.equal(properties.get("enabledByDefault"), "false");
            assert.equal(properties.get("required"), "false");
            const dependencies = object.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === "dependencies");
            if (dependencies) {
                assert(ts.isArrayLiteralExpression(dependencies.initializer));
                for (const dep of dependencies.initializer.elements) {
                    assert(ts.isStringLiteral(dep));
                    assert(available.has(dep.text), `${plugin.name} requires missing plugin ${dep.text}`);
                }
            }
            found++;
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(found, 1, plugin.name);
}
const vault = await load("src/testcordplugins/_support/vault.ts");
const salt = vault.createVaultSalt();
const key = await vault.deriveVaultKey("test password only", salt);
assert.equal(key.extractable, false);
await assert.rejects(crypto.subtle.exportKey("raw", key));
const record = { example: { password: "test value" } };
const first = await vault.sealVault(key, record);
const second = await vault.sealVault(key, record);
assert.notEqual(first, second, "Each encryption must use a fresh IV");
assert.deepEqual(await vault.openVault(key, first), record);
const wrongKey = await vault.deriveVaultKey("different password", salt);
await assert.rejects(vault.openVault(wrongKey, first));
const tampered = Buffer.from(first, "base64");
tampered[tampered.length - 1] ^= 1;
await assert.rejects(vault.openVault(key, tampered.toString("base64")));
assert.equal(vault.isVaultEnvelope({ version: 2, salt, data: first, iterations: 1 }), false);
assert(!JSON.stringify({ version: 2, salt, data: first, iterations: vault.VAULT_ITERATIONS }).includes("test password only"));
assert.equal(await vault.generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000, 8), "94287082");
assert.equal(await vault.generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1_111_111_109_000, 8), "07081804");
await assert.rejects(vault.generateTotp("invalid!"));
const network = await load("src/testcordplugins/_support/safeFetch.ts");
await assert.rejects(network.assertSafeUrl("http://example.com"));
await assert.rejects(network.assertSafeUrl("https://user:password@example.com"));
await assert.rejects(network.assertSafeUrl("https://127.0.0.1"));
await assert.rejects(network.assertSafeUrl("https://[::1]"));
await assert.rejects(network.assertSafeUrl("https://example.com", { allowedHosts: ["discord.com"] }));
const originalFetch = globalThis.fetch;
try {
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "https://other.example/" } });
    await assert.rejects(network.safeFetch("https://example.com", { allowPrivateNetwork: true, headers: { Authorization: "test only" } }), /Cross-origin/);
    await assert.rejects(network.readCappedText(new Response("123456"), 3), /too large/);
} finally { globalThis.fetch = originalFetch; }
globalThis.testcordNativeSettings = { plugins: { Socket: { enabled: false } } };
const { guardNativeMethods } = await load("src/testcordplugins/_support/nativeGuard.ts", [{
    name: "mock-native-settings",
    setup(builder) {
        builder.onResolve({ filter: /^@main\/settings$/ }, () => ({ path: "settings", namespace: "test-settings" }));
        builder.onLoad({ filter: /.*/, namespace: "test-settings" }, () => ({ contents: "export const RendererSettings = { store: globalThis.testcordNativeSettings };" }));
    }
}]);
let active = false;
const guarded = guardNativeMethods("Socket", { startServer() { active = true; }, stopServer() { active = false; } });
assert.throws(() => guarded.startServer(), /disabled/);
globalThis.testcordNativeSettings.plugins.Socket.enabled = true;
guarded.startServer();
assert.equal(active, true);
globalThis.testcordNativeSettings.plugins.Socket.enabled = false;
guarded.stopServer();
assert.equal(active, false);
assert.throws(() => guarded.startServer(), /disabled/);
delete globalThis.testcordNativeSettings;
console.log("123 registrations, dependencies, vault/TOTP, network boundaries and disabled native access checks passed.");
