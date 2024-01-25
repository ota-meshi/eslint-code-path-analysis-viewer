<script lang="ts">
import type { Rule } from "eslint";
import type * as ESTree from "estree";
type CodePathSegmentInfo = {
  segment: Rule.CodePathSegment;
  nodes: string[];
};
class CodePathStack {
  public readonly codePath: Rule.CodePath;

  private readonly currentSegments = new Map<
    Rule.CodePathSegment,
    CodePathSegmentInfo
  >();

  private readonly allSegments = new Map<
    Rule.CodePathSegment,
    CodePathSegmentInfo
  >();

  public readonly upper: CodePathStack | null;

  public readonly startNode: ESTree.Node;

  public constructor(
    codePath: Rule.CodePath,
    upper: CodePathStack | null,
    node: ESTree.Node,
  ) {
    this.codePath = codePath;
    this.upper = upper;
    this.startNode = node;
  }

  public getSegment(segment: Rule.CodePathSegment) {
    return this.allSegments.get(segment);
  }

  public getAllSegments() {
    return this.allSegments.values();
  }

  public enterSegment(segment: Rule.CodePathSegment) {
    const info: CodePathSegmentInfo = {
      segment,
      nodes: [],
    };
    this.currentSegments.set(segment, info);
    this.allSegments.set(segment, info);
  }

  public exitSegment(segment: Rule.CodePathSegment) {
    this.currentSegments.delete(segment);
  }

  public enterNode(node: ESTree.Node) {
    for (const codePathSegment of this.currentSegments.values()) {
      codePathSegment.nodes.push(nodeToString(node, "enter"));
    }
  }

  public exitNode(node: ESTree.Node) {
    for (const codePathSegment of this.currentSegments.values()) {
      const last = codePathSegment.nodes.length - 1;

      if (
        last >= 0 &&
        codePathSegment.nodes[last] === nodeToString(node, "enter")
      ) {
        codePathSegment.nodes[last] = nodeToString(node, undefined);
      } else {
        codePathSegment.nodes.push(nodeToString(node, "exit"));
      }
    }
  }
}

