/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { closeAllModals, closeModal, Modal, openMediaModal, openModal as openEquicordModal, openModalLazy as openEquicordModalLazy, React } from "@webpack/common";
import type { RenderModalProps } from "@vencord/discord-types";
import type { ComponentPropsWithRef, Context, CSSProperties, ReactNode } from "react";

export { closeAllModals, closeModal, openMediaModal };
export type { RenderModalProps } from "@vencord/discord-types";
export const ModalSize = { SMALL: "small", MEDIUM: "medium", LARGE: "large", DYNAMIC: "dynamic" } as const;
export type ModalSize = typeof ModalSize[keyof typeof ModalSize];
let closeContext: Context<() => void> | undefined;
function context() { return closeContext ??= React.createContext<() => void>(closeAllModals); }
export function openModal(render: Parameters<typeof openEquicordModal>[0], options?: Parameters<typeof openEquicordModal>[1]) {
    return openEquicordModal(props => {
        const Close = context();
        return <Close.Provider value={props.onClose}>{render(props)}</Close.Provider>;
    }, options);
}
export function openModalLazy(render: Parameters<typeof openEquicordModalLazy>[0], options?: Parameters<typeof openEquicordModalLazy>[1]) {
    return openEquicordModalLazy(async () => {
        const resolved = await render();
        return props => { const Close = context(); return <Close.Provider value={props.onClose}>{resolved(props)}</Close.Provider>; };
    }, options);
}
export interface ModalProps extends Omit<ComponentPropsWithRef<"div">, "title" | "role" | "onScroll"> {
    transitionState: number;
    onClose(): void;
    onScroll?(): void;
    role?: "dialog" | "alertdialog";
    size?: string;
    title?: ReactNode;
    hideShadow?: boolean;
    "aria-labelledby"?: string;
}
const sizes: Record<string, string> = { small: "sm", medium: "md", large: "lg", dynamic: "xxl" };
export function ModalRoot({ transitionState = 1, onClose, size = "medium", title = "", children, className, style }: Partial<ModalProps>) {
    const inheritedClose = React.useContext(context());
    return <Modal transitionState={transitionState} onClose={onClose ?? inheritedClose} size={sizes[size] ?? size} title={title}>
        <div className={className} style={style}>{children}</div>
    </Modal>;
}
interface SectionProps extends ComponentPropsWithRef<"div"> { separator?: boolean; wrap?: boolean; scrollbarType?: string; }
export function ModalHeader({ separator, wrap, style, ...props }: SectionProps) {
    return <Flex alignItems="center" justifyContent="space-between" style={{ padding: "12px 0", ...style }} {...props} />;
}
export function ModalContent({ scrollbarType, style, ...props }: SectionProps) { return <div style={{ padding: "8px 0", ...style }} {...props} />; }
export function ModalFooter({ separator, style, ...props }: SectionProps) { return <Flex justifyContent="flex-end" style={{ padding: "12px 0", ...style }} {...props} />; }
export function ModalCloseButton({ onClick, className }: { onClick?(): void; className?: string; withCircleBackground?: boolean; }) {
    const inheritedClose = React.useContext(context());
    return <Button variant="secondary" size="small" className={className} onClick={onClick ?? inheritedClose} aria-label="Close">Close</Button>;
}
export const CloseButton = ModalCloseButton;
export const Modals = { ModalRoot, ModalHeader, ModalContent, ModalFooter, ModalCloseButton };
export const ModalAPI = { openModal, openModalLazy, closeModal, closeAllModals };
