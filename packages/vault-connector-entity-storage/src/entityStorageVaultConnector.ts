// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { AlreadyExistsError, Converter, Guards, Is, NotFoundError, RandomHelper } from "@gtsc/core";
import { Bip39, ChaCha20Poly1305, Ed25519 } from "@gtsc/crypto";
import type { IEntityStorageConnector } from "@gtsc/entity-storage-models";
import { nameof } from "@gtsc/nameof";
import type { IRequestContext } from "@gtsc/services";
import type { IVaultConnector, VaultEncryptionType, VaultKeyType } from "@gtsc/vault-models";
import type { IVaultKey } from "./models/IVaultKey";
import type { IVaultSecret } from "./models/IVaultSecret";

/**
 * Class for performing vault operations in memory.
 */
export class EntityStorageVaultConnector implements IVaultConnector {
	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<EntityStorageVaultConnector>();

	/**
	 * The entity storage for the vault keys.
	 * @internal
	 */
	private readonly _vaultKeyEntityStorageConnector: IEntityStorageConnector<IVaultKey>;

	/**
	 * The entity storage for the vault secrets.
	 * @internal
	 */
	private readonly _vaultSecretEntityStorageConnector: IEntityStorageConnector<IVaultSecret>;

	/**
	 * Create a new instance of EntityStorageVaultConnector.
	 * @param dependencies The dependencies for the logging connector.
	 * @param dependencies.vaultKeyEntityStorageConnector The vault key entity storage connector dependency.
	 * @param dependencies.vaultSecretEntityStorageConnector The vault secret entity storage connector dependency.
	 */
	constructor(dependencies: {
		vaultKeyEntityStorageConnector: IEntityStorageConnector<IVaultKey>;
		vaultSecretEntityStorageConnector: IEntityStorageConnector<IVaultSecret>;
	}) {
		Guards.object(EntityStorageVaultConnector._CLASS_NAME, nameof(dependencies), dependencies);
		Guards.object(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(dependencies.vaultKeyEntityStorageConnector),
			dependencies.vaultKeyEntityStorageConnector
		);
		Guards.object(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(dependencies.vaultSecretEntityStorageConnector),
			dependencies.vaultSecretEntityStorageConnector
		);
		this._vaultKeyEntityStorageConnector = dependencies.vaultKeyEntityStorageConnector;
		this._vaultSecretEntityStorageConnector = dependencies.vaultSecretEntityStorageConnector;
	}

