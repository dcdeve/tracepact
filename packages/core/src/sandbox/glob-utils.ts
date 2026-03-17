/**
 * Converts a glob pattern to a RegExp that matches file paths.
 *
 * Supported syntax:
 * - "**" matches any number of path segments (including zero)
 * - "**\/" matches zero or more leading path segments
 * - "*" matches any sequence of characters within a single path segment
 *
 * All other regex-special characters in the pattern are escaped.
 */
export function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\0GLOBSTAR\0')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\0GLOBSTAR\0/g, '(?:.*/)?');
  // eslint-disable-next-line prefer-template
  return new RegExp(['^', escaped, '$'].join(''));
}

/** Returns true when path is permitted by at least one pattern in allowList. */
export function isAllowedPath(path: string, allowList: string[] | undefined): boolean {
  if (!allowList || allowList.length === 0) return true;
  return allowList.some((pattern) => globToRegex(pattern).test(path));
}

/** Returns true when command is permitted by at least one entry in allowList. */
export function isAllowedCommand(
  command: string,
  allowList: (string | RegExp)[] | undefined
): boolean {
  if (!allowList || allowList.length === 0) return true;
  return allowList.some((matcher) => {
    if (typeof matcher === 'string') return command === matcher;
    return matcher.test(command);
  });
}
