// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The names of the vault key types.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const VaultKeyType = {
	/**
	 * Ed25519.
	 */
	Ed25519: 0,

	/**
	 * Secp256k1.
	 */
	Secp256k1: 1
} as const;

/**
 * Vault key types.
 */
export type VaultKeyType = (typeof VaultKeyType)[keyof typeof VaultKeyType];
