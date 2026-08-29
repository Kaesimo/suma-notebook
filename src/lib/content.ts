export type Segment = { kind: "text"; value: string } | { kind: "math"; value: string };

/** Split page content into text and `\[ … \]` math segments. */
export function parseContent(content: string): Segment[] {
  const segs: Segment[] = [];
  let text = "";
  const flush = () => {
    if (text.length > 0) {
      segs.push({ kind: "text", value: text });
      text = "";
    }
  };
  let i = 0;
  while (i < content.length) {
    if (content.startsWith("\\[", i) && (i === 0 || content[i - 1] === "\n")) {
      const end = content.indexOf("\\]", i + 2);
      if (end >= 0) {
        flush();
        segs.push({ kind: "math", value: content.slice(i + 2, end).trim() });
        i = end + 2;
        if (content[i] === "\n") i++;
        continue;
      }
    }
    if (content[i] === "\n") {
      segs.push({ kind: "text", value: text });
      text = "";
      i++;
      continue;
    }
    text += content[i];
    i++;
  }
  flush();
  return segs;
}
