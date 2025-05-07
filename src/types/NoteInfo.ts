import AnkiNote from "./AnkiNote";
import GeneratedAudioInfo from "./GeneratedAudioInfo";

export default interface NoteInfo {
    ankiNote: AnkiNote;
    audioInfo?: GeneratedAudioInfo;
}