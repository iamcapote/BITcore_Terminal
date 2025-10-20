/* @vitest-environment jsdom */
/**
 * Why: Verify the model browser renders filters, sorting, and detail drawer interactions.
 * What: Interacts with filter chips, column headers, and rows to confirm state transitions surface in the UI.
 * How: Uses Testing Library to render the component and fire synthetic clicks while inspecting visible text.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ModelBrowser } from './ModelBrowser';
import { ThemeProvider } from '../theme/ThemeProvider';
import { getSelectedModel, useModelBrowserStore } from '../stores/modelBrowserStore';

afterEach(() => {
  act(() => {
    useModelBrowserStore.setState({
      providerFilters: new Set(),
      capabilityFilters: new Set(),
      sortKey: 'latency',
      sortDirection: 'asc',
      selectedModelId: null
    });
  });
});

function renderWithTheme(ui: JSX.Element) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ModelBrowser', () => {
  it('renders catalog rows and detail drawer for first selection', async () => {
    renderWithTheme(<ModelBrowser />);

    expect(screen.getByText('Model Browser')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Venice/ })).toBeTruthy();

    const rows = screen.getAllByTestId('model-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.textContent?.includes('Groq Mixtral 8x7B'))).toBe(true);

  const detailHeading = await screen.findByRole('heading', { level: 4 });
  const currentSelection = getSelectedModel();
  expect(currentSelection).toBeTruthy();
  expect(detailHeading.textContent).toContain(currentSelection!.name);
  expect(detailHeading.parentElement?.textContent).toContain(currentSelection!.provider);
  });

  it('filters by provider and capability', () => {
    renderWithTheme(<ModelBrowser />);

    fireEvent.click(screen.getByRole('button', { name: 'Venice' }));
    fireEvent.click(screen.getByRole('button', { name: 'vision' }));

    const rows = screen.getAllByTestId('model-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Venice Vision 128k');
  });

  it('sorts by context and toggles direction', () => {
    renderWithTheme(<ModelBrowser />);

    const contextHeader = screen.getByRole('button', { name: /Context/ });
    fireEvent.click(contextHeader);
    let rows = screen.getAllByTestId('model-row');
    expect(rows[0].textContent).toContain('32,000');

    fireEvent.click(contextHeader);
    rows = screen.getAllByTestId('model-row');
    expect(rows[0].textContent).toContain('1,000,000');
  });

  it('selects a row and updates drawer', () => {
    renderWithTheme(<ModelBrowser />);

    const groqRow = screen.getAllByTestId('model-row').find((row) => row.textContent?.includes('Groq Mixtral 8x7B'));
    expect(groqRow).toBeTruthy();
    fireEvent.click(groqRow!);

    expect(screen.getByText('Groq-accelerated Mixtral targeting ultra-low latency command execution and tool routing.')).toBeTruthy();
  });
});
