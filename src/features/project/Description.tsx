/**
 * Project descriptions arrive as plain text with \r\n line breaks: blank lines separate
 * paragraphs, single breaks are kept (credits are one per line). In a paragraph that reads
 * as a credit list (two or more "Role: name" lines) the roles are set quieter.
 */
const LABEL_RE = /^(?!https?:)([^:：\n]{1,40})[:：]\s*(.*)$/;
const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Bare URLs become links (descriptions point at playlists and festival pages). */
function linkify(text: string) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} className="pj-url" href={part} target="_blank" rel="noopener noreferrer">
        {part.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
    ) : (
      part
    ),
  );
}

export function Description({ text }: { text: string }) {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((p) =>
      p
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);

  if (!paragraphs.length) return null;

  return (
    <div className="pj-desc">
      {paragraphs.map((lines, i) => {
        const credits = lines.filter((l) => LABEL_RE.test(l)).length >= 2;
        return (
          <p key={i} className="pj-p" data-credits={credits ? "true" : "false"}>
            {lines.map((line, j) => {
              const m = credits ? line.match(LABEL_RE) : null;
              return (
                <span key={j} className="pj-line">
                  {m ? (
                    <>
                      <span className="pj-role">{m[1].trim()}:</span>
                      {m[2] ? <> {linkify(m[2])}</> : null}
                    </>
                  ) : (
                    linkify(line)
                  )}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
