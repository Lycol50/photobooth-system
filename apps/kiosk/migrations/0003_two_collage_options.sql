ALTER TABLE settings ADD COLUMN collage_2_frame_id TEXT;
ALTER TABLE sessions ADD COLUMN selected_frame_id TEXT;
ALTER TABLE sessions ADD COLUMN selected_option INTEGER NOT NULL DEFAULT 1;
