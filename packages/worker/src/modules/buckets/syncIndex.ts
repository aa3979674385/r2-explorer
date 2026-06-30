import { ChanfanaSchemaParam } from "chanfana";
import type { AppContext } from "../../types";
import { getIndex, syncIndex } from "./indexManager";

export class SyncIndex extends ChanfanaSchemaParam {
	schema = {};

	async handle(c: AppContext) {
		const bucketName = c.req.param("bucket");
		const bucket = c.env[bucketName] as R2Bucket | undefined;

		if (!bucket) {
			return c.json(
				{ error: `Bucket binding not found: ${bucketName}` },
				500,
			);
		}

		try {
			const existingIndex = await getIndex(bucket);
			const result = await syncIndex(bucket, existingIndex);

			return c.json({
				success: true,
				...result,
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return c.json({ success: false, error: message }, 500);
		}
	}
}
