import BlockSettings from "src/types/BlockSettings";
import Note from "src/types/Note";
import { GeneratedAudioInfo } from "./AudioGenerator";

export interface AnkiNote {
	deckName: string;
	modelName: string;
	fields: Note;
	options: any;
	tags: any[];
}

export interface PendingNote {
	settings: BlockSettings;
	ankiNote: AnkiNote;
	audioInfo?: GeneratedAudioInfo | null;
}

export default class AnkiSaver {

	private notesToSave: PendingNote[] = [];

	constructor() {

	}

	public appendNotes(settings: BlockSettings, notes: Note[]) {
		notes.forEach(n => {
			const ankiNote: AnkiNote = {
				deckName: settings.deckName,
				modelName: settings.modelName,
				fields: n,
				options: {
					allowDuplicate: false,
					duplicateScope: "deck"
				},
				tags: []
			};

			const pendingNote = {
				settings: settings,
				ankiNote: ankiNote,
			};

			this.notesToSave.push(pendingNote);
		})
	}

	public async canSaveNotes(): Promise<[PendingNote[], PendingNote[]]> {
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
					notes: this.notesToSave.map(n => n.ankiNote)
				}
			})
		});

		const canAddResult = await canAdd.json();

		const notAdded: PendingNote[] = [];
		const added: PendingNote[] = [];

		canAddResult.result.forEach((item: any, index: number) => {
			if (item) {
				added.push(this.notesToSave[index]);
			}
			else {
				notAdded.push(this.notesToSave[index]);
			}
		});

		return [added, notAdded];
	}

	public async saveNotesToAnki(added: PendingNote[]): Promise<boolean> {
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
			console.debug(result);
			this.clear();
			return !result.error;
		}

		return false;
	}

	public clear() {
		this.notesToSave = [];
	}
}