/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, React, VoiceStateStore } from "@webpack/common";

const voice = findByPropsLazy("selectVoiceChannel") as { selectVoiceChannel(channelId: string | null): void; };
let followed: string | null = null;
let subscribed = false;
const listeners = new Set<() => void>();
function notify() { for (const listener of listeners) listener(); }
function onVoiceStates({ voiceStates }: { voiceStates: Array<{ userId: string; channelId?: string | null; }>; }) {
    if (!followed) return;
    const state = voiceStates.find(state => state.userId === followed);
    if (state?.channelId) voice.selectVoiceChannel(state.channelId);
}
export function follow(userId: string) {
    followed = userId;
    if (!subscribed) {
        FluxDispatcher.subscribe("VOICE_STATE_UPDATES", onVoiceStates);
        subscribed = true;
    }
    const state = VoiceStateStore.getVoiceStateForUser(userId);
    if (state?.channelId) voice.selectVoiceChannel(state.channelId);
    notify();
}
export function unfollow() {
    if (subscribed) FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStates);
    subscribed = false;
    followed = null;
    notify();
}
function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export function useFollowId() {
    return React.useSyncExternalStore(subscribe, () => followed, () => followed);
}
