# Obsidian anki card generator
This is a sample plugin for [Obsidian](https://obsidian.md). This plugin allows you to add cards to [obsidian](https://obsidian.md) [anki](https://ankiweb.net/).

## Instalation
- Install [anki](https://apps.ankiweb.net/)
- Install [AnkiConnect](https://ankiweb.net/shared/info/2055492159)
- Add "app://obsidian.md" to `webCorsOriginList` in [AnkiConnect](https://ankiweb.net/shared/info/2055492159) settings

## Usage
- Prepare the note
	- Set the header (Word by default)
	- Add settings (deckName, deckType, handler (optional))
	- Add words to the table. The table columns must be the same as the anki fields (or you can change the field names in the handler)
- Run `Anki card creator: Generete cards` when [anki](https://apps.ankiweb.net/) is running

### Example of page
#### Words
```js
{
	deckName: "DeckName",
	modelName: "DeckType",
	handler: (result) => {
		result.Example = result.Example.replace(result.Word, '*'.repeat(result.Word.length));
	}
}
```

| Word | Definition | Example |
| - | - | - |
| Word1 | Definition 1| Example with Word1 |
| Word2 | Definition 2| Example with Word2 |
| Word3 | Definition 3| Example with Word 3|
