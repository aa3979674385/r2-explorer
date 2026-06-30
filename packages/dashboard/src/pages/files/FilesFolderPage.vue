<template>
  <q-page class="">
    <div class="q-pa-md" ref="pageContainer" @scroll="handleScroll" style="height: 100vh; overflow-y: auto;">
      <div class="flex items-center q-mb-sm">
        <q-breadcrumbs class="col">
          <q-breadcrumbs-el style="cursor: pointer" v-for="obj in breadcrumbs" :key="obj.name" :label="obj.name" @click="breadcrumbsClick(obj)" />
        </q-breadcrumbs>
        <q-input
          dense
          outlined
          v-model="searchQuery"
          :placeholder="$t('files.searchPlaceholder')"
          clearable
          class="q-mr-sm"
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="clearSearch"
        >
          <template v-slot:prepend>
            <q-icon name="search" class="cursor-pointer" @click="handleSearch" />
          </template>
        </q-input>
        <q-select
          dense
          outlined
          v-model="sortBy"
          :options="sortOptions"
          :label="$t('files.sortBy')"
          class="q-mr-sm"
          style="width: 120px"
          @update:model-value="handleSort"
        />
        <q-btn
          dense
          flat
          :icon="sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'"
          @click="toggleSortOrder"
        >
          <q-tooltip>{{ sortOrder === 'asc' ? $t('files.asc') : $t('files.desc') }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          icon="sync"
          color="orange"
          class="q-ml-sm"
          :loading="syncLoading"
          @click="handleSyncIndex"
        >
          <q-tooltip>{{ $t('layout.syncIndex') }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          icon="link"
          color="primary"
          class="q-ml-sm"
          :label="$t('files.manageShares')"
          @click="$refs.shareFile.openManageShares()"
        >
          <q-tooltip>View and manage all share links</q-tooltip>
        </q-btn>
      </div>

      <drag-and-drop ref="uploader">

        <q-table
          ref="table"
          :rows="rows"
          :columns="columns"
          row-key="name"
          :loading="loading"
          :hide-pagination="true"
          :rows-per-page-options="[0]"
          column-sort-order="da"
          :flat="true"
          table-class="file-list"
          @row-dblclick="openRowClick"
          @row-click="openRowDlbClick"
        >

          <template v-slot:loading>
              <div class="full-width q-my-lg">
                  <h6 class="flex items-center justify-center">
                      <q-spinner
                              color="primary"
                              size="xl"
                      />
                  </h6>
              </div>
          </template>

          <template v-slot:no-data>
            <div class="full-width q-my-lg" v-if="!loading">
              <h6 class="flex items-center justify-center"><q-icon name="folder" color="orange" size="lg" />{{ $t('files.emptyFolder') }}</h6>
            </div>
          </template>

          <template v-slot:body-cell-name="prop">
            <td class="flex" style="align-items: center">
              <q-icon :name="prop.row.icon" size="sm" :color="prop.row.color" class="q-mr-xs" />
              {{prop.row.name}}
            </td>
          </template>

          <template v-slot:body-cell="prop">
            <q-td :props="prop">
              {{prop.value}}
            </q-td>
            <q-menu
              touch-position
              context-menu
            >
              <FileContextMenu :prop="prop" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @duplicateObject="$refs.options.duplicateObject" @updateMetadataObject="$refs.options.updateMetadataObject" @createShareLink="$refs.shareFile.openCreateShare" />
            </q-menu>
          </template>

          <template v-slot:body-cell-options="prop">
            <td class="text-right">
              <q-btn round flat icon="more_vert" size="sm">
                <q-menu>
                  <FileContextMenu :prop="prop" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @duplicateObject="$refs.options.duplicateObject" @updateMetadataObject="$refs.options.updateMetadataObject" @createShareLink="$refs.shareFile.openCreateShare" />
                </q-menu>
              </q-btn>
            </td>
          </template>
        </q-table>

        <div v-if="loadingMore" class="q-pa-md text-center">
          <q-spinner color="primary" size="md" />
          <div class="q-mt-sm text-grey">{{ $t('files.loadingMore') }}</div>
        </div>

        <div v-if="!hasMore && rows.length > 0 && !loading" class="q-pa-md text-center text-grey">
          {{ $t('files.noMoreFiles') }}
        </div>

      </drag-and-drop>

    </div>
  </q-page>

  <file-preview ref="preview"/>
  <file-options ref="options" />
  <share-file ref="shareFile" />
</template>

<script>
import FileOptions from "components/files/FileOptions.vue";
import ShareFile from "components/files/ShareFile.vue";
import FilePreview from "components/preview/FilePreview.vue";
import DragAndDrop from "components/utils/DragAndDrop.vue";
import FileContextMenu from "pages/files/FileContextMenu.vue";
import { useQuasar } from "quasar";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";
import { ROOT_FOLDER, apiHandler, decode, encode } from "../../appUtils";

export default defineComponent({
	name: "FilesIndexPage",
	components: {
		FileContextMenu,
		FileOptions,
		DragAndDrop,
		FilePreview,
		ShareFile,
	},
	data: () => ({
		loading: false,
		loadingMore: false,
		rows: [],
		cursor: null,
		hasMore: true,
		searchQuery: "",
		sortBy: "name",
		sortOrder: "asc",
		syncLoading: false,
		columns: [
			{
				name: "name",
				required: true,
				label: this.$t('files.name'),
				align: "left",
				field: "name",
				sortable: true,
				sort: (a, b, rowA, rowB) => {
					if (rowA.type === "folder") {
						if (rowB.type === "folder") {
							// both are folders
							return a.localeCompare(b);
						}
						// only first is folder
						return 1;
					}
					if (rowB.type === "folder") {
						// only second is folder
						return -1;
					}
					// none is folder
					return a.localeCompare(b);
				},
			},
			{
				name: "lastModified",
				required: true,
				label: this.$t('files.lastModified'),
				align: "left",
				field: "lastModified",
				sortable: true,
				sort: (a, b, rowA, rowB) => {
					return rowA.timestamp - rowB.timestamp;
				},
			},
			{
				name: "size",
				required: true,
				label: this.$t('files.size'),
				align: "left",
				field: "size",
				sortable: true,
				sort: (a, b, rowA, rowB) => {
					return rowA.sizeRaw - rowB.sizeRaw;
				},
			},
			{
				name: "options",
				label: "",
				sortable: false,
			},
		],
	}),
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		selectedFolder: function () {
			if (
				this.$route.params.folder &&
				this.$route.params.folder !== ROOT_FOLDER
			) {
				return decode(this.$route.params.folder);
			}
			return "";
		},
		searchPrefix: function () {
			return this.selectedFolder + this.searchQuery;
		},
		sortOptions: function () {
			return [
				{ label: this.$t('files.sortName'), value: "name" },
				{ label: this.$t('files.sortDate'), value: "date" },
				{ label: this.$t('files.sortSize'), value: "size" },
				{ label: this.$t('files.sortType'), value: "type" },
			];
		},
		breadcrumbs: function () {
			if (this.selectedFolder) {
				return [
					{
						name: this.selectedBucket,
						path: "/",
					},
					...this.selectedFolder
						.split("/")
						.filter((obj) => obj !== "")
						.map((item, index, arr) => {
							return {
								name: item,
								path: `${arr
									.slice(0, index + 1)
									.join("/")
									.replace("Home/", "")}/`,
							};
						}),
				];
			}
			return [
				{
					name: this.selectedBucket,
					path: "/",
				},
			];
		},
	},
	watch: {
		selectedBucket(newVal) {
			this.searchQuery = "";
			this.resetAndFetchFiles();
		},
		selectedFolder(newVal) {
			this.searchQuery = "";
			this.resetAndFetchFiles();
		},
	},
	methods: {
		openRowClick: function (evt, row, index) {
			evt.preventDefault();
			this.openObject(row);
		},
		openRowDlbClick: function (evt, row, index) {
			evt.preventDefault();
			this.$bus.emit("openFileDetails", row);
		},
		breadcrumbsClick: function (obj) {
			this.$router.push({
				name: "files-folder",
				params: { bucket: this.selectedBucket, folder: encode(obj.path) },
			});
		},
		rowClick: function (evt, row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		openObject: function (row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		renameObject: function (row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		resetAndFetchFiles: async function () {
			this.rows = [];
			this.cursor = null;
			this.hasMore = true;
			await this.fetchFiles();
		},
		handleSearch: function () {
			this.resetAndFetchFiles();
		},
		handleSort: function () {
			if (this.searchQuery) {
				this.handleSearch();
			}
		},
		toggleSortOrder: function () {
			this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
			if (this.searchQuery) {
				this.handleSearch();
			}
		},
		clearSearch: function () {
			this.searchQuery = "";
			this.resetAndFetchFiles();
		},
		handleSyncIndex: async function () {
			this.syncLoading = true;
			try {
				const resp = await apiHandler.syncIndex(this.selectedBucket);
				const data = resp.data;
				if (data.changed) {
					this.q.notify({
						type: "positive",
						message: this.$t('layout.indexSynced'),
						caption: this.$t('layout.syncIndex') + `: +${data.added} -${data.removed} ~${data.updated}`,
					});
				} else {
					this.q.notify({
						type: "info",
						message: this.$t('layout.indexUpToDate'),
					});
				}
				this.resetAndFetchFiles();
			} catch (error) {
				this.q.notify({
					type: "negative",
					message: error.message || "Sync failed",
				});
			} finally {
				this.syncLoading = false;
			}
		},
		fetchFiles: async function () {
			if (this.loading || this.loadingMore || !this.hasMore) {
				return;
			}

			this.loading = true;

			if (this.searchQuery) {
				// Use the search API (index-based)
				try {
					const resp = await apiHandler.searchObjects(
						this.selectedBucket,
						this.searchQuery,
						this.sortBy,
						this.sortOrder,
					);
					const data = resp.data;
					this.rows = data.files.map((f) => ({
						...f,
						hash: encode(f.key),
						nameHash: encode(f.key),
						lastModified: f.lastModified,
						timestamp: new Date(f.lastModified).getTime(),
						size: `${f.size}`,
						sizeRaw: f.size,
						type: f.isFolder ? "folder" : "file",
						icon: f.isFolder ? "folder" : "article",
						color: f.isFolder ? "orange" : "grey",
					}));
					this.hasMore = false;
				} catch (e) {
					this.rows = [];
					this.hasMore = false;
				}
			} else {
				// Normal folder browsing
				const result = await apiHandler.fetchFilePage(
					this.selectedBucket,
					this.searchPrefix,
					"/",
					this.cursor,
					this.selectedFolder,
				);

				this.rows = result.files;
				this.cursor = result.cursor;
				this.hasMore = result.truncated;
			}

			this.loading = false;
		},
		loadMoreFiles: async function () {
			if (this.loadingMore || !this.hasMore || this.loading) {
				return;
			}

			// Don't load more in search mode - all results are returned at once
			if (this.searchQuery) {
				return;
			}

			this.loadingMore = true;

			const result = await apiHandler.fetchFilePage(
				this.selectedBucket,
				this.searchPrefix,
				"/",
				this.cursor,
				this.selectedFolder,
			);

			this.rows = [...this.rows, ...result.files];
			this.cursor = result.cursor;
			this.hasMore = result.truncated;
			this.loadingMore = false;
		},
		handleScroll: function (event) {
			const container = this.$refs.pageContainer;
			if (!container || this.loadingMore || !this.hasMore) {
				return;
			}

			const scrollTop = container.scrollTop;
			const scrollHeight = container.scrollHeight;
			const clientHeight = container.clientHeight;

			// Load more when user is within 200px of the bottom
			if (scrollTop + clientHeight >= scrollHeight - 200) {
				this.loadMoreFiles();
			}
		},
		openPreviewFromKey: async function () {
			let key = `${decode(this.$route.params.file)}`;
			if (this.selectedFolder && this.selectedFolder !== ROOT_FOLDER) {
				key = `${this.selectedFolder}${decode(this.$route.params.file)}`;
			}

			const file = await apiHandler.headFile(this.selectedBucket, key);
			this.$refs.preview.openFile(file);
		},
	},
	created() {
		this.resetAndFetchFiles();
	},
	mounted() {
		this.$refs.table.sort("name");

		this.$bus.on("fetchFiles", this.resetAndFetchFiles);

		if (this.$route.params.file) {
			this.openPreviewFromKey();
		}
	},
	beforeUnmount() {
		this.$bus.off("fetchFiles");
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
});
</script>

<style>
.file-list table , .file-list tbody , .file-list thead {
  width: 100%;
  display: block;
}


.file-list td:first-of-type, .file-list th:first-of-type {
  overflow-x: hidden;
  white-space: nowrap;
  flex-grow: 1;
  text-overflow: ellipsis;
}

.file-list tr {
  display: flex;
  width: 100%;
  justify-content: center;

}
</style>
