import type {
  editor,
  languages,
  CancellationToken,
  Range,
} from "monaco-editor";
import { loadMonaco } from "./monaco-loader.js";

export type CodeActionProvider = (
  model: editor.ITextModel,
  range: Range,
  context: languages.CodeActionContext,
  token: CancellationToken,
) => languages.ProviderResult<languages.CodeActionList>;
export type MonacoEditor = {
  /** Sets the value text of the editor. */
  setValue: (value: string) => void;
  /** Gets the value text of the editor. */
  getValue: () => string;
  /** Gets the editor. */
  getEditor: () => editor.IStandaloneCodeEditor;
  /** Set the theme. */
  setTheme: (theme: "dark" | "light") => void;
  /** Dispose the editor. */
  disposeEditor: () => void;
};
export type MonacoEditorOptions = {
  /** Specify a target element to set up the code editor. */
  element: HTMLElement;
  /** Specify the initial values. */
  init: {
    /** Code value. */
    value: string;
    /** theme. */
    theme: "dark" | "light";
  };
  /** Event listeners. */
  listeners?: {
    /** Notifies that the code value have changed. */
    onChangeValue?: (value: string) => void;
  };
};

/** Setup editor */
export async function setupMonacoEditor({
  init,
  listeners,
  element,
}: MonacoEditorOptions): Promise<MonacoEditor> {
  element.textContent = "Loading...";
  element.style.padding = "1rem";
  element.style.fontFamily = "monospace";
  const monaco = await loadMonaco();

  element.textContent = "";
  element.style.padding = "";

  const options: editor.IStandaloneEditorConstructionOptions = {
    value: init.value,
    theme: init.theme === "dark" ? "vs-dark" : "vs",
    language: "javascript",
    automaticLayout: true,
    tabSize: 2,
    fontSize: 12,
    minimap: {
      enabled: false,
    },
    quickSuggestions: false,
    colorDecorators: false,
    renderControlCharacters: false,
    // renderIndentGuides: false,
    renderValidationDecorations: "on" as const,
    renderWhitespace: "boundary" as const,
    scrollBeyondLastLine: false,
    scrollbar: { alwaysConsumeMouseWheel: false },
  };

  const standaloneEditor = monaco.editor.create(element, options);

  standaloneEditor.onDidChangeModelContent(() => {
    const value = standaloneEditor.getValue();

    listeners?.onChangeValue?.(value);
  });

  const result: MonacoEditor = {
    setValue: (value) => {
      updateValue(standaloneEditor, value);
    },
    getValue: () => standaloneEditor.getValue(),
    getEditor: () => standaloneEditor,
    setTheme: (theme: "dark" | "light") => {
      standaloneEditor.updateOptions({
        theme: theme === "dark" ? "vs-dark" : "vs",
      });
    },
    disposeEditor: () => {
      standaloneEditor.getModel()?.dispose();
      standaloneEditor.dispose();
    },
  };

  return result;

  /** Update value */
  function updateValue(editor: editor.IStandaloneCodeEditor, value: string) {
    const old = editor.getValue();

    if (old !== value) {
      editor.setValue(value);
    }
  }
}
