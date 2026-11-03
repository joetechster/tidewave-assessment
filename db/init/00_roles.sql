-- Assessment-only roles and schemas (fake passwords). Runs once on a fresh database.
CREATE ROLE engine_app LOGIN PASSWORD 'engine_pw';
CREATE ROLE leads_app LOGIN PASSWORD 'leads_pw';
CREATE ROLE qa_reader LOGIN PASSWORD 'qa_reader_pw';
GRANT CONNECT ON DATABASE tidewave TO engine_app, leads_app, qa_reader;
GRANT CREATE ON DATABASE tidewave TO engine_app, leads_app;
CREATE SCHEMA engine AUTHORIZATION engine_app;
CREATE SCHEMA leads AUTHORIZATION leads_app;
GRANT USAGE ON SCHEMA engine, leads TO qa_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE engine_app IN SCHEMA engine GRANT SELECT ON TABLES TO qa_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE leads_app IN SCHEMA leads GRANT SELECT ON TABLES TO qa_reader;
ALTER ROLE qa_reader SET default_transaction_read_only = on;
