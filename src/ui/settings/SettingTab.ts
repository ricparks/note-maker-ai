// Settings Tab UI (moved under ui/settings for cohesion)
import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { subjects } from "../../core/subject";
import BaseMakerPlugin from "../../main";
import type { LlmVendor, SubjectFolderEntry } from "../../settings/schema";
import { FolderSuggest } from "../components/FolderSuggest";

const OPENAI_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "gpt-4o", label: "GPT-4o" },
	{ value: "gpt-4o-mini", label: "GPT-4o Mini" },
	{ value: "gpt-5", label: "GPT-5" },
	{ value: "gpt-5-mini", label: "GPT-5 Mini" },
];

const GEMINI_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
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

export class BaseMakerSettingTab extends PluginSettingTab {
	plugin: BaseMakerPlugin;
	constructor(app: App, plugin: BaseMakerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "BaseMaker Settings" });

		// VERSION (read-only)
		new Setting(containerEl)
			.setName("Version")
			.setDesc(this.plugin.manifest.version);

		// SUBJECT
		new Setting(containerEl)
			.setName("Subject")
			.setDesc("Domain for note generation.")
			.addDropdown((dd) => {
				Object.keys(subjects).forEach((id) => {
					const label =
						id === "wine"
							? "Wine"
							: id === "books"
							? "Books"
							: id === "travel"
							? "Travel"
							: id;
					dd.addOption(id, label);
				});
				dd.setValue(this.plugin.settings.subject.id).onChange(
					async (v) => {
						this.plugin.settings.subject.id = v as any;
						await this.plugin.saveSettings();
						// Refresh ribbon icon/title after subject change
						(this.plugin as any)["renderRibbon"]?.();
					}
				);
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

		const refreshLlmDependentSelects = async () => {
			const llms = ensureLlmArray();
			const labels = llms.map((entry) => entry.label);
			let needsSave = false;

			const defaultSelect = defaultLlmSelectEl;
			if (defaultSelect) {
				while (defaultSelect.firstChild) {
					defaultSelect.removeChild(defaultSelect.firstChild);
				}
				llms.forEach((entry) => {
					const opt = defaultSelect.createEl("option", {
						text: entry.label,
					});
					opt.value = entry.label;
				});
				if (
					!this.plugin.settings.defaultLlmLabel ||
					!labels.includes(this.plugin.settings.defaultLlmLabel)
				) {
					this.plugin.settings.defaultLlmLabel = labels[0];
					needsSave = true;
				}
				const effectiveDefault =
					this.plugin.settings.defaultLlmLabel || labels[0] || "";
				if (defaultSelect.value !== effectiveDefault) {
					defaultSelect.value = effectiveDefault;
				}
			}

			const folderSelects = containerEl.querySelectorAll<HTMLSelectElement>(
				'select[data-role="llm-label-select"]'
			);
			folderSelects.forEach((select) => {
				const index = Number(select.dataset.index ?? "-1");
				const folder =
					index >= 0
						? this.plugin.settings.subjectFolders?.[index]
						: undefined;
				while (select.firstChild) {
					select.removeChild(select.firstChild);
				}
				const defaultOpt = select.createEl("option", {
					text: "Use default",
				});
				defaultOpt.value = "";
				llms.forEach((entry) => {
					const opt = select.createEl("option", {
						text: entry.label,
					});
					opt.value = entry.label;
				});
				const desired =
					folder?.llmLabel && labels.includes(folder.llmLabel)
						? folder.llmLabel
						: "";
				select.value = desired;
				if (folder && folder.llmLabel && !labels.includes(folder.llmLabel)) {
					folder.llmLabel = undefined;
					needsSave = true;
				}
			});

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
					for (const folder of this.plugin.settings.subjectFolders || []) {
						if (folder.llmLabel === previous) {
							folder.llmLabel = val;
						}
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
						for (const folder of this.plugin.settings.subjectFolders || []) {
							if (folder.llmLabel === removed.label) {
								folder.llmLabel = undefined;
							}
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
			.setDesc("Used when a subject folder does not select a specific LLM.");
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

		// NARRATIVE STYLE SETTINGS (moved before Subject folders)
		containerEl.createEl("h3", { text: "Narrative Style" });
		const toneWrap = containerEl.createEl("div", {
			cls: "basemaker-tone-rows",
		});

		const refreshNarrativeStyleSelects = () => {
			const styles = this.plugin.settings.narrativeStyles || [];
			const selects = containerEl.querySelectorAll<HTMLSelectElement>(
				'select[data-role="narrative-style-select"]'
			);
			selects.forEach((select) => {
				const currentValue = select.value;
				while (select.firstChild) {
					select.removeChild(select.firstChild);
				}
				const noneOpt = select.createEl("option", {
					text: "No narrative style",
				});
				noneOpt.value = "";
				styles.forEach((style) => {
					const opt = select.createEl("option", {
						text: style.label || "",
					});
					opt.value = style.label || "";
				});
				const hasCurrent = styles.some(
					(style) => style.label === currentValue
				);
				select.value = hasCurrent ? currentValue : "";
			});
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
				labelInput.placeholder = "Label (max 8, alphanumeric)";
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
					t.label = val;
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

		// Separator after Narrative Style section
		containerEl.createEl("hr");

		// SUBJECT FOLDERS
		containerEl.createEl("h3", { text: "Subject Folders" });
		const rowsWrap = containerEl.createEl("div", {
			cls: "basemaker-subject-rows",
		});

		const renderRows = () => {
			rowsWrap.empty();
			const entries = this.plugin.settings.subjectFolders || [];
			const used = new Set(
				(this.plugin.settings.subjectFolders || []).map(
					(e) => e.subjectId
				)
			);
			const allIds = Object.keys(subjects) as Array<
				keyof typeof subjects
			>;
			entries.forEach((entry, idx) => {
				const row = rowsWrap.createEl("div", {
					cls: "basemaker-subject-row",
				});
				row.style.display = "flex";
				row.style.alignItems = "center";
				row.style.gap = "10px";
				row.style.marginBottom = "8px";

				// Subject dropdown
				const subjectSelect = row.createEl("select");
				subjectSelect.dataset.role = "subject-select";
				allIds.forEach((id) => {
					const opt = subjectSelect.createEl("option", {
						text:
							id === "wine"
								? "Wine"
								: id === "books"
								? "Books"
								: id === "travel"
								? "Travel"
								: id,
					});
					opt.value = id;
					opt.selected = id === entry.subjectId;
					if (id !== entry.subjectId && used.has(id as any))
						opt.disabled = true;
				});
				subjectSelect.onchange = async () => {
					entry.subjectId = subjectSelect.value as any;
					await this.plugin.saveSettings();
					renderRows();
					await refreshLlmDependentSelects();
				};

				// Notes folder input with inline suggestions
				const notesInput = row.createEl("input", { type: "text" });
				notesInput.placeholder = "Notes folder (e.g., Bases/Travel)";
				notesInput.value = entry.notesFolder || "";
				notesInput.style.minWidth = "8ch";
				notesInput.onchange = async () => {
					entry.notesFolder = notesInput.value.trim();
					await this.plugin.saveSettings();
				};
				new FolderSuggest(this.app, notesInput, async (picked) => {
					entry.notesFolder = picked;
					await this.plugin.saveSettings();
				});

				// Photos folder input with inline suggestions
				const photosInput = row.createEl("input", { type: "text" });
				photosInput.placeholder =
					"Photos folder (e.g., Bases/Travel/photos)";
				photosInput.value = entry.photosFolder || "";
				photosInput.style.minWidth = "8ch";
				photosInput.onchange = async () => {
					entry.photosFolder = photosInput.value.trim();
					await this.plugin.saveSettings();
				};
				new FolderSuggest(this.app, photosInput, async (picked) => {
					entry.photosFolder = picked;
					await this.plugin.saveSettings();
				});

				// LLM dropdown (optional override)
				const llmSelect = row.createEl("select");
				llmSelect.dataset.role = "llm-label-select";
				llmSelect.dataset.index = String(idx);
				llmSelect.style.minWidth = "12ch";
				llmSelect.onchange = async () => {
					const value = llmSelect.value.trim();
					entry.llmLabel = value || undefined;
					await this.plugin.saveSettings();
				};

				// Narrative Style dropdown (optional association)
				const toneSelect = row.createEl("select");
				toneSelect.dataset.role = "narrative-style-select";
				const noneOpt = toneSelect.createEl("option", {
					text: "No narrative style",
				});
				noneOpt.value = "";
				const tones = this.plugin.settings.narrativeStyles || [];
				tones.forEach((t) => {
					const opt = toneSelect.createEl("option", {
						text: t.label,
					});
					opt.value = t.label;
				});
				toneSelect.value = entry.narrativeStyleLabel || "";
				toneSelect.style.minWidth = "8ch";
				toneSelect.onchange = async () => {
					const v = toneSelect.value.trim();
					entry.narrativeStyleLabel = v || undefined;
					await this.plugin.saveSettings();
				};

				// Delete button (compact ghost "×")
				const delBtn = row.createEl("button", { text: "×" });
				delBtn.addClass("basemaker-btn-ghost-danger");
				delBtn.addClass("basemaker-icon-btn");
				delBtn.style.marginLeft = "auto";
				delBtn.setAttr("aria-label", "Remove subject");
				delBtn.title = "Remove subject";
				delBtn.onclick = async () => {
					const list = this.plugin.settings.subjectFolders || [];
					list.splice(idx, 1);
					this.plugin.settings.subjectFolders = list;
					await this.plugin.saveSettings();
					renderRows();
					await refreshLlmDependentSelects();
				};
			});
		};

		renderRows();
		void refreshLlmDependentSelects();

		// Add new subject folder button
		const addWrap = containerEl.createEl("div");
		addWrap.style.display = "flex";
		addWrap.style.justifyContent = "flex-end";
		addWrap.style.marginTop = "8px";
		const addBtn = addWrap.createEl("button", {
			text: "Add new subject folder",
		});
		addBtn.addClass("mod-cta");
		const refreshAddState = () => {
			const used = new Set(
				(this.plugin.settings.subjectFolders || []).map(
					(e) => e.subjectId
				)
			);
			const allIds = Object.keys(subjects) as Array<
				keyof typeof subjects
			>;
			const available = allIds.filter((id) => !used.has(id as any));
			addBtn.disabled = available.length === 0;
			addBtn.title =
				available.length === 0 ? "All subjects already configured" : "";
		};
		refreshAddState();
		addBtn.onclick = async () => {
			const used = new Set(
				(this.plugin.settings.subjectFolders || []).map(
					(e) => e.subjectId
				)
			);
			const allIds = Object.keys(subjects) as Array<
				keyof typeof subjects
			>;
			const available = allIds.filter((id) => !used.has(id as any));
			if (available.length === 0) return;
			const newEntry: SubjectFolderEntry = {
				subjectId: available[0] as any,
				notesFolder: "",
				photosFolder: "",
				llmLabel: this.plugin.settings.defaultLlmLabel,
			};
			this.plugin.settings.subjectFolders = [
				...(this.plugin.settings.subjectFolders || []),
				newEntry,
			];
			await this.plugin.saveSettings();
			renderRows();
			refreshAddState();
			await refreshLlmDependentSelects();
		};
		// Separator after Subject Folders section
		containerEl.createEl("hr");

		// SUBJECT GUARDRAILS
		containerEl.createEl("h3", { text: "Subject Guardrails" });
		new Setting(containerEl)
			.setName("Warn on subject mismatch")
			.setDesc(
				"Show a warning if the AI predicts a different category than the selected subject (Travel always allows)."
			)
			.addToggle((t) =>
				t
					.setValue(
						this.plugin.settings.subject.warnOnMismatch ?? true
					)
					.onChange(async (val) => {
						this.plugin.settings.subject.warnOnMismatch = val;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Mismatch confidence threshold")
			.setDesc(
				"Warn only if predicted category confidence is at or above this value (0.0–1.0)."
			)
			.addText((t) =>
				t
					.setPlaceholder("0.7")
					.setValue(
						String(
							this.plugin.settings.subject.mismatchThreshold ??
								0.7
						)
					)
					.onChange(async (val) => {
						let n = parseFloat(val);
						if (isNaN(n)) n = 0.7;
						n = Math.max(0, Math.min(1, n));
						this.plugin.settings.subject.mismatchThreshold = n;
						await this.plugin.saveSettings();
					})
			);
	}
}
