import AnkiNote from "./types/AnkiNote";
import GenerateAuidoSettings from "./types/GenerateAuidoSettings";

export function normalizeTextToSpeech(text: string): string {
    text = text.replace(/\(.*?\)|\[.*?\]|\{.*?\}|\<.*?\>/gm, '');
    text = text.replace(/\*\*|__|==|\.\.\./g, '');
    return text.trim();
}

export function normalizeTextToSave(text: string): string {
    text = text.replace(/[?\\/:*<>|]/g, '');
    text = text.replace(/ /g, '_');
    return text;
}

export function prepareFileName(ankiNote: AnkiNote, text: string, audioSettings: GenerateAuidoSettings): string {
    let fileName: string = `${ankiNote.deckName}-${ankiNote.modelName}-${text.trim()}`;
    fileName = `__ag__${new Date().toISOString().substring(0, 10)}_${fileName}.mp3`;
    if (audioSettings.fileNameGenerator) {
        fileName = audioSettings.fileNameGenerator(ankiNote, fileName);
    }
    fileName = normalizeTextToSave(fileName);
    return fileName;
}