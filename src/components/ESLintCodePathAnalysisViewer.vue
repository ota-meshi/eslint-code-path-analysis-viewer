<script setup lang="ts">
import { shallowRef, onMounted, ref, watch, computed } from "vue";
import CodeEditor from "./CodeEditor.vue";
import GraphvizViewer from "./GraphvizViewer.vue";
import type { Monaco } from "../monaco-editor";
import { loadMonaco } from "../monaco-editor";
import type { Rule } from "eslint";
import { Linter } from "eslint";

const props = defineProps<{
  code: string;
}>();
const emit = defineEmits<(type: "update:code", value: string) => void>();
const code = computed({
  get: () => props.code,
  set: (value) => emit("update:code", value),
});
const dotCode = ref("");

const monacoRef = shallowRef<Monaco>();
void loadMonaco().then((monaco) => (monacoRef.value = monaco));

onMounted(() => {
  renderGraphviz(code.value);
});

watch(code, renderGraphviz);

function nodeToString(
  node: (
    | { type: "Identifier"; name: string }
    | { type: "Literal"; value: string }
    | { type: never }
  ) & { loc: { start: { line: number }; end: { line: number } } },
  label: string | undefined,
  options?: { showLoc?: boolean },
) {
  const event = label ? `:${label}` : "";

  const suffix = options?.showLoc
    ? ` @ L${node.loc.start.line}-${node.loc.end.line}`
    : "";
  switch (node.type) {
    case "Identifier":
      return `${node.type}${event} (${node.name})${suffix}`;
    case "Literal":
      return `${node.type}${event} (${node.value})${suffix}`;
    default:
      return `${(node as any).type}${event}${suffix}`;
  }
}

function renderGraphviz(code: string) {
  const linter = new Linter({ configType: "flat" });

  let codePath: Rule.CodePath | undefined;
  const codePaths: Rule.CodePath[] = [];
  const codePathSegments: Rule.CodePathSegment[] = [];
  const nodesMap = new Map<Rule.CodePathSegment, string[]>();
  linter.verify(
    code,
    {
      files: ["**"],
      plugins: {
        // @ts-expect-error -- eslint v9
        "code-path": {
          rules: {
            "extract-code-path": {
              create() {
                return {
                  onCodePathStart(cp: Rule.CodePath) {
                    if (!codePath) {
                      codePath = cp;
                    }
                    codePaths.push(cp);
                  },
                  onCodePathEnd(cp: Rule.CodePath) {
                    codePaths.splice(codePaths.indexOf(cp), 1);
                  },
                  onCodePathSegmentStart(seg: Rule.CodePathSegment) {
                    codePathSegments.push(seg);
                    nodesMap.set(seg, []);
                  },
                  onCodePathSegmentEnd(seg: Rule.CodePathSegment) {
                    codePathSegments.splice(codePathSegments.indexOf(seg), 1);
                  },
                  "*"(node: any) {
                    if (codePaths.length > 1) return;
                    for (const codePathSegment of codePathSegments) {
                      nodesMap
                        .get(codePathSegment)!
                        .push(nodeToString(node, "enter"));
                    }
                  },
                  "*:exit"(node: any) {
                    if (codePaths.length > 1) return;
                    for (const codePathSegment of codePathSegments) {
                      const nodes = nodesMap.get(codePathSegment)!;
                      const last = nodes.length - 1;

                      if (
                        last >= 0 &&
                        nodes[last] === nodeToString(node, "enter")
                      ) {
                        nodes[last] = nodeToString(node, undefined);
                      } else {
                        nodes.push(nodeToString(node, "exit"));
                      }
                    }
                  },
                };
              },
            },
          },
        },
      },
      rules: {
        "code-path/extract-code-path": "error",
      },
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    "a.js",
  );

  if (!codePath) {
    return;
  }

  let text =
    "\n" +
    "digraph {\n" +
    'node[shape=box,style="rounded,filled",fillcolor=white];\n' +
    'initial[label="",shape=circle,style=filled,fillcolor=black,width=0.25,height=0.25];\n';

  if (codePath.returnedSegments.length > 0) {
    text +=
      'final[label="",shape=doublecircle,style=filled,fillcolor=black,width=0.25,height=0.25];\n';
  }
  if (codePath.thrownSegments.length > 0) {
    text +=
      'thrown[label="✘",shape=circle,width=0.3,height=0.3,fixedsize=true];\n';
  }

  const traceMap: Record<string, Rule.CodePathSegment> = Object.create(null);
  const arrows = makeDotArrows(codePath, traceMap);

  for (const id in traceMap) {
    const segment = traceMap[id];

    text += `${id}[`;

    if (segment.reachable) {
      text += 'label="';
    } else {
      text +=
        'style="rounded,dashed,filled",fillcolor="#FF9800",label="<<unreachable>>\\n';
    }

    const nodes = nodesMap.get(segment)!;
    if (nodes.length > 0) {
      text += nodes.join("\\n");
    } else {
      text += "????";
    }

    text += '"];\n';
  }

  text += `${arrows}\n`;
  text += "}";
  dotCode.value = text;
}

/**
 * Makes a DOT code of a given code path.
 * The DOT code can be visualized with Graphvis.
 * @param {CodePath} codePath A code path to make DOT.
 * @param {Object} traceMap Optional. A map to check whether or not segments had been done.
 * @returns {string} A DOT code of the code path.
 */
function makeDotArrows(
  codePath: Rule.CodePath,
  traceMap: Record<string, Rule.CodePathSegment>,
) {
  const stack: [Rule.CodePathSegment, number][] = [
    [codePath.initialSegment, 0],
  ];
  const done = traceMap;
  let lastId: string | null = codePath.initialSegment.id;
  let text = `initial->${codePath.initialSegment.id}`;

  while (stack.length > 0) {
    const item = stack.pop()!;
    const segment = item[0];
    const index = item[1];

    if (done[segment.id] && index === 0) {
      continue;
    }
    done[segment.id] = segment;

    const nextSegment = (segment as any).allNextSegments[index];

    if (!nextSegment) {
      continue;
    }

    if (lastId === segment.id) {
      text += `->${nextSegment.id}`;
    } else {
      text += `;\n${segment.id}->${nextSegment.id}`;
    }
    lastId = nextSegment.id;

    stack.unshift([segment, 1 + index]);
    stack.push([nextSegment, 0]);
  }

  codePath.returnedSegments.forEach((finalSegment) => {
    if (lastId === finalSegment.id) {
      text += "->final";
    } else {
      text += `;\n${finalSegment.id}->final`;
    }
    lastId = null;
  });

  codePath.thrownSegments.forEach((finalSegment) => {
    if (lastId === finalSegment.id) {
      text += "->thrown";
    } else {
      text += `;\n${finalSegment.id}->thrown`;
    }
    lastId = null;
  });

  return `${text};`;
}
</script>

<template>
  <div class="eslint-cpa">
    <CodeEditor v-model:code="code" class="eslint-cpa__code" />
    <GraphvizViewer :dot="dotCode" class="eslint-cpa__dot" />
  </div>
</template>

<style scoped>
.eslint-cpa {
  color: var(--ep-color);
  font-family: system-ui;
  font-size: 0.875rem;
  min-height: 0;
  height: 100%;
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: stretch;
}

.eslint-cpa__code,
.eslint-cpa__dot {
  width: 50%;
  min-height: 0;
  height: 100%;
}

.eslint-cpa :deep(a) {
  color: var(--ep-link-color);
  text-decoration: none;
}
.eslint-cpa :deep(a:hover) {
  text-decoration: underline;
}
</style>
