-- Attendance, counted on the user row rather than in a log table.
--
-- A visits table would be the textbook shape, but it grows by one row per member
-- per day forever to answer two questions that are both answerable from three
-- columns. Rows written is the binding limit on the free plan (see
-- docs/chat-api.md), and this way a member costs at most one UPDATE a day —
-- guarded by the date, so the second visit of the same day writes nothing.
--
-- last_visit_date is a Seoul calendar date ("YYYY-MM-DD"), not a timestamp:
-- attendance is a question about days, and the reader's day is the KST one.
-- Storing an instant would mean re-deriving the date on every comparison and
-- getting the timezone wrong somewhere.

ALTER TABLE users ADD COLUMN last_visit_date TEXT;
ALTER TABLE users ADD COLUMN visit_days      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN visit_streak    INTEGER NOT NULL DEFAULT 0;
