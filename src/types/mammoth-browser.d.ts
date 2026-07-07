// Déclaration minimale pour le build navigateur de mammoth (pas de types fournis pour ce sous-chemin).
declare module "mammoth/mammoth.browser" {
  interface Resultat {
    value: string;
    messages: unknown[];
  }
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<Resultat>;
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Resultat>;
  const _default: {
    convertToHtml: typeof convertToHtml;
    extractRawText: typeof extractRawText;
  };
  export default _default;
}
