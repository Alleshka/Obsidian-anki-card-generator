import GenerateAuidoSettings from "./GenerateAuidoSettings";

export default interface WordsSettings {
    deckName: string;
    modelName: string;
    generateAudio?: GenerateAuidoSettings;
    handler?: (result: Record<string, string>) => void;
}