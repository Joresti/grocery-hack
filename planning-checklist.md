# Planning Checklist

> Everything that must be completed before coding begins.

## Planning Gaps

- [x] **Claude prompt templates — Scraper** → `docs/pipelines/scraper-pipeline.md`
- [x] **Claude prompt templates — Planner** → `docs/pipelines/planner-pipeline.md`
- ~~**Claude prompt templates — Recipe import**~~ (removed — users fill out the form manually, no AI scraping)
- [x] **Error code catalog** → `docs/architecture/error-codes.md`
- [x] **Zod schema strategy** → `docs/architecture/zod-strategy.md`
- [x] **Email templates** → `docs/design/email-templates.md`
- [x] **Seed data** → `docs/data/seed-data.md`
- [x] **Project scaffolding** → `docs/architecture/scaffolding.md`
- [x] **Migration strategy** → `docs/architecture/migration-strategy.md`
- [x] **Analytics spec** → `docs/architecture/analytics-spec.md`

## Skills to Create

- [x] `/scaffold-route` — generate route + service + query + Zod schema from an endpoint name
- [x] `/validate-types` — check `types.ts` matches schema.sql and api-contract.yaml
- [x] `/seed-db` — generate realistic Hamilton test data
- [x] `/prompt-test` — run a Claude prompt template with sample input, no DB
- [x] `/check-spend` — show current spend vs limits for all services
