// ponytail: fixed word list, catches replies made only of greetings/filler. "Hi I am Rahul" still passes; a false reject costs one retry.
const NOT_A_NAME =
  /^(?:(?:hi+|he+y+|hei+|hel+o+|hlo+|hai+|aloha|hola|namaste|namaskar|salaam|good|morning|afternoon|evening|ok+|okay|yes|no|sir|ma+m|madam|there|thanks|thank|you|please|pls|info|details|price|start|interested)(?: |$))+$/i;

/** Replies like "Hei" or "Good morning" pass the letters-only check, but they aren't names. */
export const isNotAName = (text: string) => NOT_A_NAME.test(text);
