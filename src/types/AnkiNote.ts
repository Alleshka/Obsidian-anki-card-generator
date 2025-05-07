export default interface AnkiNote {
    deckName: string;
    modelName: string;
    fields: Record<string, string>;
    options: any;
    tags: any[];
}