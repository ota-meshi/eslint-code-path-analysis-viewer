<script setup lang="ts">
import { ref, watch } from "vue";
import ESLintCodePathAnalysisViewer from "./components/ESLintCodePathAnalysisViewer.vue";
import GitHubIcon from "./components/GitHubIcon.vue";
import ThemeSwitch from "./components/ThemeSwitch.vue";
import { compress } from "./utils/compress";
import { debounce } from "./utils/debounce";
import * as hash from "./utils/hash";

const props = defineProps<{
  code?: string;
}>();
const code = ref<string>(props.code || "");

function setCode(neCode: string) {
  code.value = neCode;
}

const eslintCodePathAnalysisViewer = ref<InstanceType<
  typeof ESLintCodePathAnalysisViewer
> | null>(null);

let lastHashData = hash.getHashData();

watch(
  code,
  debounce<(c: string) => void>((newCode) => {
    const hashData = compress(newCode);
    lastHashData = hashData;
    window.location.hash = hashData;
    if (window.parent) {
      window.parent.postMessage(hashData, "*");
    }
  }, 300),
  { deep: true },
);

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const hashData = hash.getHashData();
    if (hashData && hashData !== lastHashData) {
      void hash.toCode(hashData).then((code) => {
        if (code) {
          void setCode(code);
        }
      });
    }
  });
}
</script>

<template>
  <header class="header">
    <div class="title">
      <a href="https://github.com/eslint-community/">
        <img class="community-logo" src="/icon.svg" />
      </a>
      <a href="https://eslint.org/"> ESLint </a>
      Code Path Analysis Viewer
    </div>
    <div class="header-menu">
      <ThemeSwitch />
      <a
        class="github"
        target="_blank"
        href="https://github.com/ota-meshi/eslint-code-path-analysis-viewer"
      >
        <GitHubIcon alt="GitHub" />
      </a>
    </div>
  </header>
  <ESLintCodePathAnalysisViewer
    v-model:code="code"
    ref="eslintCodePathAnalysisViewer"
  />
  <footer class="footer">
    <!-- <a href="https://github.com/eslint-community">
      <img class="logo" :src="logo" alt="ESLint Community" />
    </a> -->
  </footer>
</template>

<style scoped>
.header {
  padding: 0 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-family: system-ui;
  color: var(--title-color);
  font-size: 1.2rem;
  font-weight: 500;
}
.title a {
  color: var(--title-link-color);
  text-decoration: none;
}

.community-logo {
  height: 22px;
  vertical-align: bottom;
}

.header-menu {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px;
}

.github {
  display: flex;
}

.footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 12px;
}

.logo {
  height: 50px;
}
</style>
