export interface ScoreInput {
  experienceYears?: number | string;
  hoursPerWeek?: number | string;
  city?: string;
}

export function calculateScore(input: ScoreInput): number {
  let score = 0;

  // 1. Experience points: 0 y = 0, 1–2 y = 20, 3+ y = 40
  const exp = Number(input.experienceYears) || 0;
  if (exp >= 3) {
    score += 40;
  } else if (exp >= 1) {
    score += 20;
  } else {
    score += 0;
  }

  // 2. Availability: counted in whole hours, rounded down
  // <10 h/week = 0, 10–19 = 20, 20+ = 30
  const hours = Math.floor(Number(input.hoursPerWeek) || 0);
  if (hours >= 20) {
    score += 30;
  } else if (hours >= 10) {
    score += 20;
  } else {
    score += 0;
  }

  // 3. City points: Lagos, Abuja, Accra, Kumasi = 30; other = 10
  const city = (input.city || '').trim().toLowerCase();
  const priorityCities = ['lagos', 'abuja', 'accra', 'kumasi'];
  if (priorityCities.includes(city)) {
    score += 30;
  } else {
    score += 10;
  }

  return score;
}

export function determineStatus(score: number): 'screening_invite' | 'needs_review' | 'not_now' {
  if (score > 70) {
    return 'screening_invite';
  } else if (score >= 50) {
    return 'needs_review';
  } else {
    return 'not_now';
  }
}
