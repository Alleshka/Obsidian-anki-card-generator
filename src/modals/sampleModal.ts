import { App, Modal, Setting } from 'obsidian';
import Note from '../types/Note';

export default class SampleModal extends Modal {
	private addedItems: Note[];
	private notAddedItems: Note[];
	private isSuccess: boolean;

	constructor(app: App, isSuccess: boolean, addedItems: Note[], notAddedItems: Note[]) {
		super(app);

		this.isSuccess = isSuccess;
		this.addedItems = addedItems;
		this.notAddedItems = notAddedItems;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty(); // Clear any previous content


		// Added Section
		const addedDiv = contentEl.createDiv({ cls: 'report-section' });
		addedDiv.createEl('h3', { text: '✅ Added' });
		if (this.addedItems.length > 0 && this.isSuccess) {
			const ul = addedDiv.createEl('ul');
			this.addedItems.forEach(note => {
				ul.createEl('li', { text: `${Object.values(note)[0]}` });
			});
		} else {
			addedDiv.createEl('p', { text: 'No items were added.' });
		}

		// Not Added Section
		const notAddedDiv = contentEl.createDiv({ cls: 'report-section' });
		notAddedDiv.createEl('h3', { text: '❌ Not Added' });
		if (this.notAddedItems.length > 0 || !this.isSuccess) {
			const ul = notAddedDiv.createEl('ul');
			this.notAddedItems.forEach(note => {
				ul.createEl('li', { text: `${Object.values(note)[0]}` });
			});

			if (!this.isSuccess) {
				this.addedItems.forEach(note => {
					ul.createEl('li', { text: `${Object.values(note)[0]}` });
				});
			}
		} else {
			notAddedDiv.createEl('p', { text: 'All items were added successfully.' });
		}

		// Close button
		new Setting(contentEl)
			.addButton(btn =>
				btn.setButtonText('Close')
					.setCta()
					.onClick(() => this.close())
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}