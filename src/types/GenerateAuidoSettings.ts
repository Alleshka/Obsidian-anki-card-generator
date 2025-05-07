import AnkiNote from "./AnkiNote";

export default interface GenerateAuidoSettings {
    language: string;
    audioField?: string;
    textToSpeechGetter?: (result: Record<string, string>) => string;
    fileNameGenerator?: (note: AnkiNote, defaultFileName: string) => string;
}