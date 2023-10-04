import {
	EXTENSION_NAME_REGEX,
	EXTENSION_PKG_KEY,
	HYBRID_EXTENSION_TYPES,
	ExtensionManifest,
} from '@directus/constants';
import type { Extension } from '@directus/types';
import fse from 'fs-extra';
import path from 'path';
import { isTypeIn } from './array-helpers.js';
import { listFolders } from './list-folders.js';
import { resolvePackage } from './resolve-package.js';

export const findExtension = async (folder: string, filename: string) => {
	if (await fse.exists(path.join(folder, `${filename}.cjs`))) return `${filename}.cjs`;
	if (await fse.exists(path.join(folder, `${filename}.mjs`))) return `${filename}.mjs`;
	return `${filename}.js`;
};

export async function resolvePackageExtensions(root: string, extensionNames?: string[]): Promise<Extension[]> {
	const extensions: Extension[] = [];

	const local = extensionNames === undefined;

	if (extensionNames === undefined) {
		extensionNames = await listFolders(root);
		extensionNames = extensionNames.filter((name) => EXTENSION_NAME_REGEX.test(name));
	}

	for (const extensionName of extensionNames) {
		const extensionPath = local ? path.join(root, extensionName) : resolvePackage(extensionName, root);
		const extensionManifest: Record<string, any> = await fse.readJSON(path.join(extensionPath, 'package.json'));

		let parsedManifest;

		try {
			parsedManifest = ExtensionManifest.parse(extensionManifest);
		} catch (error: any) {
			throw new Error(`The extension manifest of "${extensionName}" is not valid.\n${error.message}`);
		}

		const extensionOptions = parsedManifest[EXTENSION_PKG_KEY];

		if (extensionOptions.type === 'bundle') {
			extensions.push({
				path: extensionPath,
				name: parsedManifest.name,
				description: parsedManifest.description || '',
				icon: parsedManifest.icon || '',
				version: parsedManifest.version,
				type: extensionOptions.type,
				entrypoint: {
					app: extensionOptions.path.app,
					api: extensionOptions.path.api,
				},
				entries: extensionOptions.entries,
				host: extensionOptions.host,
				secure: extensionOptions.secure === true,
				debugger: extensionOptions.debugger === true,
				requested_permissions: extensionOptions.permissions ?? [],
				local,
			});
		} else if (isTypeIn(extensionOptions, HYBRID_EXTENSION_TYPES)) {
			extensions.push({
				path: extensionPath,
				name: parsedManifest.name,
				description: parsedManifest.description ?? '',
				icon: parsedManifest.icon ?? '',
				version: parsedManifest.version,
				type: extensionOptions.type,
				entrypoint: {
					app: extensionOptions.path.app,
					api: extensionOptions.path.api,
				},
				host: extensionOptions.host,
				secure: extensionOptions.secure === true,
				debugger: extensionOptions.debugger === true,
				requested_permissions: extensionOptions.permissions ?? [],
				local,
			});
		} else {
			extensions.push({
				path: extensionPath,
				name: parsedManifest.name,
				description: parsedManifest.description ?? '',
				icon: parsedManifest.icon ?? '',
				version: parsedManifest.version,
				type: extensionOptions.type,
				entrypoint: extensionOptions.path,
				host: extensionOptions.host,
				secure: extensionOptions.secure === true,
				debugger: extensionOptions.debugger === true,
				requested_permissions: extensionOptions.permissions ?? [],
				local,
			});
		}
	}

	return extensions;
}

export async function getPackageExtensions(root: string): Promise<Extension[]> {
	let pkg: { dependencies?: Record<string, string> };

	try {
		pkg = await fse.readJSON(path.resolve(root, 'package.json'));
	} catch {
		throw new Error('Current folder does not contain a package.json file');
	}

	const extensionNames = Object.keys(pkg.dependencies ?? {}).filter((dep) => EXTENSION_NAME_REGEX.test(dep));

	return resolvePackageExtensions(root, extensionNames);
}
