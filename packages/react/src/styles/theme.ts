/**
 * @x402/react - Theme Configuration
 * CSS-in-JS theme with no external dependencies
 */

export interface X402Theme {
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    primary: string;
    primaryHover: string;
    border: string;
    error: string;
    success: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  fontSizes: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

/**
 * Default light theme
 */
export const defaultTheme: X402Theme = {
  colors: {
    background: 'rgba(255, 255, 255, 0.95)',
    surface: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#666666',
    primary: '#0052FF', // Coinbase blue
    primaryHover: '#0043CC',
    border: '#e5e7eb',
    error: '#dc2626',
    success: '#16a34a',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '24px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
};

/**
 * Dark theme
 */
export const darkTheme: X402Theme = {
  colors: {
    background: 'rgba(17, 17, 17, 0.95)',
    surface: '#1a1a1a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    border: '#333333',
    error: '#ef4444',
    success: '#22c55e',
  },
  borderRadius: defaultTheme.borderRadius,
  spacing: defaultTheme.spacing,
  fontSizes: defaultTheme.fontSizes,
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
  },
};

/**
 * Create inline styles from theme values
 */
export function createStyles(theme: X402Theme) {
  return {
    overlay: {
      position: 'absolute' as const,
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(8px)',
      backgroundColor: theme.colors.background,
      zIndex: 10,
    },

    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      boxShadow: theme.shadows.lg,
      padding: theme.spacing.lg,
      maxWidth: '400px',
      width: '90%',
      textAlign: 'center' as const,
      border: `1px solid ${theme.colors.border}`,
    },

    lockIcon: {
      fontSize: '48px',
      marginBottom: theme.spacing.md,
    },

    title: {
      fontSize: theme.fontSizes.lg,
      fontWeight: 600,
      color: theme.colors.text,
      margin: `0 0 ${theme.spacing.sm} 0`,
    },

    description: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textSecondary,
      margin: `0 0 ${theme.spacing.lg} 0`,
    },

    priceTag: {
      display: 'inline-block',
      backgroundColor: theme.colors.primary + '15',
      color: theme.colors.primary,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.fontSizes.md,
      fontWeight: 600,
      marginBottom: theme.spacing.lg,
    },

    button: {
      width: '100%',
      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      backgroundColor: theme.colors.primary,
      color: '#ffffff',
      border: 'none',
      borderRadius: theme.borderRadius.md,
      fontSize: theme.fontSizes.md,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.2s, transform 0.1s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },

    buttonHover: {
      backgroundColor: theme.colors.primaryHover,
    },

    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },

    connectButton: {
      width: '100%',
      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      backgroundColor: 'transparent',
      color: theme.colors.primary,
      border: `2px solid ${theme.colors.primary}`,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.fontSizes.md,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.2s, color 0.2s',
    },

    error: {
      color: theme.colors.error,
      fontSize: theme.fontSizes.sm,
      marginTop: theme.spacing.md,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.error + '15',
      borderRadius: theme.borderRadius.sm,
    },

    footer: {
      marginTop: theme.spacing.lg,
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textSecondary,
    },

    link: {
      color: theme.colors.primary,
      textDecoration: 'none',
    },

    spinner: {
      width: '20px',
      height: '20px',
      border: '2px solid transparent',
      borderTopColor: 'currentColor',
      borderRadius: '50%',
      animation: 'x402-spin 0.8s linear infinite',
    },

    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing.xs,
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      backgroundColor: theme.colors.success + '15',
      color: theme.colors.success,
      borderRadius: theme.borderRadius.sm,
      fontSize: theme.fontSizes.xs,
      fontWeight: 500,
    },
  };
}

/**
 * CSS keyframes for spinner animation (inject once)
 */
export const keyframesCSS = `
@keyframes x402-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

/**
 * Inject keyframes into document head
 */
export function injectKeyframes(): void {
  if (typeof document === 'undefined') return;

  const styleId = 'x402-keyframes';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = keyframesCSS;
  document.head.appendChild(style);
}
