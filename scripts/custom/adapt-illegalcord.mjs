/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const manifest = JSON.parse(fs.readFileSync("scripts/custom/illegalcord-allowlist.json", "utf8"));
const support = "src/illegalcordplugins/_support";
const header = "/*\n * Vencord, a Discord client mod\n * Copyright (c) 2026 Vendicated and contributors\n * SPDX-License-Identifier: GPL-3.0-or-later\n */\n";
const constants = fs.readFileSync(path.join(process.argv[2], "src/utils/constants.ts"), "utf8");
const registry = ts.createSourceFile("constants.ts", constants, ts.ScriptTarget.Latest, true);
const definitions = new Map();
for (const statement of registry.statements) if (ts.isVariableStatement(statement))
    for (const item of statement.declarationList.declarations) {
        const name = item.name.getText(registry);
        if (!["Devs", "EquicordDevs"].includes(name)) continue;
        const call = item.initializer;
        if (!ts.isCallExpression(call) || call.expression.getText(registry) !== "Object.freeze") throw new Error("Unexpected author registry.");
        let authors = call.arguments[0];
        if (ts.isSatisfiesExpression(authors)) authors = authors.expression;
        if (!ts.isObjectLiteralExpression(authors)) throw new Error("Unexpected author registry.");
        for (const author of authors.properties) {
            if (!ts.isPropertyAssignment(author) || !ts.isObjectLiteralExpression(author.initializer)) throw new Error("Unexpected author entry.");
            for (const field of author.initializer.properties)
                if (!ts.isPropertyAssignment(field) || ![ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.BigIntLiteral, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.TrueKeyword].includes(field.initializer.kind)) throw new Error("Unexpected author field.");
        }
        definitions.set(name, call.getText(registry));
    }
if (definitions.size !== 2) throw new Error("Missing author registries.");
fs.mkdirSync(support, { recursive: true });
fs.writeFileSync(support + "/constants.ts", header + 'import type { Dev as BaseDev } from "@utils/constants";\ntype Dev = BaseDev & { github?: string; };\nexport * from "@utils/constants";\n' + [...definitions].map(([name, value]) => `export const ${name} = ${value};\n`).join(""));
fs.writeFileSync("src/illegalcordplugins/_kamidereCompat/branding.ts", header + 'import icon from "file://../../../browser/icon.png?base64";\nexport const BRAND_NAME = "ChunCord";\nexport const BRAND_ICON_DATA_URL = `data:image/png;base64,${icon}`;\n');
const validTags = new Set([...fs.readFileSync("src/utils/types.ts", "utf8").matchAll(/^    "([A-Za-z]+)",?$/gm)].map(m => m[1]));
for (const plugin of manifest.plugins) for (const file of plugin.files) {
    if (file.endsWith(".md")) {
        const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
        fs.writeFileSync(file, text.replace(/(\S)[\t ]{2,}$/gm, "$1<br>").replace(/[\t ]+$/gm, "").trimEnd() + "\n");
    }
    if (!/\.[mc]?[jt]sx?$/.test(file)) continue;
    let code = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    let relative = path.posix.relative(path.posix.dirname(file), support + "/constants");
    if (!relative.startsWith(".")) relative = "./" + relative;
    code = code.replaceAll('"@utils/constants"', JSON.stringify(relative));
    code = code.replaceAll('"file://../../../browser/Illegalcord.png?base64"', '"file://../../../browser/icon.png?base64"');
    if (plugin.name === "DiscordHardened") code = code
        .replace("migrateOldSettingToNewPlugin, ", "")
        .replace(/^migrateOldSettingToNewPlugin\("WebRTCLeakPrevent"[^\n]+\n/gm, "");
    if (plugin.name === "SoundcloudRPC") code = code.replaceAll("../IllegalcordDynamicIsland/native", "./native").replaceAll("pluginHelpers.IllegalcordDynamicIsland", "pluginHelpers.SoundcloudRPC");
    if (file.endsWith("discreetMode/index.tsx")) code = code
        .replace('import { installLarpCordPrivacy } from "./larpCord";\n', "")
        .replace("        const larpCordPrivacy = installLarpCordPrivacy(isInterfaceHidden);\n", "")
        .replace("            larpCordPrivacy.refresh();\n", "")
        .replace("            larpCordPrivacy.stop();\n", "")
        .replace("Client Diagnostics and LarpCord contact replacements remain available.", "Client Diagnostics remain available.")
        .replace("LarpCord profile changes are suspended in this mode. Its email and phone replacements remain active.", "Profile customization plugins are suspended in this mode.");
    const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    const edits = [];
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "definePlugin") {
            const object = node.arguments[0];
            if (!ts.isObjectLiteralExpression(object)) throw new Error("Unsupported plugin registration.");
            for (const property of object.properties) if (ts.isPropertyAssignment(property)) {
                const name = property.name.getText(ast);
                if (["name", "enabledByDefault", "required"].includes(name)) {
                    let end = property.end;
                    if (code[end] === ",") end++;
                    edits.push([property.getStart(ast), end, ""]);
                }
                if (name === "tags" && ts.isArrayLiteralExpression(property.initializer))
                    edits.push([property.initializer.getStart(ast), property.initializer.end, JSON.stringify(property.initializer.elements.filter(ts.isStringLiteral).map(x => x.text).filter(x => validTags.has(x)))]);
            }
            edits.push([object.getStart(ast) + 1, object.getStart(ast) + 1, `\n    name: ${JSON.stringify(plugin.name)},\n    enabledByDefault: false,\n    required: false,`]);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) code = code.slice(0, start) + text + code.slice(end);
    fs.writeFileSync(file, code.replace(/(required: false,)\s*(?=\S)/g, "$1\n    ").replace(/^[\t ]+$/gm, ""));
}
