import { App, Modal } from 'obsidian';

export class ProgressModal extends Modal {
  private messages: { text: string; type: 'info' | 'error'; ts: number }[] = [];
  private autoScroll = true;
  private completed = false;

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('BaseMaker Processing');
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

    const list = el.createEl('div', { cls: 'basemaker-progress-log' });
    this.messages.forEach(m => {
      const line = list.createEl('div', { cls: 'basemaker-progress-line' });
      line.addClass(m.type === 'error' ? 'is-error' : 'is-info');
      const time = new Date(m.ts).toLocaleTimeString();
      line.createEl('span', { text: `[${time}] `, cls: 'timestamp' });
      line.createEl('span', { text: m.text });
    });

    if (this.autoScroll) {
      list.scrollTop = list.scrollHeight;
    }

    if (this.completed) {
      const footer = el.createEl('div', { cls: 'basemaker-progress-footer' });
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
