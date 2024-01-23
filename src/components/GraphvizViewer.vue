<script setup lang="ts">
import { Graphviz } from "@hpcc-js/wasm";
import { computed, nextTick, ref, watch } from "vue";

type GraphvizInstance = Awaited<ReturnType<(typeof Graphviz)["load"]>>;

const props = defineProps<{
  dot?: string;
}>();

const root = ref<HTMLDivElement | null>(null);
const graphviz = ref<GraphvizInstance | null>(null);
void Graphviz.load().then((r) => {
  graphviz.value = r;
});

const svg = computed(() => {
  if (!props.dot || graphviz.value == null) return "";
  const r = graphviz.value.dot(props.dot);
  return r;
});

watch(
  () => props.dot,
  () => {
    void adjustSVGSize();
  },
  {
    immediate: true,
  },
);

async function adjustSVGSize() {
  await nextTick();
  const svg = root.value?.querySelector("svg");
  if (!svg) {
    setTimeout(() => {
      void adjustSVGSize();
    }, 20);
    return;
  }
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;
  for (const child of Array.from(svg.children)) {
    const rect = child.getBoundingClientRect();
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    bottom = Math.max(bottom, rect.bottom);
    right = Math.max(right, rect.right);
  }
  if (isFinite(top) && isFinite(left) && isFinite(bottom) && isFinite(right)) {
    svg.setAttribute("height", `${bottom - top}`);
    svg.setAttribute("width", `${right - left}`);
  } else {
    svg.removeAttribute("height");
    svg.removeAttribute("width");
  }
}
</script>

<template>
  <div v-html="svg" class="eslint-cpa__graphviz-viewer" ref="root" />
</template>

<style scoped>
.eslint-cpa__graphviz-viewer {
  overflow: auto;
}
.eslint-cpa__graphviz-viewer :deep(svg) {
  max-width: 150%;
}
</style>
