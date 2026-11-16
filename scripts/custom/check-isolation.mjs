/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export function definition(code) {
    const source = ts.createSourceFile("index.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const exported = source.statements.find(ts.isExportAssignment);
    const call = exported?.expression;
    if (!call || !ts.isCallExpression(call) || call.expression.getText(source) !== "definePlugin")
        throw new Error("Cannot establish plugin definition");
    const object = call.arguments[0];
    if (!object || !ts.isObjectLiteralExpression(object) || object.properties.some(p => ts.isSpreadAssignment(p) || (p.name && ts.isComputedPropertyName(p.name))))
        throw new Error("Dynamic plugin definition requires review");
    const value = name => {
        const properties = object.properties.filter(p => p.name && p.name.text === name);
        if (properties.length > 1) throw new Error("Duplicate isolation metadata requires review");
        return properties[0];
    };
    if (value("__proto__")) throw new Error("Prototype metadata requires review");
    const required = value("required");
    const dependencies = value("dependencies");
    if (dependencies && (!ts.isPropertyAssignment(dependencies) || !ts.isArrayLiteralExpression(dependencies.initializer)
        || dependencies.initializer.elements.some(e => !ts.isStringLiteral(e))))
        throw new Error("Dynamic plugin dependencies require review");
    return { required: Boolean(required && (!ts.isPropertyAssignment(required) || required.initializer.kind !== ts.SyntaxKind.FalseKeyword)), dependencies: dependencies ? dependencies.initializer.elements.map(e => e.text) : [] };
}

export function verify(root, folders, names) {
    const regular = target => {
        if (fs.lstatSync(target).isSymbolicLink()) throw new Error("Linked plugin source requires review");
        return target;
    };
    regular(path.join(root, "src"));
    for (const folder of folders) {
        regular(path.dirname(path.join(root, folder)));
        regular(path.join(root, folder));
        const entry = ["index.ts", "index.tsx"].map(f => path.join(root, folder, f)).find(fs.existsSync);
        if (entry) regular(entry);
        if (!entry || definition(fs.readFileSync(entry, "utf8")).required)
            throw new Error("Required or unknown plugin cannot be isolated: " + folder);
    }
    for (const collection of ["plugins", "plugins/_api", "plugins/_core", "equicordplugins", "equicordplugins/_api", "equicordplugins/_core", "testcordplugins", "illegalcordplugins", "userplugins"]) {
        const base = path.join(root, "src", collection);
        if (!fs.existsSync(base)) continue;
        regular(base);
        for (const item of fs.readdirSync(base, { withFileTypes: true })) {
            if (item.name.startsWith("_") || item.name.startsWith(".") || item.name === "index.ts") continue;
            if (item.isSymbolicLink()) throw new Error("Linked plugin requires review: " + item.name);
            if (!item.isDirectory() && !(item.isFile() && /\.tsx?$/.test(item.name))) continue;
            const folder = `src/${collection}/${item.name}`;
            if (folders.includes(folder)) continue;
            const entry = item.isDirectory() ? ["index.ts", "index.tsx"].map(f => path.join(root, folder, f)).find(fs.existsSync) : path.join(root, folder);
            if (!entry) continue;
            regular(entry);
            const info = definition(fs.readFileSync(entry, "utf8"));
            if (info.dependencies.some(name => names.includes(name)))
                throw new Error("Retained plugin depends on isolated plugin: " + folder);
        }
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
    const request = JSON.parse(process.argv[2]);
    verify(process.cwd(), request.folders, request.names);
}
