/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { readCappedText, safeFetch } from "../_support/safeFetch";
import { IpcMainInvokeEvent } from "electron";

export interface NativeGroqResponse {
    status: number;
    body: string;
    error?: string;
    headers?: Record<string, string>;
}

export async function groqFetch(
    _: IpcMainInvokeEvent,
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
): Promise<NativeGroqResponse> {
    try {
        const response = await safeFetch(url, {
            allowedHosts: ["api.groq.com", "reidverse-ai.up.railway.app"],
            method,
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body,
        });
        return {
            status: response.status,
            body: await readCappedText(response),
            headers: Object.fromEntries(response.headers.entries()),
        };
    } catch (error) {
        return {
            status: -1,
            body: "",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
