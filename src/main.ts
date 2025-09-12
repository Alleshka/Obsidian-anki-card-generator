import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import SampleModal from 'src/modals/sampleModal';
import { normalizeTextToSpeech, prepareFileName } from './utils';
import NoteInfo from 'src/types/NoteInfo';
import WordsSettings from './types/WordSettings';
import AnkiNote from './types/AnkiNote';
import GeneratedAudioInfo from './types/GeneratedAudioInfo';

const gTTS = require('gtts');
const path = require('path');

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

		new SampleModal(this.app, added, notAdded).open();
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
		let settings: WordsSettings = (0, eval)('(' + str + ')');
		return settings;
	}

	private parseFields(str: string, settings: WordsSettings): NoteInfo[] {
		const content: string[] = str.split("\n").filter(s => s.trim());
		if (content.length < 3) return [];

		const headers = content[0].split('|').map(h => h.trim()).filter(h => h);
		const rows = content.slice(2); // skip header and separator

		let handler : any = null;
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
				text = normalizeTextToSpeech(text);

				const fileName = prepareFileName(ankiNote, text, audioSettings);
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
