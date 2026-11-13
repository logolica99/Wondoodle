export type PipExchangeCaption = {
  role: "user" | "assistant";
  text: string;
  partial?: boolean;
};

const MIN_EXPLANATION_CHARS = 12;
const MIN_EXPLANATION_WORDS = 3;

/**
 * Journey completion for "Tell Pip your idea" requires a real exchange:
 * the student explains something and Pip responds. Mic-open alone is not enough.
 */
export function hasMeaningfulPipExchange(
  captions: PipExchangeCaption[]
): boolean {
  const finished = captions.filter((line) => !line.partial && line.text.trim());

  const studentExplanation = finished.find(
    (line) => line.role === "user" && isSubstantiveExplanation(line.text)
  );
  if (!studentExplanation) return false;

  const studentIndex = finished.indexOf(studentExplanation);
  return finished
    .slice(studentIndex + 1)
    .some((line) => line.role === "assistant" && line.text.trim().length >= 4);
}

function isSubstantiveExplanation(text: string): boolean {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length < MIN_EXPLANATION_CHARS) return false;
  const words = cleaned.split(" ").filter(Boolean);
  return words.length >= MIN_EXPLANATION_WORDS;
}
