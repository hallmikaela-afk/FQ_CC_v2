-- ============================================
-- Fox & Quinn — Real Data Seed
-- Run AFTER 001_initial_schema.sql
-- ============================================

-- First, clear the default template_tasks from schema migration
DELETE FROM template_tasks;

-- ============================================
-- TEAM MEMBERS
-- ============================================
INSERT INTO team_members (id, name, initials, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mikaela Hall', 'MH', 'Owner & Creative Director'),
  ('00000000-0000-0000-0000-000000000002', 'Liliana VanMiddlesworth', 'LV', 'Marketing Assistant'),
  ('00000000-0000-0000-0000-000000000003', 'Tim Bell', 'TB', 'Planning Assistant');

-- ============================================
-- PROJECTS
-- ============================================
INSERT INTO projects (id, slug, type, name, status, event_date, contract_signed_date, color, service_tier, client1_name, client2_name, venue_name, venue_location, venue_street, venue_city_state_zip, client_street, client_city_state_zip, guest_count, estimated_budget, concept, canva_link, internal_file_share, client_shared_folder, client_portal_link, client_website, sharepoint_folder, project_colors) VALUES
  ('10000000-0000-0000-0000-000000000001', 'julia-frank', 'client', 'Julia & Frank', 'active', '2026-06-07', '2024-10-14', '#8B6F4E', 'Harmony Planning', 'Julia', 'Frank', 'Wave Resort', 'Long Branch, NJ', '101 Chelsea Ave', 'Long Branch, NJ 07740', '245 Park Ave, Apt 12B', 'New York, NY 10167', 130, '$100K', NULL, 'https://canva.com/...', 'https://sharepoint.com/...', 'https://drive.google.com/...', 'https://portal.example.com/...', 'https://...', 'https://sharepoint.com/...', '["#C4A97D","#5B7A5E","#A0522D","#8B8FAE","#C4A040","#B8A060","#C49870","#6B5B4E","#7B8B5E","#4A5B8B","#5B4B3E","#C4A040","#B87040","#D4A0B0"]'),
  ('10000000-0000-0000-0000-000000000002', 'tippi-justin', 'client', 'Tippi & Justin', 'active', '2026-09-19', '2025-10-28', '#6B7F5E', 'Harmony Planning', 'Tippi', 'Justin', 'Vanderbilt Museum', 'Centerport, NY', NULL, NULL, NULL, NULL, 175, '$170K', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000003', 'elisabeth-jj', 'client', 'Elisabeth & JJ', 'active', '2026-10-10', '2025-11-07', '#A0522D', 'Harmony Planning', 'Elisabeth', 'JJ', 'LionRock Farm', 'Sharon, CT', NULL, NULL, NULL, NULL, 160, '$200K', 'Rooted in Rhythm', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000004', 'cathy-omar', 'proposal', 'Cathy Wu & Omar Hyder', 'proposal_sent', '2026-08-01', NULL, '#9B8E82', NULL, 'Cathy', 'Omar', 'MIT Chapel & Samberg Center', 'Cambridge, MA', NULL, NULL, NULL, NULL, NULL, NULL, 'Wu-Hyder Symposium', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000005', 'sun-steeped', 'shoot', 'Sun-Steeped', 'active', '2026-04-20', NULL, '#D4A574', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Golden, mimosa-toned, graphic black accents', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000006', 'menorca', 'shoot', 'Menorca', 'active', '2026-05-18', NULL, '#C4956A', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Vestige Son Vell + Lithica Quarry, Menorca Spain', NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Set shoot-specific fields
UPDATE projects SET location = 'EHP Hamptons or Wildflower Farms TBD', design_board_link = 'https://canva.com/design/sun-steeped' WHERE id = '10000000-0000-0000-0000-000000000005';
UPDATE projects SET location = 'Menorca, Spain', photographer = 'EFEGE', florist = 'Cassandra at Enrich Events', design_board_link = 'https://canva.com/design/menorca-shoot' WHERE id = '10000000-0000-0000-0000-000000000006';

-- ============================================
-- PROJECT ASSIGNMENTS
-- ============================================
INSERT INTO project_assignments (project_id, team_member_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'), -- Julia & Frank → Mikaela
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'), -- Julia & Frank → Liliana
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'), -- Tippi & Justin → Liliana
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002'), -- Elisabeth & JJ → Liliana
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001'), -- Sun-Steeped → Mikaela
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001'), -- Menorca → Mikaela
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002'), -- Menorca → Liliana
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003'); -- Menorca → Tim

-- ============================================
-- VENDORS (Julia & Frank)
-- ============================================
INSERT INTO vendors (project_id, category, vendor_name, contact_name, email, phone, website, instagram) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Hair & Makeup', 'Artsi Artistry', NULL, 'artsiartistry@gmail.com', '(856) 885-0001', NULL, '@artsiartistry'),
  ('10000000-0000-0000-0000-000000000001', 'Hair & Makeup', 'Gloss Studio', NULL, NULL, NULL, NULL, '@glossstudio'),
  ('10000000-0000-0000-0000-000000000001', 'Band/DJ', 'SCE Event Group', 'Jason Jani', 'jason@sceeventgroup.com', '(888) 278-0900', 'https://sceeventgroup.com/', '@sceeventgroup'),
  ('10000000-0000-0000-0000-000000000001', 'Band/DJ', 'Arnie Abrams Pianist', 'Arnie Abrams', 'arnie@arnieabramspianist.com', '(732) 995-1082', 'http://www.ArnieAbramsPianist.com', NULL),
  ('10000000-0000-0000-0000-000000000001', 'Band/DJ', 'Piano Piano', 'Amy Wolk', 'amy@pianopianostudios.com', '(212) 586-9056', NULL, NULL),
  ('10000000-0000-0000-0000-000000000001', 'Florist', 'Lilysh Floral', 'Liliya Pincosy', 'contact@lilyshdesign.com', '(347) 339-2627', 'https://www.lilysh.com/', '@lilyshfloral'),
  ('10000000-0000-0000-0000-000000000001', 'Rentals', 'United Rent All', 'Kristen A. Redmond', 'kristen@unitedrentall.com', '(908) 359-3663', NULL, NULL),
  ('10000000-0000-0000-0000-000000000001', 'Photographer', 'Tay Tesvich Photography', 'Tay Tesvich', 'taylortesvichphotography@gmail.com', '(251) 554-5227', 'https://www.taytesvichphoto.com/', '@taytesvich'),
  ('10000000-0000-0000-0000-000000000001', 'Stationery', 'Merci Studio', 'Meredith Masingill Cochran', 'mercistudio.design@gmail.com', '(205) 438-5177', NULL, '@mercistudiodesign'),
  ('10000000-0000-0000-0000-000000000001', 'Caterer', 'Wave Resort - Catering', 'Allison Mercer', 'amercer@waveresort.com', '(732) 795-6659', 'https://www.waveresort.com/', '@waveresort');

-- VENDORS (Menorca)
INSERT INTO vendors (project_id, category, vendor_name, contact_name, email, website, instagram) VALUES
  ('10000000-0000-0000-0000-000000000006', 'Photographer', 'EFEGE', 'EFEGE Photo', NULL, NULL, '@efegephoto'),
  ('10000000-0000-0000-0000-000000000006', 'Florist', 'Enrich Events', 'Cassandra', 'cassandra@enrichevents.com', NULL, '@enrichevents'),
  ('10000000-0000-0000-0000-000000000006', 'Venue', 'Vestige Son Vell', NULL, NULL, 'https://vestigesonvell.com', NULL);

-- VENDORS (Sun-Steeped — placeholders)
INSERT INTO vendors (project_id, category, vendor_name) VALUES
  ('10000000-0000-0000-0000-000000000005', 'Photographer', 'TBD'),
  ('10000000-0000-0000-0000-000000000005', 'Florist', 'TBD');


-- ============================================
-- JULIA & FRANK — TASKS (30 tasks)
-- Notes field stores the Function/Person assignment
-- ============================================
INSERT INTO tasks (project_id, text, completed, status, due_date, category, priority, notes, sort_order) VALUES
  -- In Progress tasks
  ('10000000-0000-0000-0000-000000000001', 'Choose lighting and/or draping', false, 'in_progress', '2025-09-19', 'Vendor Sourcing', 'medium', 'Function: Designer', 1),
  ('10000000-0000-0000-0000-000000000001', 'Have all non-design vendors booked', false, 'in_progress', '2025-12-09', 'Design & Styling', 'medium', 'Function: Planner', 2),
  ('10000000-0000-0000-0000-000000000001', 'Have all design vendors booked', false, NULL, '2025-12-09', 'Design & Styling', 'medium', 'Function: Designer', 3),
  -- Ongoing tasks
  ('10000000-0000-0000-0000-000000000001', 'Make/revise internal inventory list of things needed to bring/order', false, NULL, '2026-01-08', 'Design & Styling', NULL, 'Function: Designer', 4),
  ('10000000-0000-0000-0000-000000000001', 'Finalize Invitation designs/wording', false, NULL, '2026-03-29', 'Design & Styling', NULL, 'Function: Planner, Designer', 5),
  ('10000000-0000-0000-0000-000000000001', 'Finalize first draft of vendor timelines', false, NULL, '2026-03-29', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 6),
  ('10000000-0000-0000-0000-000000000001', 'Ensure all first draft vendor questions are edited and ready to send at 8 weeks', false, NULL, '2026-04-05', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 7),
  ('10000000-0000-0000-0000-000000000001', 'Ensure invitations are sent out', false, NULL, '2026-04-12', 'Design & Styling', NULL, 'Function: Designer', 8),
  ('10000000-0000-0000-0000-000000000001', 'Ensure first draft timelines and vendor questions are sent to all vendors', false, NULL, '2026-04-12', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 9),
  ('10000000-0000-0000-0000-000000000001', 'Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, payment reminders, etc.', false, NULL, '2026-04-19', 'Check in - Client', NULL, 'Function: Planner, Coordinator', 10),
  ('10000000-0000-0000-0000-000000000001', 'Finalize floor plans', false, NULL, '2026-04-19', 'Design & Styling', NULL, 'Function: Designer', 11),
  ('10000000-0000-0000-0000-000000000001', 'Remind client to start collecting rsvps and start working on seating chart in Aisle Planner', false, NULL, '2026-04-19', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 12),
  ('10000000-0000-0000-0000-000000000001', 'Place any remaining orders for day-of items (guest book, pens, card boxes, reserve signs, easels, candles, etc.)', false, NULL, '2026-04-19', 'Design & Styling', NULL, 'Function: Designer', 13),
  ('10000000-0000-0000-0000-000000000001', 'Send processional questionnaire and final details questionnaire to client', false, NULL, '2026-05-03', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 14),
  ('10000000-0000-0000-0000-000000000001', 'Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, Payment reminders, etc.', false, NULL, '2026-05-07', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 15),
  ('10000000-0000-0000-0000-000000000001', 'Confirm that seating chart is done and ready to be sent to print', false, NULL, '2026-05-10', 'Planning Milestones', NULL, 'Function: Planner', 16),
  ('10000000-0000-0000-0000-000000000001', 'Ensure all second draft vendor questions are edited and ready to send at 4 weeks', false, NULL, '2026-05-10', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 17),
  ('10000000-0000-0000-0000-000000000001', 'Ensure second draft timelines and vendor questions are sent to all vendors', false, NULL, '2026-05-10', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 18),
  ('10000000-0000-0000-0000-000000000001', 'Finalize all day of paper goods and signage designs with vendor', false, NULL, '2026-05-10', 'Planning Milestones', NULL, 'Function: Designer', 19),
  ('10000000-0000-0000-0000-000000000001', 'Execute phone calls with all vendors to go over any last questions and timeline revisions', false, NULL, '2026-05-17', 'Final Details', NULL, 'Function: Planner, Coordinator', 20),
  ('10000000-0000-0000-0000-000000000001', 'Confirm everything is ordered/built according to design/design invoice', false, NULL, '2026-05-17', 'Final Details', NULL, 'Function: Designer', 21),
  ('10000000-0000-0000-0000-000000000001', 'Double check all rental orders and cross check with guest count', false, NULL, '2026-05-17', 'Final Details', NULL, 'Function: Designer', 22),
  ('10000000-0000-0000-0000-000000000001', 'Schedule final details call with client for 7 days out', false, NULL, '2026-05-24', 'Final Details', NULL, 'Function: Planner, Coordinator', 23),
  ('10000000-0000-0000-0000-000000000001', 'Planner and Designer have meeting - confirm all deliveries, rentals orders, signage and seating chart', false, NULL, '2026-05-24', 'Final Details', NULL, 'Function: Planner, Designer', 24),
  ('10000000-0000-0000-0000-000000000001', 'Send caterers final head counts and dietary restrictions and vendor meal counts and dietary restrictions', false, NULL, '2026-05-24', 'Final Details', NULL, 'Function: Planner, Coordinator', 25),
  ('10000000-0000-0000-0000-000000000001', 'Have final details call with client to review timeline, final details questionnaire, processional questionnaire, final payments, etc.', false, NULL, '2026-05-31', 'Final Details', NULL, 'Function: Planner, Coordinator', 26),
  ('10000000-0000-0000-0000-000000000001', 'Prepare all materials and send final timeline/layout to vendors', false, NULL, '2026-06-02', 'Day-of Prep', NULL, 'Function: Planner, Coordinator', 27),
  ('10000000-0000-0000-0000-000000000001', 'Team call to run through all details of the day', false, NULL, '2026-06-03', 'Day-of Prep', NULL, 'Function: Planner, Designer, Coordinator', 28),
  ('10000000-0000-0000-0000-000000000001', 'Print all needed materials for the day of, bag styling and coordinating kits, pack any needed extra items', false, NULL, '2026-06-05', 'Day-of Prep', NULL, 'Function: Planner, Designer', 29),
  ('10000000-0000-0000-0000-000000000001', 'Send review email', false, NULL, '2026-06-08', 'Day-of Prep', NULL, 'Function: Admin, Planner', 30);

-- Julia & Frank subtasks
-- "Have all design vendors booked" → Book Ice Sculptor
INSERT INTO subtasks (task_id, text, completed, sort_order)
SELECT id, 'Book Ice Sculptor', false, 1
FROM tasks WHERE project_id = '10000000-0000-0000-0000-000000000001' AND text = 'Have all design vendors booked';

-- "Make/revise internal inventory list" → Add table to rental order
INSERT INTO subtasks (task_id, text, completed, sort_order)
SELECT id, 'Add table to rental order (6'' or 8'')', false, 1
FROM tasks WHERE project_id = '10000000-0000-0000-0000-000000000001' AND text LIKE 'Make/revise internal inventory%';


-- ============================================
-- TIPPI & JUSTIN — TASKS (46 tasks)
-- ============================================
INSERT INTO tasks (project_id, text, completed, status, due_date, category, priority, notes, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000002', 'Confirm Final Guest Count with Caterer', false, NULL, '2026-09-05', 'Final Details', NULL, 'Function: Coordinator, Planner', 1),
  ('10000000-0000-0000-0000-000000000002', 'Book MUAH', false, 'in_progress', '2025-12-23', 'Vendor Sourcing', NULL, 'Function: Planner', 2),
  ('10000000-0000-0000-0000-000000000002', 'Book DJ/music', false, 'in_progress', '2025-12-23', 'Vendor Sourcing', NULL, 'Function: Planner', 3),
  ('10000000-0000-0000-0000-000000000002', 'Book day-of transportation for guests, if needed', false, NULL, '2026-01-22', 'Vendor Sourcing', NULL, 'Function: Planner', 4),
  ('10000000-0000-0000-0000-000000000002', 'Book officiant', false, NULL, '2026-02-21', 'Vendor Sourcing', NULL, 'Function: Planner', 5),
  ('10000000-0000-0000-0000-000000000002', 'Secure vendor for signage and specialty lettering if different from invitations vendor', false, NULL, '2026-03-23', 'Design & Styling', NULL, 'Function: Designer', 6),
  ('10000000-0000-0000-0000-000000000002', 'Have all non-design vendors booked', false, NULL, '2026-03-23', 'Design & Styling', NULL, 'Function: Planner', 7),
  ('10000000-0000-0000-0000-000000000002', 'Have all design vendors booked', false, NULL, '2026-03-23', 'Design & Styling', NULL, 'Function: Designer', 8),
  ('10000000-0000-0000-0000-000000000002', 'Begin on timeline', false, NULL, '2026-03-23', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 9),
  ('10000000-0000-0000-0000-000000000002', 'Schedule walkthrough with team', false, NULL, '2026-04-07', 'Planning Milestones', NULL, 'Function: Planner, Designer, Coordinator', 10),
  ('10000000-0000-0000-0000-000000000002', 'Check in call with client to: check on AP checklist and remind client of upcoming tasks, payment reminders, update and recap of all vendors that have been booked', false, NULL, '2026-04-07', 'Check in - Client', NULL, 'Function: Planner', 11),
  ('10000000-0000-0000-0000-000000000002', 'Make/revise internal inventory list of things needed to bring/order', false, NULL, '2026-04-22', 'Design & Styling', NULL, 'Function: Designer', 12),
  ('10000000-0000-0000-0000-000000000002', 'Send client check in email re: payment reminders, checklist reminders', false, NULL, '2026-05-07', 'Check in - Client', NULL, 'Function: Planner', 13),
  ('10000000-0000-0000-0000-000000000002', 'Begin designing invitations', false, NULL, '2026-05-07', 'Design & Styling', NULL, 'Function: Designer', 14),
  ('10000000-0000-0000-0000-000000000002', 'Schedule timeline call with client for 12 weeks out', false, NULL, '2026-05-07', 'Check in - Client', NULL, 'Function: Planner, Coordinator', 15),
  ('10000000-0000-0000-0000-000000000002', 'Begin on floor plan', false, NULL, '2026-05-22', 'Planning Milestones', NULL, 'Function: Designer', 16),
  ('10000000-0000-0000-0000-000000000002', 'Ask client about their preference for wedding favors *these are not necessary if there is nothing special/sentimental*', false, NULL, '2026-05-22', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 17),
  ('10000000-0000-0000-0000-000000000002', 'Have timeline call with client', false, NULL, '2026-06-27', 'Check in - Client', NULL, 'Function: Planner, Coordinator', 18),
  ('10000000-0000-0000-0000-000000000002', 'Schedule ceremony rehearsal', false, NULL, '2026-06-27', 'Venue & Key Vendor Search', NULL, 'Function: Planner, Coordinator', 19),
  ('10000000-0000-0000-0000-000000000002', 'Finalize first draft of timeline and send to client', false, NULL, '2026-07-04', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 20),
  ('10000000-0000-0000-0000-000000000002', 'Finalize Invitation designs/wording', false, NULL, '2026-07-11', 'Design & Styling', NULL, 'Function: Planner, Designer', 21),
  ('10000000-0000-0000-0000-000000000002', 'Finalize first draft of vendor timelines', false, NULL, '2026-07-11', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 22),
  ('10000000-0000-0000-0000-000000000002', 'Ensure all first draft vendor questions are edited and ready to send at 8 weeks', false, NULL, '2026-07-18', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 23),
  ('10000000-0000-0000-0000-000000000002', 'Ensure invitations are sent out', false, NULL, '2026-07-25', 'Design & Styling', NULL, 'Function: Designer', 24),
  ('10000000-0000-0000-0000-000000000002', 'Ensure first draft timelines and vendor questions are sent to all vendors', false, NULL, '2026-07-25', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 25),
  ('10000000-0000-0000-0000-000000000002', 'Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, payment reminders, etc.', false, NULL, '2026-08-01', 'Check in - Client', NULL, 'Function: Planner, Coordinator', 26),
  ('10000000-0000-0000-0000-000000000002', 'Finalize floor plans', false, NULL, '2026-08-01', 'Design & Styling', NULL, 'Function: Designer', 27),
  ('10000000-0000-0000-0000-000000000002', 'Remind client to start collecting rsvps and start working on seating chart in Aisle Planner', false, NULL, '2026-08-01', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 28),
  ('10000000-0000-0000-0000-000000000002', 'Place any remaining orders for day-of items (guest book, pens, card boxes, reserve signs, easels, candles, etc.)', false, NULL, '2026-08-01', 'Design & Styling', NULL, 'Function: Designer', 29),
  ('10000000-0000-0000-0000-000000000002', 'Send processional questionnaire and final details questionnaire to client', false, NULL, '2026-08-14', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 30),
  ('10000000-0000-0000-0000-000000000002', 'Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, Payment reminders, etc.', false, NULL, '2026-08-19', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 31),
  ('10000000-0000-0000-0000-000000000002', 'Confirm that seating chart is done and ready to be sent to print', false, NULL, '2026-08-22', 'Planning Milestones', NULL, 'Function: Planner', 32),
  ('10000000-0000-0000-0000-000000000002', 'Ensure all second draft vendor questions are edited and ready to send at 4 weeks', false, NULL, '2026-08-22', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 33),
  ('10000000-0000-0000-0000-000000000002', 'Ensure second draft timelines and vendor questions are sent to all vendors', false, NULL, '2026-08-22', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 34),
  ('10000000-0000-0000-0000-000000000002', 'Finalize all day of paper goods and signage designs with vendor', false, NULL, '2026-08-22', 'Planning Milestones', NULL, 'Function: Designer', 35),
  ('10000000-0000-0000-0000-000000000002', 'Execute phone calls with all vendors to go over any last questions and timeline revisions', false, NULL, '2026-08-29', 'Final Details', NULL, 'Function: Planner, Coordinator', 36),
  ('10000000-0000-0000-0000-000000000002', 'Confirm everything is ordered/built according to design/design invoice', false, NULL, '2026-08-29', 'Final Details', NULL, 'Function: Designer', 37),
  ('10000000-0000-0000-0000-000000000002', 'Double check all rental orders and cross check with guest count', false, NULL, '2026-08-29', 'Final Details', NULL, 'Function: Designer', 38),
  ('10000000-0000-0000-0000-000000000002', 'Schedule final details call with client for 7 days out', false, NULL, '2026-09-05', 'Final Details', NULL, 'Function: Planner, Coordinator', 39),
  ('10000000-0000-0000-0000-000000000002', 'Planner and Designer have meeting - confirm all deliveries, rentals orders, signage and seating chart', false, NULL, '2026-09-05', 'Final Details', NULL, 'Function: Planner, Designer', 40),
  ('10000000-0000-0000-0000-000000000002', 'Send caterers final head counts and dietary restrictions and vendor meal counts and dietary restrictions', false, NULL, '2026-09-05', 'Final Details', NULL, 'Function: Planner, Coordinator', 41),
  ('10000000-0000-0000-0000-000000000002', 'Have final details call with client to review timeline, final details questionnaire, processional questionnaire, final payments, etc.', false, NULL, '2026-09-12', 'Final Details', NULL, 'Function: Planner, Coordinator', 42),
  ('10000000-0000-0000-0000-000000000002', 'Prepare all materials and send final timeline/layout to vendors', false, NULL, '2026-09-14', 'Day-of Prep', NULL, 'Function: Planner, Coordinator', 43),
  ('10000000-0000-0000-0000-000000000002', 'Team call to run through all details of the day', false, NULL, '2026-09-15', 'Day-of Prep', NULL, 'Function: Planner, Designer, Coordinator', 44),
  ('10000000-0000-0000-0000-000000000002', 'Print all needed materials for the day of, bag styling and coordinating kits, pack any needed extra items', false, NULL, '2026-09-17', 'Day-of Prep', NULL, 'Function: Planner, Designer', 45),
  ('10000000-0000-0000-0000-000000000002', 'Send review email', false, NULL, '2026-09-26', 'Day-of Prep', NULL, 'Function: Admin, Planner', 46);

-- Tippi & Justin subtasks
INSERT INTO subtasks (task_id, text, completed, sort_order)
SELECT id, 'Ask Tippi for Contract', false, 1
FROM tasks WHERE project_id = '10000000-0000-0000-0000-000000000002' AND text = 'Book MUAH';

INSERT INTO subtasks (task_id, text, completed, sort_order)
SELECT id, 'Review DJ contract', false, 1
FROM tasks WHERE project_id = '10000000-0000-0000-0000-000000000002' AND text = 'Book DJ/music';


-- ============================================
-- ELISABETH & JJ — TASKS (51 tasks)
-- ============================================
INSERT INTO tasks (project_id, text, completed, status, due_date, category, priority, notes, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000003', 'Create wedding website', false, NULL, '2026-03-14', 'Onboarding', NULL, 'Function: Planner', 1),
  ('10000000-0000-0000-0000-000000000003', 'Provide hair and makeup options to client', false, NULL, '2025-12-29', 'Vendor Sourcing', NULL, 'Function: Planner', 2),
  ('10000000-0000-0000-0000-000000000003', 'Provide dessert options to client', false, NULL, '2026-01-28', 'Vendor Sourcing', NULL, 'Function: Planner', 3),
  ('10000000-0000-0000-0000-000000000003', 'Book dessert', false, NULL, '2026-02-12', 'Vendor Sourcing', NULL, 'Function: Planner', 4),
  ('10000000-0000-0000-0000-000000000003', 'Book day-of transportation for guests, if needed', false, NULL, '2026-02-12', 'Vendor Sourcing', NULL, 'Function: Planner', 5),
  ('10000000-0000-0000-0000-000000000003', 'Finalize save-the-dates and send to print', false, NULL, '2026-03-14', 'Design & Styling', NULL, 'Function: Designer', 6),
  ('10000000-0000-0000-0000-000000000003', 'Secure invitation designer and begin invitation design', false, 'in_progress', '2026-03-14', 'Design & Styling', NULL, 'Function: Designer', 7),
  ('10000000-0000-0000-0000-000000000003', 'Book officiant', false, NULL, '2026-03-14', 'Vendor Sourcing', NULL, 'Function: Planner', 8),
  ('10000000-0000-0000-0000-000000000003', 'Make sure designer or client sends save-the-dates', false, NULL, '2026-03-14', 'Design & Styling', NULL, 'Function: Planner', 9),
  ('10000000-0000-0000-0000-000000000003', 'Once design proposal is signed and deposit paid, start officially booking design vendors OR confirm that your client has successfully signed and paid all design vendor invoices and contracts', false, NULL, '2026-03-29', 'Design & Styling', NULL, 'Function: Admin, Designer', 10),
  ('10000000-0000-0000-0000-000000000003', 'Secure vendor for signage and specialty lettering if different from invitations vendor', false, NULL, '2026-04-13', 'Design & Styling', NULL, 'Function: Designer', 11),
  ('10000000-0000-0000-0000-000000000003', 'Have all non-design vendors booked', false, NULL, '2026-04-13', 'Design & Styling', NULL, 'Function: Planner', 12),
  ('10000000-0000-0000-0000-000000000003', 'Have all design vendors booked', false, NULL, '2026-04-13', 'Design & Styling', NULL, 'Function: Designer', 13),
  ('10000000-0000-0000-0000-000000000003', 'Begin on timeline', false, NULL, '2026-04-13', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 14),
  ('10000000-0000-0000-0000-000000000003', 'Schedule walkthrough with team', false, NULL, '2026-04-28', 'Planning Milestones', NULL, 'Function: Planner, Designer, Coordinator', 15),
  ('10000000-0000-0000-0000-000000000003', 'Check in call with client to: check on AP checklist and remind client of upcoming tasks, payment reminders, update and recap of all vendors that have been booked', false, NULL, '2026-04-28', 'Check in - Client', NULL, 'Function: Planner', 16),
  ('10000000-0000-0000-0000-000000000003', 'Make/revise internal inventory list of things needed to bring/order', false, NULL, '2026-05-13', 'Design & Styling', NULL, 'Function: Designer', 17),
  ('10000000-0000-0000-0000-000000000003', 'Send client check in email re: payment reminders, checklist reminders', false, NULL, '2026-05-28', 'Check in - Client', NULL, 'Function: Planner', 18),
  ('10000000-0000-0000-0000-000000000003', 'Begin designing invitations', false, NULL, '2026-05-28', 'Design & Styling', NULL, 'Function: Designer', 19),
  ('10000000-0000-0000-0000-000000000003', 'Schedule timeline call with client for 12 weeks out', false, NULL, '2026-05-28', 'Check in - Client', NULL, 'Function: Planner, Coordinator', 20),
  ('10000000-0000-0000-0000-000000000003', 'Begin on floor plan', false, NULL, '2026-06-12', 'Planning Milestones', NULL, 'Function: Designer', 21),
  ('10000000-0000-0000-0000-000000000003', 'Ask client about their preference for wedding favors *these are not necessary if there is nothing special/sentimental*', false, NULL, '2026-06-12', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 22),
  ('10000000-0000-0000-0000-000000000003', 'Have timeline call with client', false, NULL, '2026-07-18', 'Check in - Client', NULL, 'Function: Planner, Coordinator', 23),
  ('10000000-0000-0000-0000-000000000003', 'Schedule ceremony rehearsal', false, NULL, '2026-07-18', 'Venue & Key Vendor Search', NULL, 'Function: Planner, Coordinator', 24),
  ('10000000-0000-0000-0000-000000000003', 'Finalize first draft of timeline and send to client', false, NULL, '2026-07-25', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 25),
  ('10000000-0000-0000-0000-000000000003', 'Finalize Invitation designs/wording', false, NULL, '2026-08-01', 'Design & Styling', NULL, 'Function: Planner, Designer', 26),
  ('10000000-0000-0000-0000-000000000003', 'Finalize first draft of vendor timelines', false, NULL, '2026-08-01', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 27),
  ('10000000-0000-0000-0000-000000000003', 'Ensure all first draft vendor questions are edited and ready to send at 8 weeks', false, NULL, '2026-08-08', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 28),
  ('10000000-0000-0000-0000-000000000003', 'Ensure invitations are sent out', false, NULL, '2026-08-15', 'Design & Styling', NULL, 'Function: Designer', 29),
  ('10000000-0000-0000-0000-000000000003', 'Ensure first draft timelines and vendor questions are sent to all vendors', false, NULL, '2026-08-15', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 30),
  ('10000000-0000-0000-0000-000000000003', 'Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, payment reminders, etc.', false, NULL, '2026-08-22', 'Check in - Client', NULL, 'Function: Planner, Coordinator', 31),
  ('10000000-0000-0000-0000-000000000003', 'Finalize floor plans', false, NULL, '2026-08-22', 'Design & Styling', NULL, 'Function: Designer', 32),
  ('10000000-0000-0000-0000-000000000003', 'Remind client to start collecting rsvps and start working on seating chart in Aisle Planner', false, NULL, '2026-08-22', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 33),
  ('10000000-0000-0000-0000-000000000003', 'Place any remaining orders for day-of items (guest book, pens, card boxes, reserve signs, easels, candles, etc.)', false, NULL, '2026-08-22', 'Design & Styling', NULL, 'Function: Designer', 34),
  ('10000000-0000-0000-0000-000000000003', 'Send processional questionnaire and final details questionnaire to client', false, NULL, '2026-09-05', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 35),
  ('10000000-0000-0000-0000-000000000003', 'Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, Payment reminders, etc.', false, NULL, '2026-09-09', 'Client Feedback', NULL, 'Function: Planner, Coordinator', 36),
  ('10000000-0000-0000-0000-000000000003', 'Confirm that seating chart is done and ready to be sent to print', false, NULL, '2026-09-12', 'Planning Milestones', NULL, 'Function: Planner', 37),
  ('10000000-0000-0000-0000-000000000003', 'Ensure all second draft vendor questions are edited and ready to send at 4 weeks', false, NULL, '2026-09-12', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 38),
  ('10000000-0000-0000-0000-000000000003', 'Ensure second draft timelines and vendor questions are sent to all vendors', false, NULL, '2026-09-12', 'Planning Milestones', NULL, 'Function: Planner, Coordinator', 39),
  ('10000000-0000-0000-0000-000000000003', 'Finalize all day of paper goods and signage designs with vendor', false, NULL, '2026-09-12', 'Planning Milestones', NULL, 'Function: Designer', 40),
  ('10000000-0000-0000-0000-000000000003', 'Execute phone calls with all vendors to go over any last questions and timeline revisions', false, NULL, '2026-09-19', 'Final Details', NULL, 'Function: Planner, Coordinator', 41),
  ('10000000-0000-0000-0000-000000000003', 'Confirm everything is ordered/built according to design/design invoice', false, NULL, '2026-09-19', 'Final Details', NULL, 'Function: Designer', 42),
  ('10000000-0000-0000-0000-000000000003', 'Double check all rental orders and cross check with guest count', false, NULL, '2026-09-19', 'Final Details', NULL, 'Function: Designer', 43),
  ('10000000-0000-0000-0000-000000000003', 'Schedule final details call with client for 7 days out', false, NULL, '2026-09-26', 'Final Details', NULL, 'Function: Planner, Coordinator', 44),
  ('10000000-0000-0000-0000-000000000003', 'Planner and Designer have meeting - confirm all deliveries, rentals orders, signage and seating chart', false, NULL, '2026-09-26', 'Final Details', NULL, 'Function: Planner, Designer', 45),
  ('10000000-0000-0000-0000-000000000003', 'Send caterers final head counts and dietary restrictions and vendor meal counts and dietary restrictions', false, NULL, '2026-09-26', 'Final Details', NULL, 'Function: Planner, Coordinator', 46),
  ('10000000-0000-0000-0000-000000000003', 'Have final details call with client to review timeline, final details questionnaire, processional questionnaire, final payments, etc.', false, NULL, '2026-10-03', 'Final Details', NULL, 'Function: Planner, Coordinator', 47),
  ('10000000-0000-0000-0000-000000000003', 'Prepare all materials and send final timeline/layout to vendors', false, NULL, '2026-10-05', 'Day-of Prep', NULL, 'Function: Planner, Coordinator', 48),
  ('10000000-0000-0000-0000-000000000003', 'Team call to run through all details of the day', false, NULL, '2026-10-06', 'Day-of Prep', NULL, 'Function: Planner, Designer, Coordinator', 49),
  ('10000000-0000-0000-0000-000000000003', 'Print all needed materials for the day of, bag styling and coordinating kits, pack any needed extra items', false, NULL, '2026-10-08', 'Day-of Prep', NULL, 'Function: Planner, Designer', 50),
  ('10000000-0000-0000-0000-000000000003', 'Send review email', false, NULL, '2026-10-17', 'Day-of Prep', NULL, 'Function: Admin, Planner', 51);


-- ============================================
-- SUN-STEEPED SHOOT — TASKS (12 tasks)
-- ============================================
INSERT INTO tasks (project_id, text, completed, due_date, category, notes, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000005', 'Confirm venue (EHP vs Wildflower)', false, '2026-03-14', 'Venue & Key Vendor Search', NULL, 1),
  ('10000000-0000-0000-0000-000000000005', 'Book photographer', false, '2026-03-15', 'Venue & Key Vendor Search', NULL, 2),
  ('10000000-0000-0000-0000-000000000005', 'Source gold + black tableware rentals', false, '2026-03-20', 'Design & Styling', NULL, 3),
  ('10000000-0000-0000-0000-000000000005', 'Finalize floral palette with florist', false, '2026-03-22', 'Design & Styling', NULL, 4),
  ('10000000-0000-0000-0000-000000000005', 'Order mimosa-toned linens', false, '2026-03-25', 'Design & Styling', NULL, 5),
  ('10000000-0000-0000-0000-000000000005', 'Create shot list / mood board', false, '2026-03-28', 'Design & Styling', NULL, 6),
  ('10000000-0000-0000-0000-000000000005', 'Coordinate model casting', false, '2026-04-01', 'Vendor Sourcing', NULL, 7),
  ('10000000-0000-0000-0000-000000000005', 'Schedule hair & makeup artist', false, '2026-04-05', 'Vendor Sourcing', NULL, 8),
  ('10000000-0000-0000-0000-000000000005', 'Send creative brief to team', true, NULL, 'Planning Milestones', NULL, 9),
  ('10000000-0000-0000-0000-000000000005', 'Draft concept mood board', true, NULL, 'Design & Styling', NULL, 10),
  ('10000000-0000-0000-0000-000000000005', 'Research venue options', true, NULL, 'Venue & Key Vendor Search', NULL, 11),
  ('10000000-0000-0000-0000-000000000005', 'Create project timeline', true, NULL, 'Planning Milestones', NULL, 12);


-- ============================================
-- MENORCA SHOOT — TASKS (15 tasks)
-- ============================================
INSERT INTO tasks (project_id, text, completed, due_date, category, notes, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000006', 'Book flights to Menorca', false, '2026-03-20', 'Logistics', NULL, 1),
  ('10000000-0000-0000-0000-000000000006', 'Confirm Vestige Son Vell access permit', false, '2026-03-25', 'Venue & Key Vendor Search', NULL, 2),
  ('10000000-0000-0000-0000-000000000006', 'Finalize floral order with Cassandra', false, '2026-04-01', 'Design & Styling', NULL, 3),
  ('10000000-0000-0000-0000-000000000006', 'Ship rentals & props to Spain', false, '2026-04-10', 'Logistics', NULL, 4),
  ('10000000-0000-0000-0000-000000000006', 'Arrange local transport + accommodation', false, '2026-04-15', 'Logistics', NULL, 5),
  ('10000000-0000-0000-0000-000000000006', 'Create detailed shot list for Lithica Quarry', false, '2026-04-20', 'Design & Styling', NULL, 6),
  ('10000000-0000-0000-0000-000000000006', 'Coordinate model travel logistics', false, '2026-04-25', 'Logistics', NULL, 7),
  ('10000000-0000-0000-0000-000000000006', 'Confirm EFEGE availability + contract', false, '2026-03-15', 'Venue & Key Vendor Search', NULL, 8),
  ('10000000-0000-0000-0000-000000000006', 'Source local hair & makeup in Menorca', false, '2026-04-05', 'Vendor Sourcing', NULL, 9),
  ('10000000-0000-0000-0000-000000000006', 'Research Menorca venue options', true, NULL, 'Venue & Key Vendor Search', NULL, 10),
  ('10000000-0000-0000-0000-000000000006', 'Contact EFEGE for initial inquiry', true, NULL, 'Vendor Sourcing', NULL, 11),
  ('10000000-0000-0000-0000-000000000006', 'Draft concept + mood board', true, NULL, 'Design & Styling', NULL, 12),
  ('10000000-0000-0000-0000-000000000006', 'Connect with Cassandra at Enrich', true, NULL, 'Vendor Sourcing', NULL, 13),
  ('10000000-0000-0000-0000-000000000006', 'Create project budget estimate', true, NULL, 'Planning Milestones', NULL, 14),
  ('10000000-0000-0000-0000-000000000006', 'Build project timeline', true, NULL, 'Planning Milestones', NULL, 15);


-- ============================================
-- CALL NOTES (Julia & Frank)
-- ============================================
INSERT INTO call_notes (id, project_id, date, title, summary, raw_text) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-03-03', 'Floral Direction & Logistics',
   NULL,
   'Call covered floral direction (greenery + white/blush approved), cocktail hour music (jazz trio preference), room block deadline (April 15 — potential late RSVPs from Italy), sparkler exit request (needs venue fire check), tasting scheduling (within 3 weeks), budget check (florals may need trim), and calligrapher lead from Instagram.'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-03-05', 'Timeline & Logistics Review',
   'The meeting focused on finalizing the wedding timeline and addressing various logistical details for the upcoming wedding.',
   'juliamazzucca: Provide Mikaela with details on the number of hair and makeup artists, their schedule/timeline, and how many people each is bringing. juliamazzucca: Send Mikaela the specific link or details for the chosen cigars. juliamazzucca: Send Mikaela options for the well-wishing box (card box) for review. Mikaela: Update the hair and makeup schedule to include the additional person (Gabriella) and reorganize based on new artist information. Mikaela: Move the first look timing earlier (to 3:15 or 3:30) and consult with Tay (photographer) on timing. Mikaela: Reach out to Mark to confirm timing for the single toast during dinner. Mikaela: Ask the photo booth vendor how long setup takes and if it can be set up during dinner.');

-- Extracted actions for call note 1
INSERT INTO extracted_actions (call_note_id, text, due_date, accepted, dismissed) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Check Wave Resort fire safety rules for sparkler exit', '2026-03-10', true, false),
  ('20000000-0000-0000-0000-000000000001', 'Schedule tasting at Wave Resort', '2026-03-20', true, false),
  ('20000000-0000-0000-0000-000000000001', 'Follow up with Julia on calligrapher Instagram handle', '2026-03-07', true, false),
  ('20000000-0000-0000-0000-000000000001', 'Research jazz trio options for cocktail hour', '2026-03-15', false, true),
  ('20000000-0000-0000-0000-000000000001', 'Flag room block deadline — April 15 final numbers', '2026-04-10', true, false);

-- Extracted actions for call note 2
INSERT INTO extracted_actions (call_note_id, text, due_date, accepted, dismissed) VALUES
  ('20000000-0000-0000-0000-000000000002', 'Update hair and makeup schedule for Gabriella', '2026-03-10', true, false),
  ('20000000-0000-0000-0000-000000000002', 'Move first look to 3:15 and consult Tay on timing', '2026-03-08', true, false),
  ('20000000-0000-0000-0000-000000000002', 'Ask photo booth vendor about setup during dinner', '2026-03-12', true, false),
  ('20000000-0000-0000-0000-000000000002', 'Schedule call with Mark re: bartender + luge', '2026-03-10', false, false);


-- ============================================
-- TEMPLATE TASKS (New Client Onboarding)
-- Full list from your spreadsheet
-- timing_note stores the original relative timing description
-- weeks_before_event is approximate for DB compatibility
-- ============================================
INSERT INTO template_tasks (text, category, weeks_before_event, sort_order, is_active) VALUES
  -- Onboarding (immediate + first 2 weeks)
  ('Send welcome packet', 'Onboarding', 60, 1, true),
  ('Send client planning questionnaire', 'Onboarding', 60, 2, true),
  ('Add client address to Trello', 'Onboarding', 60, 3, true),
  ('Create Aisle Planner', 'Onboarding', 59, 4, true),
  ('Edit Aisle Planner checklist', 'Onboarding', 59, 5, true),
  ('Option to create URL and email address for client', 'Onboarding', 59, 6, true),
  ('Load vendor recommendations into Aisle Planner', 'Onboarding', 58, 7, true),
  ('Send Aisle Planner intro email to client', 'Onboarding', 57, 8, true),
  ('Check in with client on Aisle Planner details, if needed', 'Check in - Client', 56, 9, true),

  -- Venue & Key Vendor Search (14-10 months out)
  ('Begin doing venue research for client', 'Venue & Key Vendor Search', 60, 10, true),
  ('Provide client with venue/ceremony/reception space options', 'Venue & Key Vendor Search', 56, 11, true),
  ('Book venues for ceremony and reception', 'Venue & Key Vendor Search', 52, 12, true),
  ('Provide photographer options to client', 'Venue & Key Vendor Search', 48, 13, true),
  ('Book photographer', 'Venue & Key Vendor Search', 48, 14, true),
  ('Provide catering options to client', 'Venue & Key Vendor Search', 48, 15, true),
  ('Book caterer', 'Venue & Key Vendor Search', 48, 16, true),
  ('Provide videographer options to client', 'Venue & Key Vendor Search', 48, 17, true),
  ('Book videographer', 'Vendor Sourcing', 44, 18, true),
  ('Provide beverage or bar options to client, if needed', 'Venue & Key Vendor Search', 48, 19, true),
  ('Book beverage or bar vendor, if needed', 'Vendor Sourcing', 44, 20, true),
  ('Remind client to finish guest list, include addresses/emails/full names', 'Client Feedback', 44, 21, true),

  -- Design Shift (~10 months out)
  ('Send design questionnaire', 'Client Feedback', 44, 22, true),
  ('Create wedding website', 'Onboarding', 44, 23, true),
  ('Start on design board', 'Design & Styling', 40, 24, true),

  -- Vendor Sourcing (9-7 months)
  ('Provide hair and makeup options to client', 'Vendor Sourcing', 42, 25, true),
  ('Secure vendor for save-the-dates', 'Vendor Sourcing', 40, 26, true),
  ('Book MUAH', 'Vendor Sourcing', 40, 27, true),
  ('Provide DJ/music options to client', 'Vendor Sourcing', 42, 28, true),
  ('Book DJ/music', 'Vendor Sourcing', 40, 29, true),
  ('Schedule design meeting for 8 months out, or sooner if ready', 'Vendor Sourcing', 40, 30, true),
  ('Choose florist', 'Vendor Sourcing', 40, 31, true),
  ('Choose rentals', 'Vendor Sourcing', 40, 32, true),
  ('Choose lighting and/or draping', 'Vendor Sourcing', 40, 33, true),
  ('Provide dessert options to client', 'Vendor Sourcing', 38, 34, true),
  ('Book dessert', 'Vendor Sourcing', 36, 35, true),
  ('Book hotel blocks for guests with 2 to 4 options in different price ranges', 'Venue & Key Vendor Search', 36, 36, true),
  ('Book day-of transportation for guests, if needed', 'Vendor Sourcing', 36, 37, true),

  -- Design Meetings & Proposals (8-7 months)
  ('Have design meeting with client to review design board and send final revisions', 'Check in - Client', 36, 38, true),
  ('Once design booklet is approved, start collecting design components quotes', 'Design & Styling', 34, 39, true),
  ('Send complete, itemized design invoice to client OR one email with all collected quotes from different vendors', 'Design & Styling', 32, 40, true),
  ('Finalize save-the-dates and send to print', 'Design & Styling', 32, 41, true),
  ('Secure invitation designer and begin invitation design', 'Design & Styling', 32, 42, true),
  ('Book portable restrooms, if needed', 'Vendor Sourcing', 32, 43, true),
  ('Book photobooth, if desired', 'Vendor Sourcing', 32, 44, true),
  ('Book officiant', 'Vendor Sourcing', 32, 45, true),
  ('Make sure designer or client sends save-the-dates', 'Design & Styling', 32, 46, true),
  ('Once design proposal is signed and deposit paid, start officially booking design vendors OR confirm that your client has successfully signed and paid all design vendor invoices and contracts', 'Design & Styling', 30, 47, true),

  -- Design Finalization (6 months)
  ('Secure vendor for signage and specialty lettering if different from invitations vendor', 'Design & Styling', 28, 48, true),
  ('Have all non-design vendors booked', 'Design & Styling', 28, 49, true),
  ('Have all design vendors booked', 'Design & Styling', 28, 50, true),

  -- Coordinator Shift & Planning (6-4 months)
  ('Begin on timeline', 'Planning Milestones', 28, 51, true),
  ('Schedule walkthrough with team', 'Planning Milestones', 24, 52, true),
  ('Check in call with client to: check on AP checklist and remind client of upcoming tasks, payment reminders, update and recap of all vendors that have been booked', 'Check in - Client', 24, 53, true),
  ('Make/revise internal inventory list of things needed to bring/order', 'Design & Styling', 22, 54, true),
  ('Send client check in email re: payment reminders, checklist reminders', 'Check in - Client', 20, 55, true),
  ('Begin designing invitations', 'Design & Styling', 20, 56, true),
  ('Schedule timeline call with client for 12 weeks out', 'Check in - Client', 20, 57, true),
  ('Begin on floor plan', 'Planning Milestones', 18, 58, true),
  ('Ask client about their preference for wedding favors *these are not necessary if there is nothing special/sentimental*', 'Client Feedback', 18, 59, true),

  -- Timeline & Invitations (12-8 weeks)
  ('Have timeline call with client', 'Check in - Client', 12, 60, true),
  ('Schedule ceremony rehearsal', 'Venue & Key Vendor Search', 12, 61, true),
  ('Finalize first draft of timeline and send to client', 'Planning Milestones', 11, 62, true),
  ('Finalize Invitation designs/wording', 'Design & Styling', 10, 63, true),
  ('Finalize first draft of vendor timelines', 'Planning Milestones', 10, 64, true),
  ('Ensure all first draft vendor questions are edited and ready to send at 8 weeks', 'Planning Milestones', 9, 65, true),
  ('Ensure invitations are sent out', 'Design & Styling', 8, 66, true),
  ('Ensure first draft timelines and vendor questions are sent to all vendors', 'Planning Milestones', 8, 67, true),

  -- Final Prep (7-4 weeks)
  ('Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, payment reminders, etc.', 'Check in - Client', 7, 68, true),
  ('Finalize floor plans', 'Design & Styling', 7, 69, true),
  ('Remind client to start collecting rsvps and start working on seating chart in Aisle Planner', 'Client Feedback', 7, 70, true),
  ('Place any remaining orders for day-of items (guest book, pens, card boxes, reserve signs, easels, candles, etc.)', 'Design & Styling', 7, 71, true),
  ('Send processional questionnaire and final details questionnaire to client', 'Client Feedback', 5, 72, true),
  ('Check in call with client to: check on Aisle Planner checklist and remind client of upcoming tasks, Payment reminders, etc.', 'Client Feedback', 4, 73, true),
  ('Confirm that seating chart is done and ready to be sent to print', 'Planning Milestones', 4, 74, true),
  ('Ensure all second draft vendor questions are edited and ready to send at 4 weeks', 'Planning Milestones', 4, 75, true),
  ('Ensure second draft timelines and vendor questions are sent to all vendors', 'Planning Milestones', 4, 76, true),
  ('Finalize all day of paper goods and signage designs with vendor', 'Planning Milestones', 4, 77, true),

  -- Final Details (3-1 weeks)
  ('Execute phone calls with all vendors to go over any last questions and timeline revisions', 'Final Details', 3, 78, true),
  ('Confirm everything is ordered/built according to design/design invoice', 'Final Details', 3, 79, true),
  ('Double check all rental orders and cross check with guest count', 'Final Details', 3, 80, true),
  ('Schedule final details call with client for 7 days out', 'Final Details', 2, 81, true),
  ('Planner and Designer have meeting - confirm all deliveries, rentals orders, signage and seating chart', 'Final Details', 2, 82, true),
  ('Send caterers final head counts and dietary restrictions and vendor meal counts and dietary restrictions', 'Final Details', 2, 83, true),
  ('Have final details call with client to review timeline, final details questionnaire, processional questionnaire, final payments, etc.', 'Final Details', 1, 84, true),

  -- Day-of Prep (final week)
  ('Prepare all materials and send final timeline/layout to vendors', 'Day-of Prep', 1, 85, true),
  ('Team call to run through all details of the day', 'Day-of Prep', 1, 86, true),
  ('Print all needed materials for the day of, bag styling and coordinating kits, pack any needed extra items', 'Day-of Prep', 0, 87, true),
  ('Send review email', 'Day-of Prep', 0, 88, true);


-- ============================================
-- ============================================
-- FIX NULL STATUS — set status based on completed field
-- ============================================
UPDATE tasks SET status = 'completed' WHERE completed = true AND status IS NULL;
UPDATE tasks SET status = 'in_progress' WHERE completed = false AND status IS NULL;

-- VERIFICATION QUERY (run to check counts)
-- ============================================
-- SELECT
--   (SELECT count(*) FROM team_members) as team_count,
--   (SELECT count(*) FROM projects) as project_count,
--   (SELECT count(*) FROM tasks) as task_count,
--   (SELECT count(*) FROM subtasks) as subtask_count,
--   (SELECT count(*) FROM vendors) as vendor_count,
--   (SELECT count(*) FROM call_notes) as call_note_count,
--   (SELECT count(*) FROM extracted_actions) as action_count,
--   (SELECT count(*) FROM template_tasks) as template_count;
