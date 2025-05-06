Research Terminal Instructions

Our research terminal supports two primary commands: /chat and /research. Each of these commands accepts two flags to define its behavior:

--m (model): Specifies the model to be used for the entire session.

--c (character slug): Defines the character context to be maintained throughout the session.

Default Behavior:

If no flags are provided, the terminal uses a default model and a default character slug.

If --c None is specified, no character context is applied, and the session runs with just the model’s default behavior.

A model is always required, so if no model flag is provided, the default model is used.

Usage Consistency:

Once a model and character slug are specified (either by flags or defaults), they remain consistent throughout the entire session to ensure uniformity in context and output for all interactions and queries.