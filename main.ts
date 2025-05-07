import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
const gTTS = require('gtts');
const path = require('path');

interface WordsSettings {
	deckName: string,
	modelName: string,
	generateAudio?: GenerateAuidoSettings,
	handler?: (result: Record<string, string>) => void;
}

interface GenerateAuidoSettings {
	language: string;
	audioField?: string;
	textToSpeechGetter?: (result: Record<string, string>) => string;
	fileNameGenerator?: (note: AnkiNote, defaultFileName: string) => string;
}

interface GeneratedAudioInfo {
	fileName: string;
	textToSpeech: string;
	language: string;
}

interface AnkiNote {
	deckName: string;
	modelName: string;
	fields: Record<string, string>;
	options: any;
	tags: any[];
}

interface NoteInfo {
	ankiNote: AnkiNote;
	audioInfo?: GeneratedAudioInfo;
}

interface AGAnkiCardCreatorSetting {
	anki_connect_url: string;
	ankiFileFolder: string;
}

const DEFAULT_SETTINGS: AGAnkiCardCreatorSetting = {
	anki_connect_url: 'http://localhost:8765',
	ankiFileFolder: `%appdata%/Anki2/user 1/collection.media/`
}

export default class AGAnkiCardCreator extends Plugin {
	settings: AGAnkiCardCreatorSetting;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'generate-cards',
			name: 'Generate cards',
			editorCallback: (editor: Editor, view: MarkdownView) => this.processCards(editor, view)
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async processCards(editor: Editor, view: MarkdownView) {
		const notes: NoteInfo[] = this.parseObsidianNote(editor);
		const [added, notAdded] = await this.saveNotesToAnki(notes);

		if (added.length != 0) {
			for (const note of added) {
				if (note.audioInfo) {
					this.generateAudio(note.audioInfo);
				}
			}
		}

		if (false) {
			new Notice(`${added.length} notes were adeed`);

			if (notAdded.length != 0) {
				for (const note of notAdded) {
					new Notice(`Note '${Object.values(note.ankiNote.fields)[0]}' was't added`);
				}
			}
		}
		else {
			new SampleModal(this.app, added, notAdded).open();
		}
	}

	private async saveNotesToAnki(decks: NoteInfo[]) {
		const notes = decks.map(d => d.ankiNote);
		const canAdd = await fetch('http://127.0.0.1:8765', {
			method: 'POST',
			mode: 'cors',
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST,PATCH,OPTIONS'
			},
			body: JSON.stringify({
				action: "canAddNotes",
				version: 6,
				params: {
					notes: notes
				}
			})
		});

		const canAddResult = await canAdd.json();

		const notAdded: NoteInfo[] = [];
		const added: NoteInfo[] = [];

		canAddResult.result.forEach((item: any, index: number) => {
			if (item) {
				added.push(decks[index]);
			}
			else {
				notAdded.push(decks[index]);
			}
		});

