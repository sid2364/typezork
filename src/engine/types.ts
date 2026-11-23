/** Identifier of a room in a game definition. */
export type RoomId = string;

/** Identifier of a thing (item or creature) in a game definition. */
export type ThingId = string;

/** How a line of output should be presented. Front-ends map these to styles. */
export type OutputStyle =
  | 'title' // room names, banners
  | 'room' // room descriptions
  | 'info' // ordinary responses
  | 'error' // "you can't do that" style responses: the parser or the rules said no
  | 'blocked' // the world itself stands in the way: a guard, a creature, a riddle
  | 'summary' // a plain record line at the end of a game (what was kept, what was lost)
  | 'question' // the game is waiting for an answer
  | 'option' // a numbered answer the player can pick
  | 'hint' // what to try next, shown after everything else
  | 'win' // victory text
  | 'lose' // game over text
  | 'echo' // the player's own command, echoed back
  // Control markers (empty text):
  | 'pause' // front-ends may wait for the player (e.g. "press Enter") before showing the rest
  | 'clear'; // front-ends should clear the screen

export interface OutputLine {
  readonly text: string;
  readonly style: OutputStyle;
}

export const line = (text: string, style: OutputStyle = 'info'): OutputLine => ({ text, style });

export const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
