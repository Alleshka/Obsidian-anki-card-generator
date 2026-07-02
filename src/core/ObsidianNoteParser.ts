
import BlockSettings from "../types/BlockSettings";
import Note from "../types/Note";

export interface BlockInfo {
    settings: BlockSettings;
    notes: Note[];
}

export default class ObsidianNoteParser {
    public parseObsidianNote(content: string): BlockInfo[] {
        const blocks: BlockInfo[] = [];
        const deckRegexp = /```js\s*(?<settings>[\s\S]*?)\s*```\s*[\s\S]*?(?<words>\|.*?)(?=\n\s*(?:#|$))/gs

        let block;
        while ((block = deckRegexp.exec(content)) != null) {
            if (block && block.groups) {
                const { settings, words } = block.groups;
                let parsedSettings = this.parseSettings(settings);
                const parsedCards = this.parseFields(parsedSettings, words);

                if (parsedCards.length > 0) {
                    blocks.push({ settings: parsedSettings, notes: parsedCards });
                }
            }
        }

        return blocks;
    }

    private parseSettings(str: string): BlockSettings {
        let settings: BlockSettings = (0, eval)('(' + str + ')');
        return settings;
    }

    private parseFields(settings: BlockSettings, str: string): Note[] {
        const content: string[] = str.split("\n").map(s => s.trim());
        if (content.length < 3) return [];

        const headers = content[0].split('|').map(h => h.trim());
        const rows = content.slice(2); // skip header and separator

        if (!settings.key) {
            settings.key = headers.find(h => h.trim())
        }

        const words: Note[] = [];

        rows.forEach(row => {
            const values = row.split('|').map(value => value.trim());
            if (values.filter(v => v).length === 0) return; // skip empty rows

            const note: Note = {};

            headers.forEach((header, index) => {
                if (header) {
                    note[header] = (values[index] || "").trim() || '';
                }
            });

            if (settings.handler) {
                settings.handler(note);
            }

            words.push(note);
        });

        return words;
    }
}