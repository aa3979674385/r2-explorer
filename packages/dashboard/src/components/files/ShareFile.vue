<template>
  <!-- Share Link Create Dialog -->
  <q-dialog v-model="createShareModal" @hide="resetCreate">
    <q-card style="min-width: 500px;">
      <q-card-section class="row items-center">
        <q-avatar icon="share" color="blue" text-color="white" />
        <span class="q-ml-sm text-h6">{{ $t('share.shareFile') }}</span>
      </q-card-section>

      <q-card-section v-if="row">
        <div class="text-subtitle2 q-mb-sm">File: <code>{{ row.name }}</code></div>
        
        <q-input
          v-model.number="expiresInHours"
          type="number"
          :label="$t('share.expiresIn')"
          hint="Leave as 0 for permanent link"
          min="0"
          class="q-mb-md"
        />

        <q-input
          v-model="password"
          type="password"
          :label="$t('share.passwordOptional')"
          hint="Leave empty for no password protection"
          class="q-mb-md"
        />

        <q-input
          v-model.number="maxDownloads"
          type="number"
          :label="$t('share.maxDownloadsOptional')"
          hint="Leave as 0 for unlimited downloads"
          min="0"
          class="q-mb-md"
        />

        <div v-if="shareUrl" class="q-mt-md q-pa-md bg-grey-2 rounded-borders">
          <div class="text-subtitle2 q-mb-sm">{{ $t('share.shareLinkCreated') }}</div>
          <div class="flex items-center">
            <q-input
              v-model="shareUrl"
              readonly
              dense
              outlined
              class="col"
            />
            <q-btn
              flat
              round
              dense
              icon="content_copy"
              color="primary"
              class="q-ml-sm"
              @click="copyToClipboard(shareUrl)"
            >
              <q-tooltip>{{ $t('share.copyToClipboard') }}</q-tooltip>
            </q-btn>
          </div>
          <div v-if="expiresAt" class="text-caption q-mt-sm">
            Expires: {{ formatExpiry(expiresAt) }}
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('close')" color="primary" v-close-popup />
        <q-btn
          v-if="!shareUrl"
          flat
          :label="$t('share.createLink')"
          color="blue"
          :loading="loading"
          @click="createShare"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Manage Shares Dialog -->
  <q-dialog v-model="manageSharesModal" @hide="resetManage">
    <q-card style="min-width: 600px;">
      <q-card-section class="row items-center">
        <q-avatar icon="link" color="blue" text-color="white" />
        <span class="q-ml-sm text-h6">{{ $t('share.manageShareLinks') }}</span>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-table
          :rows="shares"
          :columns="getShareColumns()"
          row-key="shareId"
          :loading="loadingShares"
          flat
          :pagination="{ rowsPerPage: 10 }"
        >
          <template v-slot:body-cell-shareUrl="props">
            <q-td :props="props">
              <div class="flex items-center">
                <a :href="props.row.shareUrl" target="_blank" class="text-primary ellipsis" style="max-width: 200px;">
                  {{ props.row.shareUrl }}
                </a>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="content_copy"
                  color="primary"
                  class="q-ml-xs"
                  @click="copyToClipboard(props.row.shareUrl)"
                >
                  <q-tooltip>{{ $t('copy') }}</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip
                :color="props.row.isExpired ? 'red' : 'green'"
                text-color="white"
                size="sm"
              >
                {{ props.row.isExpired ? $t('share.expired') : $t('share.active') }}
              </q-chip>
              <q-chip v-if="props.row.hasPassword" color="orange" text-color="white" size="sm">
                <q-icon name="lock" size="xs" />
              </q-chip>
            </q-td>
          </template>

          <template v-slot:body-cell-downloads="props">
            <q-td :props="props">
              {{ props.row.currentDownloads }}
              <span v-if="props.row.maxDownloads"> / {{ props.row.maxDownloads }}</span>
              <span v-else> / ∞</span>
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="red"
                @click="deleteShare(props.row)"
              >
                <q-tooltip>{{ $t('share.revoke') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { useQuasar } from "quasar";
import { apiHandler } from "src/appUtils";
import { defineComponent } from "vue";

export default defineComponent({
	name: "ShareFile",
	data: () => ({
		row: null,
		createShareModal: false,
		manageSharesModal: false,
		loading: false,
		loadingShares: false,
		expiresInHours: 0,
		password: "",
		maxDownloads: 0,
		shareUrl: "",
		shareId: "",
		expiresAt: null,
		shares: [],
	}),
	methods: {
		getShareColumns: function () {
			return [
				{
					name: "key",
					label: this.$t('files.name'),
					field: "key",
					align: "left",
					sortable: true,
				},
				{
					name: "shareUrl",
					label: this.$t('share.shareFile'),
					field: "shareUrl",
					align: "left",
				},
				{
					name: "status",
					label: this.$t('share.status'),
					field: "isExpired",
					align: "center",
					sortable: true,
				},
				{
					name: "downloads",
					label: this.$t('share.downloads'),
					align: "center",
					sortable: true,
				},
				{
					name: "created",
					label: this.$t('files.lastModified'),
					field: "createdAt",
					align: "left",
					sortable: true,
					format: (val) => new Date(val).toLocaleString(),
				},
				{
					name: "actions",
					label: this.$t('delete'),
					align: "center",
				},
			];
		},
		openCreateShare: function (row) {
			this.createShareModal = true;
			this.row = row;
		},
		openManageShares: async function () {
			this.manageSharesModal = true;
			await this.loadShares();
		},
		loadShares: async function () {
			this.loadingShares = true;
			try {
				const response = await apiHandler.listShares(this.selectedBucket);
				this.shares = response.data.shares;
			} catch (error) {
				this.q.notify({
					type: "negative",
					message: this.$t('share.loadFailed'),
					caption: error.message,
				});
			} finally {
				this.loadingShares = false;
			}
		},
		createShare: async function () {
			this.loading = true;
			try {
				const options = {};

				if (this.expiresInHours > 0) {
					options.expiresIn = this.expiresInHours * 3600; // Convert hours to seconds
				}

				if (this.password) {
					options.password = this.password;
				}

				if (this.maxDownloads > 0) {
					options.maxDownloads = this.maxDownloads;
				}

				const response = await apiHandler.createShareLink(
					this.selectedBucket,
					this.row.key,
					options,
				);

				this.shareUrl = response.data.shareUrl;
				this.shareId = response.data.shareId;
				this.expiresAt = response.data.expiresAt;

				this.q.notify({
					type: "positive",
					message: this.$t('share.shareLinkCreated'),
					icon: "share",
				});
			} catch (error) {
				this.q.notify({
					type: "negative",
					message: this.$t('share.createFailed'),
					caption: error.response?.data?.message || error.message,
				});
			} finally {
				this.loading = false;
			}
		},
		deleteShare: async function (share) {
			this.q
				.dialog({
					title: this.$t('share.revoke'),
					message: `Are you sure you want to revoke this share link for "${share.key}"?`,
					cancel: true,
					persistent: true,
				})
				.onOk(async () => {
					try {
						await apiHandler.deleteShareLink(
							this.selectedBucket,
							share.shareId,
						);
						this.q.notify({
							type: "positive",
							message: this.$t('share.revoke'),
						});
						await this.loadShares();
					} catch (error) {
						this.q.notify({
							type: "negative",
							message: this.$t('share.revokeFailed'),
							caption: error.message,
						});
					}
				});
		},
		copyToClipboard: function (text) {
			navigator.clipboard.writeText(text);
			this.q.notify({
				type: "positive",
				message: this.$t('share.copyToClipboard'),
				icon: "content_copy",
				timeout: 1000,
			});
		},
		formatExpiry: (timestamp) => new Date(timestamp).toLocaleString(),
		resetCreate: function () {
			this.createShareModal = false;
			this.loading = false;
			this.expiresInHours = 0;
			this.password = "";
			this.maxDownloads = 0;
			this.shareUrl = "";
			this.shareId = "";
			this.expiresAt = null;
			this.row = null;
		},
		resetManage: function () {
			this.manageSharesModal = false;
			this.loadingShares = false;
			this.shares = [];
		},
	},
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
	},
	setup() {
		return {
			q: useQuasar(),
		};
	},
});
</script>

<style scoped>
code {
  background-color: #e9e9e9;
  padding: 0.25em;
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
