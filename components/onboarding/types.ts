import type { Profile } from '@/lib/types';

export interface OnboardingData {
  socialisingId: string;
  networkingId: string;
  datingId: string;
  city: string;
  nationality: string;
  profession: string;
  affiliation: string;
  industry: string;
  role: string;
  favouriteDrink: string;
  fridayNight: string;
  relationship: string;
  cityVisible: boolean;
  professionVisible: boolean;
  favouriteDrinkVisible: boolean;
  fridayNightVisible: boolean;
}

export const EMPTY_DATA: OnboardingData = {
  socialisingId: '0',
  networkingId: '0',
  datingId: '0',
  city: '',
  nationality: '',
  profession: '',
  affiliation: '',
  industry: '',
  role: '',
  favouriteDrink: '',
  fridayNight: '',
  relationship: '',
  cityVisible: true,
  professionVisible: true,
  favouriteDrinkVisible: true,
  fridayNightVisible: true,
};

export const STEP_TITLES = [
  'Looking for',
  'Where you are',
  'What you do',
  'The fun stuff',
  'Who sees it',
];

const idToStr = (n: number | null | undefined): string =>
  n === null || n === undefined ? '0' : String(n);

const strOr = (s: string | null | undefined): string => s ?? '';

const boolOr = (b: boolean | null | undefined): boolean => b ?? true;

export function profileToData(p: Partial<Profile> | null): OnboardingData {
  if (!p) return { ...EMPTY_DATA };
  return {
    socialisingId: idToStr(p.socialising_id),
    networkingId: idToStr(p.networking_id),
    datingId: idToStr(p.dating_id),
    city: strOr(p.city),
    nationality: strOr(p.nationality),
    profession: strOr(p.profession),
    affiliation: strOr(p.affiliation),
    industry: strOr(p.industry),
    role: strOr(p.role),
    favouriteDrink: strOr(p.fave_drink),
    fridayNight: strOr(p.friday_night),
    relationship: strOr(p.relationship),
    cityVisible: boolOr(p.city_visible),
    professionVisible: boolOr(p.profession_visible),
    favouriteDrinkVisible: boolOr(p.fave_drink_visible),
    fridayNightVisible: boolOr(p.friday_night_visible),
  };
}

const trimOrNull = (s: string): string | null => {
  const t = s.trim();
  return t === '' ? null : t;
};

const idOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isNaN(n) || n === 0 ? null : n;
};

export function dataToProfilePatch(
  id: string,
  d: OnboardingData,
): Partial<Profile> & { id: string } {
  return {
    id,
    socialising_id: idOrNull(d.socialisingId),
    networking_id: idOrNull(d.networkingId),
    dating_id: idOrNull(d.datingId),
    city: trimOrNull(d.city),
    nationality: trimOrNull(d.nationality),
    profession: trimOrNull(d.profession),
    affiliation: trimOrNull(d.affiliation),
    industry: trimOrNull(d.industry),
    role: trimOrNull(d.role),
    fave_drink: trimOrNull(d.favouriteDrink),
    friday_night: trimOrNull(d.fridayNight),
    relationship: trimOrNull(d.relationship),
    city_visible: d.cityVisible,
    profession_visible: d.professionVisible,
    fave_drink_visible: d.favouriteDrinkVisible,
    friday_night_visible: d.fridayNightVisible,
  };
}
