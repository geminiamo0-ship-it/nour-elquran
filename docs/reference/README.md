# Owner-approved V3 landing reference

The HTML file in this directory is a **visual and behavior reference only**, never shipped as the web runtime page. Route `/` renders Next.js React components under `apps/web/src/features/landing/v3`, with typed hooks and local mock interactions.

Do not add this HTML back to `apps/web/public` or redirect the landing route to it. When changing the React implementation, compare the rendered result against this reference and run responsive browser tests.
