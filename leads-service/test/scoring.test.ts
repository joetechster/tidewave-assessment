import { describe, it, expect } from 'vitest';
import { calculateScore, determineStatus } from '../src/scoring';

describe('Scoring Logic', () => {
  it('calculates score correctly for high experience rep in priority city', () => {
    // 3+ years (40) + 20+ hours (30) + Lagos (30) = 100
    const score = calculateScore({
      experienceYears: 4,
      hoursPerWeek: 25,
      city: 'Lagos',
    });
    expect(score).toBe(100);
  });

  it('calculates score correctly for entry level rep in non-priority city', () => {
    // 0 years (0) + 5 hours (0) + Ibadan (10) = 10
    const score = calculateScore({
      experienceYears: 0,
      hoursPerWeek: 5,
      city: 'Ibadan',
    });
    expect(score).toBe(10);
  });

  it('calculates score correctly for intermediate rep', () => {
    // 1-2 years (20) + 15 hours (20) + Benin City (10) = 50
    const score = calculateScore({
      experienceYears: 2,
      hoursPerWeek: 15,
      city: 'Benin City',
    });
    expect(score).toBe(50);
  });

  it('floors fractional hours before calculating availability points', () => {
    // 9.5 hours -> floored to 9 hours (<10 hours -> 0 points)
    // 0 years (0) + 9.5 floored to 9 (0) + Abuja (30) = 30
    const score = calculateScore({
      experienceYears: 0,
      hoursPerWeek: 9.5,
      city: 'Abuja',
    });
    expect(score).toBe(30);
  });

  it('assigns status for clear high score', () => {
    expect(determineStatus(85)).toBe('screening_invite');
  });

  it('assigns status for clear medium score', () => {
    expect(determineStatus(60)).toBe('needs_review');
  });

  it('assigns status for clear low score', () => {
    expect(determineStatus(40)).toBe('not_now');
  });
});
