import { stemmer } from 'stemmer';

export function stem(word: string): string {
  return stemmer(word);
}
