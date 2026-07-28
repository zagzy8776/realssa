import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'api-sports-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        'data-type'?: string;
        'data-key'?: string;
        'data-sport'?: string;
        'data-url-football'?: string;
        'data-lang'?: string;
        'data-theme'?: string;
        'data-show-errors'?: string | boolean;
        'data-target-game'?: string;
        'data-target-standings'?: string;
        'data-target-team'?: string;
        'data-target-player'?: string;
        'data-league'?: string | number;
        'data-season'?: string | number;
        'data-game-id'?: string | number;
        'data-team-id'?: string | number;
        'data-h2h'?: string;
        'data-refresh'?: string | number | boolean;
        'data-tab'?: string;
        'data-games-style'?: string | number;
        'data-show-toolbar'?: string | boolean;
      }, HTMLElement>;
    }
  }
}
