/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync("scripts/custom/testcord-allowlist.json", "utf8"));
const support = "src/testcordplugins/_support";
const header = "/*\n * Vencord, a Discord client mod\n * Copyright (c) 2026 Vendicated and contributors\n * SPDX-License-Identifier: GPL-3.0-or-later\n */\n";
const relative = (file, to) => {
    let result = path.posix.relative(path.posix.dirname(file), to).replace(/\.tsx?$/, "");
    if (!result.startsWith(".")) result = "./" + result;
    return result;
};
const sourceRoot = process.argv[2];
if (sourceRoot) {
    const code = fs.readFileSync(path.join(sourceRoot, "src/utils/constants.ts"), "utf8").replace(/\r\n/g, "\n");
    const ast = ts.createSourceFile("constants.ts", code, ts.ScriptTarget.Latest, true);
    let definition;
    for (const statement of ast.statements) if (ts.isVariableStatement(statement))
        for (const item of statement.declarationList.declarations)
            if (item.name.getText(ast) === "TestcordDevs") {
                const call = item.initializer;
                if (!ts.isCallExpression(call) || call.expression.getText(ast) !== "Object.freeze") throw new Error("Unexpected author registry.");
                let authors = call.arguments[0];
                if (ts.isSatisfiesExpression(authors)) authors = authors.expression;
                if (!ts.isObjectLiteralExpression(authors)) throw new Error("Unexpected author registry.");
                for (const author of authors.properties) {
                    if (!ts.isPropertyAssignment(author) || !(ts.isIdentifier(author.name) || ts.isStringLiteral(author.name)) || !ts.isObjectLiteralExpression(author.initializer)) throw new Error("Unexpected author entry.");
                    for (const field of author.initializer.properties)
                        if (!ts.isPropertyAssignment(field) || !(ts.isIdentifier(field.name) || ts.isStringLiteral(field.name)) || ![ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.BigIntLiteral].includes(field.initializer.kind)) throw new Error("Unexpected author field.");
                }
                definition = call.getText(ast);
            }
    if (!definition) throw new Error("Upstream author registry is missing.");
    fs.writeFileSync(support + "/constants.ts", header + 'import type { Dev as EquicordDev } from "@utils/constants";\ntype Dev = EquicordDev & { github?: string; };\nexport * from "@utils/constants";\nexport const TestcordDevs = ' + definition + ";\n");
}
const redirects = {
    "@utils/constants": support + "/constants.ts",
    "@utils/testcordI18n": support + "/i18n.ts",
    "@utils/testcordModals": support + "/modal.tsx",
    "@utils/modal": support + "/modal.tsx",
    "@webpack/common": support + "/webpack.tsx",
    "@components/Flex": support + "/Flex.tsx",
    "@components/Badge": support + "/Badge.tsx",
    "@main/utils/safeFetch": support + "/safeFetch.ts",
    "@api/index": support + "/api.ts",
    "@utils/apiKeyWarning": support + "/apiKeyWarning.tsx",
    "@utils/localStorage": support + "/localStorage.ts",
    "@utils/pluginIds": support + "/pluginIds.ts",
    "@utils/margins": "@components/margins",
    "@utils/Logger.js": "@utils/Logger",
    "@api/RuntimeInterposition": support + "/RuntimeInterposition.ts",
    "@api/Notifications/Notifications": "@api/Notifications",
    "@testcordplugins/TestcordHelper/iconColors": support + "/iconColors.ts",
    "@testcordplugins/PanelLayout/modules/musicControls/settings": "@equicordplugins/musicControls/settings",
    "@testcordplugins/PanelLayout/modules/musicControls/spotify/SpotifyStore": "@equicordplugins/musicControls/spotify/SpotifyStore",
    "../vc-followUser": support + "/follow.ts",
};
const validTagsCode = fs.readFileSync("src/utils/types.ts", "utf8");
const validTags = new Set([...validTagsCode.matchAll(/^    "([A-Za-z]+)",?$/gm)].map(m => m[1]));
for (const entry of manifest.plugins) {
    for (const file of entry.files) {
        if (!/\.[mc]?[jt]sx?$/.test(file)) continue;
        let code = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
        code = code.replace(/(["'])(@[^"']+|\.\.[^"']*)\1/g, (whole, quote, value) => {
            const to = redirects[value];
            return to ? quote + (to.startsWith("src/") ? relative(file, to) : to) + quote : whole;
        });
        code = code.replace(/"PanelLayout"/g, '"MusicControls"');
        if (entry.name === "ApiSniper") code = code.replace(/(userBlacklist:\s*\{[\s\S]*?default:\s*)"[^"]*"/, '$1""');
        if (entry.name === "AutoClaim") code = code.replace(/(allowedguilds:\s*\{[\s\S]*?default:\s*)"[^"]*"/, '$1""');
        if (entry.name === "FakeUserSwitcher") code = code.replace(/identity_guild_id:\s*"\d+"/, 'identity_guild_id: "123456789012345678"');
        const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
        const edits = [];
        function visit(node) {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "definePlugin"
                && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
                const object = node.arguments[0];
                for (const property of object.properties) if (ts.isPropertyAssignment(property)) {
                    const name = property.name.getText(ast);
                    if (["name", "required", "enabledByDefault"].includes(name)) {
                        const end = code[property.end] === "," ? property.end + 1 : property.end;
                        edits.push([property.getStart(ast), end, ""]);
                    }
                    if (name === "tags" && ts.isArrayLiteralExpression(property.initializer)) {
                        const tags = property.initializer.elements.filter(ts.isStringLiteral).map(x => x.text).filter(x => validTags.has(x));
                        edits.push([property.initializer.getStart(ast), property.initializer.end, JSON.stringify(tags)]);
                    }
                }
                edits.push([object.getStart(ast) + 1, object.getStart(ast) + 1, "\n    name: " + JSON.stringify(entry.name) + ",\n    enabledByDefault: false,\n    required: false,"]);
            }
            ts.forEachChild(node, visit);
        }
        visit(ast);
        for (const [start,end,text] of edits.sort((a,b) => b[0] - a[0])) code = code.slice(0,start) + text + code.slice(end);
        code = code.replace(/(required: false,)\s*(?=\S)/g, "$1\n    ");
        fs.writeFileSync(file, code);
    }
}
const runtimeFile = support + "/RuntimeInterposition.ts";
fs.writeFileSync(runtimeFile, fs.readFileSync(runtimeFile, "utf8").replace('import { PluginHealth } from "@api/PluginHealth";\n', "").replace(/PluginHealth\.setRuntimeHookProvider\([^\n]+\);/, ""));
