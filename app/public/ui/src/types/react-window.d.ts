/**
 * Minimal type shims for react-window to satisfy the Bundler module resolution configuration until upstream typings load correctly.
 */

declare module 'react-window' {
  import type { CSSProperties, ComponentType, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

  export interface ListChildComponentProps<T = any> {
    index: number;
    style: CSSProperties;
    data: T;
  }

  export interface ListOnItemsRenderedProps {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
  }

  export interface FixedSizeListProps<T = any> {
    height: number;
    itemCount: number;
    itemSize: number;
    width: number | string;
    onItemsRendered?: (props: ListOnItemsRenderedProps) => void;
    itemKey?: (index: number, data: T) => string | number;
    children: ComponentType<ListChildComponentProps<T>>;
  }

  export interface FixedSizeListHandle {
    scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
  }

  export const FixedSizeList: ForwardRefExoticComponent<FixedSizeListProps<any> & RefAttributes<FixedSizeListHandle>>;
}
