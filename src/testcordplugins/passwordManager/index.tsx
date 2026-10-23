/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";
import { createVaultSalt, deriveVaultKey, generateTotp, isVaultEnvelope, openVault, sealVault, VAULT_ITERATIONS, type VaultEnvelope } from "../_support/vault";

import { DataStore } from "../_support/api";
import { Flex } from "../_support/Flex";
import SettingsPlugin from "@plugins/_core/settings";
import { TestcordDevs } from "../_support/constants";
import * as Modal from "../_support/modal";
import definePlugin, { type IconProps } from "@utils/types";
import { Button, React, Text, TextInput } from "../_support/webpack";

function LockIcon({ height = 20, width = 20, className }: IconProps) {
    return (
        <svg className={className} aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width={width} height={height} fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" fillRule="evenodd" d="M6 9h1V6a5 5 0 0 1 10 0v3h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Zm9-3v3H9V6a3 3 0 1 1 6 0Zm-1 8a2 2 0 0 1-1 1.73V18a1 1 0 1 1-2 0v-2.27A2 2 0 1 1 14 14Z" clipRule="evenodd" />
        </svg>
    );
}

interface PasswordEntry {
    id: string;
    title: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
    createdAt: number;
    updatedAt: number;
    twoFactorSecret?: string;
    twoFactorType?: "2fa_totp" | "2fa_hotp";
}

function isPasswordMap(value: unknown): value is Record<string, PasswordEntry> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    return Object.values(value).every(entry => typeof entry === "object" && entry !== null
        && "id" in entry && typeof entry.id === "string"
        && "title" in entry && typeof entry.title === "string"
        && "username" in entry && typeof entry.username === "string"
        && "password" in entry && typeof entry.password === "string"
        && "createdAt" in entry && typeof entry.createdAt === "number"
        && "updatedAt" in entry && typeof entry.updatedAt === "number");
}

class PasswordManager {
    public passwords: Record<string, PasswordEntry> = {};
    private encryptionKey: CryptoKey | null = null;
    private envelope: VaultEnvelope | null = null;
    private legacyHash: string | null = null;
    get masterHash(): string | null { return this.envelope ? "configured" : this.legacyHash; }
    get unlocked() { return this.encryptionKey !== null; }
    async init() {
        this.lock();
        const stored: unknown = await DataStore.get("passwordManager.vault.v2");
        if (stored != null && !isVaultEnvelope(stored)) throw new Error("Invalid encrypted vault. Saved data was preserved.");
        this.envelope = isVaultEnvelope(stored) ? stored : null;
        const legacy: unknown = await DataStore.get("passwordManager.masterHash");
        this.legacyHash = typeof legacy === "string" && /^[a-f0-9]{64}$/.test(legacy) ? legacy : null;
    }
    lock() { this.encryptionKey = null; this.passwords = {}; }
    private async installVault(password: string, records: Record<string, PasswordEntry>) {
        const salt = createVaultSalt();
        const key = await deriveVaultKey(password, salt);
        const envelope: VaultEnvelope = { version: 2, salt, iterations: VAULT_ITERATIONS, data: await sealVault(key, records) };
        await DataStore.set("passwordManager.vault.v2", envelope);
        this.envelope = envelope; this.encryptionKey = key; this.passwords = records;
        await DataStore.delMany(["passwordManager.masterHash", "passwordManager.data"]);
        this.legacyHash = null;
    }
    async setMasterPassword(password: string) {
        if (this.masterHash) throw new Error("Unlock the existing vault first.");
        if (password.length < 8) throw new Error("Use at least eight characters.");
        await this.installVault(password, {});
    }
    async verifyMasterPassword(password: string): Promise<boolean> {
        try {
            if (this.envelope) {
                const key = await deriveVaultKey(password, this.envelope.salt, this.envelope.iterations);
                const records = await openVault(key, this.envelope.data);
                if (!isPasswordMap(records)) return false;
                this.encryptionKey = key; this.passwords = records;
                return true;
            }
            if (!this.legacyHash) return false;
            const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)));
            const hash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
            if (hash !== this.legacyHash) return false;
            const stored: unknown = await DataStore.get("passwordManager.data");
            let records: unknown = {};
            if (typeof stored === "string") {
                const legacyKey = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
                records = await openVault(legacyKey, stored);
            }
            if (!isPasswordMap(records)) return false;
            await this.installVault(password, records);
            return true;
        } catch { return false; }
    }
    async save() {
        if (!this.encryptionKey || !this.envelope) throw new Error("Unlock the vault first.");
        const envelope = { ...this.envelope, data: await sealVault(this.encryptionKey, this.passwords) };
        await DataStore.set("passwordManager.vault.v2", envelope);
        this.envelope = envelope;
    }

    addPassword(entry: Omit<PasswordEntry, "id" | "createdAt" | "updatedAt">) {
        const id = crypto.randomUUID();
        const now = Date.now();
        this.passwords[id] = {
            ...entry,
            id,
            createdAt: now,
            updatedAt: now
        };
        this.save();
    }

    async deletePassword(id: string, masterPassword: string): Promise<boolean> {
        if (!await this.verifyMasterPassword(masterPassword)) {
            return false;
        }

        delete this.passwords[id];
        await this.save();
        return true;
    }

    async generateTOTPCode(secret: string): Promise<string> {
        try { return await generateTotp(secret); }
        catch { return "Invalid secret"; }
    }

}

