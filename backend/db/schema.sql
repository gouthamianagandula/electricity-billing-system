DROP TABLE IF EXISTS payments, bills, readings, meters, customers, tariffs, users CASCADE;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL
                CHECK (role IN ('ADMIN','STAFF','CUSTOMER','METER_READER')),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  user_id         INT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name            VARCHAR(100) NOT NULL,
  address         TEXT NOT NULL,
  phone           VARCHAR(15),
  connection_type VARCHAR(20) DEFAULT 'DOMESTIC',
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE meters (
  id           SERIAL PRIMARY KEY,
  customer_id  INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  meter_number VARCHAR(30) UNIQUE NOT NULL,
  installed_on DATE DEFAULT CURRENT_DATE,
  status       VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE'))
);

CREATE TABLE readings (
  id             SERIAL PRIMARY KEY,
  meter_id       INT NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  reading_date   DATE NOT NULL,
  reading_value  NUMERIC(10,2) NOT NULL,
  units_consumed NUMERIC(10,2) NOT NULL DEFAULT 0,
  recorded_by    INT REFERENCES users(id),
  UNIQUE (meter_id, reading_date)
);

CREATE TABLE tariffs (
  id            SERIAL PRIMARY KEY,
  slab_from     INT NOT NULL,
  slab_to       INT,
  rate_per_unit NUMERIC(6,2) NOT NULL
);

CREATE TABLE bills (
  id            SERIAL PRIMARY KEY,
  customer_id   INT NOT NULL REFERENCES customers(id),
  meter_id      INT NOT NULL REFERENCES meters(id),
  reading_id    INT REFERENCES readings(id),
  billing_month DATE NOT NULL,
  units         NUMERIC(10,2) NOT NULL,
  energy_charge NUMERIC(10,2) NOT NULL,
  fixed_charge  NUMERIC(10,2) NOT NULL,
  total_amount  NUMERIC(10,2) NOT NULL,
  due_date      DATE NOT NULL,
  status        VARCHAR(10) DEFAULT 'UNPAID' CHECK (status IN ('UNPAID','PAID','OVERDUE')),
  generated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (meter_id, billing_month)
);

CREATE TABLE payments (
  id             SERIAL PRIMARY KEY,
  bill_id        INT NOT NULL REFERENCES bills(id),
  amount         NUMERIC(10,2) NOT NULL,
  payment_date   TIMESTAMP DEFAULT NOW(),
  transaction_id VARCHAR(40) UNIQUE NOT NULL,
  method         VARCHAR(20) DEFAULT 'UPI',
  status         VARCHAR(10) DEFAULT 'SUCCESS'
);

INSERT INTO tariffs (slab_from, slab_to, rate_per_unit) VALUES
  (0,   100,  3.50),
  (101, 200,  5.00),
  (201, 300,  7.00),
  (301, NULL, 9.00);