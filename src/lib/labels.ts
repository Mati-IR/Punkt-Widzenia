// Polish UI labels for dataset enum values (schema v0.2). Labels live in code, not in data.
import type {
  CLASSIC, POLISH, OWNERSHIP, SEGMENT, RELIABILITY, TYPE, CHAIN_LEVEL, FUNDING, REACH_METRIC, SOURCE_TYPE,
} from './dataset';

type Labels<T extends readonly string[]> = Record<T[number], string>;

export const classicLabel: Labels<typeof CLASSIC> = {
  left: 'Lewica',
  'center-left': 'Centrolewica',
  center: 'Centrum',
  'center-right': 'Centroprawica',
  right: 'Prawica',
};
export const polishLabel: Labels<typeof POLISH> = {
  'government-aligned': 'Prorządowe',
  'leans-government': 'Raczej prorządowe',
  'independent-mixed': 'Niezależne / mieszane',
  'leans-opposition': 'Raczej proopozycyjne',
  'opposition-aligned': 'Proopozycyjne',
};
export const ownershipLabel: Labels<typeof OWNERSHIP> = {
  'state-public': 'Państwowe / publiczne',
  'polish-private': 'Polski kapitał prywatny',
  foreign: 'Kapitał zagraniczny',
  'church-linked': 'Powiązane z Kościołem',
  'party-linked': 'Powiązane z partią',
  'reader-funded': 'Finansowane przez odbiorców',
};
export const segmentLabel: Labels<typeof SEGMENT> = {
  mainstream: 'Główny nurt',
  independent: 'Niezależne',
};
export const reliabilityLabel: Labels<typeof RELIABILITY> = {
  high: 'Wysoka',
  mixed: 'Mieszana',
  low: 'Niska',
};
export const typeLabel: Labels<typeof TYPE> = {
  tv: 'Telewizja',
  radio: 'Radio',
  daily: 'Dziennik',
  weekly: 'Tygodnik',
  monthly: 'Miesięcznik',
  portal: 'Portal',
  online: 'Serwis online',
  youtube: 'Kanał YouTube',
  podcast: 'Podcast',
};
export const chainLevelLabel: Labels<typeof CHAIN_LEVEL> = {
  brand: 'Marka',
  publisher: 'Wydawca',
  owner: 'Właściciel',
  'ultimate-owner': 'Ostateczny właściciel',
};
export const fundingLabel: Labels<typeof FUNDING> = {
  advertising: 'Reklamy',
  subscriptions: 'Prenumeraty / subskrypcje',
  'copy-sales': 'Sprzedaż egzemplarzy',
  donations: 'Darowizny',
  crowdfunding: 'Crowdfunding',
  'platform-revenue': 'Przychody z platform',
  'public-funding': 'Środki publiczne',
  grants: 'Granty',
};
export const reachLabel: Labels<typeof REACH_METRIC> = {
  'tv-share': 'Udział w oglądalności',
  'tv-avg-viewers': 'Średnia widownia',
  'radio-share': 'Udział w słuchalności',
  'real-users': 'Użytkownicy (real users)',
  'print-sales': 'Sprzedaż egzemplarzy',
  'youtube-subscribers': 'Subskrybenci YouTube',
  patrons: 'Patroni',
  'daily-listeners': 'Dzienni słuchacze',
};
export const sourceTypeLabel: Labels<typeof SOURCE_TYPE> = {
  research: 'badanie',
  regulator: 'regulator',
  factcheck: 'fact-checking',
  register: 'rejestr',
  court: 'sąd',
  outlet: 'redakcja',
  sample: 'próbka treści',
  press: 'prasa',
};
export const scoreLabel = ['0 — słabo', '1 — częściowo', '2 — dobrze'] as const;