const AddPasswordModal = ({ manager, onClose, ...props }: Modal.ModalProps & {
    manager: PasswordManager;
    onClose: () => void;
}) => {
    const [title, setTitle] = React.useState("");
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [twoFactorSecret, setTwoFactorSecret] = React.useState("");

    return (
        <Modal.ModalRoot {...props}>
            <Modal.ModalHeader separator={false}>
                <Text variant="heading-lg/semibold">Add Password</Text>
            </Modal.ModalHeader>
            <Modal.ModalContent className="password-modal-content">
                <div className="password-modal-section">
                    <Text variant="heading-sm/medium" style={{ marginBottom: "8px" }}>Title</Text>
                    <TextInput
                        placeholder="e.g., Discord Account"
                        value={title}
                        onChange={e => setTitle(e)}
                    />
                </div>
                <div className="password-modal-separator" />
                <div className="password-modal-section">
                    <Text variant="heading-sm/medium" style={{ marginBottom: "8px" }}>Login Details</Text>
                    <Flex direction={Flex.Direction.VERTICAL as any} gap={10} {...({} as any)}>
                        <TextInput
                            placeholder="Username or Email"
                            value={username}
                            onChange={e => setUsername(e)}
                        />
                        <TextInput
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e)}
                            type="password"
                        />
                    </Flex>
                </div>
                <div className="password-modal-separator" />
                <div className="password-modal-section">
                    <Text variant="heading-sm/medium" style={{ marginBottom: "8px" }}>Two-Factor Authentication (Optional)</Text>
                    <TextInput
                        placeholder="2FA Secret Key"
                        value={twoFactorSecret}
                        onChange={e => setTwoFactorSecret(e)}
                    />
                </div>
            </Modal.ModalContent>
            <Modal.ModalFooter className="password-modal-footer">
                <Flex justify={Flex.Justify.END as any} gap={10} {...({} as any)}>
                    <Button
                        color={Button.Colors.BRAND}
                        disabled={!title || !username || !password}
                        onClick={() => {
                            manager.addPassword({
                                title,
                                username,
                                password,
                                twoFactorSecret: twoFactorSecret || undefined,
                                twoFactorType: twoFactorSecret ? "2fa_totp" : undefined
                            });
                            onClose();
                        }}
                    >
                        Save
                    </Button>
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                </Flex>
            </Modal.ModalFooter>
        </Modal.ModalRoot>
    );
};

