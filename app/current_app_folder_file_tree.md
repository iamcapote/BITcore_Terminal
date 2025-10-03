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
  diagnose.cli.mjs
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
    keys.mjs
    memory-context.mjs
    query-classifier.mjs

  research-github.cli.mjs
  research-scheduler.cli.mjs
  research.cli.mjs
  research.command.mjs
  research.github-sync.cli.mjs
  research.mjs
  status.cli.mjs
  terminal.cli.mjs
  users.cli.mjs

config/
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
      session-registry.mjs


  status/
    index.mjs
    routes.mjs
    status.controller.mjs
    status.service.mjs


filetree.mjs
infrastructure/
  ai/
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
    memory.store.mjs
    memory.validators.mjs

  missions/
    github-sync.mjs

  research/
    github-sync.mjs
    research.engine.mjs
    research.markdown.mjs
    research.override-runner.mjs
    research.path.mjs

  search/
    search.mjs
    search.providers.mjs


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
  cli-runner.mjs
  github.utils.mjs
  log-channel.mjs
  logger.mjs
  object.freeze.mjs
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