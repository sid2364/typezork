/** Identifier of a room in a game definition. */
export type RoomId = string;

/** Identifier of a thing (item or creature) in a game definition. */
export type ThingId = string;

/** How a line of output should be presented. Front-ends map these to styles. */
export type OutputStyle =
  | 'title' // room names, banners
  | 'room' // room descriptions
  | 'info' // ordinary responses
  | 'error' // "you can't do that" style responses
  | 'question' // the game is waiting for an answer
  | 'win' // victory text
  | 'echo'; // the player's own command, echoed back

export interface OutputLine {
  readonly text: string;
  readonly style: OutputStyle;
}

export const line = (text: string, style: OutputStyle = 'info'): OutputLine => ({ text, style });

export const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
