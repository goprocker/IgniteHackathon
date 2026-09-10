/** Any codepoint in the Tamil block means the whole message needs Tamil metrics. */
const TAMIL_PATTERN = /[\u0B80-\u0BFF]/;

interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps) {
  const hasTamil = TAMIL_PATTERN.test(text);

  return (
    <div className="flex justify-end">
      <p
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-[8px] border border-line",
          "bg-surface-sunken px-4 py-2.5 text-[15px] text-ink",
          hasTamil ? "tamil" : "",
        ].join(" ")}
      >
        {text}
      </p>
    </div>
  );
}
