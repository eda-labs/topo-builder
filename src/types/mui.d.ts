import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    card: {
      bg: string;
      border: string;
    };
  }
  interface PaletteOptions {
    card?: {
      bg?: string;
      border?: string;
    };
  }
}
