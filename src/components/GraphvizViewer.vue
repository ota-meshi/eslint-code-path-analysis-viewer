<script setup lang="ts">
import { Graphviz } from "@hpcc-js/wasm";
import { computed, ref } from "vue";

type GraphvizInstance = Awaited<ReturnType<(typeof Graphviz)["load"]>>;

const props = defineProps<{
  dot?: string;
}>();
const graphviz = ref<GraphvizInstance | null>(null);
void Graphviz.load().then((r) => {
  graphviz.value = r;
});

const svg = computed(() => {
  if (props.dot == null || graphviz.value == null) return "";
  const r = graphviz.value?.dot(props.dot);
  return r;
});
</script>

<template>
  <div v-html="svg" class="eslint-cpa__graphviz-viewer" />
</template>

<style scoped>
.eslint-cpa__graphviz-viewer {
  overflow: auto;
}
.eslint-cpa__graphviz-viewer :deep(svg) {
  max-width: 120%;
}
</style>
