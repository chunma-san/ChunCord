/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const compiled = await build({ entryPoints: ["src/main/applyHostPatch.ts"], bundle: true, write: false, platform: "node", format: "cjs", external: ["original-fs"] });
const module = { exports: {} };
const hostFs = { ...fs };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(name => name === "original-fs" ? hostFs : require(name), module, module.exports);
const { patchResourcesDir } = module.exports;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "chuncord-host-bootstrap-"));
try {
    const target = path.join(root, "chuncord.asar");
    const patcher = path.join(target, "patcher.js");
    const resources = path.join(root, "resources");
    fs.mkdirSync(resources);
    fs.writeFileSync(path.join(resources, "app.asar"), "vanilla");
    assert.equal(patchResourcesDir(resources, patcher), true);
    const index = path.join(resources, "app.asar", "index.js");
    const source = fs.readFileSync(index, "utf8");
    fs.writeFileSync(target, "old");
    const candidate = Buffer.from("new verified version");
    fs.writeFileSync(target + ".pending", candidate);
    const receipt = { version: 1, size: candidate.length, sha256: crypto.createHash("sha256").update(candidate).digest("hex"), revision: "a".repeat(40) };
    fs.writeFileSync(target + ".pending.json", JSON.stringify(receipt));
    let loaded;
    const run = () => vm.runInNewContext(source, { require(name) { if (name === "original-fs") return fs; if (name === "crypto") return crypto; assert.equal(name, target); loaded = fs.readFileSync(target, "utf8"); } });
    run();
    assert.equal(loaded, candidate.toString());
    assert.equal(fs.readFileSync(target + ".previous", "utf8"), "old");
    assert(!fs.existsSync(target + ".pending"));
    fs.writeFileSync(target + ".pending", "corrupt");
    fs.writeFileSync(target + ".pending.json", JSON.stringify(receipt));
    run(); assert.equal(loaded, candidate.toString());
    fs.writeFileSync(index, `require(${JSON.stringify(patcher)});`);
    const legacy = fs.readFileSync(index, "utf8");
    hostFs.renameSync = () => { throw new Error("rename failed"); };
    assert.throws(() => patchResourcesDir(resources, patcher), /rename failed/);
    assert.equal(fs.readFileSync(index, "utf8"), legacy);
    assert.deepEqual(fs.readdirSync(path.dirname(index)).sort(), ["index.js", "package.json"]);
    hostFs.renameSync = fs.renameSync;
    assert.equal(patchResourcesDir(resources, patcher), true);
    assert.equal(fs.readFileSync(index, "utf8"), source);
    assert.equal(patchResourcesDir(resources, patcher), false);
    fs.writeFileSync(index, 'require("other-mod");');
    assert.equal(patchResourcesDir(resources, patcher), false);
    assert.equal(fs.readFileSync(index, "utf8"), 'require("other-mod");');
    console.log("PASS: host-upgrade bootstrap activates verified updates before load; legacy repair is scoped and corrupt updates preserve the installed archive.");
} finally { fs.rmSync(root, { recursive: true, force: true }); }
