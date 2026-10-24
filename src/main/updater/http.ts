/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { parseChunCordRelease, releaseChecksum, releaseMatches, type ChunCordRelease } from "@shared/chuncordRelease";
import { createHash, randomUUID } from "crypto";
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "original-fs";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { Updater } from ".";
import { ASAR_FILE } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
let PendingUpdate: ChunCordRelease | null = null;

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function listUpdates() {
    const isOutdated = await fetchUpdate();
    if (!isOutdated) return [];

    if (!PendingUpdate) return [];
    const data = await githubGet(`/compare/${gitHash}...${PendingUpdate.revision}`);

    return data.commits.map((c: any) => ({
        hash: c.sha,
        author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
        message: c.commit.message.split("\n")[0]
    }));
}

async function fetchUpdate() {
    const data = parseChunCordRelease(await githubGet<unknown>("/releases/latest"), ASAR_FILE);
    if (releaseMatches(data.revision, gitHash)) {
        PendingUpdate = null;
        return false;
    }
    PendingUpdate = data;

    return true;
}

async function applyUpdate() {
    if (!PendingUpdate) return true;

    const candidate = PendingUpdate;
    const checksumList = await fetchBuffer(candidate.checksums.browser_download_url);
    const expected = releaseChecksum(checksumList.toString("utf8"), ASAR_FILE);
    const data = await fetchBuffer(candidate.asset.browser_download_url);
    if (data.length !== candidate.asset.size || createHash("sha256").update(data).digest("hex") !== expected)
        throw new Error("ChunCord update verification failed. The installed version was preserved.");
    if (!existsSync(`${__dirname}.loader-version`) || readFileSync(`${__dirname}.loader-version`, "utf8").trim() !== "1")
        throw new Error("Close Discord and run Repair in the latest ChunCord Installer once to enable restart-safe updates.");
    const temporary = `${__dirname}.update-${randomUUID()}`;
    const receiptTemporary = `${temporary}.json`;
    try {
        writeFileSync(temporary, data, { flush: true, flag: "wx" });
        // Electron holds the running archive open on Windows. The installer
        // bootstrap commits this verified candidate before loading it next time.
        writeFileSync(receiptTemporary, JSON.stringify({ version: 1, size: data.length, sha256: expected, revision: candidate.revision }), { flush: true, flag: "wx" });
        renameSync(temporary, `${__dirname}.pending`);
        renameSync(receiptTemporary, `${__dirname}.pending.json`);
    } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
        if (existsSync(receiptTemporary)) unlinkSync(receiptTemporary);
    }

    PendingUpdate = null;

    return true;
}

const HttpUpdater: Updater = {
    getRepo: async () => `https://github.com/${gitRemote}`,
    listUpdates,
    fetchUpdate,
    applyUpdate
};

export default HttpUpdater;
