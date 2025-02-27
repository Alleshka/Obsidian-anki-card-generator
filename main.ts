import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface DeckSettings {
	deckName: string,
	modelName: string,
	handler?: () => void;
}

interface AGAnkiCardCreatorSetting {
	anki_connect_url: string;
	deckPreffix: string;
	wordsPreffix: string;
}

const DEFAULT_SETTINGS: AGAnkiCardCreatorSetting = {
	anki_connect_url: 'http://localhost:8765',
	deckPreffix: 'Deck',
	wordsPreffix: 'Words',
}

export default class AGAnkiCardCreator extends Plugin {
	settings: AGAnkiCardCreatorSetting;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'generate-cards',
			name: 'Generate cards',
			editorCallback: (editor: Editor, view: MarkdownView) => this.generateCards(editor, view)
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

	async generateCards(editor: Editor, view: MarkdownView) {
		const notes = this.parseNotes(editor);

		const [added, notAdded] = await this.saveNotesToAnki(notes);
		new Notice(`${added.length} notes were adeed`);

		if (notAdded.length != 0) {
			for (const note of notAdded) {
				new Notice(`Note '${Object.values(note.fields)[0]}' was't added`);
			}
		}

		console.log("Added:");
		console.log(added);
		console.log();
		console.log("Not added");
		console.log(notAdded);
		console.log();
	}

	async saveNotesToAnki(decks: any) {

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
					notes: decks
				}
			})
		});

		const canAddResult = await canAdd.json();
		console.log(canAddResult);

		const notAdded: any[] = [];
		const added: any[] = [];

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
						notes: added
					}
				})
			});
			const result = await response.json();
			console.log(result);
		}

		return [added, notAdded];
	}

	parseNotes(editor: Editor) {
		const notes: any[] = [];
		const content = editor.getValue();
		//const deckRegexp = /#*\s*Deck(?<settings>\n*\s*.*?)(?=\n#)(?:\n#*\s*Words\n(?<words>.*?)(?=\n(?:#|$)))/gs
		// #*Words\n(?<settings>.*?)\n?\|(?<words>.*?)(?=\n(?:#|$))
		const deckRegexp = new RegExp(`#*${this.settings.wordsPreffix}\\n(?<settings>.*?)\\n?\\|(?<words>.*?)(?=\\n(?:#|$))`, 'gs');

		let block;
		while ((block = deckRegexp.exec(content)) != null) {
			if (block && block.groups) {
				const { settings, words } = block.groups;

				let parsedSettings = this.parseSettings(settings);
				if (parsedSettings != null) {
					const parsedCards = this.parseCards(words, parsedSettings);
					notes.push(...parsedCards);
				}
			}
		}

		return notes;
	}

	parseSettings(str: string): DeckSettings | null {
		const settingsRegex = /```js\n(?<code>.*?)\n```/gms
		const match = settingsRegex.exec(str);
		if (match != null) {
			let settings = eval('(' + match[1] + ')');
			return settings;
		}
		else return null;
	}

	parseCards(str: string, settings: any) {
		const content: string[] = str.split("\n").filter(s => s.trim());
		if (content.length < 3) return [];

		const headers = content[0].split('|').map(h => h.trim()).filter(h => h);
		const rows = content.slice(2); // skip header and separator

		let handler = null;
		if (settings.handler) {
			handler = settings.handler;
		}

		const words = rows.map(row => {
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

			return {
				deckName: settings.deckName,
				modelName: settings.modelName,
				fields: wordEntry,
				options: {
					"allowDuplicate": false,
					"duplicateScope": "deck"
				},
				tags: []
			};
		});

		return words;
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
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
			.setName('Deck header')
			.addText(text => text
				.setValue(this.plugin.settings.deckPreffix)
				.onChange(async (value) => {
					this.plugin.settings.deckPreffix = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Words header')
			.addText(text => text
				.setValue(this.plugin.settings.wordsPreffix)
				.onChange(async (value) => {
					this.plugin.settings.wordsPreffix = value;
					await this.plugin.saveSettings();
				}));
	}
}
