export interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

export interface RedactionConfig {
  rules?: RedactionRule[];
  redactEnvValues?: string[];
}
