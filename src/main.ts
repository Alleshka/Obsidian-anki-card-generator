import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import SampleModal from 'src/modals/sampleModal';
import ObsidianNoteParser, { BlockInfo } from './core/ObsidianNoteParser';
import AudioGenerator from './core/AudioGenerator';
import AnkiSaver from './core/AnkiSaver';

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
	private audioGenerator: AudioGenerator = new AudioGenerator();
	private obsidianNoteParser: ObsidianNoteParser = new ObsidianNoteParser();
	private ankiSaver: AnkiSaver = new AnkiSaver();

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
		let isSuccess = false;

		const content = editor.getValue();
		const blocks: BlockInfo[] = this.obsidianNoteParser.parseObsidianNote(content);

		blocks.forEach(block => {
			this.ankiSaver.appendNotes(block.settings, block.notes);
		});

		const [added, notAdded] = await this.ankiSaver.canSaveNotes();

		if (added.length > 0) {
			added.forEach(note => {
				note.audioInfo = this.audioGenerator.generateAudioInfo(note.settings, note.ankiNote.fields);
			})
			const saveResult = await this.ankiSaver.saveNotesToAnki(added);
			isSuccess = saveResult;
		}
		else {
			isSuccess = false;
		}

		if (isSuccess) {
			for (const note of added) {
				if (note.audioInfo) {
					this.audioGenerator.generateAudioFile(note.audioInfo, this.settings.ankiFileFolder);
				}
			}
		}

		this.ankiSaver.clear();

		new SampleModal(this.app, isSuccess, added.map(note => note.ankiNote.fields), notAdded.map(note => note.ankiNote.fields)).open();
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
