<script setup lang="ts">
import { ref } from "vue";
import MonacoEditor from "./MonacoEditor.vue";
defineProps<{
  code: string;
}>();
const emit = defineEmits<(type: "update:code", value: string) => void>();
const monacoEditor = ref<InstanceType<typeof MonacoEditor> | null>(null);

function handleUpdateModelValue(code: string) {
  emit("update:code", code);
}
</script>

<template>
  <div class="eslint-cpa-code">
    <MonacoEditor
      class="eslint-cpa-code__monaco"
      ref="monacoEditor"
      :model-value="code"
      language="javascript"
      @update:model-value="handleUpdateModelValue"
    />
  </div>
</template>

<style scoped>
.eslint-cpa-code,
.eslint-cpa-code__monaco {
  height: 100%;
}
</style>
