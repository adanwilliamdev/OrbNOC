// ESLint (flat config) para o JavaScript do navegador (src/main/resources/static/js).
// Definido à mão, sem pacotes extras: o conjunto "recommended" é reproduzido abaixo para que
// `npx --yes eslint@9` baste, sem npm install. Regras são "warn" para não quebrar o CI com código
// legado; apenas erros de sintaxe (parsing) falham o lint.
"use strict";

// Globais de navegador usadas pelo frontend (declaradas à mão).
const browserGlobals = Object.fromEntries(
  [
    "window", "document", "navigator", "location", "history", "localStorage", "sessionStorage",
    "console", "fetch", "WebSocket", "EventSource", "URL", "URLSearchParams", "FormData", "Headers",
    "Request", "Response", "AbortController", "MutationObserver", "ResizeObserver",
    "IntersectionObserver", "CustomEvent", "Event", "HTMLElement", "Element", "Node", "NodeFilter",
    "DOMParser", "Notification", "Audio", "Intl", "Image", "Blob", "performance",
    "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
    "cancelAnimationFrame", "queueMicrotask", "getComputedStyle", "matchMedia", "alert", "confirm",
    "prompt", "atob", "btoa", "crypto", "structuredClone", "TextEncoder", "TextDecoder",
  ].map((name) => [name, "readonly"])
);

// Equivalente manual de js.configs.recommended (ESLint 9), como avisos.
const recommended = Object.fromEntries(
  [
    "constructor-super", "for-direction", "getter-return", "no-async-promise-executor",
    "no-case-declarations", "no-class-assign", "no-compare-neg-zero", "no-cond-assign",
    "no-const-assign", "no-constant-binary-expression", "no-constant-condition",
    "no-control-regex", "no-debugger", "no-delete-var", "no-dupe-args", "no-dupe-class-members",
    "no-dupe-else-if", "no-dupe-keys", "no-duplicate-case", "no-empty", "no-empty-character-class",
    "no-empty-pattern", "no-empty-static-block", "no-ex-assign", "no-extra-boolean-cast",
    "no-fallthrough", "no-func-assign", "no-global-assign", "no-import-assign",
    "no-invalid-regexp", "no-irregular-whitespace", "no-loss-of-precision",
    "no-misleading-character-class", "no-new-native-nonconstructor", "no-nonoctal-decimal-escape",
    "no-obj-calls", "no-octal", "no-prototype-builtins", "no-redeclare", "no-regex-spaces",
    "no-self-assign", "no-setter-return", "no-shadow-restricted-names", "no-sparse-arrays",
    "no-this-before-super", "no-undef", "no-unexpected-multiline", "no-unreachable",
    "no-unsafe-finally", "no-unsafe-negation", "no-unsafe-optional-chaining", "no-unused-labels",
    "no-unused-private-class-members", "no-unused-vars", "no-useless-backreference",
    "no-useless-catch", "no-useless-escape", "no-with", "require-yield", "use-isnan",
    "valid-typeof",
  ].map((rule) => [rule, "warn"])
);

module.exports = [
  {
    files: ["src/main/resources/static/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script", // sem módulos/bundler: o arquivo é carregado por <script>
      globals: browserGlobals,
    },
    linterOptions: { reportUnusedDisableDirectives: "warn" },
    rules: recommended,
  },
];
