/*
 * Copyright (C) 2026 The Application Foundry, LLC 
 *
 * This file is part of NoteMakerAI.
 *
 * NoteMakerAI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * NoteMakerAI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * =========================================================================
 *
 * COMMERCIAL LICENSE OPTION
 *
 * If you wish to use this software in a proprietary product or are unable
 * to comply with the terms of the AGPLv3, a commercial license is available.
 *
 * For commercial licensing inquiries, please contact: license@theapplicationfoundry.com 
 *
 * =========================================================================
 */
import { App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
  private message: string;
  private onConfirm: (dontShowAgain: boolean) => void;
  private onCancel: (dontShowAgain: boolean) => void;
  private dontShowAgain = false;

  constructor(app: App, message: string, onConfirm: (dontShowAgain: boolean) => void, onCancel: (dontShowAgain: boolean) => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    this.titleEl.setText('Confirm');
    const el = this.contentEl;
    el.empty();
    el.createEl('p', { text: this.message });
    const checkboxWrap = el.createEl('div', { cls: 'notemaker-confirm-checkbox-wrap' });
    const label = checkboxWrap.createEl('label');
    const cb = label.createEl('input', { type: 'checkbox' });
    label.appendText(" Don't show this warning again");
    cb.onchange = () => { this.dontShowAgain = cb.checked; };
    const footer = el.createEl('div', { cls: 'notemaker-confirm-footer' });
    const cancelBtn = footer.createEl('button', { text: 'Cancel', cls: 'notemaker-confirm-cancel-btn' });
    const okBtn = footer.createEl('button', { text: 'Continue' });
    okBtn.addClass('mod-cta');
    cancelBtn.onclick = () => { this.close(); this.onCancel(this.dontShowAgain); };
    okBtn.onclick = () => { this.close(); this.onConfirm(this.dontShowAgain); };
  }
}

export interface ConfirmResult { ok: boolean; dontShowAgain: boolean }

export function confirm(app: App, message: string): Promise<ConfirmResult> {
  return new Promise(resolve => {
    const modal = new ConfirmModal(
      app,
      message,
      // onConfirm
      (dontShowAgain) => resolve({ ok: true, dontShowAgain }),
      // onCancel
      (dontShowAgain) => resolve({ ok: false, dontShowAgain })
    );
    modal.open();
  });
}
