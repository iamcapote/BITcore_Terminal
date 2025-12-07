# Current APP Folder File Tree

```plaintext
commands/
  admin.cli.mjs
  chat/
    interactive-cli.mjs
    memory.mjs
    persona.mjs
    research/
      exit.mjs
      queries.mjs
      start.mjs

    research.mjs
    session.mjs

  chat-history.cli.mjs
  chat.cli.mjs
  diagnose/
    checks.mjs

  diagnose.cli.mjs
  export.cli.mjs
  index.mjs
  keys.cli.mjs
  login.cli.mjs
  logout.cli.mjs
  logs.cli.mjs
  memory.cli.mjs
  missions/
    helpers.mjs
    sync.handler.mjs
    templates.handler.mjs

  missions.cli.mjs
  password.cli.mjs
  prompts.cli.mjs
  research/
    action-resolver.mjs
    archive-actions.mjs
    emitters.mjs
    keys.mjs
    logging.mjs
    memory-context.mjs
    passwords.mjs
    query-classifier.mjs
    run-workflow.mjs
    state.mjs

  research-github.cli.mjs
  research-scheduler.cli.mjs
  research.cli.mjs
  research.command.mjs
  research.github-sync.cli.mjs
  research.mjs
  security.cli.mjs
  status.cli.mjs
  storage.cli.mjs
  terminal.cli.mjs
  users.cli.mjs

components/
  layout/
    Dashboard.tsx

  ui/
    Button.tsx
    Card.tsx
    Input.tsx
    Textarea.tsx


config/
  cli-metadata.json
  index.mjs
  websocket.mjs

current_app_folder_file_tree.md
features/
  ai/
    model-browser/
      index.mjs
      model-browser.controller.mjs
      model-browser.routes.mjs
      model-browser.service.mjs

    research.providers.controller.mjs
    research.providers.fallbacks.mjs
    research.providers.llm.mjs
    research.providers.mjs
    research.providers.service.mjs
    research.providers.utils.mjs

  auth/
    encryption.mjs
    routes.mjs
    user-manager.mjs
    user-manager.mjs.bak

  chat/
    chat-persona.controller.mjs
    chat-persona.routes.mjs
    chat-persona.schema.mjs
    chat-persona.service.mjs
    handlers.mjs
    index.mjs
    routes.mjs
    ws-chat-handler.mjs

  chat-history/
    chat-history.controller.mjs
    chat-history.repository.mjs
    chat-history.schema.mjs
    chat-history.service.mjs
    index.mjs
    routes.mjs

  config/
    config.schema.mjs
    secure-config.service.mjs

  logs/
    routes.mjs

  memory/
    index.mjs
    memory.controller.mjs
    memory.enricher.mjs
    memory.schema.mjs
    memory.service.mjs
    memory.telemetry.mjs
    memory.types.mjs
    routes.mjs

  missions/
    github-sync.service.mjs
    index.mjs
    mission.controller.mjs
    mission.github-sync.controller.mjs
    mission.repository.mjs
    mission.scheduler-state.repository.mjs
    mission.scheduler.mjs
    mission.schema.mjs
    mission.service.mjs
    mission.telemetry.mjs
    mission.templates.repository.mjs
    routes.mjs

  preferences/
    index.mjs
    research-preferences.controller.mjs
    research-preferences.routes.mjs
    research-preferences.service.mjs
    terminal-preferences.controller.mjs
    terminal-preferences.routes.mjs
    terminal-preferences.service.mjs

  prompts/
    index.mjs
    prompt.controller.mjs
    prompt.github-sync.controller.mjs
    prompt.github-sync.service.mjs
    prompt.repository.mjs
    prompt.schema.mjs
    prompt.service.mjs
    routes.mjs

  research/
    github-activity.channel.mjs
    github-activity.routes.mjs
    github-activity.webcomm.mjs
    github-sync/
      controller.mjs
      index.mjs
      request.fetcher.mjs
      request.scheduler.mjs
      routes.mjs
      service.mjs

    research.controller.mjs
    research.defaults.mjs
    research.github-sync.controller.mjs
    research.github-sync.service.mjs
    research.telemetry.metrics.mjs
    research.telemetry.mjs
    routes.mjs
    websocket/
      chat-handler.mjs
      client-io.mjs
      command-handler.mjs
      connection.mjs
      constants.mjs
      input-handler.mjs
      prompt.mjs
      session-bootstrap.mjs
      session-registry.mjs


  status/
    index.mjs
    routes.mjs
    status.controller.mjs
    status.service.mjs


filetree.mjs
infrastructure/
  ai/
    langchain/
      chains/
        query-generation.chain.mjs

      prompts/
        research.prompts.mjs

      venice-chat-model.mjs

    venice.characters.mjs
    venice.llm-client.mjs
    venice.models.mjs
    venice.response-processor.mjs

  config/
    encrypted-config.store.mjs

  memory/
    github-memory.integration.mjs
    memory.helpers.mjs
    memory.manager.mjs
    memory.prompts.mjs
    memory.settings.mjs
    memory.store.mjs
    memory.validators.mjs

  missions/
    github-sync.mjs

  research/
    github-sync.mjs
    research.archive.mjs
    research.engine.mjs
    research.markdown.mjs
    research.override-runner.mjs
    research.path.mjs

  search/
    search.mjs
    search.providers.mjs

  session/
    session.store.mjs


public/
  chat-history/
    chat-history.js
    index.html

  chat.js
  command-processor.js
  css/
    base.css
    chat-history.css
    github-sync.css
    memory.css
    model-browser.css
    organizer.css
    prompts.css
    research.css
    telemetry.css
    terminal-core.css
    terminal-persona.css
    terminal-preferences.css
    terminal-status.css
    terminal.css
    wiki-shell.css

  github-sync/
    github-sync.js
    index.html
    modules/
      activity-feed.js
      api.js
      dashboard.constants.js
      dashboard.js
      dashboard.remote-controller.js
      dashboard.remote-view.js
      dashboard.result-view.js
      dashboard.staging-controller.js
      dashboard.staging-view.js
      dashboard.utils.js
      staging.js


  index.html
  memory/
    index.html
    memory.js

  organizer/
    bootstrap.js
    index.html
    organizer.js
    organizer.missions.js
    organizer.prompts.js
    organizer.scheduler.js
    organizer.state.js
    organizer.utils.js

  prompts/
    actions.js
    api.js
    elements.js
    index.html
    prompts.js
    render.js
    state.js

  research/
    index.html
    render/
      memory.js
      reports.js
      stats.js
      status-progress.js
      suggestions.js
      summary.js
      thoughts.js

    research.github.js
    research.interactions.js
    research.js
    research.preferences.js
    research.prompts.js
    research.render.github.js
    research.render.js
    research.render.telemetry.js
    research.state.js
    research.telemetry.js
    research.utils.js
    research.ws.js

  research.js
  status/
    status.bootstrap.js
    status.client.js
    status.constants.js
    status.dom.js
    status.presence.js

  status.js
  style.css
  terminal/
    terminal.bootstrap.js
    terminal.chat.persona.js
    terminal.core.events.js
    terminal.core.handlers.js
    terminal.core.js
    terminal.core.output.js
    terminal.memory.telemetry.js
    terminal.model.browser.js
    terminal.preferences.js
    terminal.prompts.js
    terminal.research.handlers.js
    terminal.research.render.js
    terminal.research.state.js

  terminal.js
  theme-preload.js
  theme-toggle.js
  ui/
    ansi-map.json
    index.html
    ladle-screens/

    node_modules/
      .vite/
        deps/
          @ladle_react-context.js
          @ladle_react-context.js.map
          @ladle_react.js
          @ladle_react.js.map
          @mdx-js_react.js
          @mdx-js_react.js.map
          _metadata.json
          chunk-7DVDPDKJ.js
          chunk-7DVDPDKJ.js.map
          chunk-BFKM6BAR.js
          chunk-BFKM6BAR.js.map
          chunk-FEAW5Q5V.js
          chunk-FEAW5Q5V.js.map
          chunk-G3PMV62Z.js
          chunk-G3PMV62Z.js.map
          chunk-IUPVGT5T.js
          chunk-IUPVGT5T.js.map
          chunk-P2VVPHDX.js
          chunk-P2VVPHDX.js.map
          classnames.js
          classnames.js.map
          debug.js
          debug.js.map
          history.js
          history.js.map
          lodash__merge.js
          lodash__merge.js.map
          package.json
          prism-react-renderer.js
          prism-react-renderer.js.map
          query-string.js
          query-string.js.map
          react-dom.js
          react-dom.js.map
          react-dom_client.js
          react-dom_client.js.map
          react-hotkeys-hook.js
          react-hotkeys-hook.js.map
          react-inspector.js
          react-inspector.js.map
          react.js
          react.js.map
          react_jsx-dev-runtime.js
          react_jsx-dev-runtime.js.map
          react_jsx-runtime.js
          react_jsx-runtime.js.map

        vitest/
          da39a3ee5e6b4b0d3255bfef95601890afd80709/
            results.json




    screenshots/

    src/
      App.new.tsx
      App.theme-command.test.tsx
      App.tsx
      components/
        ChatTranscript.test.tsx
        ChatTranscript.tsx
        CommandPalette.test.tsx
        CommandPalette.tsx
        LogsViewer.test.tsx
        LogsViewer.tsx
        MemoryTimeline.test.tsx
        MemoryTimeline.tsx
        MissionControlCard.tsx
        ModalManager.tsx
        ModelBrowser.test.tsx
        ModelBrowser.tsx
        PromptModal.test.tsx
        PromptModal.tsx
        ResearchTelemetryCard.test.tsx
        ResearchTelemetryCard.tsx
        SettingsDrawer.test.tsx
        SettingsDrawer.tsx
        TerminalShell.hacker.test.tsx
        TerminalShell.test.tsx
        TerminalShell.tsx
        ToolDockCard.tsx
        common/
          Modal.css
          Modal.tsx

        layout/
          CommandSurface.tsx
          Dashboard.css
          Dashboard.tsx
          InsightDeck.tsx
          ShellHeader.tsx
          ShellLayout.tsx
          ShellSidebar.tsx
          Sidebar.css
          Sidebar.tsx
          SidebarNavigation.tsx

        modals/
          SettingsModal.css
          SettingsModal.tsx

        primitives/
          Button.css
          Button.tsx
          Card.css
          Card.test.tsx
          Card.tsx
          Input.css
          Input.tsx
          ProgressRing.tsx
          Select.css
          Select.tsx
          Textarea.css
          Textarea.tsx
          Window.test.tsx
          Window.tsx
          index.ts


      controllers/
        runConfigSetThemeCommand.ts

      data/
        commandMetadata.ts
        modelCatalog.ts

      hooks/
        useCommandSections.ts
        useGlobalShortcuts.test.tsx
        useGlobalShortcuts.ts

      main.tsx
      stores/
        commandPaletteStore.test.ts
        commandPaletteStore.ts
        interfaceStore.test.ts
        interfaceStore.ts
        logsViewerStore.test.ts
        logsViewerStore.ts
        memoryTimelineStore.test.ts
        memoryTimelineStore.ts
        modelBrowserStore.test.ts
        modelBrowserStore.ts
        promptModalStore.test.ts
        promptModalStore.ts
        researchTelemetryStore.test.ts
        researchTelemetryStore.ts
        terminalStore.test.ts
        terminalStore.ts
        useModalStore.ts

      styles/
        chat-theme.css
        dashboard-app.css
        foundations.css
        hacker-theme.css
        root.css
        shell-layout.css
        themes.css

      theme/
        ThemeProvider.test.tsx
        ThemeProvider.tsx
        constants.ts
        themeOverrides.ts

      types/
        react-window.d.ts

      utils/
        time.ts


    stories/
      Primitives.stories.tsx

    token-normalizer.mjs
    tokens.css
    tokens.json
    tsconfig.json
    vitest.setup.ts

  webcomm.js

start.mjs
tests/
  brave-provider.test.mjs
  brave-search-provider.test.mjs
  chat.test.mjs
  fix-validation-issues.mjs
  github-sync.test.mjs
  helpers/
    validation-env.mjs
    validation-smoke-tests.mjs

  output-manager.test.mjs
  provider.test.mjs
  rate-limiter.test.mjs
  research-engine.test.mjs
  research-markdown.test.mjs
  research-override-runner.test.mjs
  research-pipeline.test.mjs
  research.test.mjs
  system-validation.mjs
  test-setup.mjs
  token-classifier.test.mjs

utils/
  api-keys.mjs
  cli-args-parser.mjs
  cli-error-handler.mjs
  cli-metadata-extractor.mjs
  cli-runner.mjs
  github.utils.mjs
  log-channel.mjs
  logger.mjs
  object.freeze.mjs
  rate-limiter.mjs
  research.clean-query.mjs
  research.ensure-dir.mjs
  research.file-utils.mjs
  research.memory-intelligence.mjs
  research.object-utils.mjs
  research.output-manager.mjs
  research.prompt.mjs
  research.rate-limiter.mjs
  token-classifier.mjs
  websocket.utils.mjs


```