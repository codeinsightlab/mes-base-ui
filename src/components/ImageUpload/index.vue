<script setup lang="ts">
import FileUpload from '@/components/FileUpload/index.vue'
const model = defineModel<string>({ default: '' });withDefaults(defineProps<{ limit?: number;fileSize?: number;fileType?: string[];isShowTip?: boolean;resource?: string }>(), { limit: 5, fileSize: 5, fileType: () => ['png', 'jpg', 'jpeg', 'gif', 'webp'], isShowTip: true, resource: 'personal' })
</script><template><FileUpload v-model="model" images :limit="limit" :file-size="fileSize" :file-type="fileType" :is-show-tip="isShowTip" :resource="resource" /></template>
