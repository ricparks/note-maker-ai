// Settings Tab UI (moved under ui/settings for cohesion)
import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type NoteMakerAI from "../../main";
import type { LlmVendor } from "../../settings/schema";
import { SUBJECT_DIR, SUBJECT_PHOTOS_DIR } from "../../utils/constants";
import { FolderSuggest } from "../components/FolderSuggest";

const OPENAI_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "gpt-5.1", label: "GPT-5.1" },
	{ value: "gpt-5-mini", label: "GPT-5 Mini" },
];

const GEMINI_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
	{ value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
	{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

const OPENROUTER_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
	{ value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
	{ value: "anthropic/claude-opus-4.1", label: "Claude Opus 4.1" },
	{ value: "x-ai/grok-4", label: "Grok 4" },
	{ value: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
];

const ANTHROPIC_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "claude-opus-4-5-20251101", label: "Claude Opus 4.5" },
];

const MODEL_OPTION_MAP: Record<LlmVendor, Array<{ value: string; label: string }>> = {
	openai: OPENAI_MODEL_OPTIONS,
	gemini: GEMINI_MODEL_OPTIONS,
	openrouter: OPENROUTER_MODEL_OPTIONS,
	anthropic: ANTHROPIC_MODEL_OPTIONS,
};

export class NoteMakerAISettingTab extends PluginSettingTab {
	plugin: NoteMakerAI;
	constructor(app: App, plugin: NoteMakerAI) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h3", { text: "NoteMakerAI Settings" });

		// VERSION (read-only)
		new Setting(containerEl)
			.setName("Version")
			.setDesc(this.plugin.manifest.version);

		// SUBJECTS
		containerEl.createEl("h3", { text: "Subjects" });
		const subjectsWrap = containerEl.createEl("div", { cls: "notemaker-subjects-list" });

		const renderSubjects = () => {
			subjectsWrap.empty();
			const subjects = this.plugin.settings.subjects || [];
			
			subjects.forEach((subject, idx) => {
				const card = subjectsWrap.createEl("div", { cls: "notemaker-subject-card" });
				card.style.border = "1px solid var(--background-modifier-border)";
				card.style.borderRadius = "8px";
				card.style.padding = "12px";
				card.style.marginBottom = "12px";
				card.style.backgroundColor = "var(--background-secondary)";

				// Header: Name + Loading styling
				const header = card.createEl("div");
				header.style.display = "flex";
				header.style.justifyContent = "space-between";
				header.style.marginBottom = "10px";
				header.createEl("h4", { text: subject.name || "Untitled Subject", cls: "setting-item-name" }).style.margin = "0";

				// Delete Button
				const delBtn = header.createEl("button", { text: "Delete" });
				delBtn.addClass("mod-warning");
				delBtn.onclick = async () => {
					if (!confirm(`Delete subject "${subject.name}"?`)) return;
					this.plugin.settings.subjects.splice(idx, 1);
					await this.plugin.saveSettings();
					await this.plugin.renderRibbons();
					renderSubjects();
				};

				// Name
				new Setting(card)
					.setName("Subject Name")
					.setDesc("Name used in menus and ribbons.")
					.addText(text => text
						.setPlaceholder("e.g. Books, Recipes, Wine")
						.setValue(subject.name)
						.onChange(async (val) => {
							subject.name = val;
							await this.plugin.saveSettings();
							// Debounce ribbon update? For now just save.
							// Header update
							const h4 = header.querySelector("h4");
							if (h4) h4.textContent = val || "Untitled Subject";
							await this.plugin.renderRibbons();
						}));

				// Definition Path
				new Setting(card)
					.setName("Definition File")
					.setDesc("Path to the Subject Definition File (SDF).")
					.addText(text => {
						text.setPlaceholder("e.g. settings/RecipeSubject.md")
							.setValue(subject.subjectDefinitionPath)
							.onChange(async (val) => {
								subject.subjectDefinitionPath = val;
								await this.plugin.saveSettings();
								// Trigger reload of this subject
								await (this.plugin as any).reloadSubject(subject);
							});
						new FolderSuggest(this.app, text.inputEl, async (picked) => {
							subject.subjectDefinitionPath = picked;
							await this.plugin.saveSettings();
							await (this.plugin as any).reloadSubject(subject);
						});
					});

				// Notes Dir
				new Setting(card)
					.setName("Notes Folder")
					.setDesc("Where to save new notes for this subject.")
					.addText(text => {
						text.setPlaceholder(`e.g. ${SUBJECT_DIR}`)
							.setValue(subject.notesDir)
							.onChange(async (val) => {
								subject.notesDir = val;
								await this.plugin.saveSettings();
							});
						new FolderSuggest(this.app, text.inputEl, async (picked) => {
							subject.notesDir = picked;
							await this.plugin.saveSettings();
						});
					});

				// Photos Dir
				new Setting(card)
					.setName("Photos Folder")
					.setDesc("Where to save/move images.")
					.addText(text => {
						text.setPlaceholder(`e.g. ${SUBJECT_PHOTOS_DIR}`)
							.setValue(subject.photosDir)
							.onChange(async (val) => {
								subject.photosDir = val;
								await this.plugin.saveSettings();
							});
						new FolderSuggest(this.app, text.inputEl, async (picked) => {
							subject.photosDir = picked;
							await this.plugin.saveSettings();
						});
					});

				// LLM Override
				new Setting(card)
					.setName("LLM Override")
					.setDesc("Optional. Use a specific LLM for this subject.")
					.addDropdown(dd => {
						dd.addOption("", "Default (Global Setting)");
						const llms = this.plugin.settings.llms || [];
						llms.forEach(l => dd.addOption(l.label, l.label));
						dd.setValue(subject.llmLabel || "");
						dd.onChange(async (val) => {
							subject.llmLabel = val || undefined;
							await this.plugin.saveSettings();
							await (this.plugin as any).reloadSubject(subject); // Update active subject config
						});
					});
			});
		};

		renderSubjects();

		const addSubjectWrap = containerEl.createEl("div", { cls: "notemaker-add-subject" });
		addSubjectWrap.style.display = "flex";
		addSubjectWrap.style.justifyContent = "center";
		addSubjectWrap.style.marginBottom = "24px";

		const addBtn = addSubjectWrap.createEl("button", { text: "+ Add New Subject" });
		addBtn.addClass("mod-cta");
		addBtn.onclick = async () => {
			this.plugin.settings.subjects.push({
				name: "",
				notesDir: "",
				photosDir: "",
				subjectDefinitionPath: "",
			});
			await this.plugin.saveSettings();
			renderSubjects();
		};

		// LLM CONFIGURATION
		const ensureLlmArray = () => {
			if (!Array.isArray(this.plugin.settings.llms)) {
				this.plugin.settings.llms = [];
			}
			return this.plugin.settings.llms;
		};

		containerEl.createEl("h3", { text: "LLMs" });
		containerEl.createEl("hr");
		const llmWrap = containerEl.createEl("div", {
			cls: "notemaker-llm-rows",
		});

		let defaultLlmSelectEl: HTMLSelectElement | null = null;

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
			

			if (needsSave) {
				await this.plugin.saveSettings();
			}
			renderSubjects();
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

					await this.plugin.saveSettings();
					await refreshLlmDependentSelects();
				};

				const vendorSelect = row.createEl("select");
				const vendorOptions: Array<{ value: LlmVendor; text: string }> = [
					{ value: "openai", text: "OpenAI" },
					{ value: "gemini", text: "Google Gemini" },
					{ value: "openrouter", text: "OpenRouter" },
					{ value: "anthropic", text: "Anthropic" },
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
				customModelInput.style.minWidth = "12ch";
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
					customModelInput.style.display = "none";
					customModelInput.value = "";

					if (entry.model === value) return;
					entry.model = value;
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

				// Update visibility when vendor changes
				const originalVendorOnChange = vendorSelect.onchange;
				vendorSelect.onchange = async (e) => {
					if (originalVendorOnChange) {
						await (originalVendorOnChange as any).call(vendorSelect, e);
					}
					// No extra fields to toggle for now
				};

				const delBtn = row.createEl("button", { text: "×" });
				delBtn.addClass("notemaker-btn-ghost-danger");
				delBtn.addClass("notemaker-icon-btn");
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
		addLlmWrap.style.marginBottom = "18px";
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
			.setName("LLM to use")
			.setDesc("Select an LLM from your defined LLMs above.");
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
						if (!this.plugin.settings.image) {
							this.plugin.settings.image = {
								keepOriginalAfterResize: val,
								orientation: 'maintain',
								rotationDirection: 'clockwise',
							};
						} else {
							this.plugin.settings.image.keepOriginalAfterResize = val;
						}
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Reduced Image Orientation")
			.setDesc("Ensure the reduced image matches this orientation.")
			.addDropdown((dd) => {
				dd.addOption("maintain", "Maintain original");
				dd.addOption("landscape", "Landscape");
				dd.addOption("portrait", "Portrait");
				dd.setValue(this.plugin.settings.image?.orientation || "maintain");
				dd.onChange(async (val) => {
					if (!this.plugin.settings.image) {
						this.plugin.settings.image = {
							keepOriginalAfterResize: false,
							orientation: val as any,
							rotationDirection: 'clockwise',
						};
					} else {
						this.plugin.settings.image.orientation = val as any;
					}
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Rotation Direction")
			.setDesc("When rotating, which direction to turn.")
			.addDropdown((dd) => {
				dd.addOption("clockwise", "Clockwise");
				dd.addOption("counter-clockwise", "Counter-Clockwise");
				dd.setValue(this.plugin.settings.image?.rotationDirection || "clockwise");
				dd.onChange(async (val) => {
					if (!this.plugin.settings.image) {
						this.plugin.settings.image = {
							keepOriginalAfterResize: false,
							orientation: 'maintain',
							rotationDirection: val as any,
						};
					} else {
						this.plugin.settings.image.rotationDirection = val as any;
					}
					await this.plugin.saveSettings();
				});
			});



		// Separator after Subject Folders section
		containerEl.createEl("hr");

	}

}
