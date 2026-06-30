import type { AppContext } from "../types";

export interface IndexEntry {
	key: string;
	name: string;
	size: number;
	type: string;
	lastModified: string;
	etag: string;
	isFolder: boolean;
}

export interface IndexFile {
	version: number;
	lastUpdated: string;
	files: IndexEntry[];
}

const INDEX_PATH = ".r2-explorer/index.json";
const INDEX_VERSION = 1;

export async function getIndex(bucket: R2Bucket): Promise<IndexFile | null> {
	try {
		const obj = await bucket.get(INDEX_PATH);
		if (!obj) return null;

		const text = await obj.text();
		const index = JSON.parse(text) as IndexFile;

		if (index.version !== INDEX_VERSION) return null;
		return index;
	} catch {
		return null;
	}
}

export async function saveIndex(
	bucket: R2Bucket,
	index: IndexFile,
): Promise<void> {
	index.lastUpdated = new Date().toISOString();
	await bucket.put(INDEX_PATH, JSON.stringify(index), {
		httpMetadata: { contentType: "application/json" },
	});
}

export function addEntry(index: IndexFile, entry: IndexEntry): void {
	const existingIdx = index.files.findIndex((f) => f.key === entry.key);
	if (existingIdx >= 0) {
		index.files[existingIdx] = entry;
	} else {
		index.files.push(entry);
	}
}

export function removeEntry(index: IndexFile, key: string): void {
	index.files = index.files.filter((f) => f.key !== key);
}

export function renameEntry(index: IndexFile, oldKey: string, newKey: string): void {
	const entry = index.files.find((f) => f.key === oldKey);
	if (entry) {
		entry.key = newKey;
		entry.name = newKey.split("/").pop() || newKey;
	}
}

export function buildEntry(obj: R2Object): IndexEntry {
	return {
		key: obj.key,
		name: obj.key.split("/").pop() || obj.key,
		size: obj.size,
		type: obj.httpMetadata?.contentType || "application/octet-stream",
		lastModified: obj.uploaded.toISOString(),
		etag: obj.etag || "",
		isFolder: obj.key.endsWith("/"),
	};
}

interface SyncResult {
	added: number;
	updated: number;
	removed: number;
	skipped: number;
	changed: boolean;
}

export async function syncIndex(
	bucket: R2Bucket,
	existingIndex: IndexFile | null,
): Promise<SyncResult> {
	const result: SyncResult = {
		added: 0,
		updated: 0,
		removed: 0,
		skipped: 0,
		changed: false,
	};

	const isInitial = !existingIndex;
	const index = existingIndex || {
		version: INDEX_VERSION,
		lastUpdated: "",
		files: [],
	};

	// Build etag map from existing index
	const existingMap = new Map<string, string>();
	for (const entry of index.files) {
		existingMap.set(entry.key, entry.etag);
	}

	// List all R2 objects
	const seenKeys = new Set<string>();
	let truncated = true;
	let cursor: string | undefined;

	while (truncated) {
		const listResult = await bucket.list({
			include: ["httpMetadata"],
			cursor,
		});

		truncated = listResult.truncated;
		cursor = listResult.cursor;

		for (const obj of listResult.objects) {
			// Skip internal index file
			if (obj.key === INDEX_PATH) continue;
			// Skip hidden files unless showHiddenFiles is true
			// Skip share links
			if (obj.key.startsWith(".r2-explorer/")) continue;

			seenKeys.add(obj.key);
			const existingEtag = existingMap.get(obj.key);

			if (existingEtag === undefined) {
				// New file
				const entry = buildEntry(obj);
				addEntry(index, entry);
				result.added++;
				result.changed = true;
			} else if (existingEtag !== obj.etag) {
				// Modified file
				const entry = buildEntry(obj);
				addEntry(index, entry);
				result.updated++;
				result.changed = true;
			} else {
				result.skipped++;
			}
		}
	}

	// Detect deleted files
	const deletedKeys = [...existingMap.keys()].filter((k) => !seenKeys.has(k));
	for (const key of deletedKeys) {
		removeEntry(index, key);
		result.removed++;
		result.changed = true;
	}

	// Save if changed or initial sync
	if (result.changed || isInitial) {
		await saveIndex(bucket, index);
	}

	return result;
}

export async function deleteFromIndex(
	bucket: R2Bucket,
	key: string,
): Promise<void> {
	const index = await getIndex(bucket);
	if (!index) return;

	removeEntry(index, key);
	await saveIndex(bucket, index);
}

export async function addToIndex(
	bucket: R2Bucket,
	entry: IndexEntry,
): Promise<void> {
	let index = await getIndex(bucket);
	if (!index) {
		index = { version: INDEX_VERSION, lastUpdated: "", files: [] };
	}
	addEntry(index, entry);
	await saveIndex(bucket, index);
}

export async function updateIndexEntry(
	bucket: R2Bucket,
	oldKey: string,
	newKey: string,
): Promise<void> {
	const index = await getIndex(bucket);
	if (!index) return;

	renameEntry(index, oldKey, newKey);
	await saveIndex(bucket, index);
}
