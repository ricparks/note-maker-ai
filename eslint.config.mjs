import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

const DEFAULT_BRANDS = [
  // Operating systems
  "iOS", "iPadOS", "macOS", "Windows", "Android", "Linux",
  // Obsidian
  "Obsidian", "Obsidian Sync", "Obsidian Publish",
  // Cloud storage
  "Google Drive", "Dropbox", "OneDrive", "iCloud Drive",
  // Communication platforms
  "YouTube", "Slack", "Discord", "Telegram", "WhatsApp", "Twitter", "X",
  // Productivity tools
  "Readwise", "Zotero",
  // Diagram tools
  "Excalidraw", "Mermaid",
  // Languages
  "Markdown", "LaTeX", "JavaScript", "TypeScript", "Node.js",
  // Development tools
  "npm", "pnpm", "Yarn", "Git", "GitHub", "GitLab",
  // Other tools
  "Notion", "Evernote", "Roam Research", "Logseq", "Anki", "Reddit",
  "VS Code", "Visual Studio Code", "IntelliJ IDEA", "WebStorm", "PyCharm",
];

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": ["error", {
        brands: [...DEFAULT_BRANDS, "NoteMaker AI", "NoteMakerAI", "LLM", "LLMs", "SDF", "API"],
      }],
    },
  },
]);
