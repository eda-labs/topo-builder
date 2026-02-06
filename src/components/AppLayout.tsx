import { useState, useMemo, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Snackbar,
  Link,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  PlayArrow as ValidateIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Terminal as TerminalIcon,
  PhotoCameraOutlined as PhotoCameraIcon,
  Info,
} from '@mui/icons-material';
import { toSvg } from 'html-to-image';
import { getNodesBounds } from '@xyflow/react';

import { useTopologyStore } from '../lib/store';
import { exportToYaml, normalizeNodeCoordinates, downloadYaml } from '../lib/yaml-converter';
import { validateNetworkTopology } from '../lib/validate';
import type { ValidationResult } from '../types/ui';
import { TITLE, ERROR_DISPLAY_DURATION_MS } from '../lib/constants';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const darkMode = useTopologyStore(state => state.darkMode);
  const setDarkMode = useTopologyStore(state => state.setDarkMode);

  const theme = useMemo(() => createTheme({
    cssVariables: true,
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: '#7d33f2', light: '#9a5ff5', dark: '#5c1fd4' },
      card: {
        bg: darkMode ? '#262626' : '#f5f5f5',
        border: darkMode ? '#424242' : '#e0e0e0',
      },
    },
    typography: {
      fontFamily: '"NokiaPureText", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          outlined: {
            backgroundColor: 'var(--mui-palette-card-bg)',
            borderColor: 'var(--mui-palette-card-border)',
          },
        },
      },
    },
  }), [darkMode]);

  const topologyName = useTopologyStore(state => state.topologyName);
  const namespace = useTopologyStore(state => state.namespace);
  const operation = useTopologyStore(state => state.operation);
  const nodes = useTopologyStore(state => state.nodes);
  const edges = useTopologyStore(state => state.edges);
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const simulation = useTopologyStore(state => state.simulation);
  const error = useTopologyStore(state => state.error);
  const setError = useTopologyStore(state => state.setError);

  const [copied, setCopied] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [displayedError, setDisplayedError] = useState<string | null>(null);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);

  useEffect(() => {
    if (error) {
      setDisplayedError(error);
    }
  }, [error]);

  const getExportYaml = () => exportToYaml({
    topologyName: `${topologyName}-${Date.now()}`,
    namespace, operation, nodes: normalizeNodeCoordinates(nodes), edges, nodeTemplates, linkTemplates, simulation,
  });

  const handleDownload = () => {
    const yaml = getExportYaml();
    downloadYaml(yaml, `${topologyName}-${Date.now()}.yaml`);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getExportYaml());
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  };

  const handleCopyKubectl = async () => {
    await navigator.clipboard.writeText(`kubectl apply -f - <<'EOF'\n${getExportYaml()}\nEOF`);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  };

  const handleValidate = () => {
    const yaml = exportToYaml({ topologyName, namespace, operation, nodes, edges, nodeTemplates, linkTemplates, simulation });
    setValidationResult(validateNetworkTopology(yaml));
    setValidationDialogOpen(true);
  };

  const handleExportSvg = async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) {
      setError('Could not find canvas');
      return;
    }

    const padding = 100;
    const nodesBounds = getNodesBounds(nodes);
    const imageWidth = Math.max(nodesBounds.width + padding * 2, 400);
    const imageHeight = Math.max(nodesBounds.height + padding * 2, 400);

    try {
      const dataUrl = await toSvg(viewport, {
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${-nodesBounds.x + padding}px, ${-nodesBounds.y + padding}px) scale(1)`,
        },
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${topologyName}-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError('Failed to export SVG');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" elevation={1} sx={{ bgcolor: 'var(--color-primary)' }}>
          <Toolbar variant="dense">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
              <img src="/eda.svg" alt="EDA" style={{ height: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 200, color: 'white' }}>
                {TITLE}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Validate against schema">
                <IconButton size="small" onClick={handleValidate} sx={{ color: 'white' }}>
                  <ValidateIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={copied ? 'Copied!' : 'Copy YAML'}>
                <IconButton size="small" onClick={() => { void handleCopy(); }} sx={{ color: 'white' }}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy as kubectl apply">
                <IconButton size="small" onClick={() => { void handleCopyKubectl(); }} sx={{ color: 'white' }}>
                  <TerminalIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download YAML">
                <IconButton size="small" onClick={handleDownload} sx={{ color: 'white' }}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save as SVG">
                <IconButton size="small" onClick={() => { void handleExportSvg(); }} sx={{ color: 'white' }}>
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={darkMode ? 'Light mode' : 'Dark mode'}>
                <IconButton size="small" onClick={() => { setDarkMode(!darkMode); }} sx={{ color: 'white' }}>
                  {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="About">
                <IconButton size="small" onClick={() => { setAboutDialogOpen(true); }} sx={{ color: 'white' }}>
                  <Info fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {children}

        <Dialog open={validationDialogOpen} onClose={() => { setValidationDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {validationResult?.valid ? <SuccessIcon color="success" /> : <ErrorIcon color="error" />}
            {validationResult?.valid ? 'Validation Passed' : 'Validation Failed'}
          </DialogTitle>
          <DialogContent>
            {validationResult?.valid ? (
              <Alert severity="success">The topology is valid according to the NetworkTopology schema.</Alert>
            ) : (
              <>
                <Alert severity="error" sx={{ mb: 2 }}>Found {validationResult?.errors.length} validation error(s)</Alert>
                <List dense>
                  {validationResult?.errors.map((err, i) => (
                    <ListItem key={i} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={err.message}
                        secondary={err.path || 'root'}
                        slotProps={{
                          primary: { variant: 'body2' },
                          secondary: { variant: 'caption', sx: { fontFamily: 'monospace' } },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setValidationDialogOpen(false); }}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={aboutDialogOpen} onClose={() => { setAboutDialogOpen(false); }} maxWidth="xs" fullWidth>
          <DialogTitle>{TITLE} <Typography component="span" variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>({__COMMIT_SHA__})</Typography></DialogTitle>
          <DialogContent sx={{ pb: 0 }}>
            <Container sx={{ textAlign: 'center' }}>
              <Typography variant="body1">
                Topology Builder UI for the <Link href="https://eda.dev" target="_blank" rel="noopener">Nokia EDA</Link> platform allows users to create the input YAML for the topology workflow in a graphical way.
              </Typography>
              <br/>
              <Typography variant="caption">
                Created by <Link target="_blank" href="https://www.linkedin.com/in/kaelem-chandra/">Kaelem Chandra</Link> and <Link target="_blank" href="https://www.linkedin.com/in/rdodin/">Roman Dodin</Link>
              </Typography>
              <br/>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, my: 1 }}>
                <IconButton href="https://github.com/eda-labs/topo-builder" target="_blank" size="small">
                  <svg width="20" height="20" fill={theme.palette.text.primary} viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.545 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z"></path>
                  </svg>
                </IconButton>
                <IconButton href="https://eda.dev/discord" target="_blank" size="small">
                  <svg width="20" height="20" fill={theme.palette.text.primary} viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.942 5.556a16.3 16.3 0 0 0-4.126-1.3 12.04 12.04 0 0 0-.529 1.1 15.175 15.175 0 0 0-4.573 0 11.586 11.586 0 0 0-.535-1.1 16.274 16.274 0 0 0-4.129 1.3 17.392 17.392 0 0 0-2.868 11.662 15.785 15.785 0 0 0 4.963 2.521c.41-.564.773-1.16 1.084-1.785a10.638 10.638 0 0 1-1.706-.83c.143-.106.283-.217.418-.331a11.664 11.664 0 0 0 10.118 0c.137.114.277.225.418.331-.544.328-1.116.606-1.71.832a12.58 12.58 0 0 0 1.084 1.785 16.46 16.46 0 0 0 5.064-2.595 17.286 17.286 0 0 0-2.973-11.59ZM8.678 14.813a1.94 1.94 0 0 1-1.8-2.045 1.93 1.93 0 0 1 1.8-2.047 1.918 1.918 0 0 1 1.8 2.047 1.929 1.929 0 0 1-1.8 2.045Zm6.644 0a1.94 1.94 0 0 1-1.8-2.045 1.93 1.93 0 0 1 1.8-2.047 1.919 1.919 0 0 1 1.8 2.047 1.93 1.93 0 0 1-1.8 2.045Z"></path>
                  </svg>
                </IconButton>
              </Box>
              <Typography variant="caption" color="textSecondary">
                This is not an official Nokia product.
              </Typography>
            </Container>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setAboutDialogOpen(false); }}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!error}
          autoHideDuration={ERROR_DISPLAY_DURATION_MS}
          onClose={(_, reason) => { if (reason !== 'clickaway') setError(null); }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => { setError(null); }} severity="error" variant="filled">{displayedError}</Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