function nodeToString(
  node: ESTree.Node,
  label: string | undefined,
  options?: { showLoc?: boolean },
) {
  const event = label ? `:${label}` : "";

  const suffix = options?.showLoc
    ? ` @ L${node.loc!.start.line}-${node.loc!.end.line}`
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
</script>

<script setup lang="ts">
import { shallowRef, onMounted, computed, watch } from "vue";
import CodeEditor from "./CodeEditor.vue";
import GraphvizViewer from "./GraphvizViewer.vue";
import type { Monaco } from "../monaco-editor";
import { loadMonaco } from "../monaco-editor";
import { Linter } from "eslint";

const props = defineProps<{
  code: string;
}>();
const emit = defineEmits<(type: "update:code", value: string) => void>();
const code = computed({
  get: () => props.code,
  set: (value) => emit("update:code", value),
});

const monacoRef = shallowRef<Monaco>();
void loadMonaco().then((monaco) => (monacoRef.value = monaco));

onMounted(() => {
  renderGraphviz(code.value);
});

const dotCodeList = computed(() => renderGraphviz(code.value));
const activeNode = shallowRef<ESTree.Node | null>(null);

watch(
  dotCodeList,
  (list) => {
    if (
      activeNode.value != null &&
      list.some((item) => item.node === activeNode.value)
    ) {
      return;
    }
    activeNode.value = list[0]?.node || null;
  },
  { immediate: true },
);

function renderGraphviz(code: string) {
  const linter = new Linter({ configType: "flat" });

  let stack: CodePathStack | null = null;
  const allCodePaths: CodePathStack[] = [];
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
                  onCodePathStart(codePath: Rule.CodePath, node: ESTree.Node) {
                    stack = new CodePathStack(codePath, stack, node);
                    allCodePaths.push(stack);
                  },
                  onCodePathEnd(_codePath: Rule.CodePath) {
                    stack = stack?.upper || null;
                  },
                  onCodePathSegmentStart(segment: Rule.CodePathSegment) {
                    stack!.enterSegment(segment);
                  },
                  onUnreachableCodePathSegmentStart(
                    segment: Rule.CodePathSegment,
                  ) {
                    stack!.enterSegment(segment);
                  },
                  onCodePathSegmentEnd(segment: Rule.CodePathSegment) {
                    stack!.exitSegment(segment);
                  },
                  onUnreachableCodePathSegmentEnd(
                    segment: Rule.CodePathSegment,
                  ) {
                    stack!.exitSegment(segment);
                  },
                  "*"(node: ESTree.Node) {
                    if (!stack) return;
                    stack.enterNode(node);
                  },
                  "*:exit"(node: ESTree.Node) {
                    if (!stack) return;
                    stack.exitNode(node);
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
        parserOptions: {
          ecmaFeatures: {
            globalReturn: true,
          },
        },
      },
    },
    "a.js",
  );

  return allCodePaths.map((target) => {
    const { codePath } = target;

    let text =
      `\n` +
      `digraph {\n` +
      `node[shape=box,style="rounded,filled",fillcolor=white];\n` +
      `initial[label="",shape=circle,style=filled,fillcolor=black,width=0.25,height=0.25];\n`;

    if (codePath.returnedSegments.length > 0) {
      text += `final[label="",shape=doublecircle,style=filled,fillcolor=black,width=0.25,height=0.25];\n`;
    }
    if (codePath.thrownSegments.length > 0) {
      text +=
        'thrown[label="✘",shape=circle,width=0.3,height=0.3,fixedsize=true];\n';
    }

    const arrows = makeDotArrows(codePath);

    for (const { segment, nodes } of target.getAllSegments()) {
      text += `${segment.id}[`;

      if (segment.reachable) {
        text += 'label="';
      } else {
        text +=
          'style="rounded,dashed,filled",fillcolor="#FF9800",label="<<unreachable>>\\n';
      }

      if (nodes && nodes.length > 0) {
        text += nodes.join("\\n");
      } else {
        text += "????";
      }

      text += '"];\n';
    }

    text += `${arrows}\n`;
    text += "}";
    return {
      dot: text,
      node: target.startNode,
    };
  });
}

/**
 * Makes a DOT code of a given code path.
 * The DOT code can be visualized with Graphvis.
 * @param {CodePath} codePath A code path to make DOT.
 * @returns {string} A DOT code of the code path.
 */
function makeDotArrows(codePath: Rule.CodePath) {
  const stack: { segment: Rule.CodePathSegment; index: number }[] = [
    { segment: codePath.initialSegment, index: 0 },
  ];
  const done: Record<string, Rule.CodePathSegment> = Object.create(null);
  let lastId: string | null = codePath.initialSegment.id;
  let text = `initial->${codePath.initialSegment.id}`;

  while (stack.length > 0) {
    const { segment, index } = stack.pop()!;

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

    stack.unshift({ segment, index: 1 + index });
    stack.push({ segment: nextSegment, index: 0 });
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
    <div class="eslint-cpa__dot-wrapper">
      <div class="eslint-cpa__dot-tab">
        <template v-for="dotCode in dotCodeList">
          <label>
            <input
              type="radio"
              :value="dotCode.node"
              v-model="activeNode"
              name="active"
            />
            {{ dotCode.node.type }}@L{{ dotCode.node.loc!.start.line }}
          </label>
        </template>
      </div>
      <GraphvizViewer
        :dot="dotCodeList.find((item) => item.node === activeNode)?.dot || ''"
        class="eslint-cpa__dot"
      />
    </div>
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
.eslint-cpa__dot-wrapper {
  width: 50%;
  min-height: 0;
  height: 100%;
}

.eslint-cpa__dot-wrapper {
  display: flex;
  flex-direction: column;
}

.eslint-cpa__dot {
  flex-grow: 1;
}

.eslint-cpa :deep(a) {
  color: var(--ep-link-color);
  text-decoration: none;
}
.eslint-cpa :deep(a:hover) {
  text-decoration: underline;
}
</style>
