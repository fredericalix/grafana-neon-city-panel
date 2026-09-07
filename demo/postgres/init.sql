-- Neon Noodle Bar — schema + seed
CREATE TABLE menu (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES menu (id),
  quantity INTEGER NOT NULL DEFAULT 1,
  served_by TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_created_at_idx ON orders (created_at DESC);

INSERT INTO menu (name, price_cents) VALUES
  ('Chrome Shoyu Ramen', 1200),
  ('Holo-Tonkotsu Deluxe', 1550),
  ('Static Miso Bowl', 1100),
  ('Glitch Gyoza (6pc)', 650),
  ('Neon Negi Tsukemen', 1400),
  ('Synth Sake Broth', 950),
  ('Data-Dashi Udon', 1050);
