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

export class ProgressModal extends Modal {
  private messages: { text: string; type: 'info' | 'error'; ts: number }[] = [];
  private autoScroll = true;
  private completed = false;

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('NoteMakerAI Processing');
    this.render();
  }

  onClose() {
    // Clean up if needed
    this.contentEl.empty();
  }

  addMessage(text: string, type: 'info' | 'error' = 'info') {
    this.messages.push({ text, type, ts: Date.now() });
    // Keep only last 200 messages to avoid runaway
    if (this.messages.length > 200) this.messages.shift();
    this.render();
  }

  markDone(success = true) {
    this.completed = true;
    this.addMessage(success ? 'Completed.' : 'Finished with errors.', success ? 'info' : 'error');
    this.render();
  }

  private render() {
    const el = this.contentEl;
    el.empty();

    const list = el.createEl('div', { cls: 'notemaker-progress-log' });
    this.messages.forEach(m => {
      const line = list.createEl('div', { cls: 'notemaker-progress-line' });
      line.addClass(m.type === 'error' ? 'is-error' : 'is-info');
      const time = new Date(m.ts).toLocaleTimeString();
      line.createEl('span', { text: `[${time}] `, cls: 'timestamp' });
      line.createEl('span', { text: m.text });
    });

    if (this.autoScroll) {
      list.scrollTop = list.scrollHeight;
    }

    if (this.completed) {
      const footer = el.createEl('div', { cls: 'notemaker-progress-footer' });
      const btn = footer.createEl('button', { text: 'OK' });
      btn.addClass('mod-cta');
      btn.onclick = () => this.close();
    }
  }
}

export class ProgressSession {
  constructor(private modal: ProgressModal) {}
  info(msg: string) { this.modal.addMessage(msg, 'info'); }
  error(msg: string) { this.modal.addMessage(msg, 'error'); }
  done(ok = true) { this.modal.markDone(ok); }
}

export function createProgressModal(app: App) {
  const modal = new ProgressModal(app);
  modal.open();
  return new ProgressSession(modal);
}
