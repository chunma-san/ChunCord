/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { definition, verify } from "./check-isolation.mjs";

assert.equal(definition('export default definePlugin({name: "Optional"});').required, false);
assert.equal(definition('const enabled = true; export default definePlugin({required: enabled});').required, true);
assert.equal(definition('export default definePlugin({/* required: true */ name: "Optional"});').required, false);
assert.throws(() => definition('export default definePlugin({...settings});'));
assert.throws(() => definition('export default definePlugin({dependencies: configured});'));
assert.throws(() => definition('export default definePlugin({["required"]: true});'));
assert.throws(() => definition('export default definePlugin({[key]: []});'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "chuncord-isolation-"));
assert.equal(definition('export default definePlugin({"requ\\u0069red": true});').required, true);
assert.throws(() => definition('export default definePlugin({required: false, required: true});'));
assert.throws(() => definition('export default definePlugin({dependencies: [], "dependencies": []});'));
assert.throws(() => definition('export default definePlugin({__proto__: {required: true}});'));
try {
    for (const [name, code] of Object.entries({ Broken: 'export default definePlugin({name: "Broken"});', Consumer: 'export default definePlugin({required: true, dependencies: ["Broken"]});' })) {
        const folder = path.join(root, "src/testcordplugins", name);
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(path.join(folder, "index.ts"), code);
    }
    assert.throws(() => verify(root, ["src/testcordplugins/Broken"], ["Broken"]), /depends on isolated/);
    fs.rmSync(path.join(root, "src/testcordplugins/Consumer"), { recursive: true });
    fs.mkdirSync(path.join(root, "src/userplugins"));
    fs.writeFileSync(path.join(root, "src/userplugins/Consumer.ts"), 'export default definePlugin({dependencies: ["Broken"]});');
    assert.throws(() => verify(root, ["src/testcordplugins/Broken"], ["Broken"]), /depends on isolated/);
    const originalStat = fs.lstatSync;
    try {
        for (const linked of ["src/userplugins", "src/testcordplugins/Broken/index.ts"]) {
            fs.lstatSync = target => path.resolve(target) === path.resolve(root, linked) ? { isSymbolicLink: () => true } : originalStat(target);
            assert.throws(() => verify(root, ["src/testcordplugins/Broken"], ["Broken"]), /Linked/);
        }
    } finally {
        fs.lstatSync = originalStat;
    }
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}
console.log("Optional definition and retained dependency checks passed.");