const SetMasterPasswordModal = ({ manager, onSuccess, ...props }: Modal.ModalProps & {
    manager: PasswordManager;
    onSuccess?: () => void;
}) => {
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [error, setError] = React.useState("");
    const mountedRef = React.useRef(true);

    React.useEffect(() => () => { mountedRef.current = false; }, []);

    return (
        <Modal.ModalRoot {...props}>
            <Modal.ModalHeader separator={false}>
                <Text variant="heading-lg/semibold">Set Master Password</Text>
            </Modal.ModalHeader>
            <Modal.ModalContent className="password-modal-content">
                <div className="password-modal-section">
                    <Flex direction={Flex.Direction.VERTICAL as any} gap={10} {...({} as any)}>
                        <TextInput
                            placeholder="Master Password (at least 8 characters)"
                            value={password}
                            onChange={e => setPassword(e)}
                            type="password"
                        />
                        <TextInput
                            placeholder="Confirm Master Password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e)}
                            type="password"
                        />
                        {error && <Text color="danger">{error}</Text>}
                    </Flex>
                </div>
            </Modal.ModalContent>
            <Modal.ModalFooter className="password-modal-footer">
                <Flex justify={Flex.Justify.END as any} gap={10} {...({} as any)}>
                    <Button
                        color={Button.Colors.BRAND}
                        disabled={password.length < 8 || !confirmPassword}
                        onClick={async () => {
                            if (password !== confirmPassword) {
                                setError("Passwords don't match!");
                                return;
                            }
                            await manager.setMasterPassword(password);
                            if (!mountedRef.current) return;
                            onSuccess?.();
                            props.onClose();
                        }}
                    >
                        Save
                    </Button>
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        onClick={props.onClose}
                    >
                        Cancel
                    </Button>
                </Flex>
            </Modal.ModalFooter>
        </Modal.ModalRoot>
    );
};

const DeletePasswordModal = ({
    manager,
    passwordId,
    passwordTitle,
    onSuccess,
    ...props
}: Modal.ModalProps & {
    manager: PasswordManager;
    passwordId: string;
    passwordTitle: string;
    onSuccess: () => void;
}) => {
    const [masterPassword, setMasterPassword] = React.useState("");
    const [error, setError] = React.useState("");
    const mountedRef = React.useRef(true);

    React.useEffect(() => () => { mountedRef.current = false; }, []);

    return (
        <Modal.ModalRoot {...props}>
            <Modal.ModalHeader separator={false}>
                <Text variant="heading-lg/semibold">Delete Password</Text>
            </Modal.ModalHeader>
            <Modal.ModalContent className="password-modal-content">
                <div className="password-modal-section">
                    <Text>Are you sure you want to delete "{passwordTitle}"?</Text>
                    <Text>Enter your master password to confirm:</Text>
                    <TextInput
                        placeholder="Master Password"
                        value={masterPassword}
                        onChange={e => setMasterPassword(e)}
                        type="password"
                    />
                    {error && <Text color="danger">{error}</Text>}
                </div>
            </Modal.ModalContent>
            <Modal.ModalFooter className="password-modal-footer">
                <Flex justify={Flex.Justify.END as any} gap={10} {...({} as any)}>
                    <Button
                        color={Button.Colors.RED}
                        disabled={!masterPassword}
                        onClick={async () => {
                            const success = await manager.deletePassword(passwordId, masterPassword);
                            if (!mountedRef.current) return;
                            if (success) {
                                onSuccess();
                                props.onClose();
                            } else {
                                setError("Incorrect master password");
                            }
                        }}
                    >
                        Delete
                    </Button>
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        onClick={props.onClose}
                    >
                        Cancel
                    </Button>
                </Flex>
            </Modal.ModalFooter>
        </Modal.ModalRoot>
    );
};

