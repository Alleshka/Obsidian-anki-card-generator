import BlockSettings from "src/types/BlockSettings";
import Note from "src/types/Note";

const gTTS = require('gtts');
const path = require('path');

export interface GeneratedAudioInfo {
    fileName: string;
    textToSpeech: string;
    language: string;
}

export default class AudioGenerator {
    public generateAudioFile(audioInfo: GeneratedAudioInfo, ankiFileFolder: string): void {
        let text = audioInfo.textToSpeech;
        if (!text) {
            console.log("Text is empty");
            return;
        }

        var gtts = new gTTS(text, audioInfo.language);

        const filePath = path.join(ankiFileFolder, audioInfo.fileName);
        gtts.save(filePath, function (err: any, result: any) {
            if (err) { throw new Error(err) }
            console.log(`Success! Open file ${filePath} to hear result.`);
        });
    }

    public generateAudioInfo(settings: BlockSettings, wordEntry: Note): GeneratedAudioInfo | null {
        const audioSettings = settings.generateAudio;

        if (!audioSettings) {
            console.debug("Audio generation settings are not provided.");
            return null;
        }

        const defaultField = wordEntry[settings.key || "Key"]; // TODO: make confirmable
        console.debug("Generating audio for:", defaultField);

        if (!defaultField) {
           console.debug("The field for audio generation is empty.");
           return null;
        }

        const audioField = audioSettings.audioField || "Audio";
        let text: string = audioSettings.textToSpeechGetter
            ? audioSettings.textToSpeechGetter(wordEntry)
            : defaultField;
        text = this.normalizeTextToSpeech(text);

        const fileName = this.prepareFileName(settings, text);
        wordEntry[audioField] = `[sound:${fileName}]`;

        const audioInfo: GeneratedAudioInfo = {
            fileName: fileName,
            textToSpeech: text,
            language: audioSettings.language
        };

        return audioInfo;
    }

    private normalizeTextToSpeech(text: string): string {
        text = text.replace(/\(.*?\)|\[.*?\]|\{.*?\}|\<.*?\>/gm, '');
        text = text.replace(/\*\*|__|==|\.\.\./g, '');

        return text.trim();
    }

    private prepareFileName(settings: BlockSettings, text: string,): string {
        let fileName: string = `${settings.deckName}-${settings.modelName}-${text.trim()}`;
        fileName = `__ag__${new Date().toISOString().substring(0, 10)}_${fileName}.mp3`;

        const audioSettings = settings.generateAudio;
        if (audioSettings && audioSettings.fileNameGenerator) {
            fileName = audioSettings.fileNameGenerator(settings, fileName);
        }

        fileName = this.normalizeTextToSave(fileName);

        return fileName;
    }

    private normalizeTextToSave(text: string): string {
        text = text.replace(/[?\\/:*<>|]/g, '');
        text = text.replace(/ /g, '_');

        return text;
    }
}