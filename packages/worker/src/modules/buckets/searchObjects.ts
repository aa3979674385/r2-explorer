import { z } from "zod";
import { ChanfanaSchemaParam } from "chanfana";
import type { AppContext } from "../../types";
import { getIndex, type IndexEntry } from "./indexManager";

export class SearchObjects extends ChanfanaSchemaParam {
	schema = {
		request: {
			query: z.object({
				q: z.string().min(1),
				sortBy: z.enum(["name", "date", "size"]).default("name"),
				sortOrder: z.enum(["asc", "desc"]).default("asc"),
			}),
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const bucketName = c.req.param("bucket");

		const bucket = c.env[bucketName] as R2Bucket | undefined;
		if (!bucket) {
			return c.json(
				{ error: `Bucket binding not found: ${bucketName}` },
				500,
			);
		}

		const index = await getIndex(bucket);
		if (!index) {
			return c.json({ files: [], total: 0, synced: false });
		}

		const query = data.query.q.toLowerCase();
		let results = index.files.filter(
			(entry) =>
				entry.name.toLowerCase().includes(query) ||
				entry.key.toLowerCase().includes(query),
		);

		// Sort
		const sortOrder = data.query.sortOrder === "desc" ? -1 : 1;
		switch (data.query.sortBy) {
			case "name":
				results.sort((a, b) => sortOrder * a.name.localeCompare(b.name));
				break;
			case "date":
				results.sort(
					(a, b) =>
						sortOrder *
						(new Date(a.lastModified).getTime() -
							new Date(b.lastModified).getTime()),
				);
				break;
			case "size":
				results.sort((a, b) => sortOrder * (a.size - b.size));
				break;
		}

		return c.json({
			files: results,
			total: results.length,
			synced: true,
			lastUpdated: index.lastUpdated,
		});
	}
}
