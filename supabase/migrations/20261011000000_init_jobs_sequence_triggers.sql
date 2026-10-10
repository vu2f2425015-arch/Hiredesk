-- Supabase Migration: Initial Schema, Atomic Sequence & Immutability Trigger
-- See packages/database/prisma/migrations/20261011000000_init_jobs_sequence_triggers/migration.sql

CREATE SEQUENCE IF NOT EXISTS job_code_seq START WITH 1001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_job_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'JOB-' || nextval('job_code_seq')::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_job_code_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."jobCode" IS NOT NULL AND NEW."jobCode" <> OLD."jobCode" THEN
        RAISE EXCEPTION 'jobCode is immutable and cannot be updated once set';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