		if (added.length > 0) {
			const response = await fetch('http://127.0.0.1:8765', {
				method: 'POST',
				mode: 'cors',
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST,PATCH,OPTIONS'
				},
				body: JSON.stringify({
					action: "addNotes",
					version: 6,
					params: {
						notes: added.map(n => n.ankiNote)
					}
				})
			});
			const result = await response.json();
			console.log(result);
		}

		return [added, notAdded];
	}

	private parseObsidianNote(editor: Editor): NoteInfo[] {
		const parsedDecks: NoteInfo[] = [];
		const content = editor.getValue();
		const deckRegexp = /\`\`\`js\n?(?<settings>.*?)\`\`\`\n*\|(?<words>.*?)(?=\n(?:#|$))/gs

		let block;
		while ((block = deckRegexp.exec(content)) != null) {
			if (block && block.groups) {
				const { settings, words } = block.groups;

				let parsedSettings = this.parseSettings(settings);
				const parsedCards = this.parseFields(words, parsedSettings);
				parsedDecks.push(...parsedCards);
			}
		}

		return parsedDecks;
	}

	private parseSettings(str: string): WordsSettings {
		let settings: WordsSettings = eval('(' + str + ')');
		return settings;
	}

	private parseFields(str: string, settings: WordsSettings): NoteInfo[] {
		const content: string[] = str.split("\n").filter(s => s.trim());
		if (content.length < 3) return [];

		const headers = content[0].split('|').map(h => h.trim()).filter(h => h);
		const rows = content.slice(2); // skip header and separator

		let handler = null;
		if (settings.handler) {
			handler = settings.handler;
		}

		const words: NoteInfo[] = rows.map(row => {
			const values = row.split('|').filter(v => v.trim());
			const wordEntry: Record<string, string> = {};

			headers.forEach((header, index) => {
				if (header) {
					wordEntry[header] = (values[index] || "").trim() || '';
				}
			});

			if (handler) {
				handler(wordEntry);
			}

			const ankiNote: AnkiNote = {
				deckName: settings.deckName,
				modelName: settings.modelName,
				fields: wordEntry,
				options: {
					"allowDuplicate": false,
					"duplicateScope": "deck"
				},
				tags: []
			};

			const noteInfo: NoteInfo = {
				ankiNote: ankiNote
			}

			if (settings.generateAudio) {
				const defaultField = wordEntry[headers[0]];
				const audioSettings = settings.generateAudio;
				const audioField = audioSettings.audioField || "Audio";

				let text: string = audioSettings.textToSpeechGetter
					? audioSettings.textToSpeechGetter(wordEntry)
					: defaultField;
				text = this.normalizeTextToSpeech(text);

				const fileName = this.prepareFileName(ankiNote, text, audioSettings);
				wordEntry[audioField] = `[sound:${fileName}]`;

				const audioInfo: GeneratedAudioInfo = {
					fileName: fileName,
					textToSpeech: text,
					language: audioSettings.language
				};
				noteInfo.audioInfo = audioInfo;
			}

			return noteInfo;
		});

		return words;
	}

	private generateAudio(audioInfo: GeneratedAudioInfo) {
		let text = audioInfo.textToSpeech;
		if (!text) {
			console.log("Text is empty");
			return;
		}

		var gtts = new gTTS(text, audioInfo.language);

		const filePath = path.join(this.settings.ankiFileFolder, audioInfo.fileName);
		gtts.save(filePath, function (err: any, result: any) {
			if (err) { throw new Error(err) }
			console.log(`Success! Open file ${filePath} to hear result.`);
		});
	}

	private normalizeTextToSpeech(text: string): string {
		text = text.replace(/\(.*?\)|\[.*?\]|\{.*?\}|\<.*?\>/gm, "");
		text = text.replace(/\*\*|__|==|\.\.\./g, "");
		return text.trim();
	}

	private normalizeTextToSave(text: string): string {
		text = text.replace(/[?\\/:*<>|]/g, "");
		text = text.replace(/ /g, "_");
		return text;
	}

	private prepareFileName(ankiNote: AnkiNote, text: string, audioSettings: GenerateAuidoSettings): string {
		let fileName: string = `${ankiNote.deckName}-${ankiNote.modelName}-${text.trim()}`;
		fileName = `__ag__${new Date().toISOString().substring(0, 10)}_${fileName}.mp3`;
		if (audioSettings.fileNameGenerator) {
			fileName = audioSettings.fileNameGenerator(ankiNote, fileName);
		}
		fileName = this.normalizeTextToSave(fileName);
		return fileName;
	}
}

class SampleModal extends Modal {
	private addedItems: NoteInfo[];
	private notAddedItems: NoteInfo[];

	constructor(app: App, addedItems: NoteInfo[], notAddedItems: NoteInfo[]) {
		super(app);

		this.addedItems = addedItems;
		this.notAddedItems = notAddedItems;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty(); // Clear any previous content
		contentEl.createEl('h2', { text: 'Operation Report' });

		// Added Section
		const addedDiv = contentEl.createDiv({ cls: 'report-section' });
		addedDiv.createEl('h3', { text: '✅ Added' });
		if (this.addedItems.length > 0) {
			const ul = addedDiv.createEl('ul');
			this.addedItems.forEach(note => {
				ul.createEl('li', { text: `${Object.values(note.ankiNote.fields)[0]}` });
			});
		} else {
			addedDiv.createEl('p', { text: 'No items were added.' });
		}

		// Not Added Section
		const notAddedDiv = contentEl.createDiv({ cls: 'report-section' });
		notAddedDiv.createEl('h3', { text: '❌ Not Added' });
		if (this.notAddedItems.length > 0) {
			const ul = notAddedDiv.createEl('ul');
			this.notAddedItems.forEach(note => {
				ul.createEl('li', { text: `${Object.values(note.ankiNote.fields)[0]}` });
			});
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

class SampleSettingTab extends PluginSettingTab {
	plugin: AGAnkiCardCreator;

	constructor(app: App, plugin: AGAnkiCardCreator) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Anki connect URL')
			.setDesc('You have to install https://ankiweb.net/shared/info/2055492159 first')
			.addText(text => text
				.setPlaceholder('Enter your url')
				.setValue(this.plugin.settings.anki_connect_url)
				.onChange(async (value) => {
					this.plugin.settings.anki_connect_url = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Anki file folder')
			.addText(text => text
				.setValue(this.plugin.settings.ankiFileFolder)
				.onChange(async (value) => {
					this.plugin.settings.ankiFileFolder = value;
					await this.plugin.saveSettings();
				}));
	}
}