const ViewPasswordModal = ({
    manager,
    entry,
    ...props
}: Modal.ModalProps & {
    manager: PasswordManager;
    entry: PasswordEntry;
}) => {
    const [masterPassword, setMasterPassword] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState("");
    const mountedRef = React.useRef(true);

    React.useEffect(() => () => { mountedRef.current = false; }, []);

    const verifyAndShow = async () => {
        const isValid = await manager.verifyMasterPassword(masterPassword);
        if (!mountedRef.current) return;
        if (isValid) {
            setShowPassword(true);
        } else {
            setError("Incorrect master password");
        }
    };

    return (
        <Modal.ModalRoot {...props}>
            <Modal.ModalHeader separator={false}>
                <Text variant="heading-lg/semibold">View Password for {entry.title}</Text>
            </Modal.ModalHeader>
            <Modal.ModalContent className="password-modal-content">
                <div className="password-modal-section">
                    {!showPassword ? (
                        <>
                            <Text>Enter your master password to view:</Text>
                            <TextInput
                                placeholder="Master Password"
                                value={masterPassword}
                                onChange={e => setMasterPassword(e)}
                                type="password"
                            />
                            {error && <Text color="danger">{error}</Text>}
                        </>
                    ) : (
                        <Flex direction={Flex.Direction.VERTICAL as any} gap={10} {...({} as any)}>
                            <div className="password-view-section">
                                <Text variant="heading-sm/medium">Username</Text>
                                <Text>{entry.username}</Text>
                            </div>
                            <div className="password-view-section">
                                <Text variant="heading-sm/medium">Password</Text>
                                <Text>{entry.password}</Text>
                            </div>
                            {entry.twoFactorSecret && (
                                <div className="password-view-section">
                                    <Text variant="heading-sm/medium">2FA Secret</Text>
                                    <Text>{entry.twoFactorSecret}</Text>
                                </div>
                            )}
                        </Flex>
                    )}
                </div>
            </Modal.ModalContent>
            <Modal.ModalFooter className="password-modal-footer">
                <Flex justify={Flex.Justify.END as any} gap={10} {...({} as any)}>
                    {!showPassword ? (
                        <Button
                            color={Button.Colors.BRAND}
                            disabled={!masterPassword}
                            onClick={verifyAndShow}
                        >
                            View
                        </Button>
                    ) : (
                        <Button
                            color={Button.Colors.BRAND}
                            onClick={props.onClose}
                        >
                            Close
                        </Button>
                    )}
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        onClick={props.onClose}
                    >
                        Cancel
                    </Button>
                </Flex>
            </Modal.ModalFooter>
        </Modal.ModalRoot>
    );
};

const PasswordEntryComponent = ({ entry, manager, onDelete }: {
    entry: PasswordEntry;
    manager: PasswordManager;
    onDelete: () => void;
}) => {
    const [totpCode, setTotpCode] = React.useState<string>("");

    React.useEffect(() => {
        if (entry.twoFactorSecret && entry.twoFactorType === "2fa_totp") {
            let cancelled = false;
            const updateCode = async () => {
                const code = await manager.generateTOTPCode(entry.twoFactorSecret!);
                if (cancelled) return;
                setTotpCode(code);
            };
            updateCode();
            const interval = setInterval(updateCode, 1000);
            return () => { cancelled = true; clearInterval(interval); };
        }
    }, [entry.twoFactorSecret, entry.twoFactorType, manager]);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
    };

    return (
        <div className="password-entry" key={entry.id}>
            <div>
                <Text variant="heading-sm/medium">{entry.title}</Text>
                <Text>{entry.username}</Text>
            </div>
            <div className="password-actions">
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.BRAND}
                    onClick={() => {
                        Modal.openModal((props: any) => (
                            <ViewPasswordModal
                                {...props}
                                manager={manager}
                                entry={entry}
                            />
                        ) as any);
                    }}
                >
                    View
                </Button>
                <Button
                    size={Button.Sizes.SMALL}
                    onClick={() => copyToClipboard(entry.password)}
                >
                    Copy Password
                </Button>
                {totpCode && (
                    <Button
                        size={Button.Sizes.SMALL}
                        onClick={() => copyToClipboard(totpCode)}
                    >
                        2FA: {totpCode}
                    </Button>
                )}
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    onClick={() => {
                        Modal.openModal((props: any) => (
                            <DeletePasswordModal
                                {...props}
                                manager={manager}
                                passwordId={entry.id}
                                passwordTitle={entry.title}
                                onSuccess={onDelete}
                            />
                        ) as any);
                    }}
                >
                    Delete
                </Button>
            </div>
        </div>
    );
};

