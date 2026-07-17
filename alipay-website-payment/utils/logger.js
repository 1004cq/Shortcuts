/**
 * 简单结构化日志（支付链路排障用）
 */
function ts() {
  return new Date().toISOString();
}

function log(level, tag, message, extra) {
  const line = {
    t: ts(),
    level,
    tag,
    message,
    ...(extra && typeof extra === "object" ? { extra } : extra != null ? { extra } : {}),
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

module.exports = {
  info: (tag, message, extra) => log("info", tag, message, extra),
  warn: (tag, message, extra) => log("warn", tag, message, extra),
  error: (tag, message, extra) => log("error", tag, message, extra),
};
