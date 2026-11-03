-- Seed data for Tidewave Street Team leads

INSERT INTO leads.leads (
  id, first_name, last_name, email, phone, city, experience_years, hours_per_week, source, consent, consent_withdrawn, score, status, duplicate_of, created_at
) VALUES
(
  'lead_seed_01', 'Kemi', 'Adeyemi', 'Kemi.Adeyemi@Mail.test ', '+2348021110001', 'Lagos', 3, 25, 'web', true, false, 100, 'screening_invite', NULL, NOW() - INTERVAL '14 days'
),
(
  'lead_seed_02', 'Kemi', 'Adeyemi', 'kemi.adeyemi@mail.test', '+2348021110001', 'Lagos', 3, 20, 'web', true, false, 100, 'screening_invite', NULL, NOW() - INTERVAL '13 days'
),
(
  'lead_seed_03', 'Femi', 'Okafor', 'femi.okafor@mail.test', '+2348031234567', 'Abuja', 3, 15, 'social', true, false, 90, 'screening_invite', NULL, NOW() - INTERVAL '12 days'
),
(
  'lead_seed_04', 'Femi', 'Okafor', 'femi.personal@mail.test', '08031234567', 'Abuja', 1, 15, 'referral', true, false, 70, 'needs_review', NULL, NOW() - INTERVAL '11 days'
),
(
  'lead_seed_05', 'Chinwe', 'Bello', 'chinwe.bello@mail.test', '+2348052220005', 'Accra', 2, 10, 'web', true, false, 70, 'needs_review', NULL, NOW() - INTERVAL '10 days'
),
(
  'lead_seed_06', 'Sola', 'Davies', 'sola.davies@mail.test', '+2348073330006', 'Kumasi', 0, 15, 'campus', false, true, 50, 'needs_review', NULL, NOW() - INTERVAL '10 days'
),
(
  'lead_seed_07', 'Sola', 'Davies', 'sola.davies@mail.test', '+2348073330006', 'Kumasi', 1, 22.5, 'campus', true, false, 80, 'screening_invite', NULL, NOW() - INTERVAL '3 days'
),
(
  'lead_seed_08', 'Ama', 'Mensah', 'ama.mensah@mail.test', '+233241000008', 'Accra', 4, 24, 'flyer', true, false, 100, 'screening_invite', NULL, NOW() - INTERVAL '9 days'
),
(
  'lead_seed_09', 'Yaw', 'Asante', 'yaw.asante@mail.test', '+233242000009', 'Kumasi', 1, 8, 'event', true, false, 50, 'needs_review', NULL, NOW() - INTERVAL '8 days'
),
(
  'lead_seed_10', 'Folake', 'Coker', 'folake.coker@mail.test', '+2348094440010', 'Ibadan', 0, 5, 'web', true, false, 10, 'not_now', NULL, NOW() - INTERVAL '7 days'
),
(
  'lead_seed_11', 'Dapo', 'Balogun', 'dapo.balogun@mail.test', '+2348065550011', 'Benin City', 1, 12, 'referral', true, false, 50, 'needs_review', NULL, NOW() - INTERVAL '6 days'
),
(
  'lead_seed_12', 'Babatunde', 'Lawal', 'babatunde.lawal@mail.test', '+2348036660012', 'Lagos', 0, 8, 'campus', true, false, 30, 'not_now', NULL, NOW() - INTERVAL '5 days'
),
(
  'lead_seed_13', 'Tayo', 'Adeleke', 'tayo.adeleke@mail.test', '+2348027770013', 'Lagos', 3, 15, 'web', true, false, 90, 'screening_invite', NULL, NOW() - INTERVAL '4 days'
),
(
  'lead_seed_14', 'Tayo', 'Adeleke', 'tayo.adeleke@mail.test', '+2348027770013', 'Lagos', 3, 15, 'web', true, false, 90, 'duplicate', 'lead_seed_13', NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- Seed activity rows
INSERT INTO leads.lead_activity (id, lead_id, type, detail, actor, created_at)
SELECT
  'act_' || id,
  id,
  'application_created',
  jsonb_build_object('source', source, 'score', score, 'status', status),
  'system',
  created_at
FROM leads.leads
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads.lead_activity (id, lead_id, type, detail, actor, created_at)
VALUES
('act_dup_14', 'lead_seed_14', 'duplicate_detected', '{"duplicateOf":"lead_seed_13"}'::jsonb, 'system', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
