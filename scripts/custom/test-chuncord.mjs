/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

async function load(file, plugins = [], define = {}) {
    const result = await build({ entryPoints: [file], platform: "node", format: "esm", bundle: true, write: false, plugins, define });
    return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64"));
}
const helper = await load("src/shared/chuncordRelease.ts");
const prefix = "https://github.com/chunma-san/ChunCord/releases/download/chuncord-test/";
const data = Buffer.from("verified ASAR fixture");
const hash = createHash("sha256").update(data).digest("hex");
const release = { target_commitish: "b".repeat(40), name: "ChunCord bbbbbbbb", assets: [
    { name: "desktop.asar", size: data.length, browser_download_url: prefix + "desktop.asar" },
    { name: "SHA256SUMS.txt", size: 80, browser_download_url: prefix + "SHA256SUMS.txt" }
] };
assert.equal(helper.parseChunCordRelease(release, "desktop.asar").revision, "b".repeat(40));
assert.equal(helper.releaseMatches("b".repeat(40), "bbbbbbbb"), true);
assert.equal(helper.releaseMatches("b".repeat(40), ""), false);
assert.throws(() => helper.parseChunCordRelease({ ...release, assets: [] }, "desktop.asar"));
assert.throws(() => helper.parseChunCordRelease({ ...release, assets: release.assets.map(a => ({ ...a, browser_download_url: a.browser_download_url.replace("chunma-san/ChunCord", "other/repo") })) }, "desktop.asar"));
assert.equal(helper.releaseChecksum(hash + "  desktop.asar\n", "desktop.asar"), hash);
assert.throws(() => helper.releaseChecksum(hash + "  desktop.asar\n" + hash + "  desktop.asar\n", "desktop.asar"));

const directory = fs.mkdtempSync(path.join(path.resolve(".."), "chuncord-update-test-"));
const installed = path.join(directory, "chuncord.asar");
assert.equal(path.dirname(directory), path.resolve(".."));
fs.writeFileSync(installed, "previous version");
globalThis.chunCordReleaseFixture = release;
globalThis.chunCordDownloadFixture = Buffer.from("corrupt download");
globalThis.chunCordChecksumFixture = Buffer.from(hash + "  desktop.asar\n");
const mocks = [{ name: "isolated-update-fixtures", setup(builder) {
    builder.onResolve({ filter: /^original-fs$/ }, () => ({ path: "node:fs", external: true }));
    builder.onResolve({ filter: /^(~git-hash|~git-remote|@main\/utils\/http)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents:
        args.path === "~git-hash" ? 'export default "aaaaaaaa";' :
            args.path === "~git-remote" ? 'export default "chunma-san/ChunCord";' :
                `export async function fetchJson(url) {
                    if (url.endsWith("/releases/latest")) return globalThis.chunCordReleaseFixture;
                    if (url.endsWith("/compare/aaaaaaaa..." + "b".repeat(40))) return {commits:[{sha:"b".repeat(40),author:{login:"maintainer"},commit:{message:"New checked build"}}]};
                    throw new Error("Unexpected request: " + url);
                }
                export async function fetchBuffer(url) {
                    return url.endsWith("SHA256SUMS.txt") ? globalThis.chunCordChecksumFixture : globalThis.chunCordDownloadFixture;
                }`
    }));
} }];
try {
    const { default: updater } = await load("src/main/updater/http.ts", mocks, { __dirname: JSON.stringify(installed), IS_VESKTOP: "false", IS_EQUIBOP: "false" });
    assert.equal((await updater.listUpdates()).length, 1);
    await assert.rejects(updater.applyUpdate(), /verification failed/);
    assert.equal(fs.readFileSync(installed, "utf8"), "previous version");
    globalThis.chunCordDownloadFixture = data;
    await assert.rejects(updater.applyUpdate(), /Repair/);
    fs.writeFileSync(installed + ".loader-version", "1");
    assert.equal(await updater.applyUpdate(), true);
    assert.equal(fs.readFileSync(installed, "utf8"), "previous version");
    assert.deepEqual(fs.readFileSync(installed + ".pending"), data);
    assert.equal(JSON.parse(fs.readFileSync(installed + ".pending.json")).sha256, hash);
    globalThis.chunCordReleaseFixture = { ...release, target_commitish: "a".repeat(40) };
    assert.deepEqual(await updater.listUpdates(), []);
} finally {
    delete globalThis.chunCordReleaseFixture;
    delete globalThis.chunCordDownloadFixture;
    delete globalThis.chunCordChecksumFixture;
    for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
    fs.rmdirSync(directory);
}
console.log("ChunCord release validation, notification data, checksum rejection and restart-safe staging passed.");
