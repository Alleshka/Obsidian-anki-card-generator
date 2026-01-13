import GenerateAuidoSettings from "./GenerateAuidoSettings";
import Note from "./Note";

export default interface BlockSettings {
    key?: string;
    deckName: string;
    modelName: string;
    generateAudio?: GenerateAuidoSettings;
    handler?: (result: Note) => void;
}