import { beforeEach, describe, expect, it } from 'vitest';
import { effacerClesMolkky } from './persistence';

/**
 * « Effacer toutes les données » ne touche QUE Mölkky. Les applications de la
 * famille partagent l'origine `mister-guiiug.github.io`, donc le même
 * `localStorage` : ce que ce test pose « à côté » est ce qu'un
 * `localStorage.clear()` détruisait chez les autres.
 */
describe('effacer les données de Mölkky', () => {
  beforeEach(() => localStorage.clear());

  it('retire les clés mm_* et garde celles des autres applications', () => {
    localStorage.setItem('mm_players', '{"v":1,"data":[]}');
    localStorage.setItem('mm_match', '{"v":1,"data":null}');
    localStorage.setItem('mm_locale', 'fr');
    // Des clés réelles d'applications sœurs, et une session Supabase.
    localStorage.setItem('miss-contraction:journal', '[{"debut":1}]');
    localStorage.setItem('dwc_locale', 'fr');
    localStorage.setItem('sb-abcdefghijklmnopqrst-auth-token', '{}');

    effacerClesMolkky();

    expect(localStorage.getItem('mm_players')).toBeNull();
    expect(localStorage.getItem('mm_match')).toBeNull();
    expect(localStorage.getItem('mm_locale')).toBeNull();
    expect(localStorage.getItem('miss-contraction:journal')).toBe(
      '[{"debut":1}]'
    );
    expect(localStorage.getItem('dwc_locale')).toBe('fr');
    expect(localStorage.getItem('sb-abcdefghijklmnopqrst-auth-token')).toBe(
      '{}'
    );
  });
});
