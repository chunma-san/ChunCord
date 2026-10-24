/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export interface ChunCordAsset { name: string; browser_download_url: string; size: number; }
export interface ChunCordRelease { revision: string; asset: ChunCordAsset; checksums: ChunCordAsset; }
const PREFIX = "https://github.com/chunma-san/ChunCord/releases/download/";
function isAsset(value: unknown): value is ChunCordAsset {
    return typeof value === "object" && value !== null
        && "name" in value && typeof value.name === "string"
        && "browser_download_url" in value && typeof value.browser_download_url === "string"
        && value.browser_download_url.startsWith(PREFIX)
        && "size" in value && typeof value.size === "number" && value.size > 0 && value.size <= 128 * 1024 * 1024;
}
export function parseChunCordRelease(value: unknown, filename: string): ChunCordRelease {
    if (typeof value !== "object" || value === null || !("assets" in value) || !Array.isArray(value.assets))
        throw new Error("ChunCord release information is incomplete.");
    const target = "target_commitish" in value && typeof value.target_commitish === "string" ? value.target_commitish : "";
    const name = "name" in value && typeof value.name === "string" ? value.name.split(" ").pop() ?? "" : "";
    const revision = /^[a-f0-9]{40}$/i.test(target) ? target : name;
    if (!/^[a-f0-9]{7,40}$/i.test(revision)) throw new Error("ChunCord release has no valid source revision.");
    const assets = value.assets.filter(isAsset);
    const asset = assets.find(a => a.name === filename);
    const checksums = assets.find(a => a.name === "SHA256SUMS.txt");
    if (!asset || !checksums) throw new Error("The ChunCord update is not ready. Try again later.");
    return { revision, asset, checksums };
}
export function releaseMatches(revision: string, current: string) {
    return /^[a-f0-9]{7,40}$/i.test(current) && (revision.startsWith(current) || current.startsWith(revision));
}
export function releaseChecksum(text: string, filename: string): string {
    if (text.length > 16_384) throw new Error("Invalid update checksum list.");
    const matches = text.split(/\r?\n/).map(line => /^([a-f0-9]{64}) [ *](.+)$/i.exec(line))
        .filter((match): match is RegExpExecArray => match !== null && match[2] === filename);
    if (matches.length !== 1) throw new Error("The update checksum is missing or ambiguous.");
    return matches[0][1].toLowerCase();
}
