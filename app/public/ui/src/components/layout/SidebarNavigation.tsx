/**
 * Why: Surface CLI command coverage in the sidebar so operators discover capabilities without leaving the shell.
 * What: Groups command metadata into labeled sections, exposing quick-run buttons and palette shortcuts per category.
 * How: Receives pre-grouped sections, renders them with minimal styling hooks, and delegates execution to caller callbacks.
 */

import type { CommandMetadata } from '../../data/commandMetadata';

export interface SidebarCommandSection {
  id: string;
  title: string;
  description?: string;
  commands: CommandMetadata[];
  searchQuery?: string;
}

export interface SidebarNavigationProps {
  sections: SidebarCommandSection[];
  onRunCommand: (command: CommandMetadata) => void;
  onOpenPaletteWithQuery: (query: string) => void;
}

export function SidebarNavigation({ sections, onRunCommand, onOpenPaletteWithQuery }: SidebarNavigationProps): JSX.Element {
  return (
    <nav className="sidebar-navigation" aria-label="Command navigation">
      {sections.map((section) => (
        <section key={section.id} className="sidebar-navigation__section">
          <header className="sidebar-navigation__section-header">
            <div>
              <h2 className="sidebar-navigation__section-title">{section.title}</h2>
              {section.description ? <p className="sidebar-navigation__section-description">{section.description}</p> : null}
            </div>
            {section.searchQuery ? (
              <button
                type="button"
                className="sidebar-navigation__section-action"
                onClick={() => onOpenPaletteWithQuery(section.searchQuery as string)}
              >
                Search {section.title}
              </button>
            ) : null}
          </header>
          <ul className="sidebar-navigation__list">
            {section.commands.map((command) => (
              <li key={command.id} className="sidebar-navigation__item">
                <button
                  type="button"
                  className="sidebar-navigation__command"
                  onClick={() => onRunCommand(command)}
                >
                  <div className="sidebar-navigation__command-header">
                    <span className="sidebar-navigation__command-name">{command.name}</span>
                    {command.shortcut ? (
                      <span className="sidebar-navigation__command-shortcut" aria-label={`Shortcut ${command.shortcut}`}>
                        {command.shortcut}
                      </span>
                    ) : null}
                  </div>
                  <span className="sidebar-navigation__command-description">{command.description}</span>
                  <div className="sidebar-navigation__command-footer">
                    <span className="sidebar-navigation__command-usage" aria-label={`Usage ${command.usage}`}>
                      {command.usage}
                    </span>
                    {command.aliases?.length ? (
                      <span className="sidebar-navigation__command-aliases" aria-label={`Aliases ${command.aliases.join(', ')}`}>
                        {command.aliases.map((alias) => (
                          <span key={alias} className="sidebar-navigation__command-alias">
                            {alias}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export default SidebarNavigation;
