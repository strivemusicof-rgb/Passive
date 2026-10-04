-- The plot grid now uses one column width per zone of 3000 rows (instead of
-- one per row), so columns line up. Move every plot (and check-in) to the new
-- column that holds its old centre. Rows don't change. If two old plots land
-- on the same new cell, the later one moves one column east.
CREATE FUNCTION pg_temp.old_step(r int) RETURNS float8 AS $$
  SELECT 0.0003 / GREATEST(cos(radians((r + 0.5) * 0.0003)), 0.05)
$$ LANGUAGE sql IMMUTABLE;
CREATE FUNCTION pg_temp.new_step(r int) RETURNS float8 AS $$
  SELECT 0.0003 / GREATEST(cos(radians((floor(r / 3000.0) + 0.5) * 3000 * 0.0003)), 0.05)
$$ LANGUAGE sql IMMUTABLE;

CREATE TEMP TABLE plot_moves (row int, old_col int, new_col int, PRIMARY KEY (row, old_col));

DO $$
DECLARE
  p record;
  c int;
BEGIN
  FOR p IN SELECT row, col FROM plots ORDER BY row, col LOOP
    c := floor((p.col + 0.5) * pg_temp.old_step(p.row) / pg_temp.new_step(p.row));
    WHILE EXISTS (SELECT 1 FROM plot_moves m WHERE m.row = p.row AND m.new_col = c) LOOP
      c := c + 1;
    END LOOP;
    INSERT INTO plot_moves VALUES (p.row, p.col, c);
  END LOOP;
END $$;

-- Two steps so the primary key never clashes halfway through.
UPDATE plots SET col = col + 1000000000;
UPDATE plots p SET col = m.new_col FROM plot_moves m WHERE p.row = m.row AND p.col = m.old_col + 1000000000;

UPDATE check_ins SET col = col + 1000000000;
UPDATE check_ins k SET col = m.new_col FROM plot_moves m WHERE k.row = m.row AND k.col = m.old_col + 1000000000;
-- Check-ins on plots that were sold since: just recompute the column.
UPDATE check_ins SET col = floor((col - 1000000000 + 0.5) * pg_temp.old_step(row) / pg_temp.new_step(row))
  WHERE col >= 500000000;
