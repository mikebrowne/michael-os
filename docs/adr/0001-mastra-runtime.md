# Use Mastra as the MichaelOS runtime

MichaelOS needs a local-first runtime to host agents, tools, and workflows with built-in logging and observability (per the Phase 1 goal in `init.md`). We chose Mastra because it is TypeScript-native, ships agents/tools/workflows as first-class primitives plus a pino-based logger and telemetry hooks, and provides a scaffolder (`npm create mastra`) that lets us reach a runnable minimal slice faster than hand-rolling. The trade-off is framework lock-in: agents, tools, and workflow definitions will follow Mastra's APIs, so swapping frameworks later would be a meaningful rewrite. We accept this because the out-of-the-box capabilities directly match the harness's needs and keep early work minimal.

Considered alternatives: hand-rolling a bespoke runtime (rejected — more work, reinvents logging/workflow plumbing) and LangGraph/other orchestrators (rejected — less aligned with a TS-first, local-first single-operator harness).
