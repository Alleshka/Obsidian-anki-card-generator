import BlockSettings from "./BlockSettings";
import Note from "./Note";

export default interface GenerateAuidoSettings {
    language: string;
    audioField?: string;
    textToSpeechGetter?: (result: Note) => string;
    fileNameGenerator?: (settings: BlockSettings, defaultFileName: string) => string;
}