	/**
	 * Create a key in the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to create in the vault.
	 * @param type The type of key to create.
	 * @returns The public key for the key pair in base64.
	 */
	public async createKey(
		requestContext: IRequestContext,
		name: string,
		type: VaultKeyType
	): Promise<string> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);
		Guards.arrayOneOf<VaultKeyType>(EntityStorageVaultConnector._CLASS_NAME, nameof(type), type, [
			"Ed25519"
		]);

		const existingVaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (!Is.empty(existingVaultKey)) {
			throw new AlreadyExistsError(
				EntityStorageVaultConnector._CLASS_NAME,
				"keyAlreadyExists",
				name
			);
		}

		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);
		const privateKey = Ed25519.privateKeyFromSeed(seed.slice(0, Ed25519.SEED_SIZE));
		const publicKey = Ed25519.publicKeyFromPrivateKey(privateKey);

		const vaultKey: IVaultKey = {
			id: `${requestContext.identity}/${name}`,
			type,
			privateKey: Converter.bytesToBase64(privateKey),
			publicKey: Converter.bytesToBase64(publicKey)
		};

		await this._vaultKeyEntityStorageConnector.set(requestContext, vaultKey);

		return Converter.bytesToBase64(publicKey);
	}

	/**
	 * Add a key to the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to add to the vault.
	 * @param type The type of key to add.
	 * @param privateKey The private key in base64 format.
	 * @param publicKey The public key in base64 format.
	 * @returns Nothing.
	 */
	public async addKey(
		requestContext: IRequestContext,
		name: string,
		type: VaultKeyType,
		privateKey: string,
		publicKey: string
	): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);
		Guards.arrayOneOf<VaultKeyType>(EntityStorageVaultConnector._CLASS_NAME, nameof(type), type, [
			"Ed25519"
		]);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(privateKey), privateKey);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(publicKey), publicKey);

		const existingVaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (!Is.empty(existingVaultKey)) {
			throw new AlreadyExistsError(
				EntityStorageVaultConnector._CLASS_NAME,
				"keyAlreadyExists",
				name
			);
		}

		const vaultKey: IVaultKey = {
			id: `${requestContext.identity}/${name}`,
			type,
			privateKey,
			publicKey
		};

		await this._vaultKeyEntityStorageConnector.set(requestContext, vaultKey);
	}

	/**
	 * Get a key from the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to get from the vault.
	 * @returns The key.
	 */
	public async getKey(
		requestContext: IRequestContext,
		name: string
	): Promise<{
		/**
		 * The type of the key e.g. Ed25519.
		 */
		type: VaultKeyType;

		/**
		 * The private key in base64 format.
		 */
		privateKey: string;

		/**
		 * The public key in base64 format.
		 */
		publicKey: string;
	}> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);

		const vaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (Is.empty(vaultKey)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "keyNotFound", name);
		}

		return {
			type: vaultKey.type,
			privateKey: vaultKey.privateKey,
			publicKey: vaultKey.publicKey
		};
	}

	/**
	 * Rename a key in the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to rename.
	 * @param newName The new name of the key.
	 * @returns Nothing.
	 */
	public async renameKey(
		requestContext: IRequestContext,
		name: string,
		newName: string
	): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(newName), newName);

		const vaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (Is.empty(vaultKey)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "keyNotFound", name);
		}

		await this._vaultKeyEntityStorageConnector.remove(
			requestContext,
			`${requestContext.identity}/${name}`
		);

		vaultKey.id = `${requestContext.identity}/${newName}`;

		await this._vaultKeyEntityStorageConnector.set(requestContext, vaultKey);
	}

	/**
	 * Remove a key from the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to create in the value.
	 * @returns Nothing.
	 */
	public async removeKey(requestContext: IRequestContext, name: string): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);

		const vaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (Is.empty(vaultKey)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "keyNotFound", name);
		}

		await this._vaultKeyEntityStorageConnector.remove(
			requestContext,
			`${requestContext.identity}/${name}`
		);
	}

	/**
	 * Sign the data using a key in the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to use for signing.
	 * @param data The data to sign in base64.
	 * @returns The signature for the data in base64.
	 */
	public async sign(requestContext: IRequestContext, name: string, data: string): Promise<string> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(data), data);

		const vaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (Is.empty(vaultKey)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "keyNotFound", name);
		}

		const signatureBytes = Ed25519.sign(
			Converter.base64ToBytes(vaultKey.privateKey),
			Converter.base64ToBytes(data)
		);

		return Converter.bytesToBase64(signatureBytes);
	}

	/**
	 * Verify the signature of the data using a key in the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to use for verification.
	 * @param data The data that was signed in base64.
	 * @param signature The signature to verify in base64.
	 * @returns True if the verification is successful.
	 */
	public async verify(
		requestContext: IRequestContext,
		name: string,
		data: string,
		signature: string
	): Promise<boolean> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(data), data);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(signature), signature);

		const vaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (Is.empty(vaultKey)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "keyNotFound", name);
		}

		return Ed25519.verify(
			Converter.base64ToBytes(vaultKey.publicKey),
			Converter.base64ToBytes(data),
			Converter.base64ToBytes(signature)
		);
	}

	/**
	 * Encrypt the data using a key in the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to use for encryption.
	 * @param encryptionType The type of encryption to use.
	 * @param data The data to encrypt in base64.
	 * @returns The encrypted data in base64.
	 */
	public async encrypt(
		requestContext: IRequestContext,
		name: string,
		encryptionType: VaultEncryptionType,
		data: string
	): Promise<string> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);
		Guards.arrayOneOf<VaultEncryptionType>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(encryptionType),
			encryptionType,
			["ChaCha20Poly1305"]
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(data), data);

		const vaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (Is.empty(vaultKey)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "keyNotFound", name);
		}

		const privateKey = Converter.base64ToBytes(vaultKey.privateKey);

		const nonce = RandomHelper.generate(12);

		const cipher = ChaCha20Poly1305.encryptor(privateKey, nonce);
		const payload = cipher.update(Converter.base64ToBytes(data));

		const encryptedBytes = new Uint8Array(nonce.length + payload.length);
		encryptedBytes.set(nonce);
		encryptedBytes.set(payload, nonce.length);

		return Converter.bytesToBase64(encryptedBytes);
	}

	/**
	 * Decrypt the data using a key in the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the key to use for decryption.
	 * @param encryptionType The type of encryption to use.
	 * @param encryptedData The data to decrypt in base64.
	 * @returns The decrypted data in base64.
	 */
	public async decrypt(
		requestContext: IRequestContext,
		name: string,
		encryptionType: VaultEncryptionType,
		encryptedData: string
	): Promise<string> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);
		Guards.arrayOneOf<VaultEncryptionType>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(encryptionType),
			encryptionType,
			["ChaCha20Poly1305"]
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(encryptedData), encryptedData);

		const vaultKey = await this._vaultKeyEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);
		if (Is.empty(vaultKey)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "keyNotFound", name);
		}

		const privateKey = Converter.base64ToBytes(vaultKey.privateKey);

		const encryptedBytes = Converter.base64ToBytes(encryptedData);

		const nonce = encryptedBytes.slice(0, 12);

		const decipher = ChaCha20Poly1305.decryptor(privateKey, nonce);
		const decryptedBytes = decipher.update(encryptedBytes.slice(nonce.length));

		return Converter.bytesToBase64(decryptedBytes);
	}

	/**
	 * Store a secret in the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the item in the vault to set.
	 * @param item The item to add to the vault.
	 * @returns Nothing.
	 */
	public async setSecret<T>(requestContext: IRequestContext, name: string, item: T): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);

		const vaultSecret: IVaultSecret = {
			id: `${requestContext.identity}/${name}`,
			data: JSON.stringify(item)
		};

		await this._vaultSecretEntityStorageConnector.set(requestContext, vaultSecret);
	}

	/**
	 * Get a secret from the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the item in the vault to get.
	 * @returns The item from the vault.
	 * @throws Error if the item is not found.
	 */
	public async getSecret<T>(requestContext: IRequestContext, name: string): Promise<T> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);

		const secret = await this._vaultSecretEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);

		if (Is.empty(secret)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "secretNotFound", name);
		}

		return JSON.parse(secret.data);
	}

	/**
	 * Remove a secret from the vault.
	 * @param requestContext The context for the request.
	 * @param name The name of the item in the vault to remove.
	 * @returns Nothing.
	 * @throws Error if the item is not found.
	 */
	public async removeSecret(requestContext: IRequestContext, name: string): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.string(
			EntityStorageVaultConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.string(EntityStorageVaultConnector._CLASS_NAME, nameof(name), name);

		const secret = await this._vaultSecretEntityStorageConnector.get(
			requestContext,
			`${requestContext.identity}/${name}`
		);

		if (Is.empty(secret)) {
			throw new NotFoundError(EntityStorageVaultConnector._CLASS_NAME, "secretNotFound", name);
		}

		return this._vaultSecretEntityStorageConnector.remove(
			requestContext,
			`${requestContext.identity}/${name}`
		);
	}
}