function UnlockVaultPanel({ manager, onUnlock }: { manager: PasswordManager; onUnlock(): void; }) {
    const [password, setPassword] = React.useState("");
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    return <Flex flexDirection="column">
        <Text variant="heading-lg/semibold">Unlock Password Manager</Text>
        <TextInput type="password" value={password} onChange={setPassword} placeholder="Master password" />
        {error && <Text>{error}</Text>}
        <Button disabled={busy || !password} onClick={async () => {
            setBusy(true);
            const unlocked = await manager.verifyMasterPassword(password);
            setBusy(false); setPassword("");
            if (unlocked) { setError(""); onUnlock(); }
            else setError("Could not unlock the vault. Check your password.");
        }}>Unlock</Button>
    </Flex>;
}

class PasswordManagerUI {
    private manager: PasswordManager;
    private hasMasterPassword: boolean;
    private forceUpdate: () => void;

    constructor(manager: PasswordManager) {
        this.manager = manager;
        this.hasMasterPassword = Boolean(manager.masterHash);
        this.forceUpdate = () => { };
    }

    render = () => {
        const [, setUpdateKey] = React.useState({});
        this.forceUpdate = () => setUpdateKey({});

        if (!this.hasMasterPassword) {
            return (
                <div className="password-manager-container">
                    <Flex direction={Flex.Direction.VERTICAL as any} gap={10} {...({} as any)}>
                        <Text variant="heading-lg/semibold">Password Manager Setup</Text>
                        <Text>Please set a master password to start using the password manager.</Text>
                        <Button
                            onClick={() => {
                                Modal.openModal((props: any) => (
                                    <SetMasterPasswordModal
                                        {...props}
                                        manager={this.manager}
                                        onSuccess={() => {
                                            this.hasMasterPassword = Boolean(this.manager.masterHash);
                                            this.forceUpdate();
                                        }}
                                    />
                                ) as any);
                            }}
                        >
                            Set Master Password
                        </Button>
                    </Flex>
                </div>
            );
        }

        if (!this.manager.unlocked) return <UnlockVaultPanel manager={this.manager} onUnlock={this.forceUpdate} />;

        return (
            <div className="password-manager-container">
                <Button onClick={() => { this.manager.lock(); this.forceUpdate(); }}>Lock Vault</Button>
                <Flex {...({ justify: Flex.Justify.BETWEEN as any, align: Flex.Align.CENTER as any } as any)}>
                    <Text variant="heading-lg/semibold">Password Manager</Text>
                    <Button
                        onClick={() => {
                            Modal.openModal((props: any) => (
                                <AddPasswordModal
                                    {...props}
                                    manager={this.manager}
                                    onClose={() => {
                                        props.onClose();
                                        this.forceUpdate();
                                    }}
                                />
                            ) as any);
                        }}
                    >
                        Add Password
                    </Button>
                </Flex>
                {Object.values(this.manager.passwords).map(entry => (
                    <PasswordEntryComponent
                        key={entry.id}
                        entry={entry}
                        manager={this.manager}
                        onDelete={this.forceUpdate}
                    />
                ))}
            </div>
        );
    };
}

export default definePlugin({
    name: "PasswordManager",
    enabledByDefault: false,
    required: false,
    description: "Local encrypted vault with an explicit unlock and no stored decryption key.",
    tags: ["Privacy","Utility"],
    authors: [TestcordDevs.x2b],

    passwordManager: null as PasswordManager | null,
    ui: null as PasswordManagerUI | null,

    async start() {
        this.passwordManager = new PasswordManager();
        await this.passwordManager.init();
        this.ui = new PasswordManagerUI(this.passwordManager);

        const settingsPlugin = Vencord.Plugins.plugins.Settings as any;
        if (settingsPlugin && settingsPlugin.customEntries) {
            settingsPlugin.customEntries.push({
                key: "passwordManager",
                title: "Password Manager",
                Component: () => this.ui!.render(),
                Icon: LockIcon
            });
        }
    },

    stop() {
        const { customEntries } = SettingsPlugin;
        const entry = customEntries.findIndex(entry => entry.key === "passwordManager");
        if (entry !== -1) customEntries.splice(entry, 1);

        this.passwordManager?.lock();
        this.passwordManager = null;
        this.ui = null;
    }
});
