/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export interface VaultEnvelope {
    version: 2;
    iterations: number;
    salt: string;
    data: string;
}
export const VAULT_ITERATIONS = 600_000;
const MAX_VAULT_BYTES = 8 * 1024 * 1024;
function encode(bytes: Uint8Array): string {
    let text = "";
    for (let offset = 0; offset < bytes.length; offset += 8192)
        text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(text);
}
function decode(text: string): Uint8Array<ArrayBuffer> {
    if (text.length > MAX_VAULT_BYTES * 2) throw new Error("Vault is too large.");
    return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}
export function isVaultEnvelope(value: unknown): value is VaultEnvelope {
    return typeof value === "object" && value !== null
        && "version" in value && value.version === 2
        && "iterations" in value && typeof value.iterations === "number"
        && Number.isInteger(value.iterations) && value.iterations >= VAULT_ITERATIONS && value.iterations <= 2_000_000
        && "salt" in value && typeof value.salt === "string" && value.salt.length <= 64
        && "data" in value && typeof value.data === "string" && value.data.length <= MAX_VAULT_BYTES * 2;
}
export async function deriveVaultKey(password: string, salt: string, iterations = VAULT_ITERATIONS): Promise<CryptoKey> {
    const bytes = decode(salt);
    if (bytes.length !== 32) throw new Error("Invalid vault salt.");
    if (!Number.isInteger(iterations) || iterations < VAULT_ITERATIONS || iterations > 2_000_000) throw new Error("Invalid vault settings.");
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: bytes, iterations }, material,
        { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export function createVaultSalt() { return encode(crypto.getRandomValues(new Uint8Array(32))); }
export async function sealVault(key: CryptoKey, value: unknown): Promise<string> {
    const plain = new TextEncoder().encode(JSON.stringify(value));
    if (plain.length > MAX_VAULT_BYTES) throw new Error("Vault is too large.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
    const bytes = new Uint8Array(iv.length + encrypted.length);
    bytes.set(iv); bytes.set(encrypted, iv.length);
    return encode(bytes);
}
export async function openVault(key: CryptoKey, text: string): Promise<unknown> {
    const bytes = decode(text);
    if (bytes.length < 28) throw new Error("Invalid vault data.");
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return JSON.parse(new TextDecoder().decode(decrypted));
}
export async function generateTotp(secret: string, time = Date.now(), digits = 6): Promise<string> {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const clean = secret.toUpperCase().replace(/[\s=]/g, "");
    if (!clean || /[^A-Z2-7]/.test(clean) || ![6, 8].includes(digits)) throw new Error("Invalid TOTP secret.");
    let bits = 0, buffer = 0;
    const decoded: number[] = [];
    for (const char of clean) {
        buffer = (buffer << 5) | alphabet.indexOf(char);
        bits += 5;
        if (bits >= 8) { bits -= 8; decoded.push((buffer >>> bits) & 255); }
    }
    if (!decoded.length) throw new Error("Invalid TOTP secret.");
    const counter = new ArrayBuffer(8);
    new DataView(counter).setBigUint64(0, BigInt(Math.floor(time / 30_000)), false);
    const key = await crypto.subtle.importKey("raw", new Uint8Array(decoded), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
    const offset = signature[signature.length - 1] & 15;
    const value = new DataView(signature.buffer).getUint32(offset, false) & 0x7fffffff;
    return (value % 10 ** digits).toString().padStart(digits, "0");
}
