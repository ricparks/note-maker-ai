// Settings Tab UI (moved under ui/settings for cohesion)
import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type NoteTakerAI from "../../main";
import type { LlmVendor } from "../../settings/schema";
import { FolderSuggest } from "../components/FolderSuggest";

const OPENAI_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "gpt-5.1", label: "GPT-5.1" },
	{ value: "gpt-5-mini", label: "GPT-5 Mini" },
];

const GEMINI_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
	{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

const OPENROUTER_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
	{ value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
	{ value: "anthropic/claude-opus-4.1", label: "Claude Opus 4.1" },
	{ value: "x-ai/grok-4", label: "Grok 4" },
	{ value: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
];

const MODEL_OPTION_MAP: Record<LlmVendor, Array<{ value: string; label: string }>> = {
	openai: OPENAI_MODEL_OPTIONS,
	gemini: GEMINI_MODEL_OPTIONS,
	openrouter: OPENROUTER_MODEL_OPTIONS,
};

export class NoteTakerSettingTab extends PluginSettingTab {
	plugin: NoteTakerAI;
	constructor(app: App, plugin: NoteTakerAI) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "NoteTakerAI Settings" });

		// VERSION (read-only)
		new Setting(containerEl)
			.setName("Version")
			.setDesc(this.plugin.manifest.version);

		// FOLDERS
		containerEl.createEl("h3", { text: "Folders" });
		
		new Setting(containerEl)
			.setName("Notes Folder")
			.setDesc("Where to save new book notes.")
			.addText((text) => {
				text.setPlaceholder("e.g. Bases/Books")
					.setValue(this.plugin.settings.folders.notes)
					.onChange(async (value) => {
						this.plugin.settings.folders.notes = value.trim();
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl, async (picked) => {
					this.plugin.settings.folders.notes = picked;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Photos Folder")
			.setDesc("Where to save/move book cover images.")
			.addText((text) => {
				text.setPlaceholder("e.g. Bases/Books/photos")
					.setValue(this.plugin.settings.folders.photos)
					.onChange(async (value) => {
						this.plugin.settings.folders.photos = value.trim();
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl, async (picked) => {
					this.plugin.settings.folders.photos = picked;
					await this.plugin.saveSettings();
				});
			});

		// LLM CONFIGURATION
		const ensureLlmArray = () => {
			if (!Array.isArray(this.plugin.settings.llms)) {
				this.plugin.settings.llms = [];
			}
			return this.plugin.settings.llms;
		};

		containerEl.createEl("h3", { text: "LLMs" });
		const llmWrap = containerEl.createEl("div", {
			cls: "basemaker-llm-rows",
		});

		let defaultLlmSelectEl: HTMLSelectElement | null = null;
		let folderLlmSelectEl: HTMLSelectElement | null = null;

		const refreshLlmDependentSelects = async () => {
			const llms = ensureLlmArray();
			const labels = llms.map((entry) => entry.label);
			let needsSave = false;

			const updateSelect = (select: HTMLSelectElement, selectedValue?: string) => {
				while (select.firstChild) {
					select.removeChild(select.firstChild);
				}
				llms.forEach((entry) => {
					const opt = select.createEl("option", {
						text: entry.label,
					});
					opt.value = entry.label;
				});
				return selectedValue || "";
			};

			if (defaultLlmSelectEl) {
				updateSelect(defaultLlmSelectEl);
				if (
					!this.plugin.settings.defaultLlmLabel ||
					!labels.includes(this.plugin.settings.defaultLlmLabel)
				) {
					this.plugin.settings.defaultLlmLabel = labels[0];
					needsSave = true;
				}
				defaultLlmSelectEl.value = this.plugin.settings.defaultLlmLabel || labels[0] || "";
			}
			
			if (folderLlmSelectEl) {
				while (folderLlmSelectEl.firstChild) {
					folderLlmSelectEl.removeChild(folderLlmSelectEl.firstChild);
				}
				folderLlmSelectEl.createEl("option", { text: "Use Default", value: "" });

				llms.forEach((entry) => {
					const opt = folderLlmSelectEl!.createEl("option", {
						text: entry.label,
					});
					opt.value = entry.label;
				});

				const current = this.plugin.settings.folders.llmLabel;
				if (current && labels.includes(current)) {
					folderLlmSelectEl.value = current;
				} else {
					folderLlmSelectEl.value = "";
					if (current) { // It was set but no longer exists
						this.plugin.settings.folders.llmLabel = undefined;
						needsSave = true;
					}
				}
			}

			if (needsSave) {
				await this.plugin.saveSettings();
			}
		};

		const generateUniqueLlmLabel = () => {
			const llms = ensureLlmArray();
			const existing = new Set(llms.map((entry) => entry.label.toLowerCase()));
			let counter = llms.length + 1;
			while (existing.has(`llm${counter}`)) {
				counter++;
			}
			return `llm${counter}`.slice(0, 12);
		};

		const renderLlmRows = () => {
			const llms = ensureLlmArray();
			llmWrap.empty();
			if (llms.length === 0) {
				const empty = llmWrap.createEl("div");
				empty.textContent = "No LLMs configured.";
				empty.addClass("setting-item-description");
				return;
			}
			llms.forEach((entry, idx) => {
				const row = llmWrap.createEl("div");
				row.style.display = "flex";
				row.style.alignItems = "center";
				row.style.gap = "10px";
				row.style.marginBottom = "8px";

				const labelInput = row.createEl("input", { type: "text" });
				labelInput.placeholder = "Label (max 12)";
				labelInput.value = entry.label;
				labelInput.maxLength = 12;
				labelInput.style.minWidth = "8ch";
				labelInput.onchange = async () => {
					const val = (labelInput.value || "").trim();
					const valid = /^[A-Za-z0-9_]{1,12}$/.test(val);
					if (!valid) {
						new Notice(
							"Label must be 1–12 characters (letters, numbers, or underscore)."
						);
						labelInput.value = entry.label;
						return;
					}
					const duplicate = llms.some(
						(other, otherIdx) =>
							otherIdx !== idx &&
							other.label.toLowerCase() === val.toLowerCase()
					);
					if (duplicate) {
						new Notice("Label must be unique.");
						labelInput.value = entry.label;
						return;
					}
					const previous = entry.label;
					if (previous === val) return;
					entry.label = val;
					if (this.plugin.settings.defaultLlmLabel === previous) {
						this.plugin.settings.defaultLlmLabel = val;
					}
					if (this.plugin.settings.folders.llmLabel === previous) {
						this.plugin.settings.folders.llmLabel = val;
					}
					await this.plugin.saveSettings();
					await refreshLlmDependentSelects();
				};

				const vendorSelect = row.createEl("select");
				const vendorOptions: Array<{ value: LlmVendor; text: string }> = [
					{ value: "openai", text: "OpenAI" },
					{ value: "gemini", text: "Google Gemini" },
					{ value: "openrouter", text: "OpenRouter" },
				];
				vendorOptions.forEach((opt) => {
					const optEl = vendorSelect.createEl("option", {
						text: opt.text,
					});
					optEl.value = opt.value;
				});
				vendorSelect.value = entry.vendor;
				vendorSelect.onchange = async () => {
					const newVendor = vendorSelect.value as LlmVendor;
					if (entry.vendor === newVendor) return;
					entry.vendor = newVendor;
					const defaults = MODEL_OPTION_MAP[newVendor] || [];
					if (defaults.length > 0) {
						entry.model = defaults[0].value;
					}
					await this.plugin.saveSettings();
					renderLlmRows();
					await refreshLlmDependentSelects();
				};

				const modelWrap = row.createEl("div");
				modelWrap.style.display = "flex";
				modelWrap.style.alignItems = "center";
				modelWrap.style.gap = "6px";
				modelWrap.style.flex = "1";

				const modelSelect = modelWrap.createEl("select");
				modelSelect.style.minWidth = "16ch";

				const customModelInput = modelWrap.createEl("input", {
					type: "text",
				});
				customModelInput.placeholder = "Custom model";
				customModelInput.style.display = "none";
				customModelInput.style.flex = "1";
				customModelInput.maxLength = 80;

				const syncModelControls = () => {
					while (modelSelect.firstChild) {
						modelSelect.removeChild(modelSelect.firstChild);
					}
					const options = MODEL_OPTION_MAP[entry.vendor] || [];
					options.forEach((opt) => {
						const optEl = modelSelect.createEl("option", {
							text: opt.label,
						});
						optEl.value = opt.value;
					});
					const customOpt = modelSelect.createEl("option", {
						text: "Custom…",
					});
					customOpt.value = "__custom__";

					const trimmed = (entry.model || "").trim();
					const matched = options.find((opt) => opt.value === trimmed);
					if (matched) {
						modelSelect.value = matched.value;
						customModelInput.style.display = "none";
						customModelInput.value = "";
						return;
					}
					if (trimmed.length > 0) {
						modelSelect.value = "__custom__";
						customModelInput.style.display = "";
						customModelInput.value = trimmed;
						return;
					}
					if (options.length > 0) {
						const defaultValue = options[0].value;
						modelSelect.value = defaultValue;
						customModelInput.style.display = "none";
						customModelInput.value = "";
						if (entry.model !== defaultValue) {
							entry.model = defaultValue;
							void this.plugin.saveSettings();
						}
						return;
					}
					modelSelect.value = "__custom__";
					customModelInput.style.display = "";
					customModelInput.value = "";
				};

				syncModelControls();

				modelSelect.onchange = async () => {
					if (modelSelect.value === "__custom__") {
						customModelInput.style.display = "";
						customModelInput.focus();
						return;
					}
					const value = modelSelect.value;
					if (entry.model === value) return;
					entry.model = value;
					customModelInput.style.display = "none";
					customModelInput.value = "";
					await this.plugin.saveSettings();
				};

				customModelInput.onchange = async () => {
					const value = customModelInput.value.trim();
					if (!value) {
						customModelInput.value = (entry.model || "").trim();
						if (!customModelInput.value) {
							customModelInput.style.display = "none";
							syncModelControls();
						}
						return;
					}
					if (entry.model === value) return;
					entry.model = value;
					modelSelect.value = "__custom__";
					await this.plugin.saveSettings();
				};

				const apiKeyInput = row.createEl("input", { type: "password" });
				apiKeyInput.placeholder = "API key";
				apiKeyInput.value = entry.apiKey || "";
				apiKeyInput.style.width = "28ch";
				apiKeyInput.onchange = async () => {
					entry.apiKey = apiKeyInput.value.trim();
					await this.plugin.saveSettings();
				};

				const delBtn = row.createEl("button", { text: "×" });
				delBtn.addClass("basemaker-btn-ghost-danger");
				delBtn.addClass("basemaker-icon-btn");
				delBtn.style.marginLeft = "auto";
				delBtn.setAttr("aria-label", "Remove LLM");
				delBtn.title = "Remove LLM";
				delBtn.disabled = llms.length <= 1;
				delBtn.onclick = async () => {
					if (llms.length <= 1) return;
					const [removed] = llms.splice(idx, 1);
					if (removed) {
						if (
							this.plugin.settings.defaultLlmLabel === removed.label
						) {
							this.plugin.settings.defaultLlmLabel = llms[0]?.label;
						}
						if (this.plugin.settings.folders.llmLabel === removed.label) {
							this.plugin.settings.folders.llmLabel = undefined;
						}
					}
					await this.plugin.saveSettings();
					renderLlmRows();
					await refreshLlmDependentSelects();
				};
			});
		};

		renderLlmRows();

		const addLlmWrap = containerEl.createEl("div");
		addLlmWrap.style.display = "flex";
		addLlmWrap.style.justifyContent = "flex-end";
		addLlmWrap.style.marginTop = "8px";
		const addLlmBtn = addLlmWrap.createEl("button", {
			text: "Add LLM",
		});
		addLlmBtn.addClass("mod-cta");
		addLlmBtn.onclick = async () => {
			const llms = ensureLlmArray();
			const newLabel = generateUniqueLlmLabel();
			const defaults = MODEL_OPTION_MAP.gemini || [];
			const newEntry = {
				label: newLabel,
				vendor: "gemini" as LlmVendor,
				model: defaults[0]?.value || "",
				apiKey: "",
			};
			this.plugin.settings.llms = [...llms, newEntry];
			if (!this.plugin.settings.defaultLlmLabel) {
				this.plugin.settings.defaultLlmLabel = newEntry.label;
			}
			await this.plugin.saveSettings();
			renderLlmRows();
			await refreshLlmDependentSelects();
		};

		const defaultLlmSetting = new Setting(containerEl)
			.setName("Default LLM")
			.setDesc("Used unless overridden below.");
		defaultLlmSetting.addDropdown((dd) => {
			const selectEl = dd.selectEl;
			selectEl.dataset.role = "llm-default-select";
			defaultLlmSelectEl = selectEl;
			selectEl.style.minWidth = "12ch";
			dd.onChange(async (value) => {
				if (this.plugin.settings.defaultLlmLabel === value) return;
				this.plugin.settings.defaultLlmLabel = value || undefined;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
			.setName("Override LLM for Books")
			.setDesc("Use a specific LLM just for this subject (optional).")
			.addDropdown((dd) => {
				folderLlmSelectEl = dd.selectEl;
				dd.onChange(async (value) => {
					this.plugin.settings.folders.llmLabel = value || undefined;
					await this.plugin.saveSettings();
				});
			});

		void refreshLlmDependentSelects();

		// IMAGE HANDLING
		containerEl.createEl("h3", { text: "Images" });
		new Setting(containerEl)
			.setName("Keep original after resize")
			.setDesc(
				"When an image is larger than 750×1000 and is resized, keep the original file instead of deleting it."
			)
			.addToggle((t) =>
				t
					.setValue(
						!!this.plugin.settings.image?.keepOriginalAfterResize
					)
					.onChange(async (val) => {
						if (!this.plugin.settings.image)
							this.plugin.settings.image = {
								keepOriginalAfterResize: val,
							} as any;
						this.plugin.settings.image.keepOriginalAfterResize =
							val;
						await this.plugin.saveSettings();
					})
			);

		// NARRATIVE STYLE SETTINGS
		containerEl.createEl("h3", { text: "Narrative Style" });
		const toneWrap = containerEl.createEl("div", {
			cls: "basemaker-tone-rows",
		});

		let folderStyleSelectEl: HTMLSelectElement | null = null;
		
		const refreshNarrativeStyleSelects = () => {
			const styles = this.plugin.settings.narrativeStyles || [];
			
			if (folderStyleSelectEl) {
				while (folderStyleSelectEl.firstChild) {
					folderStyleSelectEl.removeChild(folderStyleSelectEl.firstChild);
				}
				folderStyleSelectEl.createEl("option", { text: "No narrative style", value: "" });
				styles.forEach((style) => {
					folderStyleSelectEl!.createEl("option", { text: style.label, value: style.label });
				});
				const current = this.plugin.settings.folders.narrativeStyleLabel;
				const exists = styles.some(s => s.label === current);
				folderStyleSelectEl.value = exists ? current! : "";
			}
		};

		let pendingFocusStyleIndex: number | undefined;

		const renderToneRows = (focusStyleIndex?: number) => {
			if (focusStyleIndex === undefined) {
				pendingFocusStyleIndex = undefined;
			}
			toneWrap.empty();
			const styles = this.plugin.settings.narrativeStyles || [];
			styles.forEach((t, idx) => {
				const row = toneWrap.createEl("div");
				row.style.display = "flex";
				row.style.alignItems = "center";
				row.style.gap = "10px";
				row.style.marginBottom = "8px";

				// Label input
				const labelInput = row.createEl("input", { type: "text" });
				labelInput.dataset.role = "narrative-label";
				labelInput.dataset.index = String(idx);
				labelInput.placeholder = "Label (max 8)";
				labelInput.value = t.label || "";
				labelInput.maxLength = 8;
				labelInput.addEventListener("keydown", (evt) => {
					if (evt.key === "Tab" && !evt.shiftKey) {
						pendingFocusStyleIndex = idx;
					} else {
						pendingFocusStyleIndex = undefined;
					}
				});
				labelInput.onchange = async () => {
					const val = (labelInput.value || "").trim();
					const valid = /^[A-Za-z0-9]{1,8}$/.test(val);
					const duplicate = (
						this.plugin.settings.narrativeStyles || []
					).some(
						(e, i) =>
							i !== idx &&
							e.label.toLowerCase() === val.toLowerCase()
					);
					if (!valid) {
						new Notice(
							"Label must be alphanumeric and at most 8 characters."
						);
						labelInput.value = t.label || "";
						return;
					}
					if (duplicate) {
						new Notice("Label must be unique.");
						labelInput.value = t.label || "";
						return;
					}
					const prev = t.label;
					t.label = val;
					if (this.plugin.settings.folders.narrativeStyleLabel === prev) {
						this.plugin.settings.folders.narrativeStyleLabel = val;
					}
					await this.plugin.saveSettings();
					const shouldFocusStyle = pendingFocusStyleIndex === idx;
					pendingFocusStyleIndex = undefined;
					renderToneRows(shouldFocusStyle ? idx : undefined);
					refreshNarrativeStyleSelects();
				};

				// Narrative Style input (allow punctuation; enforce length only)
				const toneInput = row.createEl("input", { type: "text" });
				toneInput.dataset.role = "narrative-style";
				toneInput.dataset.index = String(idx);
				toneInput.placeholder = "Narrative style (max 60)";
				toneInput.value = t.narrativeStyle || "";
				toneInput.maxLength = 60;
				toneInput.style.width = "52ch";
				toneInput.onchange = async () => {
					const val = (toneInput.value || "").trim();
					if (val.length > 60) {
						new Notice(
							"Narrative style must be at most 60 characters."
						);
						toneInput.value = t.narrativeStyle || "";
						return;
					}
					t.narrativeStyle = val;
					toneInput.value = val;
					await this.plugin.saveSettings();
					refreshNarrativeStyleSelects();
				};

				// Delete button (compact ghost "×")
				const delBtn = row.createEl("button", { text: "×" });
				delBtn.addClass("basemaker-btn-ghost-danger");
				delBtn.addClass("basemaker-icon-btn");
				// Align delete button to the far right of the row
				delBtn.style.marginLeft = "auto";
				delBtn.setAttr("aria-label", "Remove narrative style");
				delBtn.title = "Remove narrative style";
				delBtn.onclick = async () => {
					const list = this.plugin.settings.narrativeStyles || [];
					list.splice(idx, 1);
					this.plugin.settings.narrativeStyles = list;
					if (this.plugin.settings.folders.narrativeStyleLabel === t.label) {
						this.plugin.settings.folders.narrativeStyleLabel = undefined;
					}
					await this.plugin.saveSettings();
					renderToneRows();
					refreshNarrativeStyleSelects();
				};
			});

			if (focusStyleIndex !== undefined) {
				const target = toneWrap.querySelector<HTMLInputElement>(
					`input[data-role="narrative-style"][data-index="${focusStyleIndex}"]`
				);
				if (target) {
					target.focus();
					target.select();
				}
			}
		};

		renderToneRows();

		// Add new narrative style button
		const addToneWrap = containerEl.createEl("div");
		addToneWrap.style.display = "flex";
		addToneWrap.style.justifyContent = "flex-end";
		addToneWrap.style.marginTop = "8px";
		addToneWrap.style.width = "100%";
		const addToneBtn = addToneWrap.createEl("button", {
			text: "Add narrative style",
		});
		addToneBtn.addClass("mod-cta");
		addToneBtn.onclick = async () => {
			const tones = this.plugin.settings.narrativeStyles || [];
			// No default; start empty so user picks a unique label
			const newEntry = { label: "", narrativeStyle: "" };
			this.plugin.settings.narrativeStyles = [...tones, newEntry];
			await this.plugin.saveSettings();
			renderToneRows();
			refreshNarrativeStyleSelects();
		};
		
		containerEl.createEl("h4", { text: "Default Narrative Style for Books" });
		new Setting(containerEl)
			.setDesc("Apply this style automatically to generated book summaries.")
			.addDropdown(dd => {
				folderStyleSelectEl = dd.selectEl;
				dd.onChange(async (v) => {
					this.plugin.settings.folders.narrativeStyleLabel = v || undefined;
					await this.plugin.saveSettings();
				});
			});
		refreshNarrativeStyleSelects();

		// Separator after Subject Folders section
		containerEl.createEl("hr");

		// VALIDATION
		containerEl.createEl("h3", { text: "Validation" });
		new Setting(containerEl)
			.setName("Warn on subject mismatch")
			.setDesc(
				"Show a warning if the AI predicts the image is not a book."
			)
			.addToggle((t) =>
				t
					.setValue(
						this.plugin.settings.validation.warnOnMismatch ?? true
					)
					.onChange(async (val) => {
						this.plugin.settings.validation.warnOnMismatch = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Mismatch confidence threshold")
			.setDesc(
				"Warn only if the AI is this confident that it is NOT a book (0.0–1.0)."
			)
			.addText((t) =>
				t
					.setPlaceholder("0.7")
					.setValue(
						String(
							this.plugin.settings.validation.mismatchThreshold ??
								0.7
						)
					)
					.onChange(async (val) => {
						let n = parseFloat(val);
						if (isNaN(n)) n = 0.7;
						n = Math.max(0, Math.min(1, n));
						this.plugin.settings.validation.mismatchThreshold = n;
						await this.plugin.saveSettings();
					})
			);
	}
}
