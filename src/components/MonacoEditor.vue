<script setup lang="ts">
import { ref, watch } from "vue";
import { setupMonacoEditor } from "../monaco-editor/monaco-setup.js";
import { themeValue } from "./ThemeSwitch.vue";

const props = defineProps<{
  modelValue?: string;
}>();
const emit =
  defineEmits<(type: "update:modelValue", modelValue: string) => void>();

const root = ref<HTMLDivElement>();
const editorRef = ref();

watch(root, async (element) => {
  if (!element) {
    return;
  }
  if (editorRef.value) {
    editorRef.value.disposeEditor();
    editorRef.value = undefined;
  }
  // eslint-disable-next-line require-atomic-updates -- OK
  editorRef.value = await setupMonacoEditor({
    element,
    init: {
      value: props.modelValue ?? "",
      theme: themeValue.value,
    },
    listeners: {
      onChangeValue(value) {
        emit("update:modelValue", value);
      },
    },
  });
});

watch(themeValue, (theme) => {
  editorRef.value?.setTheme(theme);
});
watch(
  () => props.modelValue,
  (value) => {
    editorRef.value?.setValue(value || "");
  },
);
</script>

<template>
  <div ref="root" class="eslint-cpa-monaco"></div>
</template>
