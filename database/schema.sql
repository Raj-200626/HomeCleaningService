-- Home Cleaning Service Database Schema
-- PostgreSQL / pgAdmin Compatible
-- Run this in pgAdmin Query Tool to create the database structure

-- Optional: Create database first (run as superuser in postgres database)
-- CREATE DATABASE home_cleaning_db;
-- After creating, switch to home_cleaning_db before running below

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-creating (order matters for foreign keys)
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS testimonials CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enums
DROP TYPE IF EXISTS role_enum CASCADE;
DROP TYPE IF EXISTS booking_status_enum CASCADE;

CREATE TYPE role_enum AS ENUM ('customer', 'admin');
CREATE TYPE booking_status_enum AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    password_hash VARCHAR(256) NOT NULL,
    role role_enum DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Services table
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    duration VARCHAR(50),
    image VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_active ON services(is_active);

-- Bookings table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    notes TEXT,
    status booking_status_enum DEFAULT 'pending',
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Contacts table
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    subject VARCHAR(200),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_is_read ON contacts(is_read);

-- Testimonials table
CREATE TABLE testimonials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(100),
    message TEXT NOT NULL,
    rating INTEGER DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    image VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed sample services
INSERT INTO services (name, description, price, duration, image) VALUES
('Regular House Cleaning', 'Standard cleaning service covering all rooms, dusting, vacuuming, mopping, kitchen and bathroom cleaning.', 89.99, '2-3 hours', 'regular-cleaning.jpg'),
('Deep Cleaning', 'Thorough deep cleaning service including hard-to-reach areas, behind appliances, inside cabinets, and detailed sanitization.', 199.99, '4-6 hours', 'deep-cleaning.jpg'),
('Move In/Out Cleaning', 'Complete cleaning for moving in or out ensuring your old or new home is spotless and ready for occupancy.', 249.99, '5-7 hours', 'move-cleaning.jpg'),
('Kitchen & Bathroom', 'Specialized cleaning for kitchens and bathrooms with focus on grease removal, tile scrubbing, and sanitization.', 129.99, '2-3 hours', 'kitchen-bath.jpg'),
('Window Cleaning', 'Professional interior and exterior window cleaning for streak-free, sparkling results.', 79.99, '1-2 hours', 'window-cleaning.jpg'),
('Carpet Cleaning', 'Deep carpet cleaning using professional equipment to remove stains, dirt, and allergens effectively.', 99.99, '2-3 hours', 'carpet-cleaning.jpg');

-- Seed sample testimonials
INSERT INTO testimonials (name, role, message, rating) VALUES
('Sarah Johnson', 'Regular Customer', 'Absolutely amazing service! My house has never looked so clean. The team was professional and thorough.', 5),
('Michael Chen', 'Homeowner', 'Best cleaning service in town. Reliable, affordable, and the attention to detail is outstanding.', 5),
('Emma Wilson', 'Busy Professional', 'As a working mom, this service is a lifesaver. They always show up on time and do an incredible job.', 5),
('David Martinez', 'Apartment Resident', 'The deep cleaning service was worth every penny. My apartment looks brand new. Highly recommended!', 5);

-- Create default admin user (password: admin123)
-- Password hash generated using werkzeug generate_password_hash('admin123', method='pbkdf2:sha256')
INSERT INTO users (full_name, email, phone, address, password_hash, role) VALUES
(
    'Administrator',
    'admin@clean.com',
    '555-0100',
    '123 Main Street',
    'pbkdf2:sha256:600000$ScDn3cT0F9l5q03J$39d0ef0887d12d554f09452034b120d7830ecbe8e87b17f337307773054a39e6c9b6c2b2b5d72807e02aa62e4be07a7d3b382b5b9d3f1e3d856c831b63e2b03a',
    'admin'
);

-- Optional: Verify seeded data
-- SELECT * FROM services;
-- SELECT * FROM testimonials;
-- SELECT id, full_name, email, role FROM users;
