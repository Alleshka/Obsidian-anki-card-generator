# Obsidian Anki Card Generator

A plugin for [Obsidian](https://obsidian.md) that lets you create [Anki](https://ankiweb.net/) cards directly from your notes using markdown tables.

## Requirements
- [Anki](https://apps.ankiweb.net/) desktop app
- [AnkiConnect](https://ankiweb.net/shared/info/2055492159) plugin for Anki

## Installation
1. Install Anki and AnkiConnect
2. Add `"app://obsidian.md"` to `webCorsOriginList` in AnkiConnect settings
3. Install this plugin in Obsidian

## Usage
Each note block consists of a **settings object** followed by a **markdown table**.

### Settings
Add a `js` code block with the following fields:

| Field           | Type                     | Required | Description                                                                                                                                                  |
| --------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `key`           | `string`                 | No       | The field used as a unique identifier for the note. Defaults to the first non-empty column header. Also determines which field is used for audio generation. |
| `deckName`      | `string`                 | Yes      | The Anki deck to add cards to (e.g. `"Japanese::Vocabulary"`). Created automatically if it doesn't exist. Nested decks are supported via `::`.               |
| `modelName`     | `string`                 | Yes      | The Anki note type to use (e.g. `"Basic"`). Must already exist in Anki. Defines which fields and card templates are available.                               |
| `generateAudio` | `GenerateAudioSettings`  | No       | Configuration for automatic audio generation for the `key` field.                                                                                            |
| `handler`       | `(result: Note) => void` | No       | Callback invoked after each note is processed. Useful for transforming field values before the card is created.                                              |

#### generateAudioSettings
When provided, automatically generates an audio file for each card and saves it to Anki's media collection.

| Field                | Type                                                           | Required | Description                                                                                                                    |
| -------------------- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `language`           | `string`                                                       | Yes      | Language code used for text-to-speech (e.g. `"en-US"`, `"ja-JP"`).                                                             |
| `audioField`         | `string`                                                       | No       | The note field where the audio reference will be inserted (e.g. `[sound:filename.mp3]`). Defaults to `Audio`                                        |
| `textToSpeechGetter` | `(result: Note) => string`                                     | No       | Custom function to extract the text that will be converted to speech. Defaults to the value of the `key` field.                |
| `fileNameGenerator`  | `(settings: BlockSettings, defaultFileName: string) => string` | No       | Custom function to override the generated audio file name. Receives the block settings and the default file name as arguments. |

### Running
Open the note in Obsidian and run the command **`Anki card creator: Generate cards`** while Anki is open.
## Example

````js
{ 
	deckName: "DE::AllWords",
	modelName: "BasicAndReversedWithAudio",
	handler: (result) => {
        result.Example = result.Example.replace(result.Word, '*'.repeat(result.Word.length));
    },
	generateAudio: {
		language: "de",
		audioField: "Audio"
	}
}
````

| DE                    | EN                                | Example                                                                                                                  |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ausgeben              | to spend; to give out             | Ich gebe viel Geld aus; Sie gibt eine Menge Geld für Bücher aus;                                                         |
| ausschalten           | to switch off; disable            | Bitte schalte das Licht aus; Er schaltete den Fernseher aus; Der Computer ist ausgeschaltet;                             |
| berücksichtigen       | to consider; to take into account | Er berücksichtigte meinen Wunsch; Man muss viele Faktoren berücksichtigen;                                               |
| bürsten               | brush                             | Er bürstete seinen Hut;                                                                                                  |
| das Futter (-s)       | feed; fodder                      | Was für Futter gibst du deinem Hund?; Jedes Tier braucht Futter, Wasser und ein Tierheim; Die Hühner suchten nach Futter |
| das Gehege (-s)       | enclosure;                        | In meinem Gehege halte ich Tiger;                                                                                        |
| das Kaninchen (-s)    | rabbit                            | Können Kaninchen schwimmen?; Kaninchen essen gern Möhren; Dem Kaninchen gefallen die Karotten;                           |
| das Meerschwein (-es) | guinea pig                        | Hast du dein Meerschwein schon gefüttert?;                                                                               |
