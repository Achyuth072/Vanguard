# ADR 0001: Local SQLite Datastore

## Context

The previous implementation of `pulse-career-module` targeted PostgreSQL and Supabase via `@prisma/adapter-pg`. For a single-user personal job search agent, hosted cloud databases introduce hosting costs, remote connectivity requirements, database pausing, and unnecessary authentication overhead.

## Decision

Migrate the primary storage layer to a local SQLite database (`pulse.db`) using Prisma.

The `Candidate` profile will store filter-critical scalar attributes (minimum salary, years of experience, remote requirements, target locations) as top-level indexed columns to enable fast, deterministic SQL filtering. Rich historical data (projects, employment records, skills, resume versions) will be stored as strongly typed JSON payloads within the entity to avoid multi-table relational join overhead in a single-user application.

## Consequences

- Zero hosting cost and complete offline functionality.
- Simplified backups via local file copy or JSON/CSV exports.
- Multi-user SaaS capabilities are deferred as an explicit non-goal.
- Schema migrations run locally without remote database credentials.
